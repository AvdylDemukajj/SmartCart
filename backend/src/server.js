import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { createHash } from 'node:crypto';
import { URL } from 'node:url';
import { SmartCartStore } from './store.js';
import { FixedWindowRateLimiter, resolveUserId } from './security.js';
import { InMemoryTelemetry } from './telemetry.js';
import { createCacheFromEnv } from './cache.js';
import { addItemSchema, addMemberSchema, addPantrySchema, addReceiptSchema, correctOcrSchema, createHouseholdSchema, enqueueOcrSchema, parseBody, pricingStagingSchema, setBudgetSchema, toggleItemSchema, uploadUrlSchema } from './validation.js';

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => {
      if (!data) return resolve({});
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(new Error('INVALID_JSON'));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload, requestId) {
  res.writeHead(status, {
    'content-type': 'application/json',
    'x-request-id': requestId,
  });
  res.end(JSON.stringify(payload));
}

function setupSseHeaders(res, requestId) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'x-request-id': requestId,
  });
  res.write(': connected\n\n');
}

function writeSseEvent(res, event) {
  res.write('event: activity\n');
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}


function websocketAcceptKey(secWebSocketKey) {
  return createHash('sha1').update(`${secWebSocketKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`).digest('base64');
}

function encodeWsTextFrame(text) {
  const payload = Buffer.from(text, 'utf8');
  const length = payload.length;
  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), payload]);
  }
  if (length < 65536) {
    const header = Buffer.from([0x81, 126, (length >> 8) & 0xff, length & 0xff]);
    return Buffer.concat([header, payload]);
  }
  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, payload]);
}


function parseRefreshFlag(url) {
  const value = url.searchParams.get('refresh');
  if (value === null) return false;
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  throw new Error('VALIDATION_QUERY_REFRESH');
}

function parsePositiveIntQuery(value, fallback) {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error('VALIDATION_QUERY_LIMIT');
  return parsed;
}

function canAccessAuditLog(req, userId) {
  const adminUser = process.env.SECURITY_AUDIT_ADMIN_USER_ID ?? 'admin';
  if (userId === adminUser) return true;
  const configuredKey = process.env.SECURITY_AUDIT_ADMIN_KEY;
  if (!configuredKey) return false;
  const key = req.headers['x-admin-key'];
  return typeof key === 'string' && key === configuredKey;
}

function logRequest({ requestId, method, path, userId, status, error }) {
  const log = {
    requestId,
    method,
    path,
    userId,
    status,
    error: error ?? null,
    ts: new Date().toISOString(),
  };
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(log));
}

export function createApp(config = {}) {
  const store = new SmartCartStore({ cache: config.cache ?? null });
  const globalLimiter = new FixedWindowRateLimiter({
    limit: config.globalRateLimit ?? 120,
    windowMs: config.globalRateWindowMs ?? 60_000,
  });
  const aiLimiter = new FixedWindowRateLimiter({
    limit: config.aiRateLimit ?? 10,
    windowMs: config.aiRateWindowMs ?? 60_000,
  });
  const telemetry = new InMemoryTelemetry();

  const server = http.createServer(async (req, res) => {
    const requestId = randomUUID();
    const method = req.method || 'GET';
    const url = new URL(req.url || '/', 'http://localhost');
    let userId = null;
    const requestStartNs = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - requestStartNs) / 1e6;
      telemetry.record({ path: url.pathname, status: res.statusCode, durationMs });
    });

    try {
      if (url.pathname === '/health' && method === 'GET') {
        const payload = {
          ok: true,
          service: 'smartcart-backend',
          modules: ['households', 'lists', 'pricing', 'receipts', 'budget', 'pantry', 'recipes', 'realtime', 'ocr', 'observability'],
        };
        logRequest({ requestId, method, path: url.pathname, userId: null, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (url.pathname === '/metrics' && method === 'GET') {
        const payload = telemetry.snapshot({ queueDepth: store.getOcrQueueDepth() });
        logRequest({ requestId, method, path: url.pathname, userId: null, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'GET' && /^\/trace\/[^/]+$/.test(url.pathname)) {
        const traceRequestId = url.pathname.split('/')[2];
        userId = resolveUserId(req);
        if (!userId || !canAccessAuditLog(req, userId)) throw new Error('FORBIDDEN_AUDIT_ACCESS');
        const payload = store.getTraceReport({ requestId: traceRequestId });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      userId = resolveUserId(req);
      if (!userId) {
        logRequest({ requestId, method, path: url.pathname, userId: null, status: 401, error: 'UNAUTHORIZED' });
        return sendJson(res, 401, { error: 'Missing auth. Use x-user-id or Bearer dev-user:<id>' }, requestId);
      }

      const globalRate = globalLimiter.take(userId);
      if (!globalRate.allowed) throw new Error('RATE_LIMIT_GLOBAL');

      if (method === 'POST' && /^\/households\/[^/]+\/recipes\/suggest$/.test(url.pathname)) {
        const aiRate = aiLimiter.take(userId);
        if (!aiRate.allowed) throw new Error('RATE_LIMIT_AI');
      }

      if (url.pathname === '/households' && method === 'POST') {
        const body = parseBody(createHouseholdSchema, await readBody(req));
        const payload = store.createHousehold({ ownerId: userId, name: body.name, traceContext: { requestId } });
        logRequest({ requestId, method, path: url.pathname, userId, status: 201 });
        return sendJson(res, 201, payload, requestId);
      }

      if (url.pathname === '/households' && method === 'GET') {
        const payload = store.listHouseholdsForUser(userId);
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'POST' && /^\/households\/[^/]+\/members$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const body = parseBody(addMemberSchema, await readBody(req));
        const payload = store.addMember({ actorId: userId, householdId, memberId: body.memberId, traceContext: { requestId } });
        logRequest({ requestId, method, path: url.pathname, userId, status: 201 });
        return sendJson(res, 201, payload, requestId);
      }

      if (method === 'GET' && url.pathname === '/security/audit-log') {
        if (!canAccessAuditLog(req, userId)) throw new Error('FORBIDDEN_AUDIT_ACCESS');
        const payload = store.getSecurityAuditLog({ userId, limit: parsePositiveIntQuery(url.searchParams.get('limit'), 100) });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'GET' && /^\/households\/[^/]+\/items$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const payload = store.getItems({ userId, householdId });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'POST' && /^\/households\/[^/]+\/items$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const body = parseBody(addItemSchema, await readBody(req));
        const payload = store.addItem({ userId, householdId, name: body.name, quantity: body.quantity ?? 1, traceContext: { requestId } });
        logRequest({ requestId, method, path: url.pathname, userId, status: 201 });
        return sendJson(res, 201, payload, requestId);
      }

      if (method === 'PATCH' && /^\/households\/[^/]+\/items\/[^/]+$/.test(url.pathname)) {
        const [, , householdId, , itemId] = url.pathname.split('/');
        const body = parseBody(toggleItemSchema, await readBody(req));
        const payload = store.toggleItem({ userId, householdId, itemId, expectedVersion: body.expectedVersion, traceContext: { requestId } });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'GET' && /^\/households\/[^/]+\/activity$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const payload = store.getActivity({ userId, householdId });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'GET' && /^\/households\/[^/]+\/stream$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        store.assertMember(userId, householdId);
        setupSseHeaders(res, requestId);

        const unsubscribe = store.onHouseholdEvent(householdId, (event) => {
          writeSseEvent(res, event);
        });

        const keepAlive = setInterval(() => {
          res.write(': keepalive\n\n');
        }, 15000);

        req.on('close', () => {
          clearInterval(keepAlive);
          unsubscribe();
          res.end();
        });

        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return;
      }

      if (method === 'GET' && /^\/households\/[^/]+\/budget$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const payload = store.getBudget({ userId, householdId });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'PUT' && /^\/households\/[^/]+\/budget$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const body = parseBody(setBudgetSchema, await readBody(req));
        const payload = store.setBudgetLimit({ userId, householdId, limit: body.limit, traceContext: { requestId } });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }


      if (method === 'POST' && /^\/households\/[^/]+\/receipts\/upload-url$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const body = parseBody(uploadUrlSchema, await readBody(req));
        const payload = store.createReceiptUploadUrl({ userId, householdId, fileName: body.fileName, traceContext: { requestId } });
        logRequest({ requestId, method, path: url.pathname, userId, status: 201 });
        return sendJson(res, 201, payload, requestId);
      }

      if (method === 'POST' && /^\/households\/[^/]+\/receipts\/ocr-jobs$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const body = parseBody(enqueueOcrSchema, await readBody(req));
        const payload = store.enqueueReceiptOcrJob({ userId, householdId, objectKey: body.objectKey, apiRequestId: requestId, traceContext: { requestId } });
        logRequest({ requestId, method, path: url.pathname, userId, status: 202 });
        return sendJson(res, 202, payload, requestId);
      }

      if (method === 'GET' && /^\/households\/[^/]+\/receipts\/ocr-jobs$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const payload = store.listReceiptOcrJobs({ userId, householdId });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }


      if (method === 'POST' && /^\/households\/[^/]+\/receipts\/ocr-jobs\/[^/]+\/retry$/.test(url.pathname)) {
        const [, , householdId, , , jobId] = url.pathname.split('/');
        const payload = store.retryReceiptOcrJob({ userId, householdId, jobId, traceContext: { requestId } });
        logRequest({ requestId, method, path: url.pathname, userId, status: 202 });
        return sendJson(res, 202, payload, requestId);
      }

      if (method === 'PATCH' && /^\/households\/[^/]+\/receipts\/ocr-jobs\/[^/]+\/correct$/.test(url.pathname)) {
        const [, , householdId, , , jobId] = url.pathname.split('/');
        const body = parseBody(correctOcrSchema, await readBody(req));
        const payload = store.correctReceiptOcrJob({ userId, householdId, jobId, store: body.store, items: body.items, traceContext: { requestId } });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'POST' && /^\/households\/[^/]+\/receipts\/ocr-jobs\/[^/]+\/apply$/.test(url.pathname)) {
        const [, , householdId, , , jobId] = url.pathname.split('/');
        const payload = store.applyReceiptOcrJobResult({ userId, householdId, jobId, applyRequestId: requestId, traceContext: { requestId } });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'POST' && /^\/households\/[^/]+\/receipts$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const body = parseBody(addReceiptSchema, await readBody(req));
        const payload = store.addReceipt({ userId, householdId, store: body.store ?? 'unknown', items: body.items, traceContext: { requestId } });
        logRequest({ requestId, method, path: url.pathname, userId, status: 201 });
        return sendJson(res, 201, payload, requestId);
      }

      if (method === 'GET' && /^\/households\/[^/]+\/receipts$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const payload = store.listReceipts({ userId, householdId });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'GET' && /^\/households\/[^/]+\/pantry$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const payload = store.getPantry({ userId, householdId });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'POST' && /^\/households\/[^/]+\/pantry$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const body = parseBody(addPantrySchema, await readBody(req));
        const payload = store.addPantryItem({ userId, householdId, name: body.name, quantity: body.quantity ?? 1, traceContext: { requestId } });
        logRequest({ requestId, method, path: url.pathname, userId, status: 201 });
        return sendJson(res, 201, payload, requestId);
      }

      if (method === 'GET' && /^\/households\/[^/]+\/pricing\/estimate$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const refresh = parseRefreshFlag(url);
        const payload = await store.estimatePrices({ userId, householdId, refresh });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'GET' && /^\/households\/[^/]+\/flyers$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const payload = store.listFlyers({ userId, householdId });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }


      if (method === 'POST' && /^\/households\/[^/]+\/recipes\/[^/]+\/add-to-list$/.test(url.pathname)) {
        const [, , householdId, , recipeKey] = url.pathname.split('/');
        const payload = store.addRecipeIngredientsToList({ userId, householdId, recipeKey, traceContext: { requestId } });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'GET' && url.pathname === '/recipes/cache') {
        const payload = store.getRecipeCacheStatus();
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'POST' && /^\/households\/[^/]+\/recipes\/suggest$/.test(url.pathname)) {
        const householdId = url.pathname.split('/')[2];
        const refresh = parseRefreshFlag(url);
        const payload = await store.suggestRecipes({ userId, householdId, refresh });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }



      if (method === 'GET' && url.pathname === '/pricing/cache') {
        const payload = store.getPricingCacheStatus();
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'GET' && url.pathname === '/pricing/pipeline') {
        const payload = store.getPricingPipelineStatus();
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      if (method === 'POST' && url.pathname === '/pricing/staging') {
        const body = parseBody(pricingStagingSchema, await readBody(req));
        const payload = store.ingestStagingPrices({ actorId: userId, rows: body.rows, traceContext: { requestId } });
        logRequest({ requestId, method, path: url.pathname, userId, status: 201 });
        return sendJson(res, 201, { ingested: payload.length }, requestId);
      }

      if (method === 'POST' && url.pathname === '/pricing/promote') {
        const payload = store.promoteStagingPrices({ actorId: userId, traceContext: { requestId } });
        logRequest({ requestId, method, path: url.pathname, userId, status: 200 });
        return sendJson(res, 200, payload, requestId);
      }

      logRequest({ requestId, method, path: url.pathname, userId, status: 404, error: 'NOT_FOUND' });
      return sendJson(res, 404, { error: 'Not found' }, requestId);
    } catch (error) {
      const message = error?.message ?? 'UNKNOWN_ERROR';
      if (message === 'FORBIDDEN_HOUSEHOLD_ACCESS') {
        store.recordSecurityAudit({ event: 'forbidden_household_access', requestId, userId, path: url.pathname });
        logRequest({ requestId, method, path: url.pathname, userId, status: 403, error: message });
        return sendJson(res, 403, { error: 'Forbidden' }, requestId);
      }
      if (message === 'FORBIDDEN_AUDIT_ACCESS') {
        store.recordSecurityAudit({ event: 'forbidden_audit_access', requestId, userId, path: url.pathname });
        logRequest({ requestId, method, path: url.pathname, userId, status: 403, error: message });
        return sendJson(res, 403, { error: 'Forbidden' }, requestId);
      }
      if (message === 'AUTH_INVALID_TOKEN' || message === 'AUTH_EXPIRED_TOKEN') {
        store.recordSecurityAudit({ event: 'auth_invalid', requestId, userId, path: url.pathname, reason: message });
        logRequest({ requestId, method, path: url.pathname, userId, status: 401, error: message });
        return sendJson(res, 401, { error: 'Invalid authentication token' }, requestId);
      }
      if (message === 'RATE_LIMIT_GLOBAL') {
        store.recordSecurityAudit({ event: 'rate_limit_global', requestId, userId, path: url.pathname });
        logRequest({ requestId, method, path: url.pathname, userId, status: 429, error: message });
        return sendJson(res, 429, { error: 'Global rate limit exceeded' }, requestId);
      }
      if (message === 'RATE_LIMIT_AI') {
        store.recordSecurityAudit({ event: 'rate_limit_ai', requestId, userId, path: url.pathname });
        logRequest({ requestId, method, path: url.pathname, userId, status: 429, error: message });
        return sendJson(res, 429, { error: 'AI endpoint rate limit exceeded' }, requestId);
      }
      if (message === 'ITEM_NOT_FOUND') {
        logRequest({ requestId, method, path: url.pathname, userId, status: 404, error: message });
        return sendJson(res, 404, { error: 'Item not found' }, requestId);
      }
      if (message === 'AI_RATE_LIMIT') {
        logRequest({ requestId, method, path: url.pathname, userId, status: 429, error: message });
        return sendJson(res, 429, { error: 'Daily recipe limit reached for free tier' }, requestId);
      }
      if (message === 'VERSION_CONFLICT') {
        logRequest({ requestId, method, path: url.pathname, userId, status: 409, error: message });
        return sendJson(res, 409, { error: 'Version conflict on item update' }, requestId);
      }
      if (message === 'OCR_JOB_NOT_FOUND') {
        logRequest({ requestId, method, path: url.pathname, userId, status: 404, error: message });
        return sendJson(res, 404, { error: 'OCR job not found' }, requestId);
      }
      if (message === 'OCR_JOB_NOT_READY') {
        logRequest({ requestId, method, path: url.pathname, userId, status: 409, error: message });
        return sendJson(res, 409, { error: 'OCR job not ready' }, requestId);
      }
      if (message === 'OCR_JOB_RETRY_NOT_ALLOWED') {
        logRequest({ requestId, method, path: url.pathname, userId, status: 409, error: message });
        return sendJson(res, 409, { error: 'OCR job retry not allowed for current state' }, requestId);
      }
      if (message === 'OCR_JOB_CORRECTION_NOT_ALLOWED') {
        logRequest({ requestId, method, path: url.pathname, userId, status: 409, error: message });
        return sendJson(res, 409, { error: 'OCR job correction not allowed for current state' }, requestId);
      }
      if (message === 'RECIPE_NOT_FOUND') {
        logRequest({ requestId, method, path: url.pathname, userId, status: 404, error: message });
        return sendJson(res, 404, { error: 'Recipe not found' }, requestId);
      }
      if (message.startsWith('VALIDATION_')) {
        logRequest({ requestId, method, path: url.pathname, userId, status: 400, error: message });
        return sendJson(res, 400, { error: message }, requestId);
      }
      if (message === 'INVALID_JSON') {
        logRequest({ requestId, method, path: url.pathname, userId, status: 400, error: message });
        return sendJson(res, 400, { error: 'Invalid JSON' }, requestId);
      }
      logRequest({ requestId, method, path: url.pathname, userId, status: 500, error: message });
      return sendJson(res, 500, { error: 'Internal server error' }, requestId);
    }
  });

  const wsConnections = new Map();

  server.on('upgrade', (req, socket) => {
    try {
      const url = new URL(req.url || '/', 'http://localhost');
      if (!/^\/ws\/households\/[^/]+$/.test(url.pathname)) {
        socket.destroy();
        return;
      }
      const householdId = url.pathname.split('/')[3];
      const userId = resolveUserId(req);
      if (!userId) {
        socket.destroy();
        return;
      }
      store.assertMember(userId, householdId);

      const wsKey = req.headers['sec-websocket-key'];
      if (typeof wsKey !== 'string') {
        socket.destroy();
        return;
      }

      const accept = websocketAcceptKey(wsKey);
      socket.write(
        'HTTP/1.1 101 Switching Protocols\r\n' +
          'Upgrade: websocket\r\n' +
          'Connection: Upgrade\r\n' +
          `Sec-WebSocket-Accept: ${accept}\r\n\r\n`,
      );

      const unsubscribe = store.onHouseholdEvent(householdId, (event) => {
        if (!socket.destroyed) socket.write(encodeWsTextFrame(JSON.stringify({ type: 'activity', event })));
      });

      wsConnections.set(socket, unsubscribe);
      const cleanup = () => {
        const fn = wsConnections.get(socket);
        if (fn) fn();
        wsConnections.delete(socket);
      };
      socket.on('close', cleanup);
      socket.on('end', cleanup);
      socket.on('error', cleanup);
    } catch {
      socket.destroy();
    }
  });




  return server;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const port = Number(process.env.PORT || 4000);
  createCacheFromEnv().then((cache) => {
    createApp({ cache }).listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`SmartCart backend listening on ${port}`);
    });
  });
}

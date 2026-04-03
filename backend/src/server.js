import { randomUUID } from 'node:crypto';
import http from 'node:http';
import { URL } from 'node:url';
import { SmartCartStore } from './store.js';
import { DistributedTokenBucketRateLimiter, FixedWindowRateLimiter, resolveAuthContext } from './security.js';
import { InMemoryTelemetry } from './telemetry.js';
import { createCacheFromEnv } from './cache.js';
import { readPositiveIntEnv } from './core/env.js';
import { resolveHttpError } from './core/error-catalog.js';
import { canAccessAuditLog } from './modules/admin/access.js';
import { handleSystemAndAdminRoutes } from './http/system-admin-routes.js';
import { handleHouseholdRoutes } from './http/household-routes.js';
import { handleGlobalRoutes } from './http/global-routes.js';
import { handleWebsocketUpgrade } from './http/websocket-upgrade.js';

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    const maxBodyBytes = readPositiveIntEnv('MAX_REQUEST_BODY_BYTES', 1024 * 1024);
    let receivedBytes = 0;
    let tooLarge = false;
    const contentLength = Number(req.headers['content-length']);
    if (Number.isFinite(contentLength) && contentLength > maxBodyBytes) {
      reject(new Error('REQUEST_BODY_TOO_LARGE'));
      return;
    }
    req.on('data', (chunk) => {
      if (tooLarge) return;
      receivedBytes += chunk.length;
      if (receivedBytes > maxBodyBytes) {
        tooLarge = true;
        return;
      }
      data += chunk;
    });
    req.on('end', () => {
      if (tooLarge) {
        reject(new Error('REQUEST_BODY_TOO_LARGE'));
        return;
      }
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
    'x-trace-id': res.getHeader('x-trace-id') || requestId,
  });
  res.end(JSON.stringify(payload));
}

function sendError(res, { status, code, message }, requestId) {
  return sendJson(
    res,
    status,
    {
      error: message,
      errorCode: code,
      requestId,
    },
    requestId,
  );
}

function setupSseHeaders(res, requestId) {
  res.writeHead(200, {
    'content-type': 'text/event-stream',
    'cache-control': 'no-cache',
    connection: 'keep-alive',
    'x-request-id': requestId,
    'x-trace-id': res.getHeader('x-trace-id') || requestId,
  });
  res.write(': connected\n\n');
}

function writeSseEvent(res, event) {
  res.write('event: activity\n');
  res.write(`data: ${JSON.stringify(event)}\n\n`);
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


function createRateLimiter({ cache, distributedPrefix, fixedLimit, fixedWindowMs, tokenBucketCapacity, tokenBucketRefillPerSec }) {
  const useDistributed = process.env.ENABLE_DISTRIBUTED_RATE_LIMITER !== 'false' && cache && typeof cache.getJson === 'function' && typeof cache.setJson === 'function';
  if (!useDistributed) {
    const fixedLimiter = new FixedWindowRateLimiter({ limit: fixedLimit, windowMs: fixedWindowMs });
    return {
      take: async (key) => fixedLimiter.take(key),
    };
  }

  const distributedLimiter = new DistributedTokenBucketRateLimiter({
    cache,
    prefix: distributedPrefix,
    capacity: tokenBucketCapacity,
    refillRatePerSec: tokenBucketRefillPerSec,
  });
  return {
    take: async (key) => distributedLimiter.take(key),
  };
}

export function assertProductionSecurityPolicies() {
  if (process.env.NODE_ENV !== 'production') return;
  if (!process.env.AUDIT_LOG_INTEGRITY_SALT || !process.env.AUDIT_LOG_INTEGRITY_SALT.trim()) {
    throw new Error('AUDIT_LOG_INTEGRITY_SALT_REQUIRED');
  }
}

export function createApp(config = {}) {
  assertProductionSecurityPolicies();
  const coreRepository = config.coreRepository ?? null;
  const persistentStoreRequired = config.requirePersistentStore
    ?? (process.env.NODE_ENV === 'production' && process.env.ALLOW_INMEMORY_FALLBACK !== '1');
  if (persistentStoreRequired && !coreRepository) throw new Error('PERSISTENT_STORE_REQUIRED');
  const sharedCache = config.cache ?? null;
  const store = new SmartCartStore({ cache: sharedCache, coreRepository });
  const globalLimiter = createRateLimiter({
    cache: sharedCache,
    distributedPrefix: 'rate:global',
    fixedLimit: config.globalRateLimit ?? 120,
    fixedWindowMs: config.globalRateWindowMs ?? 60_000,
    tokenBucketCapacity: config.globalRateLimit ?? 120,
    tokenBucketRefillPerSec: Math.max(1, Math.ceil((config.globalRateLimit ?? 120) / 60)),
  });
  const aiLimiter = createRateLimiter({
    cache: sharedCache,
    distributedPrefix: 'rate:ai',
    fixedLimit: config.aiRateLimit ?? 10,
    fixedWindowMs: config.aiRateWindowMs ?? 60_000,
    tokenBucketCapacity: config.aiRateLimit ?? 10,
    tokenBucketRefillPerSec: Math.max(1, Math.ceil((config.aiRateLimit ?? 10) / 60)),
  });
  const smartInputLimiter = createRateLimiter({
    cache: sharedCache,
    distributedPrefix: 'rate:smart-input',
    fixedLimit: config.smartInputRateLimit ?? 20,
    fixedWindowMs: config.smartInputRateWindowMs ?? 60_000,
    tokenBucketCapacity: config.smartInputRateLimit ?? 20,
    tokenBucketRefillPerSec: Math.max(1, Math.ceil((config.smartInputRateLimit ?? 20) / 60)),
  });
  const telemetry = new InMemoryTelemetry();

  const server = http.createServer(async (req, res) => {
    const requestId = randomUUID();
    const method = req.method || 'GET';
    const url = new URL(req.url || '/', 'http://localhost');
    let userId = null;
    let authContext = null;
    const traceContext = telemetry.startTrace({ method, path: url.pathname, headers: req.headers, requestId });
    res.setHeader('x-trace-id', traceContext.traceId);
    res.setHeader('traceparent', traceContext.traceparent);
    const requestStartNs = process.hrtime.bigint();

    res.on('finish', () => {
      const durationMs = Number(process.hrtime.bigint() - requestStartNs) / 1e6;
      telemetry.record({ path: url.pathname, status: res.statusCode, durationMs, traceId: traceContext.traceId });
      telemetry.endTrace(traceContext, { statusCode: res.statusCode });
    });

    try {
      authContext = resolveAuthContext(req);
      userId = authContext?.userId ?? null;
      const handledSystem = await handleSystemAndAdminRoutes({
        method,
        url,
        res,
        requestId,
        userId,
        authContext,
        store,
        telemetry,
        canAccessAuditLog,
        logRequest,
        sendJson,
      });
      if (handledSystem) return;
      if (!userId) {
        logRequest({ requestId, method, path: url.pathname, userId: null, status: 401, error: 'UNAUTHORIZED' });
        return sendError(
          res,
          {
            status: 401,
            code: 'UNAUTHORIZED',
            message: 'Missing auth. Use x-user-id or Bearer dev-user:<id>',
          },
          requestId,
        );
      }

      const globalRate = await globalLimiter.take(userId);
      if (!globalRate.allowed) throw new Error('RATE_LIMIT_GLOBAL');

      if (method === 'POST' && /^\/households\/[^/]+\/recipes\/suggest$/.test(url.pathname)) {
        const aiRate = await aiLimiter.take(userId);
        if (!aiRate.allowed) throw new Error('RATE_LIMIT_AI');
      }
      if (method === 'POST' && (/^\/households\/[^/]+\/voice\/parse$/.test(url.pathname) || /^\/households\/[^/]+\/barcodes\/lookup$/.test(url.pathname))) {
        const smartInputRate = await smartInputLimiter.take(userId);
        if (!smartInputRate.allowed) throw new Error('RATE_LIMIT_SMART_INPUT');
      }

      const householdHandled = await handleHouseholdRoutes({
        method,
        url,
        req,
        res,
        userId,
        requestId,
        store,
        logRequest,
        sendJson,
        readBody,
      });
      if (householdHandled && householdHandled !== true) {
        if (householdHandled.type === 'sse') {
          const householdId = householdHandled.householdId;
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
      }
      if (householdHandled === true) return;

      const globalHandled = await handleGlobalRoutes({
        method,
        url,
        req,
        res,
        userId,
        requestId,
        store,
        logRequest,
        sendJson,
        readBody,
      });
      if (globalHandled) return;

      logRequest({ requestId, method, path: url.pathname, userId, status: 404, error: 'NOT_FOUND' });
      return sendError(
        res,
        {
          status: 404,
          code: 'NOT_FOUND',
          message: 'Not found',
        },
        requestId,
      );
    } catch (error) {
      const message = error?.message ?? 'UNKNOWN_ERROR';
      const resolved = resolveHttpError(message);
      if (resolved.auditEvent) {
        await store.recordSecurityAudit({ event: resolved.auditEvent, requestId, userId, path: url.pathname, reason: message });
      }
      logRequest({ requestId, method, path: url.pathname, userId, status: resolved.status, error: message });
      return sendError(res, resolved, requestId);
    }
  });
  server.requestTimeout = readPositiveIntEnv('HTTP_REQUEST_TIMEOUT_MS', 30_000);
  server.headersTimeout = readPositiveIntEnv('HTTP_HEADERS_TIMEOUT_MS', 31_000);

  const wsConnections = new Map();

  server.on('upgrade', async (req, socket) => {
    try {
      await handleWebsocketUpgrade({
        req,
        socket,
        store,
        wsConnections,
        resolveAuthContext,
        readPositiveIntEnv,
      });
    } catch {
      socket.destroy();
    }
  });




  return server;
}

async function createCoreRepositoryFromEnv() {
  if (!process.env.DATABASE_URL) return null;
  const { PostgresHouseholdRepository } = await import('./repositories/postgres-household-repository.js');
  return new PostgresHouseholdRepository({
    connectionString: process.env.DATABASE_URL,
    schema: process.env.DB_SCHEMA || null,
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  assertProductionSecurityPolicies();
  const port = Number(process.env.PORT || 4000);
  const strictCache = process.env.NODE_ENV === 'production' && process.env.ALLOW_INMEMORY_CACHE_FALLBACK !== '1';
  Promise.all([createCacheFromEnv({ strict: strictCache }), createCoreRepositoryFromEnv()])
    .then(([cache, coreRepository]) => {
      const requirePersistentStore = process.env.NODE_ENV === 'production' && process.env.ALLOW_INMEMORY_FALLBACK !== '1';
      createApp({ cache, coreRepository, requirePersistentStore }).listen(port, () => {
        // eslint-disable-next-line no-console
        console.log(`SmartCart backend listening on ${port}`);
      });
    })
    .catch((error) => {
      // eslint-disable-next-line no-console
      console.error(`Failed to start SmartCart backend: ${error.message}`);
      process.exitCode = 1;
    });
}

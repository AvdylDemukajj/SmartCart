import { replyJson, requireAuditAccess } from './route-kit.js';

export function parsePositiveIntQuery(value, fallback) {
  if (value === null) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) throw new Error('VALIDATION_QUERY_LIMIT');
  return parsed;
}

export async function handleSystemAndAdminRoutes({
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
}) {
  if (url.pathname === '/health' && method === 'GET') {
    const payload = {
      ok: true,
      service: 'smartcart-backend',
      modules: ['households', 'lists', 'pricing', 'receipts', 'budget', 'pantry', 'recipes', 'realtime', 'ocr', 'observability'],
    };
    return replyJson({ sendJson, logRequest, res, requestId, method, path: url.pathname, userId: null, status: 200, payload });
  }

  if (url.pathname === '/metrics' && method === 'GET') {
    const payload = telemetry.snapshot({ queueDepth: store.getOcrQueueDepth() });
    return replyJson({ sendJson, logRequest, res, requestId, method, path: url.pathname, userId: null, status: 200, payload });
  }

  if (method === 'GET' && /^\/trace\/[^/]+$/.test(url.pathname)) {
    const traceRequestId = url.pathname.split('/')[2];
    if (!userId) throw new Error('FORBIDDEN_AUDIT_ACCESS');
    requireAuditAccess({ authContext, canAccessAuditLog });
    const payload = store.getTraceReport({ requestId: traceRequestId });
    return replyJson({ sendJson, logRequest, res, requestId, method, path: url.pathname, userId, status: 200, payload });
  }

  if (method === 'GET' && url.pathname === '/security/audit-log') {
    requireAuditAccess({ authContext, canAccessAuditLog });
    const payload = await store.getSecurityAuditLog({ userId, limit: parsePositiveIntQuery(url.searchParams.get('limit'), 100) });
    return replyJson({ sendJson, logRequest, res, requestId, method, path: url.pathname, userId, status: 200, payload });
  }


  if (method === 'GET' && url.pathname === '/security/audit-log/integrity') {
    requireAuditAccess({ authContext, canAccessAuditLog });
    const payload = await store.verifySecurityAuditIntegrity();
    return replyJson({ sendJson, logRequest, res, requestId, method, path: url.pathname, userId, status: payload.ok ? 200 : 409, payload });
  }

  if (method === 'POST' && url.pathname === '/security/audit-log/retention/prune') {
    requireAuditAccess({ authContext, canAccessAuditLog });
    const payload = await store.pruneSecurityAuditLog();
    return replyJson({ sendJson, logRequest, res, requestId, method, path: url.pathname, userId, status: 200, payload });
  }

  return false;
}

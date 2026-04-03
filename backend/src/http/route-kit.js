import { parseBody } from '../validation.js';

export function replyJson({ sendJson, logRequest, res, requestId, method, path, userId, status, payload }) {
  logRequest({ requestId, method, path, userId, status });
  sendJson(res, status, payload, requestId);
  return true;
}

export async function parseValidatedBody({ req, readBody, schema }) {
  return parseBody(schema, await readBody(req));
}

export function parseBooleanQuery({ value, code, defaultValue = false }) {
  if (value === null) return defaultValue;
  if (value === '1' || value === 'true') return true;
  if (value === '0' || value === 'false') return false;
  throw new Error(code);
}

export function requireAuditAccess({ authContext, canAccessAuditLog }) {
  if (!canAccessAuditLog(authContext)) throw new Error('FORBIDDEN_AUDIT_ACCESS');
}

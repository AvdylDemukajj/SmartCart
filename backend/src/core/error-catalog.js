const ERROR_CATALOG = {
  FORBIDDEN_HOUSEHOLD_ACCESS: { status: 403, message: 'Forbidden', auditEvent: 'forbidden_household_access' },
  FORBIDDEN_AUDIT_ACCESS: { status: 403, message: 'Forbidden', auditEvent: 'forbidden_audit_access' },
  AUTH_INVALID_TOKEN: { status: 401, message: 'Invalid authentication token', auditEvent: 'auth_invalid' },
  AUTH_EXPIRED_TOKEN: { status: 401, message: 'Invalid authentication token', auditEvent: 'auth_invalid' },
  AUTH_INSECURE_METHOD_DISABLED: { status: 401, message: 'Insecure auth methods are disabled in this environment', auditEvent: 'auth_insecure_method_disabled' },
  AUTH_SECRET_MISSING: { status: 500, message: 'Server auth configuration error', auditEvent: 'auth_secret_missing' },
  RATE_LIMIT_GLOBAL: { status: 429, message: 'Global rate limit exceeded', auditEvent: 'rate_limit_global' },
  RATE_LIMIT_AI: { status: 429, message: 'AI endpoint rate limit exceeded', auditEvent: 'rate_limit_ai' },
  RATE_LIMIT_SMART_INPUT: { status: 429, message: 'Smart input rate limit exceeded', auditEvent: 'rate_limit_smart_input' },
  AI_RATE_LIMIT: { status: 429, message: 'Daily recipe limit reached for free tier' },
  VERSION_CONFLICT: { status: 409, message: 'Version conflict on item update' },
  VOICE_CONTRACT_UNSUPPORTED: { status: 400, message: 'Unsupported voice contract version' },
  ITEM_NOT_FOUND: { status: 404, message: 'Item not found' },
  OCR_JOB_NOT_FOUND: { status: 404, message: 'OCR job not found' },
  OCR_JOB_NOT_READY: { status: 409, message: 'OCR job not ready' },
  OCR_JOB_RETRY_NOT_ALLOWED: { status: 409, message: 'OCR job retry not allowed for current state' },
  OCR_JOB_CORRECTION_NOT_ALLOWED: { status: 409, message: 'OCR job correction not allowed for current state' },
  RECIPE_NOT_FOUND: { status: 404, message: 'Recipe not found' },
  BARCODE_NOT_FOUND: { status: 404, message: 'Barcode not found' },
  INVALID_JSON: { status: 400, message: 'Invalid JSON' },
  REQUEST_BODY_TOO_LARGE: { status: 413, message: 'Request body too large' },
};

export function resolveHttpError(message) {
  if (typeof message === 'string' && message.startsWith('VALIDATION_')) {
    return {
      status: 400,
      code: message,
      message,
      auditEvent: null,
    };
  }

  const known = ERROR_CATALOG[message];
  if (known) {
    return {
      status: known.status,
      code: message,
      message: known.message,
      auditEvent: known.auditEvent ?? null,
    };
  }

  return {
    status: 500,
    code: 'INTERNAL_ERROR',
    message: 'Internal server error',
    auditEvent: null,
  };
}


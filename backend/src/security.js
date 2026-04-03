import { createHmac, timingSafeEqual } from 'node:crypto';

function decodeBase64Url(value) {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function encodeBase64Url(buffer) {
  return buffer.toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
}

function getJwtSecrets() {
  const value = process.env.AUTH_JWT_SECRETS ?? process.env.AUTH_JWT_SECRET;
  if (!value) {
    if (process.env.NODE_ENV === 'production') throw new Error('AUTH_SECRET_MISSING');
    return ['dev-secret'];
  }
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function verifyJwtSignature(unsignedToken, signature, secret) {
  const expected = createHmac('sha256', secret).update(unsignedToken).digest();
  const actual = Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function verifyJwtWithPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('AUTH_INVALID_TOKEN');

  const [headerPart, payloadPart, signature] = parts;
  let header;
  let payload;
  try {
    header = JSON.parse(decodeBase64Url(headerPart));
    payload = JSON.parse(decodeBase64Url(payloadPart));
  } catch {
    throw new Error('AUTH_INVALID_TOKEN');
  }

  if (header.alg !== 'HS256') throw new Error('AUTH_INVALID_TOKEN');

  const unsigned = `${headerPart}.${payloadPart}`;
  const isValid = getJwtSecrets().some((secret) => verifyJwtSignature(unsigned, signature, secret));
  if (!isValid) throw new Error('AUTH_INVALID_TOKEN');

  if (typeof payload.exp === 'number' && payload.exp * 1000 <= Date.now()) throw new Error('AUTH_EXPIRED_TOKEN');
  const requiredIssuer = process.env.AUTH_JWT_ISSUER;
  if (requiredIssuer && payload.iss !== requiredIssuer) throw new Error('AUTH_INVALID_TOKEN');
  const requiredAudience = process.env.AUTH_JWT_AUDIENCE;
  if (requiredAudience) {
    const aud = payload.aud;
    const match = Array.isArray(aud) ? aud.includes(requiredAudience) : aud === requiredAudience;
    if (!match) throw new Error('AUTH_INVALID_TOKEN');
  }
  const userId = payload.sub ?? payload.userId;
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('AUTH_INVALID_TOKEN');

  return {
    userId: userId.trim(),
    payload,
  };
}

export function resolveAuthContext(req) {
  const allowInsecureDevAuth = process.env.ALLOW_INSECURE_DEV_AUTH === 'true'
    || !process.env.NODE_ENV
    || process.env.NODE_ENV === 'development'
    || process.env.NODE_ENV === 'test';
  const headerUser = req.headers['x-user-id'];
  if (typeof headerUser === 'string' && headerUser.trim()) {
    if (!allowInsecureDevAuth) throw new Error('AUTH_INSECURE_METHOD_DISABLED');
    return {
      userId: headerUser.trim(),
      method: 'x-user-id',
      claims: null,
    };
  }

  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();

  if (token.startsWith('dev-user:')) {
    if (!allowInsecureDevAuth) throw new Error('AUTH_INSECURE_METHOD_DISABLED');
    const userId = token.replace('dev-user:', '').trim();
    if (!userId) throw new Error('AUTH_INVALID_TOKEN');
    return {
      userId,
      method: 'bearer-dev-user',
      claims: null,
    };
  }

  const verified = verifyJwtWithPayload(token);
  return {
    userId: verified.userId,
    method: 'bearer-jwt',
    claims: verified.payload,
  };
}

export function resolveUserId(req) {
  const context = resolveAuthContext(req);
  return context?.userId ?? null;
}

export function createTestJwt({
  sub,
  secret = 'dev-secret',
  expiresInSec = 3600,
  iss,
  aud,
  role,
  roles,
  permissions,
}) {
  const header = encodeBase64Url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = encodeBase64Url(Buffer.from(JSON.stringify({
    sub,
    exp: Math.floor(Date.now() / 1000) + expiresInSec,
    ...(iss ? { iss } : {}),
    ...(aud ? { aud } : {}),
    ...(role ? { role } : {}),
    ...(roles ? { roles } : {}),
    ...(permissions ? { permissions } : {}),
  })));
  const signature = encodeBase64Url(createHmac('sha256', secret).update(`${header}.${payload}`).digest());
  return `${header}.${payload}.${signature}`;
}

export class FixedWindowRateLimiter {
  constructor({ limit, windowMs }) {
    this.limit = limit;
    this.windowMs = windowMs;
    this.buckets = new Map();
  }

  take(key) {
    const now = Date.now();
    if (this.buckets.size > 5000) {
      for (const [bucketKey, bucket] of this.buckets.entries()) {
        if (bucket.expiresAt <= now) this.buckets.delete(bucketKey);
      }
    }
    const existing = this.buckets.get(key);
    if (!existing || existing.expiresAt <= now) {
      const next = { count: 1, expiresAt: now + this.windowMs };
      this.buckets.set(key, next);
      return { allowed: true, remaining: this.limit - 1, resetInSec: Math.ceil(this.windowMs / 1000) };
    }

    if (existing.count >= this.limit) {
      return { allowed: false, remaining: 0, resetInSec: Math.ceil((existing.expiresAt - now) / 1000) };
    }

    existing.count += 1;
    return { allowed: true, remaining: this.limit - existing.count, resetInSec: Math.ceil((existing.expiresAt - now) / 1000) };
  }
}


export class DistributedTokenBucketRateLimiter {
  constructor({ cache, prefix = 'rate', capacity, refillRatePerSec, ttlSec = 120 }) {
    this.cache = cache;
    this.prefix = prefix;
    this.capacity = capacity;
    this.refillRatePerSec = refillRatePerSec;
    this.ttlSec = ttlSec;
  }

  async take(key, { nowMs = Date.now() } = {}) {
    const bucketKey = `${this.prefix}:${key}`;
    const fallbackReset = Math.max(1, Math.ceil(this.capacity / this.refillRatePerSec));
    const state = await this.cache.getJson(bucketKey) ?? {
      tokens: this.capacity,
      lastRefillMs: nowMs,
    };

    const elapsedMs = Math.max(0, nowMs - Number(state.lastRefillMs || nowMs));
    const refillTokens = (elapsedMs / 1000) * this.refillRatePerSec;
    const available = Math.min(this.capacity, Number(state.tokens ?? this.capacity) + refillTokens);

    if (available < 1) {
      const nextState = { tokens: available, lastRefillMs: nowMs };
      await this.cache.setJson(bucketKey, nextState, this.ttlSec);
      const deficit = 1 - available;
      return {
        allowed: false,
        remaining: 0,
        resetInSec: Math.max(1, Math.ceil(deficit / this.refillRatePerSec)),
      };
    }

    const nextTokens = available - 1;
    await this.cache.setJson(bucketKey, { tokens: nextTokens, lastRefillMs: nowMs }, this.ttlSec);
    return {
      allowed: true,
      remaining: Math.max(0, Math.floor(nextTokens)),
      resetInSec: fallbackReset,
    };
  }
}

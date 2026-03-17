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
  const value = process.env.AUTH_JWT_SECRETS ?? process.env.AUTH_JWT_SECRET ?? 'dev-secret';
  return value.split(',').map((entry) => entry.trim()).filter(Boolean);
}

function verifyJwtSignature(unsignedToken, signature, secret) {
  const expected = createHmac('sha256', secret).update(unsignedToken).digest();
  const actual = Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function verifyJwt(token) {
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
  const userId = payload.sub ?? payload.userId;
  if (typeof userId !== 'string' || !userId.trim()) throw new Error('AUTH_INVALID_TOKEN');

  return userId.trim();
}

export function resolveUserId(req) {
  const headerUser = req.headers['x-user-id'];
  if (typeof headerUser === 'string' && headerUser.trim()) return headerUser.trim();

  const authorization = req.headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) return null;
  const token = authorization.slice('Bearer '.length).trim();

  if (token.startsWith('dev-user:')) {
    const userId = token.replace('dev-user:', '').trim();
    if (!userId) throw new Error('AUTH_INVALID_TOKEN');
    return userId;
  }

  return verifyJwt(token);
}

export function createTestJwt({ sub, secret = 'dev-secret', expiresInSec = 3600 }) {
  const header = encodeBase64Url(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const payload = encodeBase64Url(Buffer.from(JSON.stringify({ sub, exp: Math.floor(Date.now() / 1000) + expiresInSec })));
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

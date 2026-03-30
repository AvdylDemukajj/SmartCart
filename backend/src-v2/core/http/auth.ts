import { createHmac, timingSafeEqual } from 'node:crypto';

export type AuthMethod = 'none' | 'x-user-id' | 'bearer-dev-user' | 'bearer-jwt';

export interface AuthContext {
  userId: string | null;
  method: AuthMethod;
}

function decodeBase64Url(value: string): string {
  const normalized = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = normalized.length % 4 === 0 ? '' : '='.repeat(4 - (normalized.length % 4));
  return Buffer.from(`${normalized}${padding}`, 'base64').toString('utf8');
}

function verifyJwtSignature(unsignedToken: string, signature: string, secret: string): boolean {
  const expected = createHmac('sha256', secret).update(unsignedToken).digest();
  const actual = Buffer.from(signature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(actual, expected);
}

function getJwtSecrets(): string[] {
  const value = process.env.AUTH_JWT_SECRETS ?? process.env.AUTH_JWT_SECRET ?? 'dev-secret';
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function verifyJwt(token: string): string {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('AUTH_INVALID_TOKEN');

  const [headerPart, payloadPart, signature] = parts;
  let header: { alg?: string };
  let payload: { sub?: string; userId?: string; exp?: number };

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

export function resolveAuthContext(headers: Record<string, string | string[] | undefined>): AuthContext {
  const xUserId = headers['x-user-id'];
  if (typeof xUserId === 'string' && xUserId.trim()) {
    return { userId: xUserId.trim(), method: 'x-user-id' };
  }

  const authorization = headers.authorization;
  if (typeof authorization !== 'string' || !authorization.startsWith('Bearer ')) {
    return { userId: null, method: 'none' };
  }

  const token = authorization.slice('Bearer '.length).trim();
  if (token.startsWith('dev-user:')) {
    const userId = token.replace('dev-user:', '').trim();
    if (!userId) throw new Error('AUTH_INVALID_TOKEN');
    return { userId, method: 'bearer-dev-user' };
  }

  return { userId: verifyJwt(token), method: 'bearer-jwt' };
}

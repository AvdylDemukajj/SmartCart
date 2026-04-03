import test from 'node:test';
import assert from 'node:assert/strict';
import { createCacheFromEnv } from '../src/cache.js';

test('createCacheFromEnv throws in strict mode when REDIS_URL missing', async () => {
  const previous = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  try {
    await assert.rejects(() => createCacheFromEnv({ strict: true }), /REDIS_REQUIRED_IN_STRICT_MODE/);
  } finally {
    if (previous === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previous;
  }
});

test('createCacheFromEnv returns fallback cache when non-strict and REDIS_URL missing', async () => {
  const previous = process.env.REDIS_URL;
  delete process.env.REDIS_URL;
  try {
    const cache = await createCacheFromEnv();
    await cache.setJson('a', { ok: true }, 10);
    const value = await cache.getJson('a');
    assert.deepEqual(value, { ok: true });
  } finally {
    if (previous === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previous;
  }
});

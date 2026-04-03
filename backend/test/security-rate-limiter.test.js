import test from 'node:test';
import assert from 'node:assert/strict';
import { DistributedTokenBucketRateLimiter } from '../src/security.js';

class FakeCache {
  constructor() {
    this.map = new Map();
  }

  async getJson(key) {
    return this.map.get(key) ?? null;
  }

  async setJson(key, value) {
    this.map.set(key, value);
  }
}

test('distributed token bucket limiter enforces burst and refills over time', async () => {
  const cache = new FakeCache();
  const limiter = new DistributedTokenBucketRateLimiter({
    cache,
    prefix: 'rate:test',
    capacity: 2,
    refillRatePerSec: 1,
    ttlSec: 120,
  });

  const t0 = Date.now();
  const first = await limiter.take('user-1', { nowMs: t0 });
  const second = await limiter.take('user-1', { nowMs: t0 });
  const blocked = await limiter.take('user-1', { nowMs: t0 });
  const refilled = await limiter.take('user-1', { nowMs: t0 + 1200 });

  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(blocked.allowed, false);
  assert.equal(refilled.allowed, true);
});

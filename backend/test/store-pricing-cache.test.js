import test from 'node:test';
import assert from 'node:assert/strict';
import { SmartCartStore } from '../src/store.js';

test('pricing cache status reports hit/miss ratios and cache tiers', async () => {
  const store = new SmartCartStore();
  const household = await store.createHousehold({ ownerId: 'ana', name: 'Cache HH' });
  await store.addItem({ userId: 'ana', householdId: household.id, name: 'Qumesht', quantity: 2 });

  const first = await store.estimatePrices({ userId: 'ana', householdId: household.id });
  const second = await store.estimatePrices({ userId: 'ana', householdId: household.id });

  assert.equal(first.cached, false);
  assert.equal(first.cacheTier, 'origin');
  assert.equal(second.cached, true);
  assert.equal(second.cacheTier, 'memory');

  const status = store.getPricingCacheStatus();
  assert.equal(status.stats.requests, 2);
  assert.equal(status.stats.misses, 1);
  assert.equal(status.stats.memoryHits, 1);
  assert.equal(status.stats.hitRatio, 0.5);
  assert.equal(status.stats.missRatio, 0.5);
});

test('pricing estimation coalesces concurrent misses to prevent cache stampede', async () => {
  const store = new SmartCartStore();
  const household = await store.createHousehold({ ownerId: 'ana', name: 'Stampede HH' });
  await store.addItem({ userId: 'ana', householdId: household.id, name: 'Domate', quantity: 2 });

  const [a, b, c] = await Promise.all([
    store.estimatePrices({ userId: 'ana', householdId: household.id, refresh: true }),
    store.estimatePrices({ userId: 'ana', householdId: household.id, refresh: true }),
    store.estimatePrices({ userId: 'ana', householdId: household.id, refresh: true }),
  ]);

  assert.equal(a.bestStore, b.bestStore);
  assert.equal(b.bestStore, c.bestStore);

  const status = store.getPricingCacheStatus();
  assert.equal(status.stats.requests, 3);
  assert.equal(status.stats.misses, 1);
  assert.equal(status.stats.coalescedRequests, 2);
});

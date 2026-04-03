import { randomUUID } from 'node:crypto';

const DEFAULT_PRICING_CACHE_TTL_MS = 6 * 60 * 60 * 1000;

export class PricingService {
  constructor({
    repo,
    flyers,
    priceRepository,
    pricingEstimateCache,
    cache,
    assertMember,
    canonicalizeItemKey,
    normalizeName,
    recordDbTrace,
    pricingCacheTtlMs = DEFAULT_PRICING_CACHE_TTL_MS,
  }) {
    this.repo = repo;
    this.flyers = flyers;
    this.priceRepository = priceRepository;
    this.pricingEstimateCache = pricingEstimateCache;
    this.cache = cache;
    this.assertMember = assertMember;
    this.canonicalizeItemKey = canonicalizeItemKey;
    this.normalizeName = normalizeName;
    this.recordDbTrace = recordDbTrace;
    this.pricingCacheTtlMs = pricingCacheTtlMs;
  }

  ingestStagingPrices({ actorId, rows, traceContext = null }) {
    const prepared = rows.map((row) => {
      const canonicalKey = this.canonicalizeItemKey(row.itemKey ?? '');
      return {
        id: randomUUID(),
        store: String(row.store || '').toLowerCase().trim(),
        itemKey: String(row.itemKey || '').toLowerCase().trim(),
        canonicalKey,
        confidence: this.computeMatchConfidence(row.itemKey ?? '', canonicalKey),
        matchingMethod: canonicalKey === this.normalizeName(row.itemKey ?? '') ? 'exact' : 'normalized',
        price: Number(row.price),
        source: row.source ?? 'manual',
        fetchedAt: row.fetchedAt ?? new Date().toISOString(),
        ingestedAt: new Date().toISOString(),
        actorId,
      };
    });
    const result = this.priceRepository.ingest({ rows: prepared });
    this.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'prices_staging', householdId: null });
    return result;
  }

  promoteStagingPrices({ actorId, traceContext = null }) {
    const result = this.priceRepository.promoteValidated({ actorId });
    this.pricingEstimateCache.clear();
    this.recordDbTrace({ requestId: traceContext?.requestId, operation: 'promote', entity: 'store_prices_live', householdId: null });
    if (this.cache) void this.cache.delByPrefix('pricing:');
    return result;
  }

  getPricingPipelineStatus() {
    return this.priceRepository.getPipelineStatus();
  }

  getPricingCacheStatus() {
    const now = Date.now();
    let active = 0;
    for (const entry of this.pricingEstimateCache.values()) {
      if (entry.expiresAt > now) active += 1;
    }
    return {
      totalEntries: this.pricingEstimateCache.size,
      activeEntries: active,
      ttlSec: this.pricingCacheTtlMs / 1000,
    };
  }

  async estimatePrices({ userId, householdId, refresh = false }) {
    await this.assertMember(userId, householdId);
    const activeItems = (this.repo.listItems.get(householdId) ?? []).filter((item) => !item.purchased);
    const signature = activeItems
      .map((item) => `${this.canonicalizeItemKey(item.name)}:${item.quantity}:${item.version}`)
      .sort()
      .join('|');
    const cacheKey = `${householdId}:${signature}`;
    const now = Date.now();

    if (!refresh) {
      if (this.cache) {
        const redisCached = await this.cache.getJson(`pricing:${cacheKey}`);
        if (redisCached) {
          return {
            ...redisCached,
            cached: true,
            cacheTtlSecRemaining: this.pricingCacheTtlMs / 1000,
          };
        }
      }

      const cached = this.pricingEstimateCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return {
          ...cached.payload,
          cached: true,
          cacheTtlSecRemaining: Math.ceil((cached.expiresAt - now) / 1000),
        };
      }
    }

    const totals = Object.entries(this.priceRepository.getPriceBook())
      .map(([store, prices]) => {
        const subtotal = activeItems.reduce((sum, item) => {
          const key = this.canonicalizeItemKey(item.name);
          const price = prices[key] ?? 1.5;
          return sum + price * item.quantity;
        }, 0);
        return { store, total: Number(subtotal.toFixed(2)) };
      })
      .sort((a, b) => a.total - b.total);

    const payload = {
      bestStore: totals[0]?.store ?? null,
      totals,
      itemCount: activeItems.length,
    };

    this.pricingEstimateCache.set(cacheKey, {
      payload,
      expiresAt: now + this.pricingCacheTtlMs,
    });
    if (this.cache) await this.cache.setJson(`pricing:${cacheKey}`, payload, this.pricingCacheTtlMs / 1000);

    return {
      ...payload,
      cached: false,
      cacheTtlSecRemaining: this.pricingCacheTtlMs / 1000,
    };
  }

  async listFlyers({ userId, householdId }) {
    await this.assertMember(userId, householdId);
    const items = this.repo.listItems.get(householdId).map((item) => this.normalizeName(item.name));
    return this.flyers.filter((flyer) => items.some((item) => item.includes(flyer.keyword)));
  }

  async clearPricingCacheForHousehold(householdId) {
    for (const key of this.pricingEstimateCache.keys()) {
      if (key.startsWith(`${householdId}:`)) this.pricingEstimateCache.delete(key);
    }
    if (this.cache) await this.cache.delByPrefix(`pricing:${householdId}:`);
  }

  computeMatchConfidence(original, canonical) {
    const originalNormalized = this.normalizeName(original).normalize('NFD').replace(/\p{Diacritic}/gu, '');
    if (!canonical) return 0;
    if (originalNormalized === canonical) return 1;
    if (originalNormalized.includes(canonical)) return 0.9;
    const overlap = canonical.split(' ').filter((token) => token && originalNormalized.includes(token)).length;
    return Number(Math.max(0.35, Math.min(0.85, overlap * 0.4)).toFixed(2));
  }
}


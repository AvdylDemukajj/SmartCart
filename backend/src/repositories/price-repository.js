export class InMemoryPriceRepository {
  constructor(seedPriceBook = {}) {
    this.pricesStaging = [];
    this.pricesLive = [];
    this.priceBook = seedPriceBook;
    this.canonicalCatalog = new Set(Object.values(seedPriceBook).flatMap((store) => Object.keys(store)));
  }

  ingest({ rows }) {
    this.pricesStaging.push(...rows);
    return rows;
  }

  promoteValidated({ actorId }) {
    const invalid = [];
    const valid = [];

    for (const row of this.pricesStaging) {
      if (!row.store || !row.canonicalKey) {
        invalid.push({ ...row, reason: 'missing keys' });
        continue;
      }
      if (Number.isNaN(row.price) || row.price <= 0 || row.price > 999) {
        invalid.push({ ...row, reason: 'outlier price' });
        continue;
      }
      if (row.confidence < 0.35) {
        invalid.push({ ...row, reason: 'low confidence match' });
        continue;
      }
      valid.push(row);
      this.canonicalCatalog.add(row.canonicalKey);
    }

    const dedupedMap = new Map();
    for (const row of valid) {
      dedupedMap.set(`${row.store}:${row.canonicalKey}`, row);
    }

    this.pricesLive = Array.from(dedupedMap.values());

    const newBook = {};
    for (const row of this.pricesLive) {
      if (!newBook[row.store]) newBook[row.store] = {};
      newBook[row.store][row.canonicalKey] = row.price;
    }
    if (Object.keys(newBook).length > 0) this.priceBook = newBook;

    this.pricesStaging = [];

    return {
      promotedCount: this.pricesLive.length,
      rejectedCount: invalid.length,
      rejectedRows: invalid,
      actorId,
      promotedAt: new Date().toISOString(),
    };
  }

  getPipelineStatus() {
    const avgConfidence =
      this.pricesLive.length === 0
        ? 0
        : Number((this.pricesLive.reduce((sum, row) => sum + row.confidence, 0) / this.pricesLive.length).toFixed(3));

    return {
      stagingCount: this.pricesStaging.length,
      liveCount: this.pricesLive.length,
      liveRows: this.pricesLive,
      canonicalCatalogCount: this.canonicalCatalog.size,
      avgLiveConfidence: avgConfidence,
    };
  }

  getPriceBook() {
    return this.priceBook;
  }
}

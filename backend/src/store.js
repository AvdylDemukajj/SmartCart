import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { InMemoryPriceRepository } from './repositories/price-repository.js';
import { InMemoryAppRepository } from './repositories/app-repository.js';
import { generateRecipeSuggestions } from './ai-provider.js';
import { AuditLogService } from './services/audit-log.service.js';
import { ReceiptOcrService } from './services/receipt-ocr.service.js';

const DEFAULT_CATEGORY_MAP = [
  { keywords: ['qumesht', 'djath', 'kos'], category: 'Bulmet' },
  { keywords: ['mish', 'pul', 'suxhuk'], category: 'Mish' },
  { keywords: ['domate', 'molle', 'banane', 'patate'], category: 'Fruta/Perime' },
  { keywords: ['buk', 'miell', 'oriz'], category: 'Bazike' },
];

const STARTER_PRICE_BOOK = {
  maxi: { qumesht: 1.4, veze: 2.9, domate: 1.8, mish: 8.5, buke: 0.7 },
  viva: { qumesht: 1.25, veze: 3.1, domate: 1.5, mish: 8.9, buke: 0.65 },
  etc: { qumesht: 1.35, veze: 2.7, domate: 1.7, mish: 8.1, buke: 0.75 },
};

const STARTER_FLYERS = [
  { id: 'fl-etc-mish', store: 'etc', keyword: 'mish', discountPercent: 20, label: '🔥 -20% ETC këtë javë' },
  { id: 'fl-viva-domate', store: 'viva', keyword: 'domate', discountPercent: 15, label: '🔥 -15% Viva këtë javë' },
];

const BARCODE_CATALOG = {
  ks: {
    '3901234500011': { name: 'Qumesht', category: 'Bulmet' },
    '3901234500012': { name: 'Veze', category: 'Bulmet' },
    '3901234500013': { name: 'Buke', category: 'Bazike' },
  },
  al: {
    '3901234500011': { name: 'Qumësht', category: 'Bulmet' },
    '3901234500014': { name: 'Domate', category: 'Fruta/Perime' },
  },
  de: {
    '4006381333931': { name: 'Milch', category: 'Bulmet' },
    '4311501650701': { name: 'Eier', category: 'Bulmet' },
  },
};
const BARCODE_PREFIX_FALLBACK = {
  '3901234': { name: 'Produkt bazik', category: 'Të tjera', confidence: 0.55 },
};

const PRICING_CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const RECIPE_CACHE_TTL_MS = 60 * 60 * 1000;

const RECIPE_TEMPLATES = {
  shakshuka: {
    key: 'shakshuka',
    name: 'Shakshuka e shpejtë',
    etaMin: 20,
    ingredients: [
      { name: 'Domate', quantity: 4 },
      { name: 'Veze', quantity: 4 },
      { name: 'Buke', quantity: 1 },
    ],
    promptTemplate: 'Create a quick shakshuka recipe with pantry-first substitutions.',
  },
  pilaf_mish: {
    key: 'pilaf_mish',
    name: 'Pilaf me mish',
    etaMin: 35,
    ingredients: [
      { name: 'Mish', quantity: 1 },
      { name: 'Oriz', quantity: 1 },
      { name: 'Domate', quantity: 2 },
    ],
    promptTemplate: 'Create a Balkan-style pilaf with meat and rice, minimal waste.',
  },
  omlete_miks: {
    key: 'omlete_miks',
    name: 'Omletë miks',
    etaMin: 10,
    ingredients: [
      { name: 'Veze', quantity: 3 },
      { name: 'Domate', quantity: 1 },
    ],
    promptTemplate: 'Create a fast omelette recipe from remaining pantry ingredients.',
  },
};

export class SmartCartStore {
  constructor({ cache = null, coreRepository = null } = {}) {
    this.events = new EventEmitter();
    this.repo = new InMemoryAppRepository();
    this.coreRepository = coreRepository;
    this.recipeSuggestionCache = new Map();
    this.flyers = STARTER_FLYERS;
    this.pricingEstimateCache = new Map();
    this.pricingEstimateInflight = new Map();
    this.pricingCacheStats = {
      requests: 0,
      memoryHits: 0,
      sharedHits: 0,
      misses: 0,
      writes: 0,
      coalescedRequests: 0,
      refreshRequests: 0,
      sharedFailures: 0,
    };
    this.priceRepository = new InMemoryPriceRepository(STARTER_PRICE_BOOK);
    this.cache = cache;
    this.auditLogService = new AuditLogService({
      repo: this.repo,
      coreRepository: this.coreRepository,
      maxEntries: Number(process.env.AUDIT_LOG_MAX_ENTRIES || 500),
      retentionDays: Number(process.env.AUDIT_LOG_RETENTION_DAYS || 90),
      integritySalt: process.env.AUDIT_LOG_INTEGRITY_SALT
        ?? (process.env.NODE_ENV === 'production' ? null : `dev-${process.pid}-${Date.now()}`),
    });
    this.receiptOcrService = new ReceiptOcrService({
      repo: this.repo,
      assertMember: (...args) => this.assertMember(...args),
      pushActivity: (...args) => this.pushActivity(...args),
      recordDbTrace: (...args) => this.repo.recordDbTrace(...args),
      normalizeReceiptItems: (...args) => this.normalizeReceiptItems(...args),
      addReceipt: (...args) => this.addReceipt(...args),
    });
  }

  async recordSecurityAudit(event) {
    await this.auditLogService.record(event);
  }

  async getSecurityAuditLog({ userId, limit = 100 }) {
    return this.auditLogService.list({ userId, limit });
  }


  async verifySecurityAuditIntegrity() {
    return this.auditLogService.verifyIntegrity();
  }

  async pruneSecurityAuditLog(referenceDate = new Date()) {
    return this.auditLogService.pruneExpired(referenceDate);
  }

  ensureUser(userId) {
    if (!this.repo.memberships.has(userId)) this.repo.memberships.set(userId, new Set());
  }

  async createHousehold({ ownerId, name, traceContext = null }) {
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const household = { id, name, ownerId, createdAt };
    if (this.coreRepository) {
      await this.coreRepository.createHousehold({
        id,
        name,
        ownerId,
        createdAt,
        month: this.currentMonth(),
      });
    }
    this.repo.households.set(id, household);
    this.ensureUser(ownerId);
    this.repo.memberships.get(ownerId).add(id);
    this.repo.listItems.set(id, []);
    this.repo.activity.set(id, []);
    this.repo.budgets.set(id, { householdId: id, month: this.currentMonth(), limit: 300, spent: 0, updatedAt: new Date().toISOString() });
    this.repo.receipts.set(id, []);
    this.repo.pantry.set(id, []);
    this.repo.receiptUploads.set(id, []);
    this.repo.receiptOcrJobs.set(id, []);
    await this.pushActivity(id, ownerId, 'household.created', `${ownerId} krijoi household-in`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'households', householdId: id });
    return household;
  }

  async listHouseholdsForUser(userId) {
    if (this.coreRepository) return this.coreRepository.listUserHouseholds(userId);
    this.ensureUser(userId);
    return Array.from(this.repo.memberships.get(userId)).map((id) => this.repo.households.get(id));
  }

  async addMember({ actorId, householdId, memberId, traceContext = null }) {
    await this.assertMember(actorId, householdId);
    if (this.coreRepository) await this.coreRepository.addMember({ householdId, memberId });
    this.ensureUser(memberId);
    this.repo.memberships.get(memberId).add(householdId);
    await this.pushActivity(householdId, actorId, 'membership.added', `${actorId} shtoi ${memberId}`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'household_members', householdId });
    return { householdId, memberId };
  }

  async getItems({ userId, householdId }) {
    await this.assertMember(userId, householdId);
    if (this.coreRepository) return this.coreRepository.listItems({ householdId });
    return this.repo.listItems.get(householdId) ?? [];
  }

  async addItem({ userId, householdId, name, quantity = 1, traceContext = null }) {
    await this.assertMember(userId, householdId);
    const item = {
      id: randomUUID(),
      name,
      quantity,
      category: this.resolveCategory(name),
      purchased: false,
      version: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    if (this.coreRepository) {
      await this.coreRepository.addItem({
        id: item.id,
        householdId,
        name: item.name,
        quantity: item.quantity,
        category: item.category,
        purchased: item.purchased,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      });
    }
    this.repo.listItems.get(householdId).push(item);
    void this.clearPricingCacheForHousehold(householdId);
    await this.pushActivity(householdId, userId, 'list.item.added', `${userId} shtoi ${name}`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'list_items', householdId });
    return item;
  }

  async toggleItem({ userId, householdId, itemId, expectedVersion, traceContext = null }) {
    await this.assertMember(userId, householdId);
    if (this.coreRepository) {
      const updated = await this.coreRepository.toggleItem({ householdId, itemId, expectedVersion });
      if (!updated) throw new Error('ITEM_NOT_FOUND');
      if (updated.conflict) throw new Error('VERSION_CONFLICT');
      const mirror = (this.repo.listItems.get(householdId) ?? []).find((entry) => entry.id === itemId);
      if (mirror) {
        mirror.purchased = updated.purchased;
        mirror.version = Number(updated.version);
        mirror.updatedAt = updated.updatedAt;
      }
      void this.clearPricingCacheForHousehold(householdId);
      await this.pushActivity(householdId, userId, 'list.item.toggled', `${userId} ndryshoi ${updated.name}`);
      this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'update', entity: 'list_items', householdId });
      return updated;
    }
    const item = this.mustFindItem(householdId, itemId);
    if (expectedVersion !== undefined && expectedVersion !== item.version) throw new Error('VERSION_CONFLICT');
    item.purchased = !item.purchased;
    item.version += 1;
    item.updatedAt = new Date().toISOString();
    void this.clearPricingCacheForHousehold(householdId);
    await this.pushActivity(householdId, userId, 'list.item.toggled', `${userId} ndryshoi ${item.name}`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'update', entity: 'list_items', householdId });
    return item;
  }

  async getActivity({ userId, householdId }) {
    await this.assertMember(userId, householdId);
    if (this.coreRepository?.listActivity) return this.coreRepository.listActivity({ householdId });
    return this.repo.activity.get(householdId) ?? [];
  }

  async getBudget({ userId, householdId }) {
    await this.assertMember(userId, householdId);
    if (this.coreRepository) return this.coreRepository.getBudget({ householdId });
    return this.repo.budgets.get(householdId);
  }

  async setBudgetLimit({ userId, householdId, limit, traceContext = null }) {
    await this.assertMember(userId, householdId);
    if (this.coreRepository) {
      const budget = await this.coreRepository.setBudgetLimit({ householdId, limit });
      await this.pushActivity(householdId, userId, 'budget.updated', `${userId} ndryshoi buxhetin në ${limit}`);
      this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'update', entity: 'monthly_budgets', householdId });
      return budget;
    }
    const budget = this.repo.budgets.get(householdId);
    budget.limit = limit;
    budget.updatedAt = new Date().toISOString();
    await this.pushActivity(householdId, userId, 'budget.updated', `${userId} ndryshoi buxhetin në ${limit}`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'update', entity: 'monthly_budgets', householdId });
    return budget;
  }


  normalizeReceiptItems(items) {
    return items.map((item) => {
      const name = String(item?.name ?? '').trim();
      const quantity = Number(item?.quantity ?? 1);
      const unitPrice = Number(item?.unitPrice ?? 0);
      if (!name) throw new Error('VALIDATION_RECEIPT_ITEM_NAME');
      if (!Number.isFinite(quantity) || quantity <= 0) throw new Error('VALIDATION_RECEIPT_ITEM_QUANTITY');
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new Error('VALIDATION_RECEIPT_ITEM_UNITPRICE');
      return {
        name,
        quantity,
        unitPrice,
        total: quantity * unitPrice,
      };
    });
  }

  async addReceipt({ userId, householdId, store, items, traceContext = null }) {
    await this.assertMember(userId, householdId);
    const normalizedItems = this.normalizeReceiptItems(items);
    const total = normalizedItems.reduce((sum, item) => sum + item.total, 0);
    const receipt = {
      id: randomUUID(),
      store,
      items: normalizedItems,
      total: Number(total.toFixed(2)),
      createdAt: new Date().toISOString(),
    };
    if (this.coreRepository) {
      const currentBudget = await this.coreRepository.getBudget({ householdId });
      const nextBudgetSpent = Number((Number(currentBudget?.spent ?? 0) + receipt.total).toFixed(2));
      await this.coreRepository.addReceipt({
        householdId,
        receiptId: receipt.id,
        store: receipt.store,
        total: receipt.total,
        createdAt: receipt.createdAt,
        items: normalizedItems.map((item) => ({
          id: randomUUID(),
          name: item.name,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: item.total,
        })),
        budgetSpent: nextBudgetSpent,
      });
      for (const item of normalizedItems) {
        await this.coreRepository.addPantryItem({
          id: randomUUID(),
          householdId,
          name: item.name,
          quantity: item.quantity,
          addedAt: new Date().toISOString(),
        });
      }
    }
    this.repo.receipts.get(householdId).push(receipt);

    const budget = this.repo.budgets.get(householdId);
    budget.spent = Number((budget.spent + receipt.total).toFixed(2));
    budget.updatedAt = new Date().toISOString();

    const pantryItems = this.repo.pantry.get(householdId);
    for (const item of normalizedItems) {
      pantryItems.push({ id: randomUUID(), name: item.name, quantity: item.quantity, addedAt: new Date().toISOString() });
      this.autoMarkPurchased(householdId, item.name);
    }

    await this.pushActivity(householdId, userId, 'receipt.added', `${userId} regjistroi faturë ${receipt.total}€`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'receipts', householdId });
    return { receipt, budget };
  }


  async createReceiptUploadUrl({ userId, householdId, fileName, traceContext = null }) {
    await this.assertMember(userId, householdId);
    const upload = {
      uploadId: randomUUID(),
      fileName,
      objectKey: `receipts/${householdId}/${Date.now()}-${fileName}`,
      uploadUrl: `https://storage.smartcart.local/upload/${householdId}/${Date.now()}`,
      expiresInSec: 900,
      createdAt: new Date().toISOString(),
    };
    this.repo.receiptUploads.get(householdId).push(upload);
    await this.pushActivity(householdId, userId, 'receipt.upload.created', `${userId} krijoi upload URL për faturë`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'receipt_uploads', householdId });
    return upload;
  }

  async enqueueReceiptOcrJob({ userId, householdId, objectKey, apiRequestId = null, traceContext = null }) {
    return this.receiptOcrService.enqueue({ userId, householdId, objectKey, apiRequestId, traceContext });
  }

  processReceiptOcrJob({ householdId, jobId }) {
    return this.receiptOcrService.process({ householdId, jobId });
  }

  async retryReceiptOcrJob({ userId, householdId, jobId, replayToken = null, traceContext = null }) {
    return this.receiptOcrService.retry({ userId, householdId, jobId, replayToken, traceContext });
  }

  async listReceiptOcrJobs({ userId, householdId }) {
    return this.receiptOcrService.list({ userId, householdId });
  }

  async correctReceiptOcrJob({ userId, householdId, jobId, store, items, traceContext = null }) {
    return this.receiptOcrService.correct({ userId, householdId, jobId, store, items, traceContext });
  }

  async applyReceiptOcrJobResult({ userId, householdId, jobId, applyRequestId = null, traceContext = null }) {
    return this.receiptOcrService.apply({ userId, householdId, jobId, applyRequestId, traceContext });
  }

  async listReceipts({ userId, householdId }) {
    await this.assertMember(userId, householdId);
    if (this.coreRepository) return this.coreRepository.listReceipts({ householdId });
    return this.repo.receipts.get(householdId);
  }

  async getPantry({ userId, householdId }) {
    await this.assertMember(userId, householdId);
    if (this.coreRepository) return this.coreRepository.listPantry({ householdId });
    return this.repo.pantry.get(householdId);
  }

  async addPantryItem({ userId, householdId, name, quantity = 1, traceContext = null }) {
    await this.assertMember(userId, householdId);
    const item = { id: randomUUID(), name, quantity, addedAt: new Date().toISOString() };
    if (this.coreRepository) {
      await this.coreRepository.addPantryItem({
        id: item.id,
        householdId,
        name: item.name,
        quantity: item.quantity,
        addedAt: item.addedAt,
      });
    }
    this.repo.pantry.get(householdId).push(item);
    void this.clearRecipeCacheForHousehold(householdId);
    await this.pushActivity(householdId, userId, 'pantry.item.added', `${userId} shtoi pantry item ${name}`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'pantry_items', householdId });
    return item;
  }

  async parseVoiceItems({ userId, householdId, transcript, locale = 'ks', addToList = false, contractVersion = 'v1', traceContext = null }) {
    await this.assertMember(userId, householdId);
    if (contractVersion !== 'v1') throw new Error('VOICE_CONTRACT_UNSUPPORTED');
    const segments = String(transcript)
      .split(/[,.]| dhe /giu)
      .map((entry) => entry.trim())
      .filter(Boolean);

    const parsedItems = [];
    const ambiguousSegments = [];
    for (const segment of segments) {
      const match = segment.match(/(?:(\d+(?:[.,]\d+)?)\s*(kg|g|l|ml|pcs?|cope|cop[eë]?|x)?\s*)?(.+)/iu);
      if (!match) continue;
      const quantity = match[1] ? Number(match[1].replace(',', '.')) : 1;
      const unit = this.normalizeVoiceUnit(match[2]);
      const name = match[3].trim();
      if (!name) continue;
      const confidence = this.computeVoiceConfidence({ rawSegment: segment, quantity, unit, name });
      if (confidence < 0.65) {
        ambiguousSegments.push({ rawSegment: segment, reason: 'LOW_CONFIDENCE', confidence });
      }
      parsedItems.push({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        quantity: Number.isFinite(quantity) && quantity > 0 ? Math.min(quantity, 999) : 1,
        unit,
        confidence,
        category: this.resolveCategory(name),
      });
    }
    const normalizedParsedItems = this.consolidateVoiceItems(parsedItems).slice(0, 50);

    const createdItems = [];
    if (addToList) {
      for (const item of normalizedParsedItems) {
        createdItems.push(
          await this.addItem({
            userId,
            householdId,
            name: item.name,
            quantity: item.quantity,
            traceContext,
          }),
        );
      }
    }

    await this.pushActivity(householdId, userId, 'input.voice.parsed', `${userId} përdori voice input (${locale})`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'voice_inputs', householdId });
    return {
      contractVersion,
      inputSource: 'voice',
      locale: String(locale).toLowerCase(),
      transcript,
      parsedItems: normalizedParsedItems,
      ambiguousSegments,
      addedCount: createdItems.length,
      addedItems: createdItems,
    };
  }

  async lookupBarcode({ userId, householdId, barcode, locale = 'ks', quantity = 1, addToList = false, traceContext = null }) {
    await this.assertMember(userId, householdId);
    const localeKey = String(locale).toLowerCase();
    const localizedCatalog = BARCODE_CATALOG[localeKey] ?? BARCODE_CATALOG.ks;
    const barcodeKey = String(barcode);
    let product = localizedCatalog[barcodeKey];
    let resolutionSource = 'catalog_exact';
    if (!product) {
      const prefix = barcodeKey.slice(0, 7);
      product = BARCODE_PREFIX_FALLBACK[prefix] ?? null;
      resolutionSource = product ? 'catalog_prefix_fallback' : 'not_found';
    }
    if (!product) throw new Error('BARCODE_NOT_FOUND');

    let listItem = null;
    if (addToList) {
      listItem = await this.addItem({
        userId,
        householdId,
        name: product.name,
        quantity,
        traceContext,
      });
    }

    await this.pushActivity(householdId, userId, 'input.barcode.resolved', `${userId} skanoi barcode ${barcode}`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'select', entity: 'barcode_catalog', householdId });
    return {
      barcode: barcodeKey,
      inputSource: 'barcode',
      locale: localeKey,
      product,
      quantity,
      confidence: product.confidence ?? (resolutionSource === 'catalog_exact' ? 0.99 : 0.55),
      resolutionSource,
      addedToList: Boolean(addToList),
      listItem,
    };
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
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'prices_staging', householdId: null });
    return result;
  }

  promoteStagingPrices({ actorId, traceContext = null }) {
    const result = this.priceRepository.promoteValidated({ actorId });
    this.pricingEstimateCache.clear();
    this.pricingEstimateInflight.clear();
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'promote', entity: 'store_prices_live', householdId: null });
    if (this.cache) void this.cache.delByPrefix('pricing:');
    return result;
  }


  getOcrQueueDepth() {
    return this.receiptOcrService.getQueueDepth();
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
    const stats = this.pricingCacheStats;
    const hitCount = stats.memoryHits + stats.sharedHits;
    const hitRatio = stats.requests ? Number((hitCount / stats.requests).toFixed(4)) : 0;
    const missRatio = stats.requests ? Number((stats.misses / stats.requests).toFixed(4)) : 0;
    return {
      totalEntries: this.pricingEstimateCache.size,
      activeEntries: active,
      inflightComputations: this.pricingEstimateInflight.size,
      ttlSec: PRICING_CACHE_TTL_MS / 1000,
      stats: {
        ...stats,
        hitRatio,
        missRatio,
      },
    };
  }

  async estimatePrices({ userId, householdId, refresh = false }) {
    await this.assertMember(userId, householdId);
    this.pricingCacheStats.requests += 1;
    if (refresh) this.pricingCacheStats.refreshRequests += 1;
    const activeItems = (this.repo.listItems.get(householdId) ?? []).filter((item) => !item.purchased);
    const signature = activeItems
      .map((item) => `${this.canonicalizeItemKey(item.name)}:${item.quantity}:${item.version}`)
      .sort()
      .join('|');
    const cacheKey = `${householdId}:${signature}`;
    const now = Date.now();

    if (!refresh) {
      if (this.cache) {
        try {
          const redisCached = await this.cache.getJson(`pricing:${cacheKey}`);
          if (redisCached) {
            this.pricingCacheStats.sharedHits += 1;
            return {
              ...redisCached,
              cached: true,
              cacheTier: 'shared',
              cacheTtlSecRemaining: PRICING_CACHE_TTL_MS / 1000,
            };
          }
        } catch {
          this.pricingCacheStats.sharedFailures += 1;
        }
      }

      const cached = this.pricingEstimateCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        this.pricingCacheStats.memoryHits += 1;
        return {
          ...cached.payload,
          cached: true,
          cacheTier: 'memory',
          cacheTtlSecRemaining: Math.ceil((cached.expiresAt - now) / 1000),
        };
      }
    }

    const existingComputation = this.pricingEstimateInflight.get(cacheKey);
    if (existingComputation) {
      this.pricingCacheStats.coalescedRequests += 1;
      return existingComputation;
    }

    this.pricingCacheStats.misses += 1;

    const computation = this.computePricingPayload(activeItems)
      .then(async (payload) => {
        const expiresAt = Date.now() + PRICING_CACHE_TTL_MS;
        this.pricingEstimateCache.set(cacheKey, { payload, expiresAt });
        this.pricingCacheStats.writes += 1;

        if (this.cache) {
          try {
            await this.cache.setJson(`pricing:${cacheKey}`, payload, PRICING_CACHE_TTL_MS / 1000);
          } catch {
            this.pricingCacheStats.sharedFailures += 1;
          }
        }

        return {
          ...payload,
          cached: false,
          cacheTier: 'origin',
          cacheTtlSecRemaining: PRICING_CACHE_TTL_MS / 1000,
        };
      })
      .finally(() => {
        this.pricingEstimateInflight.delete(cacheKey);
      });

    this.pricingEstimateInflight.set(cacheKey, computation);
    return computation;
  }

  async computePricingPayload(activeItems) {
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

    return {
      bestStore: totals[0]?.store ?? null,
      totals,
      itemCount: activeItems.length,
    };
  }

  async listFlyers({ userId, householdId }) {
    await this.assertMember(userId, householdId);
    const items = this.repo.listItems.get(householdId).map((item) => this.normalizeName(item.name));
    return this.flyers.filter((flyer) => items.some((item) => item.includes(flyer.keyword)));
  }

  async suggestRecipes({ userId, householdId, refresh = false }) {
    await this.assertMember(userId, householdId);
    this.checkRecipeLimit(userId);
    const pantry = this.repo.pantry.get(householdId);
    const pantrySignature = pantry
      .map((item) => `${this.canonicalizeItemKey(item.name)}:${item.quantity}`)
      .sort()
      .join('|');
    const cacheKey = `${householdId}:${pantrySignature}`;
    const now = Date.now();

    if (!refresh) {
      if (this.cache) {
        const redisCached = await this.cache.getJson(`recipes:${cacheKey}`);
        if (redisCached) {
          return {
            ...redisCached,
            cached: true,
            cacheTtlSecRemaining: RECIPE_CACHE_TTL_MS / 1000,
            promptTemplates: redisCached.suggestions.map((item) => ({ name: item.name, template: item.promptTemplate })),
          };
        }
      }

      const cached = this.recipeSuggestionCache.get(cacheKey);
      if (cached && cached.expiresAt > now) {
        return {
          ...cached.payload,
          cached: true,
          cacheTtlSecRemaining: Math.ceil((cached.expiresAt - now) / 1000),
          promptTemplates: cached.payload.suggestions.map((item) => ({ name: item.name, template: item.promptTemplate })),
        };
      }
    }

    const names = pantry.map((item) => this.normalizeName(item.name));

    const fallbackSuggestions = [];
    if (names.includes('domate') && names.includes('veze')) fallbackSuggestions.push(RECIPE_TEMPLATES.shakshuka);
    if (names.includes('mish') && names.includes('oriz')) fallbackSuggestions.push(RECIPE_TEMPLATES.pilaf_mish);
    if (fallbackSuggestions.length === 0) fallbackSuggestions.push(RECIPE_TEMPLATES.omlete_miks);

    const aiSuggestions = await generateRecipeSuggestions({
      pantryNames: names,
      fallbackSuggestions: fallbackSuggestions.map((entry) => ({
        key: entry.key,
        name: entry.name,
        etaMin: entry.etaMin,
        promptTemplate: entry.promptTemplate,
      })),
    });

    const payload = {
      suggestions: aiSuggestions,
      remainingFreeRequests: 3 - this.getTodayRecipeUsage(userId),
    };

    this.recipeSuggestionCache.set(cacheKey, {
      payload,
      expiresAt: now + RECIPE_CACHE_TTL_MS,
    });
    if (this.cache) await this.cache.setJson(`recipes:${cacheKey}`, payload, RECIPE_CACHE_TTL_MS / 1000);

    await this.pushActivity(householdId, userId, 'recipes.generated', `${userId} kërkoi receta AI`);
    return {
      ...payload,
      cached: false,
      cacheTtlSecRemaining: RECIPE_CACHE_TTL_MS / 1000,
      promptTemplates: payload.suggestions.map((item) => ({ name: item.name, template: item.promptTemplate })),
    };
  }

  async addRecipeIngredientsToList({ userId, householdId, recipeKey, traceContext = null }) {
    await this.assertMember(userId, householdId);
    const template = RECIPE_TEMPLATES[recipeKey];
    if (!template) throw new Error('RECIPE_NOT_FOUND');

    const pantry = this.repo.pantry.get(householdId) ?? [];
    const items = this.repo.listItems.get(householdId) ?? [];
    const added = [];

    for (const ingredient of template.ingredients) {
      const pantryHas = pantry.some((entry) => this.canonicalizeItemKey(entry.name) === this.canonicalizeItemKey(ingredient.name));
      const listHas = items.some((entry) => this.canonicalizeItemKey(entry.name) === this.canonicalizeItemKey(ingredient.name) && !entry.purchased);
      if (!pantryHas && !listHas) {
        const item = await this.addItem({ userId, householdId, name: ingredient.name, quantity: ingredient.quantity });
        added.push(item);
      }
    }

    await this.pushActivity(householdId, userId, 'recipes.added_to_list', `${userId} shtoi përbërësit e recetës ${template.name}`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'list_items', householdId });
    return { recipe: template.name, addedItems: added };
  }

  getTraceReport({ requestId }) {
    return this.repo.getDbTrace(requestId);
  }

  getRecipeCacheStatus() {
    const now = Date.now();
    let active = 0;
    for (const entry of this.recipeSuggestionCache.values()) {
      if (entry.expiresAt > now) active += 1;
    }
    return {
      totalEntries: this.recipeSuggestionCache.size,
      activeEntries: active,
      ttlSec: RECIPE_CACHE_TTL_MS / 1000,
    };
  }

  onHouseholdEvent(householdId, listener) {
    const topic = `household:${householdId}`;
    this.events.on(topic, listener);
    return () => this.events.off(topic, listener);
  }

  async assertMember(userId, householdId) {
    if (this.coreRepository?.assertMember) {
      const allowed = await this.coreRepository.assertMember({ householdId, userId });
      if (!allowed) throw new Error('FORBIDDEN_HOUSEHOLD_ACCESS');
      return;
    }
    this.ensureUser(userId);
    if (!this.repo.memberships.get(userId).has(householdId)) throw new Error('FORBIDDEN_HOUSEHOLD_ACCESS');
  }

  async pushActivity(householdId, actorId, type, message) {
    const event = {
      id: randomUUID(),
      actorId,
      type,
      message,
      createdAt: new Date().toISOString(),
      householdId,
    };
    if (this.coreRepository?.addActivity) {
      await this.coreRepository.addActivity(event);
    }
    this.repo.activity.get(householdId).push(event);
    this.events.emit(`household:${householdId}`, event);
  }

  async clearPricingCacheForHousehold(householdId) {
    for (const key of this.pricingEstimateCache.keys()) {
      if (key.startsWith(`${householdId}:`)) this.pricingEstimateCache.delete(key);
    }
    for (const key of this.pricingEstimateInflight.keys()) {
      if (key.startsWith(`${householdId}:`)) this.pricingEstimateInflight.delete(key);
    }
    if (this.cache) await this.cache.delByPrefix(`pricing:${householdId}:`);
  }

  async clearRecipeCacheForHousehold(householdId) {
    for (const key of this.recipeSuggestionCache.keys()) {
      if (key.startsWith(`${householdId}:`)) this.recipeSuggestionCache.delete(key);
    }
    if (this.cache) await this.cache.delByPrefix(`recipes:${householdId}:`);
  }

  resolveCategory(itemName) {
    const lower = this.normalizeName(itemName);
    const match = DEFAULT_CATEGORY_MAP.find((entry) => entry.keywords.some((key) => lower.includes(key)));
    return match?.category ?? 'Të tjera';
  }

  normalizeName(value) {
    return String(value).toLowerCase().trim();
  }

  canonicalizeItemKey(value) {
    const base = this
      .normalizeName(value)
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/\b(kg|g|gr|ml|l|litra|liter)\b/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\d+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (base.includes('qumesht')) return 'qumesht';
    if (base.includes('veze')) return 'veze';
    if (base.includes('domate')) return 'domate';
    if (base.includes('mish')) return 'mish';
    if (base.includes('buk') || base.includes('buke')) return 'buke';
    if (base.includes('oriz')) return 'oriz';

    return base;
  }

  normalizeVoiceUnit(value) {
    const raw = String(value ?? '').toLowerCase().trim();
    if (!raw || raw === 'x' || raw === 'cope' || raw === 'copë' || raw === 'cop') return 'pcs';
    if (raw === 'g') return 'g';
    if (raw === 'kg') return 'kg';
    if (raw === 'ml') return 'ml';
    if (raw === 'l') return 'l';
    if (raw === 'pc' || raw === 'pcs') return 'pcs';
    return 'pcs';
  }

  computeVoiceConfidence({ rawSegment, quantity, unit, name }) {
    let score = 0.9;
    if (!rawSegment || String(rawSegment).length < 2) score -= 0.15;
    if (!Number.isFinite(quantity) || quantity <= 0) score -= 0.2;
    if (!name || name.length < 2) score -= 0.2;
    if (!unit) score -= 0.1;
    if (/[\d]{5,}/.test(name)) score -= 0.15;
    return Math.max(0.3, Number(score.toFixed(2)));
  }

  consolidateVoiceItems(items) {
    const grouped = new Map();
    for (const item of items) {
      const key = `${this.canonicalizeItemKey(item.name)}:${item.unit}`;
      const current = grouped.get(key);
      if (!current) {
        grouped.set(key, { ...item });
        continue;
      }
      current.quantity = Number((current.quantity + item.quantity).toFixed(2));
      current.confidence = Number(Math.max(current.confidence, item.confidence).toFixed(2));
    }
    return Array.from(grouped.values());
  }

  computeMatchConfidence(original, canonical) {
    const originalNormalized = this.normalizeName(original).normalize('NFD').replace(/\p{Diacritic}/gu, '');
    if (!canonical) return 0;
    if (originalNormalized === canonical) return 1;
    if (originalNormalized.includes(canonical)) return 0.9;
    const overlap = canonical.split(' ').filter((token) => token && originalNormalized.includes(token)).length;
    return Number(Math.max(0.35, Math.min(0.85, overlap * 0.4)).toFixed(2));
  }

  mustFindItem(householdId, itemId) {
    const item = (this.repo.listItems.get(householdId) ?? []).find((entry) => entry.id === itemId);
    if (!item) throw new Error('ITEM_NOT_FOUND');
    return item;
  }

  autoMarkPurchased(householdId, itemName) {
    const normalized = this.canonicalizeItemKey(itemName);
    const item = (this.repo.listItems.get(householdId) ?? []).find(
      (entry) => this.canonicalizeItemKey(entry.name) === normalized && !entry.purchased,
    );
    if (item) {
      item.purchased = true;
      item.version += 1;
      item.updatedAt = new Date().toISOString();
      void this.clearPricingCacheForHousehold(householdId);
    }
  }

  checkRecipeLimit(userId) {
    const key = `${userId}:${this.currentDateKey()}`;
    const used = this.repo.recipeUsage.get(key) ?? 0;
    if (used >= 3) throw new Error('AI_RATE_LIMIT');
    this.repo.recipeUsage.set(key, used + 1);
  }

  getTodayRecipeUsage(userId) {
    return this.repo.recipeUsage.get(`${userId}:${this.currentDateKey()}`) ?? 0;
  }

  currentMonth() {
    return new Date().toISOString().slice(0, 7);
  }

  currentDateKey() {
    return new Date().toISOString().slice(0, 10);
  }
}

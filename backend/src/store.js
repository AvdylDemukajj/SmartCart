import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { InMemoryPriceRepository } from './repositories/price-repository.js';
import { InMemoryAppRepository } from './repositories/app-repository.js';
import { generateRecipeSuggestions } from './ai-provider.js';

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
  constructor({ cache = null } = {}) {
    this.events = new EventEmitter();
    this.repo = new InMemoryAppRepository();
    this.recipeSuggestionCache = new Map();
    this.flyers = STARTER_FLYERS;
    this.pricingEstimateCache = new Map();
    this.priceRepository = new InMemoryPriceRepository(STARTER_PRICE_BOOK);
    this.cache = cache;
  }

  recordSecurityAudit(event) {
    this.repo.securityAuditLog.push({
      id: randomUUID(),
      ...event,
      createdAt: new Date().toISOString(),
    });
    if (this.repo.securityAuditLog.length > 500) this.repo.securityAuditLog.shift();
  }

  getSecurityAuditLog({ userId, limit = 100 }) {
    if (!userId) throw new Error('FORBIDDEN_HOUSEHOLD_ACCESS');
    return this.repo.securityAuditLog.slice(-Math.max(1, Math.min(500, limit)));
  }

  ensureUser(userId) {
    if (!this.repo.memberships.has(userId)) this.repo.memberships.set(userId, new Set());
  }

  createHousehold({ ownerId, name, traceContext = null }) {
    const id = randomUUID();
    const household = { id, name, ownerId, createdAt: new Date().toISOString() };
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
    this.pushActivity(id, ownerId, 'household.created', `${ownerId} krijoi household-in`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'households', householdId: id });
    return household;
  }

  listHouseholdsForUser(userId) {
    this.ensureUser(userId);
    return Array.from(this.repo.memberships.get(userId)).map((id) => this.repo.households.get(id));
  }

  addMember({ actorId, householdId, memberId, traceContext = null }) {
    this.assertMember(actorId, householdId);
    this.ensureUser(memberId);
    this.repo.memberships.get(memberId).add(householdId);
    this.pushActivity(householdId, actorId, 'membership.added', `${actorId} shtoi ${memberId}`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'household_members', householdId });
    return { householdId, memberId };
  }

  getItems({ userId, householdId }) {
    this.assertMember(userId, householdId);
    return this.repo.listItems.get(householdId) ?? [];
  }

  addItem({ userId, householdId, name, quantity = 1, traceContext = null }) {
    this.assertMember(userId, householdId);
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
    this.repo.listItems.get(householdId).push(item);
    void this.clearPricingCacheForHousehold(householdId);
    this.pushActivity(householdId, userId, 'list.item.added', `${userId} shtoi ${name}`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'list_items', householdId });
    return item;
  }

  toggleItem({ userId, householdId, itemId, expectedVersion, traceContext = null }) {
    this.assertMember(userId, householdId);
    const item = this.mustFindItem(householdId, itemId);
    if (expectedVersion !== undefined && expectedVersion !== item.version) throw new Error('VERSION_CONFLICT');
    item.purchased = !item.purchased;
    item.version += 1;
    item.updatedAt = new Date().toISOString();
    void this.clearPricingCacheForHousehold(householdId);
    this.pushActivity(householdId, userId, 'list.item.toggled', `${userId} ndryshoi ${item.name}`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'update', entity: 'list_items', householdId });
    return item;
  }

  getActivity({ userId, householdId }) {
    this.assertMember(userId, householdId);
    return this.repo.activity.get(householdId) ?? [];
  }

  getBudget({ userId, householdId }) {
    this.assertMember(userId, householdId);
    return this.repo.budgets.get(householdId);
  }

  setBudgetLimit({ userId, householdId, limit, traceContext = null }) {
    this.assertMember(userId, householdId);
    const budget = this.repo.budgets.get(householdId);
    budget.limit = limit;
    budget.updatedAt = new Date().toISOString();
    this.pushActivity(householdId, userId, 'budget.updated', `${userId} ndryshoi buxhetin në ${limit}`);
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

  addReceipt({ userId, householdId, store, items, traceContext = null }) {
    this.assertMember(userId, householdId);
    const normalizedItems = this.normalizeReceiptItems(items);
    const total = normalizedItems.reduce((sum, item) => sum + item.total, 0);
    const receipt = {
      id: randomUUID(),
      store,
      items: normalizedItems,
      total: Number(total.toFixed(2)),
      createdAt: new Date().toISOString(),
    };
    this.repo.receipts.get(householdId).push(receipt);

    const budget = this.repo.budgets.get(householdId);
    budget.spent = Number((budget.spent + receipt.total).toFixed(2));
    budget.updatedAt = new Date().toISOString();

    const pantryItems = this.repo.pantry.get(householdId);
    for (const item of normalizedItems) {
      pantryItems.push({ id: randomUUID(), name: item.name, quantity: item.quantity, addedAt: new Date().toISOString() });
      this.autoMarkPurchased(householdId, item.name);
    }

    this.pushActivity(householdId, userId, 'receipt.added', `${userId} regjistroi faturë ${receipt.total}€`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'receipts', householdId });
    return { receipt, budget };
  }


  createReceiptUploadUrl({ userId, householdId, fileName, traceContext = null }) {
    this.assertMember(userId, householdId);
    const upload = {
      uploadId: randomUUID(),
      fileName,
      objectKey: `receipts/${householdId}/${Date.now()}-${fileName}`,
      uploadUrl: `https://storage.smartcart.local/upload/${householdId}/${Date.now()}`,
      expiresInSec: 900,
      createdAt: new Date().toISOString(),
    };
    this.repo.receiptUploads.get(householdId).push(upload);
    this.pushActivity(householdId, userId, 'receipt.upload.created', `${userId} krijoi upload URL për faturë`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'receipt_uploads', householdId });
    return upload;
  }

  enqueueReceiptOcrJob({ userId, householdId, objectKey, apiRequestId = null, traceContext = null }) {
    this.assertMember(userId, householdId);
    const job = {
      jobId: randomUUID(),
      householdId,
      objectKey,
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      result: null,
      error: null,
      correctedResult: null,
      trace: {
        apiRequestId,
        workerRunId: null,
        workerStartedAt: null,
        applyRequestId: null,
      },
    };
    this.repo.receiptOcrJobs.get(householdId).push(job);
    this.pushActivity(householdId, userId, 'receipt.ocr.queued', `${userId} nisi OCR job`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'receipt_ocr_jobs', householdId });

    setTimeout(() => {
      this.processReceiptOcrJob({ householdId, jobId: job.jobId });
    }, 20);

    return job;
  }

  processReceiptOcrJob({ householdId, jobId }) {
    const jobs = this.repo.receiptOcrJobs.get(householdId) ?? [];
    const job = jobs.find((entry) => entry.jobId === jobId);
    if (!job || ['succeeded', 'succeeded_corrected', 'dead_letter'].includes(job.status)) return job;

    job.status = 'processing';
    job.attempts += 1;
    job.updatedAt = new Date().toISOString();
    job.trace.workerRunId = randomUUID();
    job.trace.workerStartedAt = new Date().toISOString();

    // Simulated OCR engine behavior: object keys containing "fail" will fail.
    const shouldFail = String(job.objectKey || '').toLowerCase().includes('fail');

    if (shouldFail) {
      job.error = 'OCR_ENGINE_PARSE_ERROR';
      if (job.attempts >= job.maxAttempts) {
        job.status = 'dead_letter';
      } else {
        job.status = 'failed';
      }
      job.updatedAt = new Date().toISOString();
      return job;
    }

    const parsedItems = [
      { name: 'Qumesht', quantity: 1, unitPrice: 1.2 },
      { name: 'Buke', quantity: 1, unitPrice: 0.7 },
    ];

    job.status = 'succeeded';
    job.result = {
      store: 'ocr-store',
      items: parsedItems,
      total: Number(parsedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2)),
    };
    job.error = null;
    job.updatedAt = new Date().toISOString();
    return job;
  }

  retryReceiptOcrJob({ userId, householdId, jobId, traceContext = null }) {
    this.assertMember(userId, householdId);
    const jobs = this.repo.receiptOcrJobs.get(householdId) ?? [];
    const job = jobs.find((entry) => entry.jobId === jobId);
    if (!job) throw new Error('OCR_JOB_NOT_FOUND');
    if (!['failed'].includes(job.status)) throw new Error('OCR_JOB_RETRY_NOT_ALLOWED');

    job.status = 'queued';
    job.updatedAt = new Date().toISOString();
    this.pushActivity(householdId, userId, 'receipt.ocr.retried', `${userId} ritriggeroi OCR job`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'update', entity: 'receipt_ocr_jobs', householdId });

    setTimeout(() => {
      this.processReceiptOcrJob({ householdId, jobId: job.jobId });
    }, 20);

    return job;
  }

  listReceiptOcrJobs({ userId, householdId }) {
    this.assertMember(userId, householdId);
    return this.repo.receiptOcrJobs.get(householdId) ?? [];
  }

  correctReceiptOcrJob({ userId, householdId, jobId, store, items, traceContext = null }) {
    this.assertMember(userId, householdId);
    const jobs = this.repo.receiptOcrJobs.get(householdId) ?? [];
    const job = jobs.find((entry) => entry.jobId === jobId);
    if (!job) throw new Error('OCR_JOB_NOT_FOUND');
    if (!['failed', 'dead_letter'].includes(job.status)) throw new Error('OCR_JOB_CORRECTION_NOT_ALLOWED');

    const normalizedItems = this.normalizeReceiptItems(items).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
    }));

    job.correctedResult = {
      store,
      items: normalizedItems,
      total: Number(normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2)),
    };
    job.status = 'succeeded_corrected';
    job.updatedAt = new Date().toISOString();
    this.pushActivity(householdId, userId, 'receipt.ocr.corrected', `${userId} korrigjoi manualisht OCR job`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'update', entity: 'receipt_ocr_jobs', householdId });

    return job;
  }

  applyReceiptOcrJobResult({ userId, householdId, jobId, applyRequestId = null, traceContext = null }) {
    this.assertMember(userId, householdId);
    const jobs = this.repo.receiptOcrJobs.get(householdId) ?? [];
    const job = jobs.find((entry) => entry.jobId === jobId);
    if (!job) throw new Error('OCR_JOB_NOT_FOUND');

    const source = job.status === 'succeeded_corrected' ? job.correctedResult : job.result;
    if (!source) throw new Error('OCR_JOB_NOT_READY');

    const result = this.addReceipt({
      userId,
      householdId,
      store: source.store,
      items: source.items,
      traceContext,
    });

    job.trace.applyRequestId = applyRequestId;
    this.pushActivity(householdId, userId, 'receipt.ocr.applied', `${userId} aplikoi OCR rezultatin`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'update', entity: 'receipt_ocr_jobs', householdId });
    return { job, appliedReceipt: result.receipt, budget: result.budget };
  }

  listReceipts({ userId, householdId }) {
    this.assertMember(userId, householdId);
    return this.repo.receipts.get(householdId);
  }

  getPantry({ userId, householdId }) {
    this.assertMember(userId, householdId);
    return this.repo.pantry.get(householdId);
  }

  addPantryItem({ userId, householdId, name, quantity = 1, traceContext = null }) {
    this.assertMember(userId, householdId);
    const item = { id: randomUUID(), name, quantity, addedAt: new Date().toISOString() };
    this.repo.pantry.get(householdId).push(item);
    void this.clearRecipeCacheForHousehold(householdId);
    this.pushActivity(householdId, userId, 'pantry.item.added', `${userId} shtoi pantry item ${name}`);
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'pantry_items', householdId });
    return item;
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
    this.repo.recordDbTrace({ requestId: traceContext?.requestId, operation: 'promote', entity: 'store_prices_live', householdId: null });
    if (this.cache) void this.cache.delByPrefix('pricing:');
    return result;
  }


  getOcrQueueDepth() {
    const jobs = Array.from(this.repo.receiptOcrJobs.values()).flat();
    return {
      total: jobs.length,
      queued: jobs.filter((entry) => entry.status === 'queued').length,
      processing: jobs.filter((entry) => entry.status === 'processing').length,
      failed: jobs.filter((entry) => entry.status === 'failed').length,
      deadLetter: jobs.filter((entry) => entry.status === 'dead_letter').length,
    };
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
      ttlSec: PRICING_CACHE_TTL_MS / 1000,
    };
  }

  async estimatePrices({ userId, householdId, refresh = false }) {
    this.assertMember(userId, householdId);
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
            cacheTtlSecRemaining: PRICING_CACHE_TTL_MS / 1000,
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
      expiresAt: now + PRICING_CACHE_TTL_MS,
    });
    if (this.cache) await this.cache.setJson(`pricing:${cacheKey}`, payload, PRICING_CACHE_TTL_MS / 1000);

    return {
      ...payload,
      cached: false,
      cacheTtlSecRemaining: PRICING_CACHE_TTL_MS / 1000,
    };
  }

  listFlyers({ userId, householdId }) {
    this.assertMember(userId, householdId);
    const items = this.repo.listItems.get(householdId).map((item) => this.normalizeName(item.name));
    return this.flyers.filter((flyer) => items.some((item) => item.includes(flyer.keyword)));
  }

  async suggestRecipes({ userId, householdId, refresh = false }) {
    this.assertMember(userId, householdId);
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

    this.pushActivity(householdId, userId, 'recipes.generated', `${userId} kërkoi receta AI`);
    return {
      ...payload,
      cached: false,
      cacheTtlSecRemaining: RECIPE_CACHE_TTL_MS / 1000,
      promptTemplates: payload.suggestions.map((item) => ({ name: item.name, template: item.promptTemplate })),
    };
  }

  addRecipeIngredientsToList({ userId, householdId, recipeKey, traceContext = null }) {
    this.assertMember(userId, householdId);
    const template = RECIPE_TEMPLATES[recipeKey];
    if (!template) throw new Error('RECIPE_NOT_FOUND');

    const pantry = this.repo.pantry.get(householdId) ?? [];
    const items = this.repo.listItems.get(householdId) ?? [];
    const added = [];

    for (const ingredient of template.ingredients) {
      const pantryHas = pantry.some((entry) => this.canonicalizeItemKey(entry.name) === this.canonicalizeItemKey(ingredient.name));
      const listHas = items.some((entry) => this.canonicalizeItemKey(entry.name) === this.canonicalizeItemKey(ingredient.name) && !entry.purchased);
      if (!pantryHas && !listHas) {
        const item = this.addItem({ userId, householdId, name: ingredient.name, quantity: ingredient.quantity });
        added.push(item);
      }
    }

    this.pushActivity(householdId, userId, 'recipes.added_to_list', `${userId} shtoi përbërësit e recetës ${template.name}`);
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

  assertMember(userId, householdId) {
    this.ensureUser(userId);
    if (!this.repo.memberships.get(userId).has(householdId)) throw new Error('FORBIDDEN_HOUSEHOLD_ACCESS');
  }

  pushActivity(householdId, actorId, type, message) {
    const event = {
      id: randomUUID(),
      actorId,
      type,
      message,
      createdAt: new Date().toISOString(),
      householdId,
    };
    this.repo.activity.get(householdId).push(event);
    this.events.emit(`household:${householdId}`, event);
  }

  async clearPricingCacheForHousehold(householdId) {
    for (const key of this.pricingEstimateCache.keys()) {
      if (key.startsWith(`${householdId}:`)) this.pricingEstimateCache.delete(key);
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

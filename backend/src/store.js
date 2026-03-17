import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { InMemoryPriceRepository } from './repositories/price-repository.js';

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
  constructor() {
    this.events = new EventEmitter();
    this.households = new Map();
    this.memberships = new Map();
    this.listItems = new Map();
    this.activity = new Map();
    this.budgets = new Map();
    this.receipts = new Map();
    this.pantry = new Map();
    this.recipeUsage = new Map();
    this.recipeSuggestionCache = new Map();
    this.flyers = STARTER_FLYERS;
    this.pricingEstimateCache = new Map();
    this.priceRepository = new InMemoryPriceRepository(STARTER_PRICE_BOOK);
    this.receiptUploads = new Map();
    this.receiptOcrJobs = new Map();
  }

  ensureUser(userId) {
    if (!this.memberships.has(userId)) this.memberships.set(userId, new Set());
  }

  createHousehold({ ownerId, name }) {
    const id = randomUUID();
    const household = { id, name, ownerId, createdAt: new Date().toISOString() };
    this.households.set(id, household);
    this.ensureUser(ownerId);
    this.memberships.get(ownerId).add(id);
    this.listItems.set(id, []);
    this.activity.set(id, []);
    this.budgets.set(id, { householdId: id, month: this.currentMonth(), limit: 300, spent: 0, updatedAt: new Date().toISOString() });
    this.receipts.set(id, []);
    this.pantry.set(id, []);
    this.receiptUploads.set(id, []);
    this.receiptOcrJobs.set(id, []);
    this.pushActivity(id, ownerId, 'household.created', `${ownerId} krijoi household-in`);
    return household;
  }

  listHouseholdsForUser(userId) {
    this.ensureUser(userId);
    return Array.from(this.memberships.get(userId)).map((id) => this.households.get(id));
  }

  addMember({ actorId, householdId, memberId }) {
    this.assertMember(actorId, householdId);
    this.ensureUser(memberId);
    this.memberships.get(memberId).add(householdId);
    this.pushActivity(householdId, actorId, 'membership.added', `${actorId} shtoi ${memberId}`);
    return { householdId, memberId };
  }

  getItems({ userId, householdId }) {
    this.assertMember(userId, householdId);
    return this.listItems.get(householdId) ?? [];
  }

  addItem({ userId, householdId, name, quantity = 1 }) {
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
    this.listItems.get(householdId).push(item);
    this.clearPricingCacheForHousehold(householdId);
    this.pushActivity(householdId, userId, 'list.item.added', `${userId} shtoi ${name}`);
    return item;
  }

  toggleItem({ userId, householdId, itemId, expectedVersion }) {
    this.assertMember(userId, householdId);
    const item = this.mustFindItem(householdId, itemId);
    if (expectedVersion !== undefined && expectedVersion !== item.version) throw new Error('VERSION_CONFLICT');
    item.purchased = !item.purchased;
    item.version += 1;
    item.updatedAt = new Date().toISOString();
    this.clearPricingCacheForHousehold(householdId);
    this.pushActivity(householdId, userId, 'list.item.toggled', `${userId} ndryshoi ${item.name}`);
    return item;
  }

  getActivity({ userId, householdId }) {
    this.assertMember(userId, householdId);
    return this.activity.get(householdId) ?? [];
  }

  getBudget({ userId, householdId }) {
    this.assertMember(userId, householdId);
    return this.budgets.get(householdId);
  }

  setBudgetLimit({ userId, householdId, limit }) {
    this.assertMember(userId, householdId);
    const budget = this.budgets.get(householdId);
    budget.limit = limit;
    budget.updatedAt = new Date().toISOString();
    this.pushActivity(householdId, userId, 'budget.updated', `${userId} ndryshoi buxhetin në ${limit}`);
    return budget;
  }

  addReceipt({ userId, householdId, store, items }) {
    this.assertMember(userId, householdId);
    const normalizedItems = items.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity ?? 1),
      unitPrice: Number(item.unitPrice ?? 0),
      total: Number(item.quantity ?? 1) * Number(item.unitPrice ?? 0),
    }));
    const total = normalizedItems.reduce((sum, item) => sum + item.total, 0);
    const receipt = {
      id: randomUUID(),
      store,
      items: normalizedItems,
      total: Number(total.toFixed(2)),
      createdAt: new Date().toISOString(),
    };
    this.receipts.get(householdId).push(receipt);

    const budget = this.budgets.get(householdId);
    budget.spent = Number((budget.spent + receipt.total).toFixed(2));
    budget.updatedAt = new Date().toISOString();

    const pantryItems = this.pantry.get(householdId);
    for (const item of normalizedItems) {
      pantryItems.push({ id: randomUUID(), name: item.name, quantity: item.quantity, addedAt: new Date().toISOString() });
      this.autoMarkPurchased(householdId, item.name);
    }

    this.pushActivity(householdId, userId, 'receipt.added', `${userId} regjistroi faturë ${receipt.total}€`);
    return { receipt, budget };
  }


  createReceiptUploadUrl({ userId, householdId, fileName }) {
    this.assertMember(userId, householdId);
    const upload = {
      uploadId: randomUUID(),
      fileName,
      objectKey: `receipts/${householdId}/${Date.now()}-${fileName}`,
      uploadUrl: `https://storage.smartcart.local/upload/${householdId}/${Date.now()}`,
      expiresInSec: 900,
      createdAt: new Date().toISOString(),
    };
    this.receiptUploads.get(householdId).push(upload);
    this.pushActivity(householdId, userId, 'receipt.upload.created', `${userId} krijoi upload URL për faturë`);
    return upload;
  }

  enqueueReceiptOcrJob({ userId, householdId, objectKey }) {
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
    };
    this.receiptOcrJobs.get(householdId).push(job);
    this.pushActivity(householdId, userId, 'receipt.ocr.queued', `${userId} nisi OCR job`);

    setTimeout(() => {
      this.processReceiptOcrJob({ householdId, jobId: job.jobId });
    }, 20);

    return job;
  }

  processReceiptOcrJob({ householdId, jobId }) {
    const jobs = this.receiptOcrJobs.get(householdId) ?? [];
    const job = jobs.find((entry) => entry.jobId === jobId);
    if (!job || ['succeeded', 'succeeded_corrected', 'dead_letter'].includes(job.status)) return job;

    job.status = 'processing';
    job.attempts += 1;
    job.updatedAt = new Date().toISOString();

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

  retryReceiptOcrJob({ userId, householdId, jobId }) {
    this.assertMember(userId, householdId);
    const jobs = this.receiptOcrJobs.get(householdId) ?? [];
    const job = jobs.find((entry) => entry.jobId === jobId);
    if (!job) throw new Error('OCR_JOB_NOT_FOUND');
    if (!['failed'].includes(job.status)) throw new Error('OCR_JOB_RETRY_NOT_ALLOWED');

    job.status = 'queued';
    job.updatedAt = new Date().toISOString();
    this.pushActivity(householdId, userId, 'receipt.ocr.retried', `${userId} ritriggeroi OCR job`);

    setTimeout(() => {
      this.processReceiptOcrJob({ householdId, jobId: job.jobId });
    }, 20);

    return job;
  }

  listReceiptOcrJobs({ userId, householdId }) {
    this.assertMember(userId, householdId);
    return this.receiptOcrJobs.get(householdId) ?? [];
  }

  correctReceiptOcrJob({ userId, householdId, jobId, store, items }) {
    this.assertMember(userId, householdId);
    const jobs = this.receiptOcrJobs.get(householdId) ?? [];
    const job = jobs.find((entry) => entry.jobId === jobId);
    if (!job) throw new Error('OCR_JOB_NOT_FOUND');
    if (!['failed', 'dead_letter'].includes(job.status)) throw new Error('OCR_JOB_CORRECTION_NOT_ALLOWED');

    const normalizedItems = items.map((item) => ({
      name: item.name,
      quantity: Number(item.quantity ?? 1),
      unitPrice: Number(item.unitPrice ?? 0),
    }));

    job.correctedResult = {
      store,
      items: normalizedItems,
      total: Number(normalizedItems.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0).toFixed(2)),
    };
    job.status = 'succeeded_corrected';
    job.updatedAt = new Date().toISOString();
    this.pushActivity(householdId, userId, 'receipt.ocr.corrected', `${userId} korrigjoi manualisht OCR job`);

    return job;
  }

  applyReceiptOcrJobResult({ userId, householdId, jobId }) {
    this.assertMember(userId, householdId);
    const jobs = this.receiptOcrJobs.get(householdId) ?? [];
    const job = jobs.find((entry) => entry.jobId === jobId);
    if (!job) throw new Error('OCR_JOB_NOT_FOUND');

    const source = job.status === 'succeeded_corrected' ? job.correctedResult : job.result;
    if (!source) throw new Error('OCR_JOB_NOT_READY');

    const result = this.addReceipt({
      userId,
      householdId,
      store: source.store,
      items: source.items,
    });

    this.pushActivity(householdId, userId, 'receipt.ocr.applied', `${userId} aplikoi OCR rezultatin`);
    return { job, appliedReceipt: result.receipt, budget: result.budget };
  }

  listReceipts({ userId, householdId }) {
    this.assertMember(userId, householdId);
    return this.receipts.get(householdId);
  }

  getPantry({ userId, householdId }) {
    this.assertMember(userId, householdId);
    return this.pantry.get(householdId);
  }

  addPantryItem({ userId, householdId, name, quantity = 1 }) {
    this.assertMember(userId, householdId);
    const item = { id: randomUUID(), name, quantity, addedAt: new Date().toISOString() };
    this.pantry.get(householdId).push(item);
    this.clearRecipeCacheForHousehold(householdId);
    this.pushActivity(householdId, userId, 'pantry.item.added', `${userId} shtoi pantry item ${name}`);
    return item;
  }

  ingestStagingPrices({ actorId, rows }) {
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
    return this.priceRepository.ingest({ rows: prepared });
  }

  promoteStagingPrices({ actorId }) {
    const result = this.priceRepository.promoteValidated({ actorId });
    this.pricingEstimateCache.clear();
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
      ttlSec: PRICING_CACHE_TTL_MS / 1000,
    };
  }

  estimatePrices({ userId, householdId, refresh = false }) {
    this.assertMember(userId, householdId);
    const activeItems = (this.listItems.get(householdId) ?? []).filter((item) => !item.purchased);
    const signature = activeItems
      .map((item) => `${this.canonicalizeItemKey(item.name)}:${item.quantity}:${item.version}`)
      .sort()
      .join('|');
    const cacheKey = `${householdId}:${signature}`;
    const now = Date.now();

    if (!refresh) {
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

    return {
      ...payload,
      cached: false,
      cacheTtlSecRemaining: PRICING_CACHE_TTL_MS / 1000,
    };
  }

  listFlyers({ userId, householdId }) {
    this.assertMember(userId, householdId);
    const items = this.listItems.get(householdId).map((item) => this.normalizeName(item.name));
    return this.flyers.filter((flyer) => items.some((item) => item.includes(flyer.keyword)));
  }

  suggestRecipes({ userId, householdId, refresh = false }) {
    this.assertMember(userId, householdId);
    this.checkRecipeLimit(userId);
    const pantry = this.pantry.get(householdId);
    const pantrySignature = pantry
      .map((item) => `${this.canonicalizeItemKey(item.name)}:${item.quantity}`)
      .sort()
      .join('|');
    const cacheKey = `${householdId}:${pantrySignature}`;
    const now = Date.now();

    if (!refresh) {
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

    const suggestions = [];
    if (names.includes('domate') && names.includes('veze')) suggestions.push(RECIPE_TEMPLATES.shakshuka);
    if (names.includes('mish') && names.includes('oriz')) suggestions.push(RECIPE_TEMPLATES.pilaf_mish);
    if (suggestions.length === 0) suggestions.push(RECIPE_TEMPLATES.omlete_miks);

    const payload = {
      suggestions: suggestions.map((entry) => ({
        key: entry.key,
        name: entry.name,
        etaMin: entry.etaMin,
        promptTemplate: entry.promptTemplate,
      })),
      remainingFreeRequests: 3 - this.getTodayRecipeUsage(userId),
    };

    this.recipeSuggestionCache.set(cacheKey, {
      payload,
      expiresAt: now + RECIPE_CACHE_TTL_MS,
    });

    this.pushActivity(householdId, userId, 'recipes.generated', `${userId} kërkoi receta AI`);
    return {
      ...payload,
      cached: false,
      cacheTtlSecRemaining: RECIPE_CACHE_TTL_MS / 1000,
      promptTemplates: payload.suggestions.map((item) => ({ name: item.name, template: item.promptTemplate })),
    };
  }

  addRecipeIngredientsToList({ userId, householdId, recipeKey }) {
    this.assertMember(userId, householdId);
    const template = RECIPE_TEMPLATES[recipeKey];
    if (!template) throw new Error('RECIPE_NOT_FOUND');

    const pantry = this.pantry.get(householdId) ?? [];
    const items = this.listItems.get(householdId) ?? [];
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
    return { recipe: template.name, addedItems: added };
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
    if (!this.memberships.get(userId).has(householdId)) throw new Error('FORBIDDEN_HOUSEHOLD_ACCESS');
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
    this.activity.get(householdId).push(event);
    this.events.emit(`household:${householdId}`, event);
  }

  clearPricingCacheForHousehold(householdId) {
    for (const key of this.pricingEstimateCache.keys()) {
      if (key.startsWith(`${householdId}:`)) this.pricingEstimateCache.delete(key);
    }
  }

  clearRecipeCacheForHousehold(householdId) {
    for (const key of this.recipeSuggestionCache.keys()) {
      if (key.startsWith(`${householdId}:`)) this.recipeSuggestionCache.delete(key);
    }
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
    const item = (this.listItems.get(householdId) ?? []).find((entry) => entry.id === itemId);
    if (!item) throw new Error('ITEM_NOT_FOUND');
    return item;
  }

  autoMarkPurchased(householdId, itemName) {
    const normalized = this.canonicalizeItemKey(itemName);
    const item = (this.listItems.get(householdId) ?? []).find(
      (entry) => this.canonicalizeItemKey(entry.name) === normalized && !entry.purchased,
    );
    if (item) {
      item.purchased = true;
      item.version += 1;
      item.updatedAt = new Date().toISOString();
      this.clearPricingCacheForHousehold(householdId);
    }
  }

  checkRecipeLimit(userId) {
    const key = `${userId}:${this.currentDateKey()}`;
    const used = this.recipeUsage.get(key) ?? 0;
    if (used >= 3) throw new Error('AI_RATE_LIMIT');
    this.recipeUsage.set(key, used + 1);
  }

  getTodayRecipeUsage(userId) {
    return this.recipeUsage.get(`${userId}:${this.currentDateKey()}`) ?? 0;
  }

  currentMonth() {
    return new Date().toISOString().slice(0, 7);
  }

  currentDateKey() {
    return new Date().toISOString().slice(0, 10);
  }
}

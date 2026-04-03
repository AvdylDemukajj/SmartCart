const DAY_MS = 24 * 60 * 60 * 1000;

export const PII_INVENTORY = Object.freeze({
  household: Object.freeze([
    { field: 'name', class: 'restricted', pii: true },
    { field: 'ownerId', class: 'confidential', pii: true },
  ]),
  member: Object.freeze([
    { field: 'memberId', class: 'confidential', pii: true },
  ]),
  receipt: Object.freeze([
    { field: 'store', class: 'internal', pii: false },
    { field: 'ocrRawText', class: 'restricted', pii: true },
  ]),
  audit: Object.freeze([
    { field: 'userId', class: 'confidential', pii: true },
    { field: 'reason', class: 'restricted', pii: true },
  ]),
});

const RETENTION_DAYS_BY_CLASS = Object.freeze({
  public: 365,
  internal: 180,
  confidential: 90,
  restricted: 30,
});

function maskEmail(value) {
  const [name, domain] = String(value).split('@');
  if (!domain) return '***';
  const head = name.slice(0, 1) || '*';
  return `${head}***@${domain}`;
}

function maskGeneric(value) {
  const str = String(value);
  if (!str) return '***';
  if (str.length <= 4) return '*'.repeat(str.length);
  return `${str.slice(0, 2)}***${str.slice(-2)}`;
}

export function maskValue(value, { strategy = 'generic' } = {}) {
  if (value === null || value === undefined) return value;
  if (strategy === 'email') return maskEmail(value);
  if (strategy === 'full') return '***';
  return maskGeneric(value);
}

export function classifyField(entity, field) {
  const entry = (PII_INVENTORY[entity] || []).find((item) => item.field === field);
  return entry?.class ?? 'internal';
}

export function retentionDaysForClass(classification) {
  return RETENTION_DAYS_BY_CLASS[classification] ?? RETENTION_DAYS_BY_CLASS.internal;
}

export function retentionExpiryIso({ createdAt, classification }) {
  const baseTs = new Date(createdAt).getTime();
  const expiresAt = baseTs + retentionDaysForClass(classification) * DAY_MS;
  return new Date(expiresAt).toISOString();
}

export function maskRecord(entity, input) {
  const output = { ...input };
  for (const [key, value] of Object.entries(input || {})) {
    const classification = classifyField(entity, key);
    if (classification === 'confidential') output[key] = maskValue(value);
    if (classification === 'restricted') output[key] = maskValue(value, { strategy: 'full' });
  }
  return output;
}

export function applyRetentionByClass(records, now = Date.now()) {
  const kept = [];
  const purged = [];
  for (const record of records) {
    const createdAt = new Date(record.createdAt).getTime();
    const expiry = new Date(retentionExpiryIso({ createdAt: record.createdAt, classification: record.classification })).getTime();
    if (Number.isFinite(createdAt) && Number.isFinite(expiry) && expiry <= now) purged.push(record);
    else kept.push(record);
  }
  return {
    kept,
    purged,
    stats: {
      total: records.length,
      kept: kept.length,
      purged: purged.length,
    },
  };
}

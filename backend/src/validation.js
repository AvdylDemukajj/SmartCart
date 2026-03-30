function assertObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('VALIDATION_PAYLOAD');
}

function assertNonEmptyString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function assertPositiveNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function assertNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function parseBody(validator, body) {
  validator(body);
  return body;
}

export function createHouseholdSchema(body) {
  assertObject(body);
  if (!assertNonEmptyString(body.name)) throw new Error('VALIDATION_PAYLOAD');
}

export function addMemberSchema(body) {
  assertObject(body);
  if (!assertNonEmptyString(body.memberId)) throw new Error('VALIDATION_PAYLOAD');
}

export function addItemSchema(body) {
  assertObject(body);
  if (!assertNonEmptyString(body.name)) throw new Error('VALIDATION_PAYLOAD');
  if (body.quantity !== undefined && !assertPositiveNumber(body.quantity)) throw new Error('VALIDATION_PAYLOAD');
}

export function setBudgetSchema(body) {
  assertObject(body);
  if (!assertPositiveNumber(body.limit)) throw new Error('VALIDATION_PAYLOAD');
}

export function uploadUrlSchema(body) {
  assertObject(body);
  if (!assertNonEmptyString(body.fileName)) throw new Error('VALIDATION_PAYLOAD');
}

export function enqueueOcrSchema(body) {
  assertObject(body);
  if (!assertNonEmptyString(body.objectKey)) throw new Error('VALIDATION_PAYLOAD');
}

function validateReceiptItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('VALIDATION_PAYLOAD');
  for (const item of items) {
    assertObject(item);
    if (!assertNonEmptyString(item.name)) throw new Error('VALIDATION_PAYLOAD');
    if (item.quantity !== undefined && !assertPositiveNumber(item.quantity)) throw new Error('VALIDATION_PAYLOAD');
    if (item.unitPrice !== undefined && !assertNonNegativeNumber(item.unitPrice)) throw new Error('VALIDATION_PAYLOAD');
  }
}

export function addReceiptSchema(body) {
  assertObject(body);
  validateReceiptItems(body.items);
}

export function correctOcrSchema(body) {
  assertObject(body);
  if (!assertNonEmptyString(body.store)) throw new Error('VALIDATION_PAYLOAD');
  validateReceiptItems(body.items);
}

export function pricingStagingSchema(body) {
  assertObject(body);
  if (!Array.isArray(body.rows) || body.rows.length === 0) throw new Error('VALIDATION_PAYLOAD');
  for (const row of body.rows) {
    assertObject(row);
    if (!assertNonEmptyString(row.store) || !assertNonEmptyString(row.itemKey)) throw new Error('VALIDATION_PAYLOAD');
    if (typeof row.price !== 'number' || Number.isNaN(row.price)) throw new Error('VALIDATION_PAYLOAD');
  }
}

export function addPantrySchema(body) {
  assertObject(body);
  if (!assertNonEmptyString(body.name)) throw new Error('VALIDATION_PAYLOAD');
  if (body.quantity !== undefined && !assertPositiveNumber(body.quantity)) throw new Error('VALIDATION_PAYLOAD');
}

export function toggleItemSchema(body) {
  assertObject(body);
  if (body.expectedVersion !== undefined && (!Number.isInteger(body.expectedVersion) || body.expectedVersion <= 0)) throw new Error('VALIDATION_PAYLOAD');
}

export function voiceParseSchema(body) {
  assertObject(body);
  if (!assertNonEmptyString(body.transcript)) throw new Error('VALIDATION_PAYLOAD');
  if (body.transcript.length > 500) throw new Error('VALIDATION_PAYLOAD');
  if (body.locale !== undefined && !assertNonEmptyString(body.locale)) throw new Error('VALIDATION_PAYLOAD');
  if (body.addToList !== undefined && typeof body.addToList !== 'boolean') throw new Error('VALIDATION_PAYLOAD');
  if (body.contractVersion !== undefined && body.contractVersion !== 'v1') throw new Error('VALIDATION_PAYLOAD');
}

export function barcodeLookupSchema(body) {
  assertObject(body);
  if (!assertNonEmptyString(body.barcode)) throw new Error('VALIDATION_PAYLOAD');
  if (!/^\d{8,14}$/.test(body.barcode.trim())) throw new Error('VALIDATION_PAYLOAD');
  if (body.locale !== undefined && !assertNonEmptyString(body.locale)) throw new Error('VALIDATION_PAYLOAD');
  if (body.quantity !== undefined && !assertPositiveNumber(body.quantity)) throw new Error('VALIDATION_PAYLOAD');
  if (body.addToList !== undefined && typeof body.addToList !== 'boolean') throw new Error('VALIDATION_PAYLOAD');
}

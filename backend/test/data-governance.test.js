import test from 'node:test';
import assert from 'node:assert/strict';
import {
  PII_INVENTORY,
  applyRetentionByClass,
  classifyField,
  maskRecord,
  maskValue,
  retentionDaysForClass,
  retentionExpiryIso,
} from '../src/data-governance.js';

test('PII inventory has baseline entities', () => {
  assert.ok(PII_INVENTORY.household.length > 0);
  assert.ok(PII_INVENTORY.audit.length > 0);
});

test('maskValue applies generic, email and full masking', () => {
  assert.equal(maskValue('sensitive-data'), 'se***ta');
  assert.equal(maskValue('ana@example.com', { strategy: 'email' }), 'a***@example.com');
  assert.equal(maskValue('abcd', { strategy: 'full' }), '***');
});

test('classifyField and retention defaults are stable', () => {
  assert.equal(classifyField('audit', 'reason'), 'restricted');
  assert.equal(classifyField('unknown', 'field'), 'internal');
  assert.equal(retentionDaysForClass('confidential'), 90);
  assert.equal(retentionDaysForClass('unknown'), 180);
});

test('retentionExpiryIso computes deterministic expiry by class', () => {
  const expiry = retentionExpiryIso({ createdAt: '2026-01-01T00:00:00.000Z', classification: 'restricted' });
  assert.equal(expiry, '2026-01-31T00:00:00.000Z');
});

test('maskRecord masks confidential/restricted fields', () => {
  const masked = maskRecord('audit', { userId: 'john-doe', reason: 'card number leaked', path: '/x' });
  assert.equal(masked.userId.includes('***'), true);
  assert.equal(masked.reason, '***');
  assert.equal(masked.path, '/x');
});

test('applyRetentionByClass purges expired records by class policy', () => {
  const now = Date.parse('2026-04-01T00:00:00.000Z');
  const records = [
    { id: 1, classification: 'restricted', createdAt: '2026-01-01T00:00:00.000Z' },
    { id: 2, classification: 'public', createdAt: '2026-03-25T00:00:00.000Z' },
  ];
  const result = applyRetentionByClass(records, now);
  assert.equal(result.purged.length, 1);
  assert.equal(result.purged[0].id, 1);
  assert.equal(result.kept.length, 1);
  assert.equal(result.stats.total, 2);
});

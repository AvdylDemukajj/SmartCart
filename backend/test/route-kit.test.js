import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBooleanQuery, requireAuditAccess } from '../src/http/route-kit.js';

test('parseBooleanQuery parses common boolean query forms', () => {
  assert.equal(parseBooleanQuery({ value: null, code: 'ERR_FLAG', defaultValue: false }), false);
  assert.equal(parseBooleanQuery({ value: '1', code: 'ERR_FLAG', defaultValue: false }), true);
  assert.equal(parseBooleanQuery({ value: 'true', code: 'ERR_FLAG', defaultValue: false }), true);
  assert.equal(parseBooleanQuery({ value: '0', code: 'ERR_FLAG', defaultValue: true }), false);
  assert.equal(parseBooleanQuery({ value: 'false', code: 'ERR_FLAG', defaultValue: true }), false);
});

test('parseBooleanQuery throws configured validation code on invalid value', () => {
  assert.throws(() => parseBooleanQuery({ value: 'yes', code: 'VALIDATION_QUERY_REFRESH' }), /VALIDATION_QUERY_REFRESH/);
});

test('requireAuditAccess throws when callback denies access', () => {
  assert.throws(
    () =>
      requireAuditAccess({
        authContext: { userId: 'u1' },
        canAccessAuditLog: () => false,
      }),
    /FORBIDDEN_AUDIT_ACCESS/,
  );
});

test('requireAuditAccess succeeds when callback grants access', () => {
  assert.doesNotThrow(() =>
    requireAuditAccess({
      authContext: { userId: 'u1' },
      canAccessAuditLog: () => true,
    }),
  );
});

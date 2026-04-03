import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveHttpError } from '../src/core/error-catalog.js';

test('resolveHttpError maps known errors to stable status/code/message', () => {
  const mapped = resolveHttpError('OCR_JOB_NOT_READY');
  assert.equal(mapped.status, 409);
  assert.equal(mapped.code, 'OCR_JOB_NOT_READY');
  assert.equal(mapped.message, 'OCR job not ready');
});

test('resolveHttpError maps validation-prefixed errors to 400 preserving code', () => {
  const mapped = resolveHttpError('VALIDATION_PAYLOAD');
  assert.equal(mapped.status, 400);
  assert.equal(mapped.code, 'VALIDATION_PAYLOAD');
  assert.equal(mapped.message, 'VALIDATION_PAYLOAD');
});

test('resolveHttpError falls back to internal error for unknown messages', () => {
  const mapped = resolveHttpError('SOMETHING_NEW');
  assert.equal(mapped.status, 500);
  assert.equal(mapped.code, 'INTERNAL_ERROR');
  assert.equal(mapped.message, 'Internal server error');
});

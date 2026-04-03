import test from 'node:test';
import assert from 'node:assert/strict';
import { readPositiveIntEnv } from '../src/core/env.js';

test('readPositiveIntEnv falls back on invalid values', () => {
  const previous = process.env.TEST_POSITIVE_INT;
  process.env.TEST_POSITIVE_INT = 'invalid';
  try {
    assert.equal(readPositiveIntEnv('TEST_POSITIVE_INT', 25), 25);
    process.env.TEST_POSITIVE_INT = '-2';
    assert.equal(readPositiveIntEnv('TEST_POSITIVE_INT', 25), 25);
  } finally {
    if (previous === undefined) delete process.env.TEST_POSITIVE_INT;
    else process.env.TEST_POSITIVE_INT = previous;
  }
});

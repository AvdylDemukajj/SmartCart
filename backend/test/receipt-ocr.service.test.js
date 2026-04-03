import test from 'node:test';
import assert from 'node:assert/strict';
import { ReceiptOcrService } from '../src/services/receipt-ocr.service.js';

function createService() {
  return new ReceiptOcrService({
    repo: { receiptOcrJobs: new Map([['h1', []]]) },
    assertMember: async () => {},
    pushActivity: async () => {},
    recordDbTrace: () => {},
    normalizeReceiptItems: (items) => items,
    addReceipt: async () => ({ receipt: { id: 'r1' }, budget: { spent: 10 } }),
    retryBaseDelayMs: 10,
    retryMaxDelayMs: 100,
    replayWindowMs: 60_000,
  });
}

test('receipt OCR processing sets delayed retry with backoff before dead-letter', async () => {
  const service = createService();
  const job = await service.enqueue({ userId: 'ana', householdId: 'h1', objectKey: 'receipt-fail.png' });

  const first = service.process({ householdId: 'h1', jobId: job.jobId });
  assert.equal(first.status, 'failed');
  assert.equal(typeof first.nextAttemptAt, 'string');

  const tooEarly = service.process({ householdId: 'h1', jobId: job.jobId });
  assert.equal(tooEarly.status, 'queued');

  first.nextAttemptAt = new Date(Date.now() - 50).toISOString();
  const second = service.process({ householdId: 'h1', jobId: job.jobId });
  assert.equal(second.status, 'failed');

  second.nextAttemptAt = new Date(Date.now() - 50).toISOString();
  const third = service.process({ householdId: 'h1', jobId: job.jobId });
  assert.equal(third.status, 'dead_letter');
});

test('receipt OCR retry deduplicates replay token within replay window', async () => {
  const service = createService();
  const job = await service.enqueue({ userId: 'ana', householdId: 'h1', objectKey: 'receipt-fail-2.png' });
  job.status = 'dead_letter';

  const retried = await service.retry({ userId: 'ana', householdId: 'h1', jobId: job.jobId, replayToken: 'token-12345' });
  assert.equal(retried.status, 'queued');

  retried.status = 'dead_letter';
  const duplicateReplay = await service.retry({ userId: 'ana', householdId: 'h1', jobId: job.jobId, replayToken: 'token-12345' });
  assert.equal(duplicateReplay.status, 'dead_letter');
});

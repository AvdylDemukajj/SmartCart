import { randomUUID } from 'node:crypto';

const DEFAULT_RETRY_BASE_DELAY_MS = 500;
const DEFAULT_RETRY_MAX_DELAY_MS = 15_000;
const DEFAULT_REPLAY_WINDOW_MS = 120_000;

export class ReceiptOcrService {
  constructor({
    repo,
    assertMember,
    pushActivity,
    recordDbTrace,
    normalizeReceiptItems,
    addReceipt,
    retryBaseDelayMs = DEFAULT_RETRY_BASE_DELAY_MS,
    retryMaxDelayMs = DEFAULT_RETRY_MAX_DELAY_MS,
    replayWindowMs = DEFAULT_REPLAY_WINDOW_MS,
  }) {
    this.repo = repo;
    this.assertMember = assertMember;
    this.pushActivity = pushActivity;
    this.recordDbTrace = recordDbTrace;
    this.normalizeReceiptItems = normalizeReceiptItems;
    this.addReceipt = addReceipt;
    this.retryBaseDelayMs = retryBaseDelayMs;
    this.retryMaxDelayMs = retryMaxDelayMs;
    this.replayWindowMs = replayWindowMs;
  }

  async enqueue({ userId, householdId, objectKey, apiRequestId = null, traceContext = null }) {
    await this.assertMember(userId, householdId);
    const job = {
      jobId: randomUUID(),
      householdId,
      objectKey,
      status: 'queued',
      attempts: 0,
      maxAttempts: 3,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      nextAttemptAt: null,
      lastFailureAt: null,
      replayToken: null,
      replayedAt: null,
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
    await this.pushActivity(householdId, userId, 'receipt.ocr.queued', `${userId} nisi OCR job`);
    this.recordDbTrace({ requestId: traceContext?.requestId, operation: 'insert', entity: 'receipt_ocr_jobs', householdId });

    setTimeout(() => {
      this.process({ householdId, jobId: job.jobId });
    }, 20);

    return job;
  }

  process({ householdId, jobId }) {
    const jobs = this.repo.receiptOcrJobs.get(householdId) ?? [];
    const job = jobs.find((entry) => entry.jobId === jobId);
    if (!job || ['succeeded', 'succeeded_corrected', 'dead_letter'].includes(job.status)) return job;

    if (job.nextAttemptAt) {
      const now = Date.now();
      const attemptAtMs = Date.parse(job.nextAttemptAt);
      if (Number.isFinite(attemptAtMs) && attemptAtMs > now) {
        job.status = 'queued';
        return job;
      }
    }

    job.status = 'processing';
    job.attempts += 1;
    job.updatedAt = new Date().toISOString();
    job.trace.workerRunId = randomUUID();
    job.trace.workerStartedAt = new Date().toISOString();

    const shouldFail = String(job.objectKey || '').toLowerCase().includes('fail');

    if (shouldFail) {
      job.error = 'OCR_ENGINE_PARSE_ERROR';
      job.lastFailureAt = new Date().toISOString();
      if (job.attempts >= job.maxAttempts) {
        job.status = 'dead_letter';
        job.nextAttemptAt = null;
      } else {
        job.status = 'failed';
        const delayMs = this.computeBackoffDelayMs(job.attempts);
        job.nextAttemptAt = new Date(Date.now() + delayMs).toISOString();
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
    job.nextAttemptAt = null;
    job.updatedAt = new Date().toISOString();
    return job;
  }

  async retry({ userId, householdId, jobId, replayToken = null, traceContext = null }) {
    await this.assertMember(userId, householdId);
    const jobs = this.repo.receiptOcrJobs.get(householdId) ?? [];
    const job = jobs.find((entry) => entry.jobId === jobId);
    if (!job) throw new Error('OCR_JOB_NOT_FOUND');
    if (!['failed', 'dead_letter'].includes(job.status)) throw new Error('OCR_JOB_RETRY_NOT_ALLOWED');

    if (replayToken && this.isReplayDuplicate(job, replayToken)) return job;

    job.status = 'queued';
    job.nextAttemptAt = null;
    job.replayToken = replayToken;
    job.replayedAt = replayToken ? new Date().toISOString() : job.replayedAt;
    job.updatedAt = new Date().toISOString();
    await this.pushActivity(householdId, userId, 'receipt.ocr.retried', `${userId} ritriggeroi OCR job`);
    this.recordDbTrace({ requestId: traceContext?.requestId, operation: 'update', entity: 'receipt_ocr_jobs', householdId });

    setTimeout(() => {
      this.process({ householdId, jobId: job.jobId });
    }, 20);

    return job;
  }

  async list({ userId, householdId }) {
    await this.assertMember(userId, householdId);
    return this.repo.receiptOcrJobs.get(householdId) ?? [];
  }

  async correct({ userId, householdId, jobId, store, items, traceContext = null }) {
    await this.assertMember(userId, householdId);
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
    await this.pushActivity(householdId, userId, 'receipt.ocr.corrected', `${userId} korrigjoi manualisht OCR job`);
    this.recordDbTrace({ requestId: traceContext?.requestId, operation: 'update', entity: 'receipt_ocr_jobs', householdId });

    return job;
  }

  async apply({ userId, householdId, jobId, applyRequestId = null, traceContext = null }) {
    await this.assertMember(userId, householdId);
    const jobs = this.repo.receiptOcrJobs.get(householdId) ?? [];
    const job = jobs.find((entry) => entry.jobId === jobId);
    if (!job) throw new Error('OCR_JOB_NOT_FOUND');

    const source = job.status === 'succeeded_corrected' ? job.correctedResult : job.result;
    if (!source) throw new Error('OCR_JOB_NOT_READY');

    const result = await this.addReceipt({
      userId,
      householdId,
      store: source.store,
      items: source.items,
      traceContext,
    });

    job.trace.applyRequestId = applyRequestId;
    await this.pushActivity(householdId, userId, 'receipt.ocr.applied', `${userId} aplikoi OCR rezultatin`);
    this.recordDbTrace({ requestId: traceContext?.requestId, operation: 'update', entity: 'receipt_ocr_jobs', householdId });
    return { job, appliedReceipt: result.receipt, budget: result.budget };
  }

  getQueueDepth() {
    const jobs = Array.from(this.repo.receiptOcrJobs.values()).flat();
    return {
      total: jobs.length,
      queued: jobs.filter((entry) => entry.status === 'queued').length,
      processing: jobs.filter((entry) => entry.status === 'processing').length,
      failed: jobs.filter((entry) => entry.status === 'failed').length,
      deadLetter: jobs.filter((entry) => entry.status === 'dead_letter').length,
      delayed: jobs.filter((entry) => entry.status === 'failed' && entry.nextAttemptAt).length,
    };
  }

  computeBackoffDelayMs(attempt) {
    const base = this.retryBaseDelayMs * (2 ** Math.max(0, attempt - 1));
    const jitter = Math.floor(Math.random() * Math.max(1, Math.floor(base * 0.2)));
    return Math.min(this.retryMaxDelayMs, base + jitter);
  }

  isReplayDuplicate(job, replayToken) {
    if (!job.replayToken || job.replayToken !== replayToken || !job.replayedAt) return false;
    return Date.now() - Date.parse(job.replayedAt) < this.replayWindowMs;
  }
}

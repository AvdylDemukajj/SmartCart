import { createHash, randomUUID } from 'node:crypto';

const DEFAULT_MAX_AUDIT_ENTRIES = 500;
const DEFAULT_RETENTION_DAYS = 90;

function stableStringify(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((entry) => stableStringify(entry)).join(',')}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
}

export class AuditLogService {
  constructor({
    repo,
    coreRepository = null,
    maxEntries = DEFAULT_MAX_AUDIT_ENTRIES,
    retentionDays = DEFAULT_RETENTION_DAYS,
    integritySalt,
  }) {
    if (!integritySalt || !String(integritySalt).trim()) throw new Error('AUDIT_LOG_INTEGRITY_SALT_REQUIRED');
    this.repo = repo;
    this.coreRepository = coreRepository;
    this.maxEntries = maxEntries;
    this.retentionDays = retentionDays;
    this.integritySalt = String(integritySalt).trim();
  }

  async record(event) {
    await this.pruneExpired();

    const createdAt = new Date().toISOString();
    const previous = this.repo.securityAuditLog[this.repo.securityAuditLog.length - 1] ?? null;
    const prevHash = previous?.hash ?? null;
    const hash = this.computeHash({ event, createdAt, prevHash });

    const entry = {
      id: randomUUID(),
      ...event,
      createdAt,
      prevHash,
      hash,
    };

    this.repo.securityAuditLog.push(entry);

    if (this.repo.securityAuditLog.length > this.maxEntries) {
      this.repo.securityAuditLog.splice(0, this.repo.securityAuditLog.length - this.maxEntries);
    }

    if (this.coreRepository?.appendSecurityAuditLog) {
      await this.coreRepository.appendSecurityAuditLog(entry);
    }
  }

  async list({ userId, limit = 100 }) {
    if (!userId) throw new Error('FORBIDDEN_HOUSEHOLD_ACCESS');
    const boundedLimit = Math.max(1, Math.min(this.maxEntries, limit));
    if (this.coreRepository?.listSecurityAuditLog) {
      return this.coreRepository.listSecurityAuditLog({ limit: boundedLimit });
    }
    return this.repo.securityAuditLog.slice(-boundedLimit);
  }

  async pruneExpired(referenceDate = new Date()) {
    const cutoff = referenceDate.getTime() - (this.retentionDays * 24 * 60 * 60 * 1000);
    const before = this.repo.securityAuditLog.length;
    this.repo.securityAuditLog = this.repo.securityAuditLog.filter((entry) => Date.parse(entry.createdAt) >= cutoff);

    if (this.repo.securityAuditLog.length > this.maxEntries) {
      this.repo.securityAuditLog.splice(0, this.repo.securityAuditLog.length - this.maxEntries);
    }

    if (this.repo.securityAuditLog.length > 0) this.rebuildHashes();

    let deletedFromCore = 0;
    if (this.coreRepository?.pruneSecurityAuditLog) {
      const result = await this.coreRepository.pruneSecurityAuditLog({ cutoffIso: new Date(cutoff).toISOString(), maxEntries: this.maxEntries });
      deletedFromCore = result.deleted;
    }

    return {
      deleted: Math.max(0, before - this.repo.securityAuditLog.length) + deletedFromCore,
      retained: this.repo.securityAuditLog.length,
      cutoffIso: new Date(cutoff).toISOString(),
    };
  }

  async verifyIntegrity() {
    const entries = this.coreRepository?.listSecurityAuditLog
      ? await this.coreRepository.listSecurityAuditLog({ limit: this.maxEntries, ascending: true })
      : this.repo.securityAuditLog;

    let previousHash = null;
    for (const entry of entries) {
      const expected = this.computeHash({ event: this.extractEventPayload(entry), createdAt: entry.createdAt, prevHash: previousHash });
      if (entry.hash !== expected) {
        return {
          ok: false,
          reason: 'AUDIT_LOG_TAMPER_DETECTED',
          entryId: entry.id,
          expectedHash: expected,
          actualHash: entry.hash,
        };
      }
      previousHash = entry.hash;
    }

    return {
      ok: true,
      reason: 'OK',
      entries: entries.length,
      lastHash: previousHash,
    };
  }

  computeHash({ event, createdAt, prevHash }) {
    return createHash('sha256')
      .update(this.integritySalt)
      .update('|')
      .update(prevHash ?? 'root')
      .update('|')
      .update(createdAt)
      .update('|')
      .update(stableStringify(event))
      .digest('hex');
  }

  extractEventPayload(entry) {
    const { id, createdAt, prevHash, hash, ...event } = entry;
    return event;
  }

  rebuildHashes() {
    let previousHash = null;
    this.repo.securityAuditLog = this.repo.securityAuditLog.map((entry) => {
      const event = this.extractEventPayload(entry);
      const hash = this.computeHash({ event, createdAt: entry.createdAt, prevHash: previousHash });
      const rebuilt = {
        ...entry,
        prevHash: previousHash,
        hash,
      };
      previousHash = hash;
      return rebuilt;
    });
  }
}

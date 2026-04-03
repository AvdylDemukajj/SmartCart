import test from 'node:test';
import assert from 'node:assert/strict';
import { AuditLogService } from '../src/services/audit-log.service.js';

test('AuditLogService records/list with hash chaining and integrity verification', async () => {
  const repo = { securityAuditLog: [] };
  const service = new AuditLogService({ repo, integritySalt: 'test-salt' });

  await service.record({ event: 'forbidden', userId: 'u1' });
  await service.record({ event: 'forbidden', userId: 'u2' });

  const logs = await service.list({ userId: 'admin', limit: 2 });
  assert.equal(logs.length, 2);
  assert.equal(typeof logs[0].hash, 'string');
  assert.equal(typeof logs[1].prevHash, 'string');

  const integrity = await service.verifyIntegrity();
  assert.equal(integrity.ok, true);
});

test('AuditLogService detects tampering and enforces retention pruning', async () => {
  const repo = { securityAuditLog: [] };
  const service = new AuditLogService({ repo, retentionDays: 30, integritySalt: 'test-salt' });

  await service.record({ event: 'e1', userId: 'u1' });
  await service.record({ event: 'e2', userId: 'u2' });

  repo.securityAuditLog[0].event = 'tampered';
  const integrity = await service.verifyIntegrity();
  assert.equal(integrity.ok, false);
  assert.equal(integrity.reason, 'AUDIT_LOG_TAMPER_DETECTED');

  repo.securityAuditLog = [
    {
      id: 'old-entry',
      event: 'legacy',
      userId: 'old',
      createdAt: new Date(Date.now() - (45 * 24 * 60 * 60 * 1000)).toISOString(),
      prevHash: null,
      hash: 'legacy',
    },
  ];
  const prune = await service.pruneExpired(new Date());
  assert.equal(prune.retained, 0);
  assert.equal(prune.deleted, 1);
});

test('AuditLogService requires non-empty integrity salt', () => {
  const repo = { securityAuditLog: [] };
  assert.throws(() => new AuditLogService({ repo, integritySalt: '' }), /AUDIT_LOG_INTEGRITY_SALT_REQUIRED/);
});


test('AuditLogService uses coreRepository durability hooks when provided', async () => {
  const repo = { securityAuditLog: [] };
  const persisted = [];
  const coreRepository = {
    appendSecurityAuditLog: async (entry) => { persisted.push(entry); },
    listSecurityAuditLog: async () => [...persisted],
    pruneSecurityAuditLog: async () => ({ deleted: 1 }),
  };
  const service = new AuditLogService({ repo, coreRepository, integritySalt: 'test-salt' });

  await service.record({ event: 'forbidden', userId: 'u1' });
  const listed = await service.list({ userId: 'admin', limit: 10 });
  assert.equal(listed.length, 1);

  const pruned = await service.pruneExpired(new Date(Date.now() + (365 * 24 * 60 * 60 * 1000)));
  assert.equal(pruned.deleted >= 1, true);
});

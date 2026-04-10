import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const DATABASE_URL = process.env.DATABASE_URL;
const ROOT = path.resolve(import.meta.dirname, '..');

async function applyMigrations(repository) {
  const files = ['0001_initial.sql', '0002_rls_and_security.sql', '0003_schema_parity_and_rls.sql', '0004_list_items_version.sql', '0005_security_audit_log.sql'];
  for (const file of files) {
    const sql = await readFile(path.join(ROOT, 'db/migrations', file), 'utf8');
    await repository.pool.query(sql);
  }
}

test('postgres repository: household/member/item flow with tenant isolation', { skip: !DATABASE_URL }, async () => {
  const { PostgresHouseholdRepository } = await import('../src/repositories/postgres-household-repository.js');
  const schema = `smartcart_test_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const repository = new PostgresHouseholdRepository({ connectionString: DATABASE_URL, schema });
  await repository.pool.query(`create schema if not exists ${schema}`);

  try {
    await applyMigrations(repository);

    const householdId = randomUUID();
    const createdAt = new Date().toISOString();
    await repository.createHousehold({
      id: householdId,
      name: 'Family DB',
      ownerId: 'ana',
      createdAt,
      month: createdAt.slice(0, 7),
    });

    const anaHouseholds = await repository.listUserHouseholds('ana');
    assert.equal(anaHouseholds.length, 1);
    assert.equal(anaHouseholds[0].id, householdId);

    await repository.addMember({ householdId, memberId: 'bora' });
    const boraIsMember = await repository.assertMember({ householdId, userId: 'bora' });
    const outsiderIsMember = await repository.assertMember({ householdId, userId: 'outsider' });
    assert.equal(boraIsMember, true);
    assert.equal(outsiderIsMember, false);

    await repository.addItem({
      id: randomUUID(),
      householdId,
      name: 'Qumesht',
      quantity: 2,
      category: 'Bulmet',
      purchased: false,
      createdAt,
      updatedAt: createdAt,
    });

    const items = await repository.listItems({ householdId });
    assert.equal(items.length, 1);
    assert.equal(items[0].name, 'Qumesht');
    assert.equal(Number(items[0].quantity), 2);
    assert.equal(Number(items[0].version), 1);

    const toggled = await repository.toggleItem({ householdId, itemId: items[0].id, expectedVersion: 1 });
    assert.equal(toggled.purchased, true);
    assert.equal(Number(toggled.version), 2);

    const stale = await repository.toggleItem({ householdId, itemId: items[0].id, expectedVersion: 1 });
    assert.equal(stale.conflict, true);
  } finally {
    await repository.pool.query(`drop schema if exists ${schema} cascade`);
    await repository.close();
  }
});

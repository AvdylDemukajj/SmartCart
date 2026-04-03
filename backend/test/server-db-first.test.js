import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createApp } from '../src/server.js';

const DATABASE_URL = process.env.DATABASE_URL;
const ROOT = path.resolve(import.meta.dirname, '..');

async function applyMigrations(repository) {
  const files = ['0001_initial.sql', '0002_rls_and_security.sql', '0003_schema_parity_and_rls.sql', '0004_list_items_version.sql', '0005_security_audit_log.sql'];
  for (const file of files) {
    const sql = await readFile(path.join(ROOT, 'db/migrations', file), 'utf8');
    await repository.pool.query(sql);
  }
}

test('server supports DB-first coreRepository flow for households/items/toggle', { skip: !DATABASE_URL }, async () => {
  const { PostgresHouseholdRepository } = await import('../src/repositories/postgres-household-repository.js');
  const schema = `smartcart_server_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const coreRepository = new PostgresHouseholdRepository({ connectionString: DATABASE_URL, schema });
  await coreRepository.pool.query(`create schema if not exists ${schema}`);
  await applyMigrations(coreRepository);

  const server = createApp({ coreRepository });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  try {
    const createRes = await fetch(`${baseUrl}/households`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'DB Household' }),
    });
    assert.equal(createRes.status, 201);
    const household = await createRes.json();

    const addItemRes = await fetch(`${baseUrl}/households/${household.id}/items`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Qumesht', quantity: 1 }),
    });
    assert.equal(addItemRes.status, 201);
    const item = await addItemRes.json();
    assert.equal(item.version, 1);

    const toggleOk = await fetch(`${baseUrl}/households/${household.id}/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({ expectedVersion: 1 }),
    });
    assert.equal(toggleOk.status, 200);
    const toggled = await toggleOk.json();
    assert.equal(toggled.version, 2);

    const toggleConflict = await fetch(`${baseUrl}/households/${household.id}/items/${item.id}`, {
      method: 'PATCH',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({ expectedVersion: 1 }),
    });
    assert.equal(toggleConflict.status, 409);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await coreRepository.pool.query(`drop schema if exists ${schema} cascade`);
    await coreRepository.close();
  }
});

test('server DB-first membership checks work after app restart', { skip: !DATABASE_URL }, async () => {
  const { PostgresHouseholdRepository } = await import('../src/repositories/postgres-household-repository.js');
  const schema = `smartcart_server_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
  const coreRepository = new PostgresHouseholdRepository({ connectionString: DATABASE_URL, schema });
  await coreRepository.pool.query(`create schema if not exists ${schema}`);
  await applyMigrations(coreRepository);

  const firstServer = createApp({ coreRepository });
  await new Promise((resolve) => firstServer.listen(0, resolve));
  const firstBaseUrl = `http://127.0.0.1:${firstServer.address().port}`;
  let householdId;

  try {
    const createRes = await fetch(`${firstBaseUrl}/households`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Restart household' }),
    });
    assert.equal(createRes.status, 201);
    const household = await createRes.json();
    householdId = household.id;

    const addMemberRes = await fetch(`${firstBaseUrl}/households/${householdId}/members`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({ memberId: 'bora' }),
    });
    assert.equal(addMemberRes.status, 201);
  } finally {
    await new Promise((resolve) => firstServer.close(resolve));
  }

  const secondServer = createApp({ coreRepository });
  await new Promise((resolve) => secondServer.listen(0, resolve));
  const secondBaseUrl = `http://127.0.0.1:${secondServer.address().port}`;

  try {
    const listRes = await fetch(`${secondBaseUrl}/households/${householdId}/items`, {
      method: 'GET',
      headers: { 'x-user-id': 'bora' },
    });
    assert.equal(listRes.status, 200);
    const payload = await listRes.json();
    assert.deepEqual(payload, []);
  } finally {
    await new Promise((resolve) => secondServer.close(resolve));
    await coreRepository.pool.query(`drop schema if exists ${schema} cascade`);
    await coreRepository.close();
  }
});

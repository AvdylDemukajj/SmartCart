import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

const ROOT = path.resolve(import.meta.dirname, '..');

async function loadSql(relativePath) {
  return readFile(path.join(ROOT, relativePath), 'utf8');
}

test('migration chain keeps parity with schema.sql core tables', async () => {
  const schemaSql = await loadSql('db/schema.sql');
  const migrationDir = path.join(ROOT, 'db/migrations');
  const migrationFiles = (await readdir(migrationDir))
    .filter((name) => /^\d+_.*\.sql$/.test(name))
    .sort();
  const migrationSql = await Promise.all(migrationFiles.map((name) => readFile(path.join(migrationDir, name), 'utf8')));
  const combinedMigrations = migrationSql.join('\n').toLowerCase();

  const tableRegex = /create table if not exists\s+([a-z_]+)/gi;
  const schemaTables = new Set();
  for (const match of schemaSql.matchAll(tableRegex)) {
    schemaTables.add(match[1].toLowerCase());
  }

  for (const table of schemaTables) {
    const expected = `create table if not exists ${table}`;
    assert.equal(combinedMigrations.includes(expected), true, `missing table in migrations: ${table}`);
  }
});

test('tenant-bound tables are covered by RLS enable + policy statements', async () => {
  const rlsSql = (
    await Promise.all([
      loadSql('db/migrations/0002_rls_and_security.sql'),
      loadSql('db/migrations/0003_schema_parity_and_rls.sql'),
    ])
  )
    .join('\n')
    .toLowerCase();

  const tenantTables = ['households', 'household_members', 'list_items', 'monthly_budgets', 'receipts', 'pantry_items', 'activity_log'];

  for (const table of tenantTables) {
    assert.equal(rlsSql.includes(`alter table ${table} enable row level security;`), true, `missing RLS enable for ${table}`);
    assert.equal(rlsSql.includes(` on ${table}`), true, `missing policy for ${table}`);
  }
});

test('list_items optimistic lock version exists in schema and migrations', async () => {
  const schemaSql = (await loadSql('db/schema.sql')).toLowerCase();
  const migrationSql = (await loadSql('db/migrations/0004_list_items_version.sql')).toLowerCase();

  assert.equal(schemaSql.includes('version int not null default 1'), true);
  assert.equal(migrationSql.includes('add column if not exists version int not null default 1'), true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';

async function withServer(fn) {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('contract: health response shape', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.deepEqual(Object.keys(body).sort(), ['modules', 'ok', 'service']);
    assert.equal(typeof body.ok, 'boolean');
    assert.equal(typeof body.service, 'string');
    assert.equal(Array.isArray(body.modules), true);
  });
});

test('contract: create/list household shape', async () => {
  await withServer(async (baseUrl) => {
    const create = await fetch(`${baseUrl}/households`, {
      method: 'POST',
      headers: { 'x-user-id': 'contract-user', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Contract House' }),
    });
    assert.equal(create.status, 201);
    const created = await create.json();
    for (const key of ['id', 'name', 'ownerId', 'createdAt']) {
      assert.equal(typeof created[key], 'string');
    }

    const list = await fetch(`${baseUrl}/households`, { headers: { 'x-user-id': 'contract-user' } });
    assert.equal(list.status, 200);
    const households = await list.json();
    assert.equal(Array.isArray(households), true);
    assert.equal(households.length >= 1, true);
    assert.equal(typeof households[0].id, 'string');
  });
});

test('contract: pricing estimate shape', async () => {
  await withServer(async (baseUrl) => {
    const create = await fetch(`${baseUrl}/households`, {
      method: 'POST',
      headers: { 'x-user-id': 'contract-user', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Contract House' }),
    });
    const household = await create.json();

    await fetch(`${baseUrl}/households/${household.id}/items`, {
      method: 'POST',
      headers: { 'x-user-id': 'contract-user', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Qumesht', quantity: 1 }),
    });

    const res = await fetch(`${baseUrl}/households/${household.id}/pricing/estimate`, {
      headers: { 'x-user-id': 'contract-user' },
    });
    assert.equal(res.status, 200);
    const body = await res.json();

    for (const key of ['bestStore', 'totals', 'itemCount', 'cached', 'cacheTtlSecRemaining']) {
      assert.notEqual(body[key], undefined);
    }
    assert.equal(Array.isArray(body.totals), true);
  });
});

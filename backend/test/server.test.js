import http from 'node:http';
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

async function createHousehold(baseUrl, user = 'ana') {
  const res = await fetch(`${baseUrl}/households`, {
    method: 'POST',
    headers: { 'x-user-id': user, 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Family A' }),
  });
  assert.equal(res.status, 201);
  return res.json();
}

function openSse(url, userId) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { headers: { 'x-user-id': userId, accept: 'text/event-stream' } }, (res) => {
      resolve({ req, res });
    });
    req.on('error', reject);
    req.end();
  });
}

test('health endpoint works', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/health`);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);
    assert.equal(Array.isArray(body.modules), true);
    assert.equal(typeof res.headers.get('x-request-id'), 'string');
  });
});

test('supports bearer dev token auth', async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/households`, {
      method: 'POST',
      headers: {
        authorization: 'Bearer dev-user:ana-token',
        'content-type': 'application/json',
      },
      body: JSON.stringify({ name: 'Auth Household' }),
    });
    assert.equal(res.status, 201);
  });
});

test('household + items + tenant isolation', async () => {
  await withServer(async (baseUrl) => {
    const household = await createHousehold(baseUrl);
    const ownerHeaders = { 'x-user-id': 'ana', 'content-type': 'application/json' };

    const addItemRes = await fetch(`${baseUrl}/households/${household.id}/items`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ name: 'Qumesht', quantity: 2 }),
    });
    assert.equal(addItemRes.status, 201);

    const outsiderRes = await fetch(`${baseUrl}/households/${household.id}/items`, {
      headers: { 'x-user-id': 'outsider' },
    });
    assert.equal(outsiderRes.status, 403);

    const addMemberRes = await fetch(`${baseUrl}/households/${household.id}/members`, {
      method: 'POST',
      headers: ownerHeaders,
      body: JSON.stringify({ memberId: 'rami' }),
    });
    assert.equal(addMemberRes.status, 201);

    const memberListRes = await fetch(`${baseUrl}/households/${household.id}/items`, {
      headers: { 'x-user-id': 'rami' },
    });
    assert.equal(memberListRes.status, 200);
    const memberItems = await memberListRes.json();
    assert.equal(memberItems.length, 1);
    assert.equal(memberItems[0].category, 'Bulmet');
  });
});

test('item version conflict returns 409', async () => {
  await withServer(async (baseUrl) => {
    const household = await createHousehold(baseUrl);
    const headers = { 'x-user-id': 'ana', 'content-type': 'application/json' };

    const addItemRes = await fetch(`${baseUrl}/households/${household.id}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Buke', quantity: 1 }),
    });
    const item = await addItemRes.json();

    const okPatch = await fetch(`${baseUrl}/households/${household.id}/items/${item.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ expectedVersion: 1 }),
    });
    assert.equal(okPatch.status, 200);

    const conflictPatch = await fetch(`${baseUrl}/households/${household.id}/items/${item.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ expectedVersion: 1 }),
    });
    assert.equal(conflictPatch.status, 409);
  });
});

test('receipt updates budget and marks matching item purchased', async () => {
  await withServer(async (baseUrl) => {
    const household = await createHousehold(baseUrl);
    const headers = { 'x-user-id': 'ana', 'content-type': 'application/json' };

    const addItemRes = await fetch(`${baseUrl}/households/${household.id}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Domate', quantity: 1 }),
    });
    const item = await addItemRes.json();

    const receiptRes = await fetch(`${baseUrl}/households/${household.id}/receipts`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        store: 'viva',
        items: [{ name: 'Domate', quantity: 2, unitPrice: 1.5 }],
      }),
    });
    assert.equal(receiptRes.status, 201);
    const payload = await receiptRes.json();
    assert.equal(payload.budget.spent, 3);

    const itemsRes = await fetch(`${baseUrl}/households/${household.id}/items`, {
      headers: { 'x-user-id': 'ana' },
    });
    const items = await itemsRes.json();
    const updatedItem = items.find((entry) => entry.id === item.id);
    assert.equal(updatedItem.purchased, true);
  });
});

test('pricing estimate and flyers return expected data', async () => {
  await withServer(async (baseUrl) => {
    const household = await createHousehold(baseUrl);
    const headers = { 'x-user-id': 'ana', 'content-type': 'application/json' };

    await fetch(`${baseUrl}/households/${household.id}/items`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Mish', quantity: 1 }),
    });

    const pricingRes = await fetch(`${baseUrl}/households/${household.id}/pricing/estimate`, {
      headers: { 'x-user-id': 'ana' },
    });
    assert.equal(pricingRes.status, 200);
    const pricing = await pricingRes.json();
    assert.equal(pricing.totals.length >= 1, true);

    const flyersRes = await fetch(`${baseUrl}/households/${household.id}/flyers`, {
      headers: { 'x-user-id': 'ana' },
    });
    assert.equal(flyersRes.status, 200);
    const flyers = await flyersRes.json();
    assert.equal(flyers.length >= 1, true);
  });
});

test('recipes endpoint enforces daily free-tier limit', async () => {
  await withServer(async (baseUrl) => {
    const household = await createHousehold(baseUrl);
    const headers = { 'x-user-id': 'ana', 'content-type': 'application/json' };

    const pantry1 = await fetch(`${baseUrl}/households/${household.id}/pantry`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Domate', quantity: 2 }),
    });
    assert.equal(pantry1.status, 201);
    const pantry2 = await fetch(`${baseUrl}/households/${household.id}/pantry`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'Veze', quantity: 6 }),
    });
    assert.equal(pantry2.status, 201);

    for (let i = 0; i < 3; i += 1) {
      const okRes = await fetch(`${baseUrl}/households/${household.id}/recipes/suggest`, {
        method: 'POST',
        headers: { 'x-user-id': 'ana' },
      });
      assert.equal(okRes.status, 200);
    }

    const limitedRes = await fetch(`${baseUrl}/households/${household.id}/recipes/suggest`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana' },
    });
    assert.equal(limitedRes.status, 429);
  });
});

test('real-time stream emits activity events', async () => {
  await withServer(async (baseUrl) => {
    const household = await createHousehold(baseUrl, 'ana');

    const stream = await openSse(`${baseUrl}/households/${household.id}/stream`, 'ana');
    const chunks = [];
    stream.res.setEncoding('utf8');
    stream.res.on('data', (chunk) => {
      chunks.push(chunk);
    });

    await fetch(`${baseUrl}/households/${household.id}/items`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Buke', quantity: 1 }),
    });

    await new Promise((resolve) => setTimeout(resolve, 80));
    stream.req.destroy();

    const data = chunks.join('');
    assert.equal(data.includes('event: activity'), true);
    assert.equal(data.includes('list.item.added'), true);
  });
});


test('pricing staging -> promote pipeline works with validation', async () => {
  await withServer(async (baseUrl) => {
    const stageRes = await fetch(`${baseUrl}/pricing/staging`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({
        rows: [
          { store: 'maxi', itemKey: 'Qumësht 1L', price: 1.11 },
          { store: 'viva', itemKey: 'Qumesht', price: 1.05 },
          { store: 'etc', itemKey: 'qumesht', price: 0 },
        ],
      }),
    });
    assert.equal(stageRes.status, 201);

    const promoteRes = await fetch(`${baseUrl}/pricing/promote`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana' },
    });
    assert.equal(promoteRes.status, 200);
    const promote = await promoteRes.json();
    assert.equal(promote.promotedCount, 2);
    assert.equal(promote.rejectedCount, 1);

    const pipelineRes = await fetch(`${baseUrl}/pricing/pipeline`, {
      headers: { 'x-user-id': 'ana' },
    });
    const pipeline = await pipelineRes.json();
    assert.equal(pipeline.liveCount, 2);
    assert.equal(pipeline.canonicalCatalogCount >= 1, true);
    assert.equal(pipeline.avgLiveConfidence > 0, true);

    const household = await createHousehold(baseUrl);
    await fetch(`${baseUrl}/households/${household.id}/items`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Qumesht', quantity: 1 }),
    });

    const estimateRes = await fetch(`${baseUrl}/households/${household.id}/pricing/estimate`, {
      headers: { 'x-user-id': 'ana' },
    });
    const estimate = await estimateRes.json();
    assert.equal(estimate.bestStore, 'viva');
  });
});


test('pricing estimate cache returns cached=true on repeated request', async () => {
  await withServer(async (baseUrl) => {
    const household = await createHousehold(baseUrl);

    await fetch(`${baseUrl}/households/${household.id}/items`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Qumesht', quantity: 1 }),
    });

    const first = await fetch(`${baseUrl}/households/${household.id}/pricing/estimate`, {
      headers: { 'x-user-id': 'ana' },
    });
    const firstPayload = await first.json();
    assert.equal(firstPayload.cached, false);

    const second = await fetch(`${baseUrl}/households/${household.id}/pricing/estimate`, {
      headers: { 'x-user-id': 'ana' },
    });
    const secondPayload = await second.json();
    assert.equal(secondPayload.cached, true);

    const cacheRes = await fetch(`${baseUrl}/pricing/cache`, {
      headers: { 'x-user-id': 'ana' },
    });
    const cache = await cacheRes.json();
    assert.equal(cache.activeEntries >= 1, true);
  });
});


test('receipt OCR flow: upload url -> job -> apply result', async () => {
  await withServer(async (baseUrl) => {
    const household = await createHousehold(baseUrl);

    const uploadRes = await fetch(`${baseUrl}/households/${household.id}/receipts/upload-url`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'receipt-1.jpg' }),
    });
    assert.equal(uploadRes.status, 201);
    const upload = await uploadRes.json();
    assert.equal(typeof upload.objectKey, 'string');

    const jobRes = await fetch(`${baseUrl}/households/${household.id}/receipts/ocr-jobs`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({ objectKey: upload.objectKey }),
    });
    assert.equal(jobRes.status, 202);
    const job = await jobRes.json();

    await new Promise((resolve) => setTimeout(resolve, 60));

    const listRes = await fetch(`${baseUrl}/households/${household.id}/receipts/ocr-jobs`, {
      headers: { 'x-user-id': 'ana' },
    });
    assert.equal(listRes.status, 200);
    const jobs = await listRes.json();
    const done = jobs.find((entry) => entry.jobId === job.jobId);
    assert.equal(done.status, 'succeeded');

    const applyRes = await fetch(`${baseUrl}/households/${household.id}/receipts/ocr-jobs/${job.jobId}/apply`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana' },
    });
    assert.equal(applyRes.status, 200);
    const applied = await applyRes.json();
    assert.equal(typeof applied.appliedReceipt.id, 'string');
    assert.equal(applied.budget.spent > 0, true);
  });
});


test('OCR manual correction flow works for failed/dead-letter jobs', async () => {
  await withServer(async (baseUrl) => {
    const household = await createHousehold(baseUrl);

    const uploadRes = await fetch(`${baseUrl}/households/${household.id}/receipts/upload-url`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({ fileName: 'receipt-fail.jpg' }),
    });
    const upload = await uploadRes.json();

    const jobRes = await fetch(`${baseUrl}/households/${household.id}/receipts/ocr-jobs`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({ objectKey: `${upload.objectKey}-fail` }),
    });
    const job = await jobRes.json();

    await new Promise((resolve) => setTimeout(resolve, 60));

    for (let i = 0; i < 2; i += 1) {
      const retryRes = await fetch(`${baseUrl}/households/${household.id}/receipts/ocr-jobs/${job.jobId}/retry`, {
        method: 'POST',
        headers: { 'x-user-id': 'ana' },
      });
      assert.equal(retryRes.status, 202);
      await new Promise((resolve) => setTimeout(resolve, 60));
    }

    const jobsRes = await fetch(`${baseUrl}/households/${household.id}/receipts/ocr-jobs`, {
      headers: { 'x-user-id': 'ana' },
    });
    const jobs = await jobsRes.json();
    const target = jobs.find((entry) => entry.jobId === job.jobId);
    assert.equal(target.status, 'dead_letter');

    const correctRes = await fetch(`${baseUrl}/households/${household.id}/receipts/ocr-jobs/${job.jobId}/correct`, {
      method: 'PATCH',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({
        store: 'manual-fix-store',
        items: [{ name: 'Domate', quantity: 2, unitPrice: 1.5 }],
      }),
    });
    assert.equal(correctRes.status, 200);

    const applyRes = await fetch(`${baseUrl}/households/${household.id}/receipts/ocr-jobs/${job.jobId}/apply`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana' },
    });
    assert.equal(applyRes.status, 200);
    const applied = await applyRes.json();
    assert.equal(applied.job.status, 'succeeded_corrected');
    assert.equal(applied.appliedReceipt.store, 'manual-fix-store');
  });
});


test('recipe suggest cache + add-to-list expansion works', async () => {
  await withServer(async (baseUrl) => {
    const household = await createHousehold(baseUrl);

    const pantryA = await fetch(`${baseUrl}/households/${household.id}/pantry`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Domate', quantity: 2 }),
    });
    assert.equal(pantryA.status, 201);
    const pantryB = await fetch(`${baseUrl}/households/${household.id}/pantry`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'Veze', quantity: 6 }),
    });
    assert.equal(pantryB.status, 201);

    const firstRes = await fetch(`${baseUrl}/households/${household.id}/recipes/suggest`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana' },
    });
    const first = await firstRes.json();
    assert.equal(first.cached, false);
    assert.equal(first.suggestions.length >= 1, true);

    const secondRes = await fetch(`${baseUrl}/households/${household.id}/recipes/suggest`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana' },
    });
    const second = await secondRes.json();
    assert.equal(second.cached, true);

    const addRes = await fetch(`${baseUrl}/households/${household.id}/recipes/shakshuka/add-to-list`, {
      method: 'POST',
      headers: { 'x-user-id': 'ana' },
    });
    assert.equal(addRes.status, 200);
    const addPayload = await addRes.json();
    assert.equal(Array.isArray(addPayload.addedItems), true);

    const listRes = await fetch(`${baseUrl}/households/${household.id}/items`, {
      headers: { 'x-user-id': 'ana' },
    });
    const items = await listRes.json();
    assert.equal(items.some((entry) => entry.name.toLowerCase().includes('buke')), true);

    const cacheRes = await fetch(`${baseUrl}/recipes/cache`, {
      headers: { 'x-user-id': 'ana' },
    });
    const cache = await cacheRes.json();
    assert.equal(cache.activeEntries >= 1, true);
  });
});

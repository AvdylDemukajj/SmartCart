import test from 'node:test';
import assert from 'node:assert/strict';
import { createApp } from '../src/server.js';
import { createTestJwt } from '../src/security.js';

async function withServer(fn, config) {
  const server = createApp(config);
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function createHousehold(baseUrl) {
  const res = await fetch(`${baseUrl}/households`, {
    method: 'POST',
    headers: { 'x-user-id': 'abuse-user', 'content-type': 'application/json' },
    body: JSON.stringify({ name: 'Abuse Test HH' }),
  });
  assert.equal(res.status, 201);
  return res.json();
}

test('abuse suite: blocks oversized payload and invalid retry replay token', async () => {
  const prevBodyLimit = process.env.MAX_REQUEST_BODY_BYTES;
  process.env.MAX_REQUEST_BODY_BYTES = '128';
  try {
    await withServer(async (baseUrl) => {
      const hugePayload = JSON.stringify({ name: 'x'.repeat(2048) });
      const tooLarge = await fetch(`${baseUrl}/households`, {
        method: 'POST',
        headers: { 'x-user-id': 'abuse-user', 'content-type': 'application/json' },
        body: hugePayload,
      });
      assert.equal(tooLarge.status, 413);

      const household = await createHousehold(baseUrl);
      const enqueue = await fetch(`${baseUrl}/households/${household.id}/receipts/ocr-jobs`, {
        method: 'POST',
        headers: { 'x-user-id': 'abuse-user', 'content-type': 'application/json' },
        body: JSON.stringify({ objectKey: 'should-fail.png' }),
      });
      assert.equal(enqueue.status, 202);
      const job = await enqueue.json();

      await new Promise((resolve) => setTimeout(resolve, 80));
      const retry = await fetch(`${baseUrl}/households/${household.id}/receipts/ocr-jobs/${job.jobId}/retry`, {
        method: 'POST',
        headers: { 'x-user-id': 'abuse-user', 'content-type': 'application/json' },
        body: JSON.stringify({ replayToken: 'short' }),
      });
      assert.equal(retry.status, 400);
    });
  } finally {
    if (prevBodyLimit === undefined) delete process.env.MAX_REQUEST_BODY_BYTES;
    else process.env.MAX_REQUEST_BODY_BYTES = prevBodyLimit;
  }
});

test('abuse suite: audit integrity endpoint is admin-only and returns healthy chain for admins', async () => {
  await withServer(async (baseUrl) => {
    const adminJwt = createTestJwt({
      sub: 'sec-admin',
      role: 'admin',
      permissions: ['security:audit:read'],
    });

    await fetch(`${baseUrl}/households/not-a-member/items`, {
      headers: { 'x-user-id': 'outsider' },
    });

    const forbidden = await fetch(`${baseUrl}/security/audit-log/integrity`, {
      headers: { 'x-user-id': 'ana' },
    });
    assert.equal(forbidden.status, 403);

    const integrity = await fetch(`${baseUrl}/security/audit-log/integrity`, {
      headers: { authorization: `Bearer ${adminJwt}` },
    });
    assert.equal(integrity.status, 200);
    const payload = await integrity.json();
    assert.equal(payload.ok, true);
  });
});

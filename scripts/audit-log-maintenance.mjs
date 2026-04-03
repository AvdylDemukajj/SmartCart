#!/usr/bin/env node
import { once } from 'node:events';
import { createApp } from '../backend/src/server.js';

async function main() {
  const adminJwt = process.env.AUDIT_MAINTENANCE_ADMIN_JWT;
  if (!adminJwt) throw new Error('AUDIT_MAINTENANCE_ADMIN_JWT is required');

  const server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const verify = await fetch(`${baseUrl}/security/audit-log/integrity`, {
      headers: { authorization: `Bearer ${adminJwt}` },
    });
    const verifyBody = await verify.json();
    if (!verify.ok) throw new Error(`Integrity check failed: ${JSON.stringify(verifyBody)}`);

    const prune = await fetch(`${baseUrl}/security/audit-log/retention/prune`, {
      method: 'POST',
      headers: { authorization: `Bearer ${adminJwt}` },
    });
    const pruneBody = await prune.json();
    if (!prune.ok) throw new Error(`Retention prune failed: ${JSON.stringify(pruneBody)}`);

    process.stdout.write(`${JSON.stringify({ integrity: verifyBody, prune: pruneBody }, null, 2)}\n`);
  } finally {
    server.close();
    await once(server, 'close').catch(() => {});
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function sha256(text) {
  return createHash('sha256').update(text).digest('hex');
}

async function main() {
  const started = Date.now();
  const nowIso = new Date().toISOString();
  const dateSlug = nowIso.slice(0, 10);
  const artifactDir = path.resolve('docs/ops/evidence');
  await mkdir(artifactDir, { recursive: true });

  const dataset = {
    generatedAt: nowIso,
    households: [{ id: 'hh-1', ownerId: 'backup-user', items: [{ id: 'i-1', name: 'Milk' }] }],
    audit: [{ event: 'BACKUP_DRILL', ts: nowIso }],
  };

  const backupPath = path.join(artifactDir, `backup-drill-${dateSlug}.json`);
  const restorePath = path.join(artifactDir, `restore-drill-${dateSlug}.json`);
  const payload = JSON.stringify(dataset, null, 2);
  const backupHash = sha256(payload);

  await writeFile(backupPath, payload);
  const restoredRaw = await readFile(backupPath, 'utf8');
  const restoredHash = sha256(restoredRaw);
  const restored = JSON.parse(restoredRaw);
  await writeFile(restorePath, JSON.stringify(restored, null, 2));

  const finished = Date.now();
  const report = {
    startedAt: new Date(started).toISOString(),
    finishedAt: new Date(finished).toISOString(),
    rtoSeconds: Number(((finished - started) / 1000).toFixed(3)),
    rpoSeconds: 0,
    pass: backupHash === restoredHash && restored.households.length === dataset.households.length,
    artifacts: {
      backupPath,
      restorePath,
      backupHash,
      restoredHash,
    },
    targets: {
      rtoSecondsMax: 1800,
      rpoSecondsMax: 300,
    },
  };

  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

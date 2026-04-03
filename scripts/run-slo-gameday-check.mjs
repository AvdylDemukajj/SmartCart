import { once } from 'node:events';
import { createApp } from '../backend/src/server.js';

async function main() {
  const server = createApp();
  await new Promise((resolve) => server.listen(0, resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  const headers = { 'x-user-id': 'gameday-user', 'content-type': 'application/json' };
  const startedAt = new Date().toISOString();
  const timings = [];

  try {
    const createStart = performance.now();
    const createRes = await fetch(`${baseUrl}/households`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ name: 'GameDay' }),
    });
    timings.push(performance.now() - createStart);
    const household = await createRes.json();

    for (let i = 0; i < 15; i += 1) {
      const t0 = performance.now();
      await fetch(`${baseUrl}/households/${household.id}/items`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ name: `Item-${i}`, quantity: 1 }),
      });
      timings.push(performance.now() - t0);
    }

    for (let i = 0; i < 15; i += 1) {
      const t0 = performance.now();
      await fetch(`${baseUrl}/households/${household.id}/pricing/estimate`, { headers: { 'x-user-id': 'gameday-user' } });
      timings.push(performance.now() - t0);
    }

    const metricsRes = await fetch(`${baseUrl}/metrics`);
    const metrics = await metricsRes.json();

    const sorted = [...timings].sort((a, b) => a - b);
    const p95 = sorted[Math.max(0, Math.ceil(sorted.length * 0.95) - 1)] ?? 0;
    const errorRate = metrics.error5xxRate ?? 0;

    const report = {
      startedAt,
      finishedAt: new Date().toISOString(),
      sampleCount: timings.length,
      syntheticP95Ms: Number(p95.toFixed(2)),
      metricsP95Ms: metrics.p95Ms,
      error5xxRate: errorRate,
      thresholds: {
        syntheticP95MsMax: 250,
        metricsP95MsMax: 500,
        error5xxRateMax: 0.01,
      },
      pass: p95 <= 250 && Number(metrics.p95Ms || 0) <= 500 && errorRate <= 0.01,
      notes: [
        'Synthetic gameday smoke over key write/read paths.',
        'Use this as evidence artifact; run in staging for production gate.',
      ],
    };

    process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  } finally {
    server.close();
    await once(server, 'close').catch(() => {});
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

#!/usr/bin/env node
import { readFile } from 'node:fs/promises';

function fail(message) {
  throw new Error(message);
}

function parseNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function pickArtillerySummary(report) {
  if (!report) return null;
  if (report.aggregate) return report.aggregate;
  if (report.intermediate && report.intermediate.aggregate) return report.intermediate.aggregate;
  return null;
}

async function main() {
  const file = process.argv[2];
  if (!file) fail('Usage: node scripts/run-load-gate.mjs <artillery-report.json>');

  const raw = await readFile(file, 'utf8');
  const report = JSON.parse(raw);
  const summary = pickArtillerySummary(report);
  if (!summary) fail('Unable to find Artillery aggregate summary in report.');

  const latency = summary.latency || {};
  const p95 = parseNumber(latency.p95, Number.POSITIVE_INFINITY);
  const p99 = parseNumber(latency.p99, Number.POSITIVE_INFINITY);
  const errorRate = parseNumber(summary.errors / Math.max(1, summary.requestsCompleted || summary.requests || 1), 1);

  const maxP95 = parseNumber(process.env.ARTILLERY_P95_MS, 350);
  const maxP99 = parseNumber(process.env.ARTILLERY_P99_MS, 700);
  const maxErrorRate = parseNumber(process.env.ARTILLERY_ERROR_RATE_MAX, 0.015);

  const checks = [
    { ok: p95 <= maxP95, message: `p95 ${p95}ms <= ${maxP95}ms` },
    { ok: p99 <= maxP99, message: `p99 ${p99}ms <= ${maxP99}ms` },
    { ok: errorRate <= maxErrorRate, message: `errorRate ${errorRate.toFixed(4)} <= ${maxErrorRate}` },
  ];

  for (const check of checks) {
    if (!check.ok) fail(`Artillery gate failed: ${check.message}`);
  }

  process.stdout.write(
    `${JSON.stringify({
      gate: 'artillery-stress',
      p95Ms: p95,
      p99Ms: p99,
      errorRate: Number(errorRate.toFixed(4)),
      thresholds: { p95Ms: maxP95, p99Ms: maxP99, errorRate: maxErrorRate },
      pass: true,
    }, null, 2)}\n`,
  );
}

main().catch((error) => {
  console.error(error.message || error);
  process.exitCode = 1;
});

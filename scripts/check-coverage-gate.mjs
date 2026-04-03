#!/usr/bin/env node
import { spawn } from 'node:child_process';

const globalThreshold = Number(process.env.COVERAGE_GLOBAL_THRESHOLD || 80);
const criticalThreshold = Number(process.env.COVERAGE_CRITICAL_THRESHOLD || 90);

const criticalFiles = [
  'src/security.js',
  'src/services/audit-log.service.js',
  'src/http/websocket-upgrade.js',
];

const child = spawn('node', ['--test', '--experimental-test-coverage'], {
  cwd: new URL('../backend/', import.meta.url),
  stdio: ['ignore', 'pipe', 'pipe'],
});

let out = '';
let err = '';
child.stdout.on('data', (chunk) => {
  const text = chunk.toString();
  out += text;
  process.stdout.write(text);
});
child.stderr.on('data', (chunk) => {
  const text = chunk.toString();
  err += text;
  process.stderr.write(text);
});

function parseCoverageTable(output) {
  const result = new Map();
  const lines = output.split('\n');
  for (const line of lines) {
    const match = line.match(/^#\s+(.+?)\s*\|\s*([0-9.]+)\s*\|/);
    if (!match) continue;
    const file = match[1].trim();
    const linePct = Number(match[2]);
    result.set(file, linePct);
  }
  return result;
}

child.on('close', (code) => {
  if (code !== 0) process.exit(code ?? 1);

  const coverage = parseCoverageTable(out + err);
  const allFiles = coverage.get('all files');
  if (!Number.isFinite(allFiles)) {
    console.error('Coverage summary not found in output.');
    process.exit(1);
  }

  const failures = [];
  if (allFiles < globalThreshold) {
    failures.push(`Global line coverage ${allFiles.toFixed(2)}% is below ${globalThreshold}%`);
  }

  for (const file of criticalFiles) {
    let pct = coverage.get(file);
    if (!Number.isFinite(pct)) {
      for (const [coveredFile, coveredPct] of coverage.entries()) {
        const targetSuffix = file.split('/').pop();
        if (coveredFile === file || coveredFile.endsWith(file.replace(/^src\//, '')) || coveredFile.endsWith(targetSuffix)) {
          pct = coveredPct;
          break;
        }
      }
    }
    if (!Number.isFinite(pct)) {
      failures.push(`Critical module ${file} missing from coverage output`);
      continue;
    }
    if (pct < criticalThreshold) {
      failures.push(`Critical module ${file} coverage ${pct.toFixed(2)}% is below ${criticalThreshold}%`);
    }
  }

  if (failures.length) {
    console.error('\nCoverage gate failed:');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`\nCoverage gate passed (global=${allFiles.toFixed(2)}%, critical>=${criticalThreshold}%).`);
});

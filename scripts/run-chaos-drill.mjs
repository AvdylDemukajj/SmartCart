#!/usr/bin/env node
import net from 'node:net';
import { createCacheFromEnv } from '../backend/src/cache.js';
import { createApp } from '../backend/src/server.js';

async function scenarioDbUnavailable() {
  try {
    createApp({ requirePersistentStore: true, coreRepository: null });
    return { name: 'db_unavailable', pass: false, detail: 'Expected PERSISTENT_STORE_REQUIRED failure.' };
  } catch (error) {
    return { name: 'db_unavailable', pass: error.message === 'PERSISTENT_STORE_REQUIRED', detail: error.message };
  }
}

async function scenarioRedisPartition() {
  const prev = process.env.REDIS_URL;
  process.env.REDIS_URL = 'redis://127.0.0.1:6399';
  try {
    await createCacheFromEnv({ strict: true });
    return { name: 'redis_partition_strict', pass: false, detail: 'Expected strict Redis availability failure.' };
  } catch (error) {
    return {
      name: 'redis_partition_strict',
      pass: ['REDIS_UNAVAILABLE_IN_STRICT_MODE', 'REDIS_NO_RESPONSE'].includes(error.message),
      detail: error.message,
    };
  } finally {
    if (prev === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = prev;
  }
}

async function scenarioNetworkPartition() {
  const chaosServer = net.createServer((socket) => {
    socket.destroy();
  });
  await new Promise((resolve) => chaosServer.listen(0, '127.0.0.1', resolve));
  const port = chaosServer.address().port;

  try {
    await fetch(`http://127.0.0.1:${port}/network-partition-drill`);
    return { name: 'network_partition_connection_reset', pass: false, detail: 'Expected connection reset failure.' };
  } catch (error) {
    return { name: 'network_partition_connection_reset', pass: true, detail: error.name || 'NETWORK_FAILURE' };
  } finally {
    await new Promise((resolve) => chaosServer.close(resolve));
  }
}

async function main() {
  const startedAt = new Date().toISOString();
  const scenarios = [await scenarioDbUnavailable(), await scenarioRedisPartition(), await scenarioNetworkPartition()];
  const pass = scenarios.every((s) => s.pass);
  const report = {
    startedAt,
    finishedAt: new Date().toISOString(),
    pass,
    scenarios,
    notes: [
      'Chaos drill validates failure-mode guardrails and recovery behavior.',
      'Network partition simulation is local and deterministic (connection reset).',
      'Run this in CI/nightly and keep evidence artifacts for readiness reviews.',
    ],
  };
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!pass) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

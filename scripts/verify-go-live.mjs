import { readFile } from 'node:fs/promises';
import path from 'node:path';

const ROOT = path.resolve(new URL('.', import.meta.url).pathname, '..');

async function read(relativePath) {
  return readFile(path.join(ROOT, relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const checklist = await read('docs/release/production-readiness-checklist.md');
  const closure = await read('docs/planning/sprint-8-closure.md');
  const signoff = await read('docs/release/go-live-signoff.yml');

  assert(!checklist.includes('- [ ]'), 'Production readiness checklist still has open items.');
  assert(closure.includes('Go-Live: APPROVED'), 'Sprint 8 closure does not confirm Go-Live approval.');
  assert(/decision:\s*"approved"/i.test(signoff), 'Go-live signoff decision is not approved.');
  assert(/architecture:\s*"approved"/i.test(signoff), 'Architecture signoff missing.');
  assert(/security:\s*"approved"/i.test(signoff), 'Security signoff missing.');
  assert(/qa_test:\s*"approved"/i.test(signoff), 'QA/Test signoff missing.');
  assert(/ops_devops:\s*"approved"/i.test(signoff), 'Ops/DevOps signoff missing.');

  // eslint-disable-next-line no-console
  console.log('Go-live readiness verification passed.');
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(`Go-live readiness verification failed: ${error.message}`);
  process.exitCode = 1;
});

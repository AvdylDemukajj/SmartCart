import http from 'k6/http';
import { check, sleep } from 'k6';

const base = __ENV.BASE_URL || 'http://127.0.0.1:4000';
const p95Ms = Number(__ENV.K6_P95_MS || 250);
const p99Ms = Number(__ENV.K6_P99_MS || 450);

export const options = {
  scenarios: {
    baseline: {
      executor: 'constant-vus',
      vus: Number(__ENV.K6_BASELINE_VUS || 10),
      duration: __ENV.K6_BASELINE_DURATION || '90s',
    },
  },
  thresholds: {
    http_req_duration: [`p(95)<${p95Ms}`, `p(99)<${p99Ms}`],
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
  },
};

export default function () {
  const health = http.get(`${base}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  const metrics = http.get(`${base}/metrics`);
  check(metrics, { 'metrics 200': (r) => r.status === 200 });

  sleep(0.3);
}

import http from 'k6/http';
import { check, sleep } from 'k6';

const base = __ENV.BASE_URL || 'http://127.0.0.1:4000';
const p95Ms = Number(__ENV.K6_SOAK_P95_MS || 350);
const p99Ms = Number(__ENV.K6_SOAK_P99_MS || 650);

export const options = {
  scenarios: {
    soak: {
      executor: 'ramping-vus',
      stages: [
        { duration: __ENV.K6_SOAK_WARMUP || '2m', target: Number(__ENV.K6_SOAK_VUS || 20) },
        { duration: __ENV.K6_SOAK_STEADY || '12m', target: Number(__ENV.K6_SOAK_VUS || 20) },
        { duration: __ENV.K6_SOAK_COOLDOWN || '2m', target: 0 },
      ],
    },
  },
  thresholds: {
    http_req_duration: [`p(95)<${p95Ms}`, `p(99)<${p99Ms}`],
    http_req_failed: ['rate<0.015'],
    checks: ['rate>0.985'],
  },
};

export default function () {
  const metrics = http.get(`${base}/metrics`);
  check(metrics, { 'metrics 200': (r) => r.status === 200 });

  const health = http.get(`${base}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  sleep(0.5);
}

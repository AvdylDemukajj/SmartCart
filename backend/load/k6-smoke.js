import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 5,
  duration: '30s',
};

const base = __ENV.BASE_URL || 'http://127.0.0.1:4000';

export default function () {
  const health = http.get(`${base}/health`);
  check(health, { 'health 200': (r) => r.status === 200 });

  const metrics = http.get(`${base}/metrics`);
  check(metrics, { 'metrics 200': (r) => r.status === 200 });

  sleep(1);
}

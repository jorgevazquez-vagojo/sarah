/**
 * Health Check Test: Monitor endpoint health
 * Runs continuously every minute
 */

import http from 'k6/http';
import { check } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  vus: 1,
  duration: '5m',
  thresholds: {
    http_req_duration: ['p(99)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function healthCheck() {
  const response = http.get(`${BASE_URL}/health`);

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
    'database healthy': (r) => r.json('checks.database.status') === 'ok',
    'redis healthy': (r) => r.json('checks.redis.status') === 'ok',
  });
}

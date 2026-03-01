/**
 * Stress Test: Maximum capacity before breaking
 * Ramps up gradually to find breaking point
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '2m', target: 100 },
    { duration: '5m', target: 200 },
    { duration: '5m', target: 300 },
    { duration: '5m', target: 400 },
    { duration: '5m', target: 500 },
    { duration: '5m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.2'],
    'checks': ['rate>0.8'],
  },
};

export default function stress() {
  const payload = {
    tenant_id: `tenant-${__VU % 100}`,
    session_id: `session-${Date.now()}-${__VU}`,
    text: `Load test message ${__ITER}`,
    lang: 'es',
  };

  const response = http.post(`${BASE_URL}/api/chat/message`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  sleep(0.5);
}

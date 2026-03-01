/**
 * Soak Test: Sustained load over long period
 * Runs 50 users for 30 minutes to detect memory leaks
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export const options = {
  stages: [
    { duration: '5m', target: 50 },    // Ramp up
    { duration: '30m', target: 50 },   // Stay at 50 (or adjust duration for testing)
    { duration: '5m', target: 0 },     // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(99)<1000'],
    http_req_failed: ['rate<0.05'],
  },
};

export default function soak() {
  const payload = {
    tenant_id: `tenant-${__VU % 10}`,
    session_id: `session-${Date.now()}-${__VU}`,
    text: `Soak test iteration ${__ITER}`,
    lang: 'es',
  };

  const response = http.post(`${BASE_URL}/api/chat/message`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 1000ms': (r) => r.timings.duration < 1000,
  });

  sleep(2);
}

/**
 * Spike Test: Sudden traffic increase
 * Simulates: 10 users → 100 users → 10 users over 2 minutes
 */

import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TENANT_ID = '550e8400-e29b-41d4-a716-446655440000';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // Ramp up to 10 users
    { duration: '30s', target: 100 },  // Spike to 100 users
    { duration: '30s', target: 50 },   // Gradually down to 50
    { duration: '30s', target: 10 },   // Down to 10
  ],
  thresholds: {
    http_req_duration: ['p(99)<500', 'p(95)<300'],
    http_req_failed: ['rate<0.1'],
  },
};

export default function spike() {
  const payload = {
    tenant_id: TENANT_ID,
    session_id: `session-${Date.now()}`,
    text: 'Hello Sarah',
    lang: 'es',
  };

  const response = http.post(`${BASE_URL}/api/chat/message`, JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json' },
  });

  check(response, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
    'has message_id': (r) => r.json('message_id') !== undefined,
  });

  sleep(1);
}

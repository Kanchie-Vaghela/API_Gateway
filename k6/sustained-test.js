// --- TOPIC: Sustained Load Test ---
// 100 requests/sec for 2 minutes = 12,000 total requests.
// Goal: confirm the gateway doesn't degrade over time — no memory
// leaks, no connection pool exhaustion, stable p99 throughout.

import http from 'k6/http'
import { check } from 'k6'

const TOKEN = 'YOUR_TOKEN_HERE'

export const options = {
  scenarios: {
    sustained: {
      executor: 'constant-arrival-rate',
      rate: 100,
      timeUnit: '1s',
      duration: '2m',
      preAllocatedVUs: 200,
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<1000'],
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  const res = http.get('http://localhost:3000/products', {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })
  check(res, {
    'status 200': (r) => r.status === 200,
  })
}
// --- TOPIC: Cache Impact Test ---
// Run TWICE:
// 1. With Redis cache disabled (comment out redis in product-service)
// 2. With Redis cache enabled (normal run)
// Compare p99 numbers — this is your strongest demo result.

import http from 'k6/http'
import { check } from 'k6'

const TOKEN = 'YOUR_TOKEN_HERE'

export const options = {
  scenarios: {
    cache_load: {
      executor: 'constant-arrival-rate',
      rate: 50,
      timeUnit: '1s',
      duration: '30s',
      preAllocatedVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<500'],
  },
}

export default function () {
  // Same product ID every time — guarantees cache hits after first request
  const res = http.get('http://localhost:3000/products/1', {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })
  check(res, {
    'status 200': (r) => r.status === 200,
  })
}
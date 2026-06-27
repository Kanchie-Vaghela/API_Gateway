// --- TOPIC: Burst Test ---
// Simulates a sudden spike — 500 requests in 10 seconds.
// Goal: measure if the gateway holds up under sudden load.
// What to watch: p99 latency, error rate, circuit breaker state in Grafana.

import http from 'k6/http'
import { check, sleep } from 'k6'

const TOKEN =eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VySWQiOjIsInVzZXJuYW1lIjoiazZ1c2VyIiwiaWF0IjoxNzgyNTYzMzMzLCJleHAiOjE3ODI1NjY5MzN9.MNBAtOEi9wAbZ9aeSmArPPQBVZF4cZ_hM3t7czg4OT4

export const options = {
  scenarios: {
    burst: {
      executor: 'constant-arrival-rate',
      rate: 50,              // 50 requests/sec
      timeUnit: '1s',
      duration: '10s',       // 10s × 50 = 500 total requests
      preAllocatedVUs: 100,
    },
  },
  thresholds: {
    http_req_duration: ['p(99)<2000'],   // p99 under 2 seconds
    http_req_failed: ['rate<0.05'],      // error rate under 5%
  },
}

export default function () {
  const res = http.get('http://localhost:3000/products', {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })
  check(res, {
    'status is 200': (r) => r.status === 200,
    'latency < 1000ms': (r) => r.timings.duration < 1000,
  })
}
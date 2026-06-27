// --- TOPIC: Circuit Breaker Test ---
// Run this, then in a SEPARATE terminal kill product-service:
//   docker compose stop product-service
// Watch error rate spike then plateau as circuit opens.
// Once circuit is open, responses come back instantly (< 5ms) as 503.
// Restart product-service and watch circuit recover:
//   docker compose start product-service

import http from 'k6/http'
import { check, sleep } from 'k6'

const TOKEN = 'YOUR_TOKEN_HERE'

export const options = {
  vus: 20,
  duration: '60s',
}

export default function () {
  const res = http.get('http://localhost:3000/products', {
    headers: { Authorization: `Bearer ${TOKEN}` }
  })

  // After circuit opens, 503 returns in < 5ms — check for that
  check(res, {
    'not hanging (< 2000ms)': (r) => r.timings.duration < 2000,
    'got a response': (r) => r.status === 200 || r.status === 503,
  })

  sleep(0.1)
}
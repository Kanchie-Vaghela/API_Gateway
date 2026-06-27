const promClient = require('prom-client')

// --- TOPIC: Prometheus Registry ---
// The registry is the central store for all your metrics.
// When Prometheus scrapes /metrics, it calls register.metrics()
// which serializes every registered metric into the text format
// Prometheus expects. You register each metric once at startup —
// not per request.
const register = new promClient.Registry()

// Collect default Node.js metrics — heap usage, event loop lag,
// GC duration, active handles. Free observability, always include it.
promClient.collectDefaultMetrics({ register })

// --- TOPIC: Counter ---
// Total requests ever handled. Only goes up.
// Labels let one metric represent many time series —
// {service="product-service", status_code="200", method="GET"}
// is a different series than {service="user-service", status_code="401"}
const httpRequestsTotal = new promClient.Counter({
  name: 'gateway_requests_total',
  help: 'Total number of requests proxied by the gateway',
  labelNames: ['method', 'service', 'status_code'],
  registers: [register]
})

// --- TOPIC: Histogram ---
// Tracks distribution of request durations across buckets.
// From this Prometheus can calculate any percentile — p50, p95, p99.
// Buckets are in milliseconds — pick values around where you expect
// latency to cluster. Cache hits ~5-20ms, cache misses ~100-150ms.
const httpRequestDuration = new promClient.Histogram({
  name: 'gateway_request_duration_ms',
  help: 'Request duration in milliseconds',
  labelNames: ['method', 'service', 'status_code'],
  buckets: [5, 10, 25, 50, 100, 150, 200, 500, 1000, 2500],
  registers: [register]
})

// --- TOPIC: Gauge ---
// Current value that can go up or down.
// Circuit breaker state: 0=CLOSED, 1=OPEN, 2=HALF_OPEN
// Grafana can alert when this is not 0.
const circuitBreakerState = new promClient.Gauge({
  name: 'gateway_circuit_breaker_state',
  help: 'Circuit breaker state per service: 0=CLOSED 1=OPEN 2=HALF_OPEN',
  labelNames: ['service'],
  registers: [register]
})

// Initialize all circuit breaker gauges to 0 (CLOSED)
const services = ['user-service', 'product-service', 'order-service']
services.forEach(s => circuitBreakerState.set({ service: s }, 0))

// --- TOPIC: Gauge for active requests ---
// How many requests are currently being processed right now.
// Goes up at request start, down when response is sent.
const activeRequests = new promClient.Gauge({
  name: 'gateway_active_requests',
  help: 'Number of requests currently being processed',
  registers: [register]
})

module.exports = {
  register,
  httpRequestsTotal,
  httpRequestDuration,
  circuitBreakerState,
  activeRequests
}
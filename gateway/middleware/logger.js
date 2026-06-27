// --- TOPIC: Request Logging ---
// This middleware runs at the START of the request to capture the
// timestamp, then hooks into the response 'finish' event to log
// the final status code and latency AFTER the response is sent.
// You can't log latency at the start — you don't know it yet.
// The 'finish' event fires when the response is fully flushed to
// the client, which is the correct moment to record end-to-end time.

const {
  httpRequestsTotal,
  httpRequestDuration,
  activeRequests
} = require('./metrics')

const getService = (path) => {
  if (path.startsWith('/users'))    return 'user-service'
  if (path.startsWith('/products')) return 'product-service'
  if (path.startsWith('/orders'))   return 'order-service'
  return 'gateway'
}

function logger(req, res, next) {
  const start = Date.now()
  const timestamp = new Date().toISOString()
  const service = getService(req.path)

  // --- TOPIC: Gauge increment/decrement ---
  // Track in-flight requests — up when request starts, down when done
  activeRequests.inc()

  res.on('finish', () => {
    const latency = Date.now() - start
    const labels = {
      method: req.method,
      service,
      status_code: res.statusCode
    }

    // Increment total request counter with labels
    httpRequestsTotal.inc(labels)

    // Record this request's duration in the histogram
    httpRequestDuration.observe(labels, latency)

    // Decrement active requests
    activeRequests.dec()

    console.log(JSON.stringify({
      timestamp,
      method: req.method,
      path: req.originalUrl,
      service,
      status: res.statusCode,
      latencyMs: latency,
      ip: req.ip
    }))
  })

  next()
}

module.exports = logger
const express = require('express')
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware')
const authMiddleware = require('./middleware/auth')
const rateLimiter = require('./middleware/rateLimiter')
const http = require('http')
const logger = require('./middleware/logger') 
const breakers = require('./middleware/circuitBreaker')
const { register } = require('./middleware/metrics')

const app = express()
app.use(express.json())
app.use(logger)         // 1st: log everything including rejected requests
app.use(authMiddleware) // 2nd: auth check
app.use(rateLimiter)    // 3rd: rate limit check

app.get('/metrics', async (req, res) => {
  res.set('Content-Type', register.contentType)
  res.end(await register.metrics())
})

const USER_SERVICE    = process.env.USER_SERVICE_URL    || 'http://user-service:3001'
const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002'
const ORDER_SERVICE   = process.env.ORDER_SERVICE_URL   || 'http://order-service:3003'


// Helper — wraps a proxy with circuit breaker logic
// This runs BEFORE http-proxy-middleware forwards the request
function withCircuitBreaker(breaker, proxyMiddleware) {
  return (req, res, next) => {
    // --- TOPIC: Fast Fail ---
    // If circuit is OPEN, return 503 immediately.
    // No network call, no timeout wait — client gets a response
    // in <1ms instead of waiting 30s for a dead service to timeout.
    if (!breaker.canRequest()) {
      console.log(`[circuit-breaker] ${breaker.name}: blocking request — circuit OPEN`)
      return res.status(503).json({
        error: 'service unavailable',
        service: breaker.name,
        circuit: 'OPEN',
        retryAfter: Math.ceil(breaker.timeout / 1000)
      })
    }

    // Intercept the response to record success or failure
    const originalEnd = res.end.bind(res)
    res.end = function(chunk, encoding, callback) {
      // 5xx from upstream = failure, everything else = success
      if (res.statusCode >= 500) {
        breaker.recordFailure()
      } else {
        breaker.recordSuccess()
      }
      return originalEnd(chunk, encoding, callback)
    }

    proxyMiddleware(req, res, next)
  }
}

// User service proxy
const userProxy = createProxyMiddleware({
  target: USER_SERVICE,
  changeOrigin: true,
  pathRewrite: (path, req) => '/users' + path,
  on: {
    proxyReq: fixRequestBody,
    error: (err, req, res) => {
      breakers['user-service'].recordFailure()
      console.error('Proxy error (user-service):', err.message)
      if (!res.headersSent) {
        res.status(503).json({ error: 'user-service unavailable' })
      }
    }
  }
})

// Product service proxy
const productProxy = createProxyMiddleware({
  target: PRODUCT_SERVICE,
  changeOrigin: true,
  pathRewrite: (path, req) => '/products' + path,
  on: {
    proxyReq: fixRequestBody,
    error: (err, req, res) => {
      breakers['product-service'].recordFailure()
      console.error('Proxy error (product-service):', err.message)
      if (!res.headersSent) {
        res.status(503).json({ error: 'product-service unavailable' })
      }
    }
  }
})

// Order service proxy
const orderProxy = createProxyMiddleware({
  target: ORDER_SERVICE,
  changeOrigin: true,
  pathRewrite: (path, req) => '/orders' + path,
  on: {
    proxyReq: fixRequestBody,
    error: (err, req, res) => {
      breakers['order-service'].recordFailure()
      console.error('Proxy error (order-service):', err.message)
      if (!res.headersSent) {
        res.status(503).json({ error: 'order-service unavailable' })
      }
    }
  }
})

// Mount with circuit breaker wrapping each proxy
app.use('/users',    withCircuitBreaker(breakers['user-service'],    userProxy))
app.use('/products', withCircuitBreaker(breakers['product-service'], productProxy))
app.use('/orders',   withCircuitBreaker(breakers['order-service'],   orderProxy))

// --- TOPIC: Upstream Health Probing ---
// Instead of returning a hardcoded {status: ok}, the gateway
// actively checks each service by hitting its /health endpoint.
// This is the difference between liveness (process is running)
// and readiness (dependencies are actually reachable and responding).
// If product-service is up but postgres crashed, this will catch it
// once you wire real DB checks into the service health endpoints.

function checkService(url) {
  return new Promise((resolve) => {
    const req = http.get(url, (res) => {
      resolve({ status: res.statusCode === 200 ? 'ok' : 'degraded' })
    })
    req.on('error', () => resolve({ status: 'down' }))
    req.setTimeout(2000, () => {
      req.destroy()
      resolve({ status: 'timeout' })
    })
  })
}

app.get('/health', async (req, res) => {
  const [userService, productService, orderService] = await Promise.all([
    checkService(`${USER_SERVICE}/health`),
    checkService(`${PRODUCT_SERVICE}/health`),
    checkService(`${ORDER_SERVICE}/health`),
  ])

  const services = {
    'user-service':    { status: userService.status,    circuit: breakers['user-service'].state },
    'product-service': { status: productService.status, circuit: breakers['product-service'].state },
    'order-service':   { status: orderService.status,   circuit: breakers['order-service'].state },
  }

  // Gateway is degraded if ANY upstream is not ok
  const allHealthy = Object.values(services).every(s => s.status === 'ok')

  res.status(allHealthy ? 200 : 207).json({
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services
  })
})
const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`gateway running on ${PORT}`))
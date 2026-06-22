const express = require('express')
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware')
const authMiddleware = require('./middleware/auth')
const rateLimiter = require('./middleware/rateLimiter')
const http = require('http')
const logger = require('./middleware/logger') 

const app = express()
app.use(express.json())
app.use(logger)         // 1st: log everything including rejected requests
app.use(authMiddleware) // 2nd: auth check
app.use(rateLimiter)    // 3rd: rate limit check

const USER_SERVICE    = process.env.USER_SERVICE_URL    || 'http://user-service:3001'
const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002'
const ORDER_SERVICE   = process.env.ORDER_SERVICE_URL   || 'http://order-service:3003'

app.use('/users', createProxyMiddleware({
  target: USER_SERVICE,
  changeOrigin: true,
  pathRewrite: (path, req) => '/users' + path,
  on: {
    proxyReq: fixRequestBody,
    error: (err, req, res) => {
      console.error('Proxy error (user-service):', err.message)
      res.status(503).json({ error: 'user-service unavailable' })
    }
  }
}))

app.use('/products', createProxyMiddleware({
  target: PRODUCT_SERVICE,
  changeOrigin: true,
  pathRewrite: (path, req) => '/products' + path,
  on: {
    proxyReq: fixRequestBody,
    error: (err, req, res) => {
      console.error('Proxy error (product-service):', err.message)
      res.status(503).json({ error: 'product-service unavailable' })
    }
  }
}))

app.use('/orders', createProxyMiddleware({
  target: ORDER_SERVICE,
  changeOrigin: true,
  pathRewrite: (path, req) => '/orders' + path,
  on: {
    proxyReq: fixRequestBody,
    error: (err, req, res) => {
      console.error('Proxy error (order-service):', err.message)
      res.status(503).json({ error: 'order-service unavailable' })
    }
  }
}))

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
    'user-service':    userService.status,
    'product-service': productService.status,
    'order-service':   orderService.status,
  }

  // Gateway is degraded if ANY upstream is not ok
  const allHealthy = Object.values(services).every(s => s === 'ok')

  res.status(allHealthy ? 200 : 207).json({
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    services
  })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`gateway running on ${PORT}`))
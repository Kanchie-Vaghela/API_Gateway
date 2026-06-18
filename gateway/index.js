const express = require('express')
const { createProxyMiddleware } = require('http-proxy-middleware')

const app = express()
app.use(express.json())

// --- TOPIC: Reverse Proxy ---
// http-proxy-middleware intercepts the request and re-sends it
// to the target URL, then pipes the response back to the client.
// The client never directly talks to user-service, product-service, etc.
// This is exactly what Nginx, AWS API Gateway, and Kong do at their core.

const USER_SERVICE    = process.env.USER_SERVICE_URL    || 'http://user-service:3001'
const PRODUCT_SERVICE = process.env.PRODUCT_SERVICE_URL || 'http://product-service:3002'
const ORDER_SERVICE   = process.env.ORDER_SERVICE_URL   || 'http://order-service:3003'

// Route: any request starting with /users → forward to user-service
// pathRewrite strips the /users prefix so user-service receives /register
// not /users/register — the service doesn't know it's behind a gateway
app.use('/users', createProxyMiddleware({
  target: USER_SERVICE,
  changeOrigin: true,
  on: {
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
    proxyReq: (proxyReq, req) => {
      console.log(`[gateway] forwarding ${req.method} ${req.originalUrl} -> ${PRODUCT_SERVICE}${proxyReq.path}`)
    },
    error: (err, req, res) => {
      console.error('Proxy error (product-service):', err.message)
      res.status(503).json({ error: 'product-service unavailable' })
    }
  }
}))

app.use('/orders', createProxyMiddleware({
  target: ORDER_SERVICE,
  changeOrigin: true,
  on: {
    error: (err, req, res) => {
      console.error('Proxy error (order-service):', err.message)
      res.status(503).json({ error: 'order-service unavailable' })
    }
  }
}))

// --- TOPIC: Health Check Endpoint ---
// The gateway's own health check — separate from the /health
// endpoints on each service. will expand this to check
// each upstream service and return their status too.
app.get('/health', (req, res) => {
  res.json({ service: 'gateway', status: 'ok' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`gateway running on ${PORT}`))
const express = require('express')
const { createProxyMiddleware, fixRequestBody } = require('http-proxy-middleware')
const authMiddleware = require('./middleware/auth')

const app = express()
app.use(express.json())
app.use(authMiddleware)

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

app.get('/health', (req, res) => {
  res.json({ service: 'gateway', status: 'ok' })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log(`gateway running on ${PORT}`))
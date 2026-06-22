const express = require('express')
const Redis = require('ioredis')
const app = express()
app.use(express.json())

const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379')

const CACHE_TTL = 60   // seconds — cache product data for 1 minute

// --- TOPIC: Cache-Aside Pattern ---
// The service checks Redis first. Cache hit → return immediately,
// no DB call. Cache miss → compute the response, store it in Redis,
// return it. The next identical request hits cache instead of DB.
// TTL ensures stale data eventually expires — you're trading
// consistency (data might be 60s old) for performance (no DB hit).
// For product listings that don't change every second, this tradeoff
// is completely acceptable.

app.get('/health', (req, res) => {
  res.json({ service: 'product-service', status: 'ok' })
})

app.get('/products', async (req, res) => {
  const cacheKey = 'products:all'

  try {
    // Check cache first
    const cached = await redis.get(cacheKey)
    if (cached) {
      console.log('[product-service] cache HIT for /products')
      res.setHeader('X-Cache', 'HIT')
      return res.json(JSON.parse(cached))
    }

    // Cache miss — simulate DB query with a deliberate delay
    // This delay makes the before/after cache latency numbers
    // visible in your k6 results and Grafana dashboard
    console.log('[product-service] cache MISS for /products')
    await new Promise(resolve => setTimeout(resolve, 100))   // simulates DB query

    const products = [
      { id: 1, name: 'Widget A', price: 9.99 },
      { id: 2, name: 'Widget B', price: 19.99 },
      { id: 3, name: 'Widget C', price: 29.99 }
    ]

    // Store in Redis with TTL
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(products))

    res.setHeader('X-Cache', 'MISS')
    res.json(products)
  } catch (err) {
    console.error('[product-service] Redis error:', err.message)
    // Fail open — if Redis is down, still serve from "DB"
    res.json([{ id: 1, name: 'Widget A', price: 9.99 }])
  }
})

app.get('/products/:id', async (req, res) => {
  const { id } = req.params
  const cacheKey = `products:${id}`

  try {
    const cached = await redis.get(cacheKey)
    if (cached) {
      console.log(`[product-service] cache HIT for /products/${id}`)
      res.setHeader('X-Cache', 'HIT')
      return res.json(JSON.parse(cached))
    }

    console.log(`[product-service] cache MISS for /products/${id}`)
    await new Promise(resolve => setTimeout(resolve, 100))   // simulates DB query

    const product = { id, name: `Widget ${id}`, price: parseFloat(id) * 9.99 }
    await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(product))

    res.setHeader('X-Cache', 'MISS')
    res.json(product)
  } catch (err) {
    console.error('[product-service] Redis error:', err.message)
    res.json({ id, name: `Widget ${id}`, price: 9.99 })
  }
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => console.log(`product-service running on ${PORT}`))
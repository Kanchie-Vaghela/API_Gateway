const Redis = require('ioredis')

const redis = new Redis(process.env.REDIS_URL || 'redis://redis:6379')

const WINDOW_MS = 60 * 1000   // 1 minute in milliseconds
const MAX_REQUESTS = 100       // per IP per window

// --- TOPIC: Sliding Window Rate Limiting ---
// A fixed window counter resets every 60s on the clock — so a client
// can send 100 requests at 00:59 and 100 more at 01:01, getting 200
// requests in 2 seconds. Sliding window fixes this by tracking the
// actual timestamps of each request and counting only those within
// the last 60 seconds relative to RIGHT NOW, not to a clock boundary.
// We use a Redis sorted set: score = timestamp, member = timestamp.
// ZCOUNT then counts members in the last 60s window.

async function rateLimiter(req, res, next) {
  // Use IP as the key — each IP gets its own independent counter
  const ip = req.ip || req.connection.remoteAddress
  const key = `ratelimit:${ip}`
  const now = Date.now()
  const windowStart = now - WINDOW_MS

  try {
    // Pipeline: execute all Redis commands in one round-trip
    const pipeline = redis.pipeline()

    // Remove timestamps older than the window — keeps the set clean
    pipeline.zremrangebyscore(key, 0, windowStart)

    // Add current request timestamp (score and member both = now)
    // Using `now` as both score and member — if two requests arrive
    // at the exact same millisecond, append a random suffix to member
    pipeline.zadd(key, now, `${now}-${Math.random()}`)

    // Count requests in the current window
    pipeline.zcount(key, windowStart, now)

    // Reset expiry on every request so the key auto-cleans from Redis
    pipeline.expire(key, Math.ceil(WINDOW_MS / 1000))

    const results = await pipeline.exec()
    const requestCount = results[2][1]   // zcount result

    // Set rate limit headers so clients can see their status
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS)
    res.setHeader('X-RateLimit-Remaining', Math.max(0, MAX_REQUESTS - requestCount))
    res.setHeader('X-RateLimit-Reset', Math.ceil((now + WINDOW_MS) / 1000))

    if (requestCount > MAX_REQUESTS) {
      // --- TOPIC: 429 Too Many Requests ---
      // Retry-After tells the client how many seconds to wait.
      // This is part of the HTTP spec for 429 responses — clients
      // and load testers like k6 read this header automatically.
      res.setHeader('Retry-After', Math.ceil(WINDOW_MS / 1000))
      return res.status(429).json({
        error: 'too many requests',
        retryAfter: Math.ceil(WINDOW_MS / 1000)
      })
    }

    next()
  } catch (err) {
    // --- TOPIC: Fail Open vs Fail Closed ---
    // If Redis is down, we call next() instead of blocking all traffic.
    // This is "fail open" — prefer availability over strict rate limiting.
    // For a payment API you'd fail closed. For this project, fail open
    // is the right call — Redis being down shouldn't kill your gateway.
    console.error('Rate limiter Redis error:', err.message)
    next()
  }
}

module.exports = rateLimiter
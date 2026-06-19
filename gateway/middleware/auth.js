const jwt = require('jsonwebtoken')

const JWT_SECRET = process.env.JWT_SECRET

// --- TOPIC: Public Routes vs Protected Routes ---
// Not every route needs auth — /register and /login obviously can't
// require a token (you don't have one yet when registering). We need
// a way to exempt specific paths from the auth check.
const PUBLIC_PATHS = [
  '/users/register',
  '/users/login',
  '/health',
]

function isPublicPath(path) {
  return PUBLIC_PATHS.some(p => path === p || path.startsWith(p))
}

function authMiddleware(req, res, next) {
  if (isPublicPath(req.path)) {
    return next()   // skip verification entirely, proceed to proxy
  }

  const authHeader = req.headers['authorization']
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing or malformed Authorization header' })
  }

  const token = authHeader.split(' ')[1]

  // --- TOPIC: jwt.verify() ---
  // This checks: (1) signature matches the secret — proves the token
  // wasn't forged or tampered with, (2) token hasn't expired.
  // It throws synchronously if either check fails — that's why this
  // is wrapped in try/catch, not handled via a callback or promise.
  try {
    const decoded = jwt.verify(token, JWT_SECRET)
    req.user = decoded   // attach for any gateway-level logic that needs it

    // --- TOPIC: Injecting the Trusted Header ---
    // This is the actual trust boundary. We translate "verified JWT"
    // into a plain header that downstream services read blindly.
    req.headers['x-user-id'] = decoded.userId
    req.headers['x-username'] = decoded.username

    next()
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'token expired' })
    }
    return res.status(401).json({ error: 'invalid token' })
  }
}

module.exports = authMiddleware
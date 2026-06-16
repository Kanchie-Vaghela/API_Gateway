// This is a standard Express HTTP server.
// It only knows about its own routes — it has no idea a gateway exists.
// The gateway forwards requests here; this service just responds.

const express = require('express')
const app = express()
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ service: 'user-service', status: 'ok' })
})

app.post('/register', (req, res) => {
  res.json({ message: 'register endpoint ' })
})

app.post('/login', (req, res) => {
  res.json({ message: 'login endpoint ' })
})

app.get('/profile', (req, res) => {
  res.json({ message: 'profile endpoint ' })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`user-service running on ${PORT}`))
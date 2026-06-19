const express = require('express')
const jwt = require('jsonwebtoken')
const app = express()
app.use(express.json())

const JWT_SECRET = process.env.JWT_SECRET
const users = []

app.get('/health', (req, res) => {
  res.json({ service: 'user-service', status: 'ok' })
})

app.post('/users/register', (req, res) => {
  const { username, password } = req.body
  if (!username || !password) {
    return res.status(400).json({ error: 'username and password required' })
  }
  if (users.find(u => u.username === username)) {
    return res.status(409).json({ error: 'user already exists' })
  }
  const user = { id: users.length + 1, username, password }
  users.push(user)
  res.status(201).json({ id: user.id, username: user.username })
})

app.post('/users/login', (req, res) => {
  const { username, password } = req.body
  const user = users.find(u => u.username === username && u.password === password)
  if (!user) {
    return res.status(401).json({ error: 'invalid credentials' })
  }
  const token = jwt.sign(
    { userId: user.id, username: user.username },
    JWT_SECRET,
    { expiresIn: '1h' }
  )
  res.json({ token })
})

app.get('/users/profile', (req, res) => {
  const userId = req.headers['x-user-id']
  if (!userId) {
    return res.status(401).json({ error: 'no user context' })
  }
  const user = users.find(u => u.id === parseInt(userId))
  if (!user) return res.status(404).json({ error: 'user not found' })
  res.json({ id: user.id, username: user.username })
})

const PORT = process.env.PORT || 3001
app.listen(PORT, () => console.log(`user-service running on ${PORT}`))
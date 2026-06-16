const express = require('express')
const app = express()
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ service: 'order-service', status: 'ok' })
})

app.post('/orders', (req, res) => {
  res.json({ message: 'orders endpoint ' })
})

app.get('/orders/:userId', (req, res) => {
  res.json({ userId: req.params.userId, orders: [] })
})

const PORT = process.env.PORT || 3003
app.listen(PORT, () => console.log(`order-service running on ${PORT}`))
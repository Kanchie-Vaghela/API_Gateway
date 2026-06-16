const express = require('express')
const app = express()
app.use(express.json())

app.get('/health', (req, res) => {
  res.json({ service: 'product-service', status: 'ok' })
})

app.get('/products', (req, res) => {
  // this will hit PostgreSQL, then cache result in Redis
  res.json([
    { id: 1, name: 'Widget A', price: 9.99 },
    { id: 2, name: 'Widget B', price: 19.99 }
  ])
})

app.get('/products/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Widget A', price: 9.99 })
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => console.log(`product-service running on ${PORT}`))
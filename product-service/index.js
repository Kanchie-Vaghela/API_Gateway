const express = require('express')
const app = express()
app.use(express.json())

// Log every incoming request with its exact path — this alone
// will tell us definitively what string this service receives
app.use((req, res, next) => {
  console.log(`[product-service] ${req.method} ${req.path}`)
  next()
})

app.get('/health', (req, res) => {
  res.json({ service: 'product-service', status: 'ok' })
})

app.get('/products', (req, res) => {
  res.json([
    { id: 1, name: 'Widget A', price: 9.99 },
    { id: 2, name: 'Widget B', price: 19.99 }
  ])
})

app.get('/products/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Widget A', price: 9.99 })
})

// Catch-all — if nothing above matched, log it loudly instead of
// letting Express's generic "Cannot GET" hide what path actually arrived
app.use((req, res) => {
  console.log(`[product-service] NO ROUTE MATCHED for ${req.method} ${req.path}`)
  res.status(404).json({ error: 'not found', path: req.path })
})

const PORT = process.env.PORT || 3002
app.listen(PORT, () => console.log(`product-service running on ${PORT}`))
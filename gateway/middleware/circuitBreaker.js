// --- TOPIC: Circuit Breaker State Machine ---
// Three states:
// CLOSED  → normal operation, requests pass through, failures counted
// OPEN    → service is down, requests blocked immediately, no network call
// HALF_OPEN → cooldown passed, one test request allowed through
//
// The state machine prevents cascade failures — if product-service
// is down and the gateway keeps trying, every client request ties up
// a connection waiting for a timeout. With a circuit breaker, once
// the circuit opens, failures are instant (no network wait) and the
// service gets time to recover before being probed again.

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name
    this.state = 'CLOSED'
    this.failureCount = 0
    this.openedAt = null
    this.threshold = options.threshold || 5      // failures before OPEN
    this.timeout = options.timeout || 30000      // ms before HALF_OPEN
  }

  // Called before every proxy attempt
  canRequest() {
    if (this.state === 'CLOSED') return true

    if (this.state === 'OPEN') {
      // Check if cooldown has passed
      if (Date.now() - this.openedAt >= this.timeout) {
        console.log(`[circuit-breaker] ${this.name}: OPEN → HALF_OPEN`)
        this.state = 'HALF_OPEN'
        return true   // allow the one probe request
      }
      return false    // still cooling down
    }

    if (this.state === 'HALF_OPEN') {
      return true     // allow the probe through
    }
  }

  recordSuccess() {
    if (this.state === 'HALF_OPEN') {
      console.log(`[circuit-breaker] ${this.name}: HALF_OPEN → CLOSED`)
    }
    this.failureCount = 0
    this.state = 'CLOSED'
    this.openedAt = null
  }

  recordFailure() {
    this.failureCount++
    console.log(`[circuit-breaker] ${this.name}: failure ${this.failureCount}/${this.threshold}`)

    if (this.state === 'HALF_OPEN') {
      // Probe failed — back to OPEN, reset timer
      console.log(`[circuit-breaker] ${this.name}: HALF_OPEN → OPEN`)
      this.state = 'OPEN'
      this.openedAt = Date.now()
      return
    }

    if (this.failureCount >= this.threshold) {
      console.log(`[circuit-breaker] ${this.name}: CLOSED → OPEN`)
      this.state = 'OPEN'
      this.openedAt = Date.now()
    }
  }

  // Returns current state info for health checks and metrics
  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      openedAt: this.openedAt
    }
  }
}

// One instance per service — independent state machines
// Exported as a map so gateway/index.js can access them for health checks
const breakers = {
  'user-service':    new CircuitBreaker('user-service'),
  'product-service': new CircuitBreaker('product-service'),
  'order-service':   new CircuitBreaker('order-service'),
}

module.exports = breakers
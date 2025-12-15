/**
 * Circuit Breaker Service
 * Implements circuit breaker pattern for resilient external service calls
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is failing, requests fail fast
 * - HALF_OPEN: Testing if service recovered, allowing limited requests
 */

class CircuitBreaker {
    constructor(options = {}) {
        this.name = options.name || 'circuit';
        this.timeout = options.timeout || 3000; // Request timeout
        this.errorThreshold = options.errorThreshold || 5; // Open after N errors
        this.successThreshold = options.successThreshold || 2; // Close after N successes
        this.resetTimeout = options.resetTimeout || 30000; // Time before trying again (30s)
        this.monitoringWindow = options.monitoringWindow || 60000; // 1 minute window

        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.failureCount = 0;
        this.successCount = 0;
        this.lastFailureTime = null;
        this.lastStateChange = Date.now();
        this.requestCount = 0;
        this.errorCount = 0;

        // Event handlers
        this.onOpen = options.onOpen || (() => {});
        this.onClose = options.onClose || (() => {});
        this.onHalfOpen = options.onHalfOpen || (() => {});
    }

    /**
     * Execute a function with circuit breaker protection
     */
    async execute(fn, ...args) {
        // Check if we should transition from OPEN to HALF_OPEN
        if (this.state === 'OPEN') {
            const timeSinceOpen = Date.now() - this.lastStateChange;
            if (timeSinceOpen >= this.resetTimeout) {
                this.transitionToHalfOpen();
            } else {
                throw new Error(`Circuit breaker ${this.name} is OPEN`);
            }
        }

        this.requestCount++;

        try {
            // Execute with timeout
            const result = await Promise.race([
                Promise.resolve(fn(...args)),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Request timeout')), this.timeout)
                )
            ]);

            // Success
            this.onSuccess();
            return result;

        } catch (error) {
            // Failure
            this.onFailure(error);
            throw error;
        }
    }

    /**
     * Handle successful request
     */
    onSuccess() {
        if (this.state === 'HALF_OPEN') {
            this.successCount++;
            if (this.successCount >= this.successThreshold) {
                this.transitionToClosed();
            }
        } else if (this.state === 'CLOSED') {
            // Reset failure count on success in CLOSED state
            this.failureCount = Math.max(0, this.failureCount - 1);
        }
    }

    /**
     * Handle failed request
     */
    onFailure(error) {
        this.errorCount++;
        this.lastFailureTime = Date.now();

        if (this.state === 'HALF_OPEN') {
            // If we fail in HALF_OPEN, go back to OPEN
            this.transitionToOpen();
        } else if (this.state === 'CLOSED') {
            this.failureCount++;
            if (this.failureCount >= this.errorThreshold) {
                this.transitionToOpen();
            }
        }
    }

    /**
     * Transition to OPEN state
     */
    transitionToOpen() {
        if (this.state !== 'OPEN') {
            this.state = 'OPEN';
            this.lastStateChange = Date.now();
            this.successCount = 0;
            this.onOpen(this.name);
        }
    }

    /**
     * Transition to HALF_OPEN state
     */
    transitionToHalfOpen() {
        this.state = 'HALF_OPEN';
        this.lastStateChange = Date.now();
        this.failureCount = 0;
        this.successCount = 0;
        this.onHalfOpen(this.name);
    }

    /**
     * Transition to CLOSED state
     */
    transitionToClosed() {
        this.state = 'CLOSED';
        this.lastStateChange = Date.now();
        this.failureCount = 0;
        this.successCount = 0;
        this.onClose(this.name);
    }

    /**
     * Get current state
     */
    getState() {
        return {
            state: this.state,
            failureCount: this.failureCount,
            successCount: this.successCount,
            requestCount: this.requestCount,
            errorCount: this.errorCount,
            lastFailureTime: this.lastFailureTime,
            lastStateChange: this.lastStateChange
        };
    }

    /**
     * Reset circuit breaker
     */
    reset() {
        this.transitionToClosed();
        this.requestCount = 0;
        this.errorCount = 0;
    }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers
 */
class CircuitBreakerManager {
    constructor() {
        this.breakers = new Map();
    }

    /**
     * Get or create a circuit breaker
     */
    getBreaker(name, options = {}) {
        if (!this.breakers.has(name)) {
            const breaker = new CircuitBreaker({ name, ...options });
            this.breakers.set(name, breaker);
        }
        return this.breakers.get(name);
    }

    /**
     * Get all breaker states
     */
    getAllStates() {
        const states = {};
        for (const [name, breaker] of this.breakers.entries()) {
            states[name] = breaker.getState();
        }
        return states;
    }

    /**
     * Reset a breaker
     */
    resetBreaker(name) {
        const breaker = this.breakers.get(name);
        if (breaker) {
            breaker.reset();
        }
    }

    /**
     * Reset all breakers
     */
    resetAll() {
        for (const breaker of this.breakers.values()) {
            breaker.reset();
        }
    }
}

// Export singleton instance
const circuitBreakerManager = new CircuitBreakerManager();

module.exports = {
    CircuitBreaker,
    CircuitBreakerManager,
    circuitBreakerManager
};

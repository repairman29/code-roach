/**
 * Retry Service
 * Implements retry logic with exponential backoff for resilient operations
 */

class RetryService {
    /**
     * Execute a function with retry logic
     * 
     * @param {Function} fn - Function to execute
     * @param {Object} options - Retry options
     * @param {number} options.maxRetries - Maximum number of retries (default: 3)
     * @param {number} options.initialDelay - Initial delay in ms (default: 100)
     * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
     * @param {number} options.multiplier - Exponential backoff multiplier (default: 2)
     * @param {Function} options.shouldRetry - Function to determine if error should be retried
     * @param {Function} options.onRetry - Callback on each retry
     */
    static async retry(fn, options = {}) {
        const {
            maxRetries = 3,
            initialDelay = 100,
            maxDelay = 10000,
            multiplier = 2,
            shouldRetry = (error) => true,
            onRetry = () => {}
        } = options;

        let lastError;
        let delay = initialDelay;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                // Check if we should retry this error
                if (!shouldRetry(error)) {
                    throw error;
                }

                // Don't retry on last attempt
                if (attempt === maxRetries) {
                    break;
                }

                // Call retry callback
                onRetry(error, attempt + 1, delay);

                // Wait before retrying
                await this.sleep(delay);

                // Calculate next delay with exponential backoff
                delay = Math.min(delay * multiplier, maxDelay);
            }
        }

        throw lastError;
    }

    /**
     * Sleep for specified milliseconds
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Retry with jitter (randomized delay to prevent thundering herd)
     */
    static async retryWithJitter(fn, options = {}) {
        const {
            maxRetries = 3,
            initialDelay = 100,
            maxDelay = 10000,
            multiplier = 2,
            jitter = true,
            shouldRetry = (error) => true,
            onRetry = () => {}
        } = options;

        let lastError;
        let delay = initialDelay;

        for (let attempt = 0; attempt <= maxRetries; attempt++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;

                if (!shouldRetry(error)) {
                    throw error;
                }

                if (attempt === maxRetries) {
                    break;
                }

                onRetry(error, attempt + 1, delay);

                // Add jitter to delay
                const jitteredDelay = jitter 
                    ? delay + Math.random() * delay * 0.1 // Add up to 10% jitter
                    : delay;

                await this.sleep(jitteredDelay);
                delay = Math.min(delay * multiplier, maxDelay);
            }
        }

        throw lastError;
    }

    /**
     * Retry with circuit breaker integration
     */
    static async retryWithCircuitBreaker(fn, circuitBreaker, options = {}) {
        return circuitBreaker.execute(async () => {
            return this.retry(fn, options);
        });
    }

    /**
     * Default shouldRetry function - retry on network/timeout errors
     */
    static shouldRetryNetworkError(error) {
        // Retry on network errors, timeouts, and 5xx errors
        if (error.code === 'ECONNREFUSED' || 
            error.code === 'ETIMEDOUT' || 
            error.code === 'ENOTFOUND' ||
            error.message?.includes('timeout') ||
            error.message?.includes('ECONNRESET')) {
            return true;
        }

        // Retry on 5xx server errors
        if (error.response?.status >= 500 && error.response?.status < 600) {
            return true;
        }

        // Don't retry on 4xx client errors (except 429 rate limit)
        if (error.response?.status >= 400 && error.response?.status < 500) {
            return error.response?.status === 429; // Retry rate limits
        }

        return false;
    }
}

module.exports = RetryService;

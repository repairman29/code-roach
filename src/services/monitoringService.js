/**
 * Monitoring Service
 * Centralized monitoring and metrics collection for 99.99% uptime
 * 
 * Tracks:
 * - Request metrics
 * - Error rates
 * - Response times
 * - Circuit breaker states
 * - Service health
 * - Resource usage
 */

const { circuitBreakerManager } = require('./circuitBreaker');

class MonitoringService {
    constructor() {
        this.metrics = {
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                byEndpoint: new Map(),
                byMethod: new Map()
            },
            errors: {
                total: 0,
                byType: new Map(),
                byEndpoint: new Map(),
                recent: [] // Last 100 errors
            },
            responseTimes: {
                average: 0,
                p50: 0,
                p95: 0,
                p99: 0,
                samples: [] // Last 1000 samples
            },
            circuitBreakers: {},
            uptime: {
                startTime: Date.now(),
                lastCheck: Date.now()
            },
            resources: {
                memory: [],
                cpu: []
            }
        };

        this.maxSamples = 1000;
        this.maxRecentErrors = 100;
        this.startTime = Date.now();
    }

    /**
     * Record a request
     */
    recordRequest(method, endpoint, statusCode, responseTime) {
        this.metrics.requests.total++;
        
        if (statusCode >= 200 && statusCode < 400) {
            this.metrics.requests.successful++;
        } else {
            this.metrics.requests.failed++;
        }

        // Track by endpoint
        const endpointKey = `${method} ${endpoint}`;
        if (!this.metrics.requests.byEndpoint.has(endpointKey)) {
            this.metrics.requests.byEndpoint.set(endpointKey, {
                total: 0,
                successful: 0,
                failed: 0,
                totalTime: 0
            });
        }
        const endpointMetrics = this.metrics.requests.byEndpoint.get(endpointKey);
        endpointMetrics.total++;
        if (statusCode >= 200 && statusCode < 400) {
            endpointMetrics.successful++;
        } else {
            endpointMetrics.failed++;
        }
        endpointMetrics.totalTime += responseTime;

        // Track by method
        if (!this.metrics.requests.byMethod.has(method)) {
            this.metrics.requests.byMethod.set(method, { total: 0, successful: 0, failed: 0 });
        }
        const methodMetrics = this.metrics.requests.byMethod.get(method);
        methodMetrics.total++;
        if (statusCode >= 200 && statusCode < 400) {
            methodMetrics.successful++;
        } else {
            methodMetrics.failed++;
        }

        // Track response times
        this.metrics.responseTimes.samples.push(responseTime);
        if (this.metrics.responseTimes.samples.length > this.maxSamples) {
            this.metrics.responseTimes.samples.shift();
        }
        this._calculateResponseTimePercentiles();
    }

    /**
     * Record an error
     */
    recordError(error, endpoint, context = {}) {
        this.metrics.errors.total++;
        this.metrics.requests.failed++;

        const errorType = error.name || error.constructor?.name || 'UnknownError';
        
        // Track by type
        if (!this.metrics.errors.byType.has(errorType)) {
            this.metrics.errors.byType.set(errorType, 0);
        }
        this.metrics.errors.byType.set(errorType, this.metrics.errors.byType.get(errorType) + 1);

        // Track by endpoint
        if (endpoint) {
            if (!this.metrics.errors.byEndpoint.has(endpoint)) {
                this.metrics.errors.byEndpoint.set(endpoint, 0);
            }
            this.metrics.errors.byEndpoint.set(endpoint, this.metrics.errors.byEndpoint.get(endpoint) + 1);
        }

        // Store recent error
        this.metrics.errors.recent.push({
            timestamp: Date.now(),
            type: errorType,
            message: error.message,
            endpoint,
            context
        });
        if (this.metrics.errors.recent.length > this.maxRecentErrors) {
            this.metrics.errors.recent.shift();
        }
    }

    /**
     * Update circuit breaker states
     */
    updateCircuitBreakerStates() {
        const states = circuitBreakerManager.getAllStates();
        this.metrics.circuitBreakers = states;
    }

    /**
     * Update resource metrics
     */
    updateResourceMetrics() {
        const usage = process.memoryUsage();
        this.metrics.resources.memory.push({
            timestamp: Date.now(),
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            rss: usage.rss,
            external: usage.external
        });

        // Keep last 100 samples
        if (this.metrics.resources.memory.length > 100) {
            this.metrics.resources.memory.shift();
        }

        // CPU usage would require external library or OS-specific calls
        // For now, we'll track it as available
    }

    /**
     * Calculate response time percentiles
     */
    _calculateResponseTimePercentiles() {
        if (this.metrics.responseTimes.samples.length === 0) {
            return;
        }

        const sorted = [...this.metrics.responseTimes.samples].sort((a, b) => a - b);
        const len = sorted.length;

        this.metrics.responseTimes.average = sorted.reduce((a, b) => a + b, 0) / len;
        this.metrics.responseTimes.p50 = sorted[Math.floor(len * 0.5)];
        this.metrics.responseTimes.p95 = sorted[Math.floor(len * 0.95)];
        this.metrics.responseTimes.p99 = sorted[Math.floor(len * 0.99)];
    }

    /**
     * Get current metrics
     */
    getMetrics() {
        this.updateCircuitBreakerStates();
        this.updateResourceMetrics();
        this.metrics.uptime.lastCheck = Date.now();

        return {
            ...this.metrics,
            uptime: {
                ...this.metrics.uptime,
                seconds: Math.floor((Date.now() - this.metrics.uptime.startTime) / 1000),
                hours: Math.floor((Date.now() - this.metrics.uptime.startTime) / (1000 * 60 * 60))
            },
            errorRate: this.metrics.requests.total > 0 
                ? (this.metrics.errors.total / this.metrics.requests.total) * 100 
                : 0,
            successRate: this.metrics.requests.total > 0
                ? (this.metrics.requests.successful / this.metrics.requests.total) * 100
                : 100,
            // Convert Maps to objects for JSON serialization
            requests: {
                ...this.metrics.requests,
                byEndpoint: Object.fromEntries(this.metrics.requests.byEndpoint),
                byMethod: Object.fromEntries(this.metrics.requests.byMethod)
            },
            errors: {
                ...this.metrics.errors,
                byType: Object.fromEntries(this.metrics.errors.byType),
                byEndpoint: Object.fromEntries(this.metrics.errors.byEndpoint)
            }
        };
    }

    /**
     * Get health summary
     */
    getHealthSummary() {
        const metrics = this.getMetrics();
        const openBreakers = Object.entries(metrics.circuitBreakers)
            .filter(([_, state]) => state.state === 'OPEN')
            .map(([name]) => name);

        return {
            healthy: openBreakers.length === 0 && metrics.errorRate < 5,
            errorRate: metrics.errorRate,
            successRate: metrics.successRate,
            openCircuitBreakers: openBreakers,
            uptime: metrics.uptime,
            recentErrors: metrics.errors.recent.slice(-10) // Last 10 errors
        };
    }

    /**
     * Reset metrics (useful for testing)
     */
    reset() {
        this.metrics = {
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                byEndpoint: new Map(),
                byMethod: new Map()
            },
            errors: {
                total: 0,
                byType: new Map(),
                byEndpoint: new Map(),
                recent: []
            },
            responseTimes: {
                average: 0,
                p50: 0,
                p95: 0,
                p99: 0,
                samples: []
            },
            circuitBreakers: {},
            uptime: {
                startTime: Date.now(),
                lastCheck: Date.now()
            },
            resources: {
                memory: [],
                cpu: []
            }
        };
        this.startTime = Date.now();
    }
}

// Export singleton instance
const monitoringService = new MonitoringService();

module.exports = monitoringService;

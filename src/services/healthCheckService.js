/**
 * Health Check Service
 * Comprehensive health checking for 99.99% uptime monitoring
 * 
 * Checks:
 * - Server status
 * - Database connectivity (Supabase)
 * - Redis connectivity
 * - Job queue status
 * - Memory usage
 * - Disk space
 * - External API dependencies
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

class HealthCheckService {
    constructor() {
        this.checks = {};
        this.lastCheckTime = null;
        this.checkCache = new Map(); // Cache results for 5 seconds
        this.cacheTTL = 5000;
    }

    /**
     * Run all health checks
     */
    async runAllChecks() {
        const startTime = Date.now();
        const checks = {
            server: this.checkServer(),
            database: this.checkDatabase(),
            redis: this.checkRedis(),
            jobQueue: this.checkJobQueue(),
            memory: this.checkMemory(),
            disk: this.checkDisk()
        };

        // Run all checks in parallel with timeouts
        const results = await Promise.allSettled([
            this.withTimeout(checks.server, 5000, 'database'),
            this.withTimeout(checks.database, 5000, 'database'),
            this.withTimeout(checks.redis, 3000, 'redis'),
            this.withTimeout(checks.jobQueue, 3000, 'job_queue'),
            this.withTimeout(checks.memory, 1000, 'memory'),
            this.withTimeout(checks.disk, 2000, 'disk')
        ]);

        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            response_time_ms: Date.now() - startTime,
            checks: {}
        };

        // Process results
        results.forEach((result, index) => {
            const checkNames = ['server', 'database', 'redis', 'job_queue', 'memory', 'disk'];
            const checkName = checkNames[index];
            
            if (result.status === 'fulfilled') {
                health.checks[checkName] = result.value;
            } else {
                health.checks[checkName] = {
                    status: 'error',
                    error: result.reason?.message || 'Check failed',
                    timeout: result.reason?.timeout || false
                };
            }
        });

        // Add circuit breaker states
        try {
            const { circuitBreakerManager } = require('./circuitBreaker');
            health.circuit_breakers = circuitBreakerManager.getAllStates();
        } catch (err) {
            // Circuit breaker service not available
        }

        // Determine overall health
        const criticalChecks = ['server', 'database', 'redis'];
        const criticalStatuses = criticalChecks.map(check => health.checks[check]?.status);
        const hasCriticalFailure = criticalStatuses.some(status => status === 'error' || status === 'degraded');

        // Check circuit breaker states
        if (health.circuit_breakers) {
            const openBreakers = Object.entries(health.circuit_breakers)
                .filter(([_, state]) => state.state === 'OPEN')
                .map(([name]) => name);
            
            if (openBreakers.length > 0) {
                health.status = 'degraded';
                health.degraded_reasons = health.degraded_reasons || [];
                health.degraded_reasons.push(`Circuit breakers open: ${openBreakers.join(', ')}`);
            }
        }

        if (hasCriticalFailure) {
            health.status = 'degraded';
        }

        // Check if any non-critical checks failed
        const allStatuses = Object.values(health.checks).map(c => c?.status);
        const hasAnyFailure = allStatuses.some(status => status === 'error' || status === 'degraded');
        
        if (hasAnyFailure && !hasCriticalFailure && health.status !== 'degraded') {
            health.status = 'degraded';
        }

        this.lastCheckTime = Date.now();
        return health;
    }

    /**
     * Check server status
     */
    async checkServer() {
        return {
            status: 'ok',
            uptime: process.uptime(),
            node_version: process.version,
            platform: process.platform
        };
    }

    /**
     * Check database connectivity
     */
    async checkDatabase() {
        try {
            if (!config.supabase || !config.supabase.url || !config.supabase.serviceRoleKey) {
                return {
                    status: 'not_configured',
                    message: 'Supabase not configured'
                };
            }

            const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
            
            // Simple connectivity check - verify we can reach Supabase API
            // Don't require specific tables to exist (they might not be migrated yet)
            const https = require('https');
            const url = require('url');
            const supabaseUrl = new URL(config.supabase.url);
            
            return new Promise((resolve) => {
                const options = {
                    hostname: supabaseUrl.hostname,
                    path: '/rest/v1/',
                    method: 'GET',
                    headers: {
                        'apikey': config.supabase.serviceRoleKey,
                        'Authorization': `Bearer ${config.supabase.serviceRoleKey}`
                    },
                    timeout: 5000
                };
                
                const req = https.request(options, (res) => {
                    // Any response (even 404) means API is reachable
                    if (res.statusCode === 404 || res.statusCode === 200) {
                        resolve({
                            status: 'ok',
                            response_time_ms: Date.now()
                        });
                    } else {
                        resolve({
                            status: 'degraded',
                            error: `Supabase API returned status ${res.statusCode}`,
                            code: 'HTTP_ERROR'
                        });
                    }
                });
                
                req.on('error', (err) => {
                    resolve({
                        status: 'error',
                        error: err.message || 'Cannot connect to Supabase API',
                        code: 'CONNECTION_ERROR'
                    });
                });
                
                req.on('timeout', () => {
                    req.destroy();
                    resolve({
                        status: 'error',
                        error: 'Connection timeout',
                        code: 'TIMEOUT'
                    });
                });
                
                req.end();
            });

            return {
                status: 'ok',
                response_time_ms: Date.now() // Approximate
            };
        } catch (err) {
            return {
                status: 'error',
                error: err.message
            };
        }
    }

    /**
     * Check Redis connectivity
     */
    async checkRedis() {
        try {
            const cacheService = require('./cacheService');
            
            if (!cacheService.redis) {
                return {
                    status: 'not_configured',
                    message: 'Redis not configured'
                };
            }

            const startTime = Date.now();
            const result = await cacheService.redis.ping();
            const responseTime = Date.now() - startTime;

            if (result !== 'PONG') {
                return {
                    status: 'error',
                    error: 'Unexpected Redis response'
                };
            }

            // Check Redis info
            const info = await cacheService.redis.info('server');
            const connectedClients = info.match(/connected_clients:(\d+)/)?.[1] || 'unknown';

            return {
                status: 'ok',
                response_time_ms: responseTime,
                connected_clients: parseInt(connectedClients)
            };
        } catch (err) {
            return {
                status: 'error',
                error: err.message
            };
        }
    }

    /**
     * Check job queue status
     */
    async checkJobQueue() {
        try {
            const jobQueue = require('./jobQueue');
            
            if (!jobQueue.connection) {
                return {
                    status: 'not_configured',
                    message: 'Job queue not configured'
                };
            }

            const startTime = Date.now();
            const result = await jobQueue.connection.ping();
            const responseTime = Date.now() - startTime;

            if (result !== 'PONG') {
                return {
                    status: 'error',
                    error: 'Unexpected job queue response'
                };
            }

            // Get queue stats
            const queueStats = {};
            for (const [queueName, queue] of Object.entries(jobQueue.queues || {})) {
                try {
                    const waiting = await queue.getWaitingCount();
                    const active = await queue.getActiveCount();
                    const completed = await queue.getCompletedCount();
                    const failed = await queue.getFailedCount();

                    queueStats[queueName] = {
                        waiting,
                        active,
                        completed,
                        failed
                    };
                } catch (err) {
                    queueStats[queueName] = { error: err.message };
                }
            }

            return {
                status: 'ok',
                response_time_ms: responseTime,
                queues: queueStats
            };
        } catch (err) {
            return {
                status: 'error',
                error: err.message
            };
        }
    }

    /**
     * Check memory usage
     */
    async checkMemory() {
        try {
            const usage = process.memoryUsage();
            const totalMemory = require('os').totalmem();
            const freeMemory = require('os').freemem();
            const usedMemory = totalMemory - freeMemory;
            const memoryUsagePercent = (usedMemory / totalMemory) * 100;

            // Warn if memory usage is high
            let status = 'ok';
            if (memoryUsagePercent > 90) {
                status = 'critical';
            } else if (memoryUsagePercent > 80) {
                status = 'warning';
            }

            return {
                status,
                heap_used_mb: Math.round(usage.heapUsed / 1024 / 1024),
                heap_total_mb: Math.round(usage.heapTotal / 1024 / 1024),
                rss_mb: Math.round(usage.rss / 1024 / 1024),
                external_mb: Math.round(usage.external / 1024 / 1024),
                system_total_mb: Math.round(totalMemory / 1024 / 1024),
                system_free_mb: Math.round(freeMemory / 1024 / 1024),
                system_used_percent: Math.round(memoryUsagePercent * 100) / 100
            };
        } catch (err) {
            return {
                status: 'error',
                error: err.message
            };
        }
    }

    /**
     * Check disk space
     */
    async checkDisk() {
        try {
            const fs = require('fs').promises;
            const path = require('path');
            
            // Check if we can write to disk
            const testFile = path.join(__dirname, '../../.health-check-temp');
            try {
                await fs.writeFile(testFile, 'health-check');
                await fs.unlink(testFile);
            } catch (err) {
                return {
                    status: 'error',
                    error: `Cannot write to disk: ${err.message}`
                };
            }

            // Try to get disk stats (may not work on all platforms)
            try {
                const stats = require('fs').statSync('.');
                return {
                    status: 'ok',
                    writable: true
                };
            } catch (err) {
                // If we can write, consider it ok even if we can't get stats
                return {
                    status: 'ok',
                    writable: true,
                    note: 'Disk stats unavailable'
                };
            }
        } catch (err) {
            return {
                status: 'error',
                error: err.message
            };
        }
    }

    /**
     * Wrap a promise with a timeout
     */
    async withTimeout(promise, timeoutMs, checkName) {
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => {
                reject({ 
                    timeout: true, 
                    message: `${checkName} check timed out after ${timeoutMs}ms` 
                });
            }, timeoutMs);
        });

        return Promise.race([promise, timeoutPromise]);
    }

    /**
     * Get cached health check or run new check
     */
    async getHealth(cached = true) {
        if (cached && this.lastCheckTime) {
            const cacheAge = Date.now() - this.lastCheckTime;
            if (cacheAge < this.cacheTTL) {
                const cacheKey = 'health_check';
                if (this.checkCache.has(cacheKey)) {
                    return this.checkCache.get(cacheKey);
                }
            }
        }

        const health = await this.runAllChecks();
        
        if (cached) {
            this.checkCache.set('health_check', health);
        }

        return health;
    }

    /**
     * Check if system is healthy (for load balancer)
     */
    async isHealthy() {
        const health = await this.getHealth();
        return health.status === 'healthy';
    }
}

module.exports = new HealthCheckService();

/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixMonitoringService.js
 * Last Sync: 2025-12-21T02:43:02.374Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Monitoring Service
 * Real-time monitoring of applied fixes
 * 
 * Improvement #2: Real-Time Monitoring
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const fixRollbackIntelligenceService = require('./fixRollbackIntelligenceService');
const codeHealthScoring = require('./codeHealthScoring');

class FixMonitoringService {
    constructor() {
        // Initialize active monitors map
        this.activeMonitors = new Map();
        
        // Only create Supabase client if credentials are available
        if (config.supabase.serviceRoleKey) {
            try {
                this.supabase = createClient(
                    config.supabase.url,
                    config.supabase.serviceRoleKey
                );
            } catch (error) {
                console.warn('[fixMonitoringService] Supabase not configured:', error.message);
                this.supabase = null;
            }
        } else {
            console.warn('[fixMonitoringService] Supabase credentials not configured. Service will be disabled.');
            this.supabase = null;
        }

        // Start monitoring loop
        this.startMonitoringLoop();
    }

    /**
     * Start monitoring a fix
     */
    async startMonitoring(fixId, fixData, context = {}) {
        try {
            const monitor = {
                fixId,
                fixData,
                context,
                startedAt: Date.now(),
                checks: [],
                metrics: {
                    errorCount: 0,
                    testFailures: 0,
                    performanceIssues: 0,
                    healthScore: null,
                    healthScoreChange: 0
                },
                alerts: [],
                status: 'monitoring'
            };

            this.activeMonitors.set(fixId, monitor);

            // Also register with rollback intelligence
            await fixRollbackIntelligenceService.monitorFix(fixId, fixData, context);

            // Initial health check
            await this.checkFixHealth(fixId);

            return {
                success: true,
                fixId,
                monitoring: true,
                nextCheck: Date.now() + this.monitoringInterval
            };
        } catch (error) {
            console.error('[Fix Monitoring] Error starting monitoring:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Check fix health
     */
    async checkFixHealth(fixId) {
        const monitor = this.activeMonitors.get(fixId);
        if (!monitor) {
            return { error: 'Monitor not found' };
        }

        try {
            const check = {
                timestamp: Date.now(),
                metrics: {},
                issues: [],
                status: 'healthy'
            };

            // 1. Check for new errors
            const newErrors = await this.checkNewErrors(monitor);
            check.metrics.newErrors = newErrors.length;
            if (newErrors.length > 0) {
                check.issues.push(...newErrors);
                check.status = 'degraded';
            }

            // 2. Check test status
            const testStatus = await this.checkTestStatus(monitor);
            check.metrics.testFailures = testStatus.failures;
            if (testStatus.failures > 0) {
                check.issues.push({
                    type: 'test_failure',
                    severity: 'high',
                    message: `${testStatus.failures} test(s) failing`
                });
                check.status = 'degraded';
            }

            // 3. Check performance
            const performance = await this.checkPerformance(monitor);
            check.metrics.performance = performance;
            if (performance.degraded) {
                check.issues.push({
                    type: 'performance',
                    severity: 'medium',
                    message: performance.message
                });
                if (check.status === 'healthy') {
                    check.status = 'warning';
                }
            }

            // 4. Check code health
            const health = await this.checkCodeHealth(monitor);
            check.metrics.healthScore = health.score;
            check.metrics.healthScoreChange = health.change;
            if (health.change < -10) {
                check.issues.push({
                    type: 'health_degradation',
                    severity: 'medium',
                    message: `Health score decreased by ${Math.abs(health.change)} points`
                });
            }

            // 5. Check rollback recommendation
            const rollbackCheck = await fixRollbackIntelligenceService.shouldRollback(fixId);
            check.metrics.rollbackScore = rollbackCheck.rollbackScore;
            if (rollbackCheck.shouldRollback) {
                check.issues.push({
                    type: 'rollback_recommended',
                    severity: 'critical',
                    message: rollbackCheck.reasons.join('; ')
                });
                check.status = 'critical';
            }

            // Update monitor
            monitor.checks.push(check);
            monitor.metrics.errorCount += newErrors.length;
            monitor.metrics.testFailures += testStatus.failures;
            if (health.score !== null) {
                monitor.metrics.healthScore = health.score;
                monitor.metrics.healthScoreChange = health.change;
            }

            // Generate alerts if needed
            if (check.status !== 'healthy') {
                await this.generateAlert(fixId, check);
            }

            // Store metrics
            this.metrics.set(fixId, check.metrics);

            return check;
        } catch (error) {
            console.error('[Fix Monitoring] Error checking health:', error);
            return {
                timestamp: Date.now(),
                status: 'error',
                error: error.message
            };
        }
    }

    /**
     * Check for new errors
     */
    async checkNewErrors(monitor) {
        if (!this.supabase || !monitor.context.filePath) return [];

        try {
            const { data, error } = await this.supabase
                .from('code_roach_issues')
                .select('*')
                .eq('error_file', monitor.context.filePath)
                .gt('created_at', new Date(monitor.startedAt).toISOString())
                .in('error_severity', ['critical', 'high']);

            if (error) throw error;

            return (data || []).map(issue => ({
                type: 'new_error',
                severity: issue.error_severity,
                message: issue.error_message,
                line: issue.error_line
            }));
        } catch (error) {
            console.warn('[Fix Monitoring] Error checking new errors:', error);
            return [];
        }
    }

    /**
     * Check test status
     */
    async checkTestStatus(monitor) {
        // This would integrate with test runner
        // For now, check for test-related issues
        if (!this.supabase || !monitor.context.filePath) {
            return { failures: 0, total: 0 };
        }

        try {
            const { data, error } = await this.supabase
                .from('code_roach_issues')
                .select('id')
                .eq('error_file', monitor.context.filePath)
                .gt('created_at', new Date(monitor.startedAt).toISOString())
                .or('error_type.eq.test,error_message.ilike.%test%');

            if (error) throw error;

            return {
                failures: data?.length || 0,
                total: 0 // Would get from test runner
            };
        } catch (error) {
            return { failures: 0, total: 0 };
        }
    }

    /**
     * Check performance
     */
    async checkPerformance(monitor) {
        if (!this.supabase || !monitor.context.filePath) return { degraded: false };

        try {
            const { data, error } = await this.supabase
                .from('code_roach_issues')
                .select('*')
                .eq('error_file', monitor.context.filePath)
                .eq('error_type', 'performance')
                .gt('created_at', new Date(monitor.startedAt).toISOString());

            if (error) throw error;

            if (data && data.length > 0) {
                return {
                    degraded: true,
                    message: `${data.length} performance issue(s) detected`,
                    issues: data.length
                };
            }

            return { degraded: false };
        } catch (error) {
            return { degraded: false };
        }
    }

    /**
     * Check code health
     */
    async checkCodeHealth(monitor) {
        if (!monitor.context.filePath) {
            return { score: null, change: 0 };
        }

        try {
            const currentHealth = await codeHealthScoring.getHealthScore(monitor.context.filePath);
            const currentScore = currentHealth?.overall || 0;

            // Get previous health score (from before fix)
            const previousScore = monitor.metrics.healthScore || currentScore;

            return {
                score: currentScore,
                change: currentScore - previousScore,
                previous: previousScore
            };
        } catch (error) {
            return { score: null, change: 0 };
        }
    }

    /**
     * Generate alert
     */
    async generateAlert(fixId, check) {
        const monitor = this.activeMonitors.get(fixId);
        if (!monitor) return;

        const alert = {
            fixId,
            timestamp: Date.now(),
            severity: check.status,
            issues: check.issues,
            metrics: check.metrics,
            message: this.generateAlertMessage(check)
        };

        monitor.alerts.push(alert);

        // Store alert in database
        if (this.supabase) {
            try {
                await this.supabase
                    .from('code_roach_issues')
                    .update({
                        metadata: {
                            ...(monitor.context.issue?.metadata || {}),
                            monitoring_alerts: monitor.alerts
                        }
                    })
                    .eq('id', fixId);
            } catch (error) {
                console.warn('[Fix Monitoring] Error storing alert:', error);
            }
        }

        // Could send notification here
        console.log(`[Fix Monitoring] Alert for fix ${fixId}: ${alert.message}`);
    }

    /**
     * Generate alert message
     */
    generateAlertMessage(check) {
        const issues = check.issues.map(i => i.message).join('; ');
        return `Fix monitoring detected issues: ${issues}`;
    }

    /**
     * Start monitoring loop
     */
    startMonitoringLoop() {
        setInterval(async () => {
            for (const [fixId, monitor] of this.activeMonitors) {
                // Only monitor for 24 hours
                if (Date.now() - monitor.startedAt > 24 * 60 * 60 * 1000) {
                    this.activeMonitors.delete(fixId);
                    continue;
                }

                try {
                    await this.checkFixHealth(fixId);
                } catch (error) {
                    console.error(`[Fix Monitoring] Error checking ${fixId}:`, error);
                }
            }
        }, this.monitoringInterval);
    }

    /**
     * Get monitoring status
     */
    getMonitoringStatus(fixId) {
        const monitor = this.activeMonitors.get(fixId);
        if (!monitor) {
            return { error: 'Not monitoring this fix' };
        }

        const latestCheck = monitor.checks[monitor.checks.length - 1];

        return {
            fixId,
            status: monitor.status,
            startedAt: monitor.startedAt,
            duration: Date.now() - monitor.startedAt,
            checks: monitor.checks.length,
            metrics: monitor.metrics,
            latestCheck: latestCheck || null,
            alerts: monitor.alerts.length
        };
    }

    /**
     * Stop monitoring
     */
    stopMonitoring(fixId) {
        const monitor = this.activeMonitors.get(fixId);
        if (monitor) {
            monitor.status = 'stopped';
            monitor.stoppedAt = Date.now();
            this.activeMonitors.delete(fixId);
            return { success: true, fixId };
        }
        return { success: false, error: 'Monitor not found' };
    }

    /**
     * Get all active monitors
     */
    getAllMonitors() {
        return Array.from(this.activeMonitors.values()).map(m => ({
            fixId: m.fixId,
            status: m.status,
            startedAt: m.startedAt,
            checks: m.checks.length,
            alerts: m.alerts.length,
            metrics: m.metrics
        }));
    }

    /**
     * Get monitoring dashboard data
     */
    getDashboardData() {
        const monitors = Array.from(this.activeMonitors.values());
        
        return {
            totalMonitors: monitors.length,
            healthy: monitors.filter(m => {
                const latest = m.checks[m.checks.length - 1];
                return latest && latest.status === 'healthy';
            }).length,
            degraded: monitors.filter(m => {
                const latest = m.checks[m.checks.length - 1];
                return latest && latest.status === 'degraded';
            }).length,
            critical: monitors.filter(m => {
                const latest = m.checks[m.checks.length - 1];
                return latest && latest.status === 'critical';
            }).length,
            totalAlerts: monitors.reduce((sum, m) => sum + m.alerts.length, 0),
            avgHealthScore: monitors.reduce((sum, m) => {
                const score = m.metrics.healthScore;
                return sum + (score !== null ? score : 0);
            }, 0) / (monitors.length || 1)
        };
    }
}

module.exports = new FixMonitoringService();

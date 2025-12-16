/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixQualityMetricsService.js
 * Last Sync: 2025-12-16T00:42:39.835Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Quality Metrics & SLAs Service
 * Comprehensive quality tracking and SLA monitoring
 * 
 * Improvement #4: Quality Metrics & SLAs
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

class FixQualityMetricsService {
    constructor() {
        this.supabase = null;
        this.slaDefinitions = {
            fixSuccessRate: { target: 0.95, critical: 0.90 }, // 95% target, 90% critical
            timeToFix: { target: 24, critical: 48 }, // hours
            fixAccuracy: { target: 0.90, critical: 0.85 },
            falsePositiveRate: { target: 0.05, critical: 0.10 },
            developerSatisfaction: { target: 4.0, critical: 3.5 }, // out of 5
            fixAcceptanceRate: { target: 0.85, critical: 0.75 }
        };
        
        if (config.supabase?.url && config.supabase?.serviceRoleKey) {
            this.supabase = createClient(
                config.supabase.url,
                config.supabase.serviceRoleKey
            );
        }
    }

    /**
     * Calculate quality metrics
     */
    async calculateMetrics(projectId = null, timeRange = { days: 30 }) {
        try {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - timeRange.days);

            let query = this.supabase
                .from('code_roach_issues')
                .select('*')
                .gte('created_at', startDate.toISOString());

            if (projectId) {
                // Would need project_id column
                // query = query.eq('project_id', projectId);
            }

            const { data: issues, error } = await query;

            if (error) throw error;

            // Calculate metrics
            const metrics = {
                fixSuccessRate: this.calculateFixSuccessRate(issues),
                timeToFix: this.calculateTimeToFix(issues),
                fixAccuracy: this.calculateFixAccuracy(issues),
                falsePositiveRate: this.calculateFalsePositiveRate(issues),
                fixAcceptanceRate: this.calculateFixAcceptanceRate(issues),
                totalIssues: issues.length,
                fixedIssues: issues.filter(i => i.fix_applied).length,
                resolvedIssues: issues.filter(i => i.resolved_at).length
            };

            // Calculate SLA compliance
            const slaCompliance = this.calculateSLACompliance(metrics);

            return {
                success: true,
                metrics,
                slaCompliance,
                timeRange,
                calculatedAt: new Date().toISOString()
            };
        } catch (error) {
            console.error('[Fix Quality Metrics] Error calculating metrics:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Calculate fix success rate
     */
    calculateFixSuccessRate(issues) {
        const appliedFixes = issues.filter(i => i.fix_applied);
        if (appliedFixes.length === 0) return 0;

        const successful = appliedFixes.filter(i => i.fix_success === true).length;
        return successful / appliedFixes.length;
    }

    /**
     * Calculate average time to fix
     */
    calculateTimeToFix(issues) {
        const resolved = issues.filter(i => i.resolution_time_seconds);
        if (resolved.length === 0) return null;

        const totalSeconds = resolved.reduce((sum, i) => sum + (i.resolution_time_seconds || 0), 0);
        const avgSeconds = totalSeconds / resolved.length;
        return avgSeconds / 3600; // Convert to hours
    }

    /**
     * Calculate fix accuracy
     */
    calculateFixAccuracy(issues) {
        const appliedFixes = issues.filter(i => i.fix_applied && i.fix_success !== null);
        if (appliedFixes.length === 0) return 0;

        const accurate = appliedFixes.filter(i => i.fix_success === true).length;
        return accurate / appliedFixes.length;
    }

    /**
     * Calculate false positive rate
     */
    calculateFalsePositiveRate(issues) {
        const reviewed = issues.filter(i => i.review_status === 'rejected');
        if (issues.length === 0) return 0;

        return reviewed.length / issues.length;
    }

    /**
     * Calculate fix acceptance rate
     */
    calculateFixAcceptanceRate(issues) {
        const reviewed = issues.filter(i => i.review_status !== 'pending');
        if (reviewed.length === 0) return 0;

        const accepted = reviewed.filter(i => i.review_status === 'approved').length;
        return accepted / reviewed.length;
    }

    /**
     * Calculate SLA compliance
     */
    calculateSLACompliance(metrics) {
        const compliance = {};

        // Fix success rate
        compliance.fixSuccessRate = {
            value: metrics.fixSuccessRate,
            target: this.slaDefinitions.fixSuccessRate.target,
            critical: this.slaDefinitions.fixSuccessRate.critical,
            status: this.getSLAStatus(metrics.fixSuccessRate, this.slaDefinitions.fixSuccessRate),
            compliance: (metrics.fixSuccessRate / this.slaDefinitions.fixSuccessRate.target) * 100
        };

        // Time to fix
        if (metrics.timeToFix !== null) {
            compliance.timeToFix = {
                value: metrics.timeToFix,
                target: this.slaDefinitions.timeToFix.target,
                critical: this.slaDefinitions.timeToFix.critical,
                status: this.getSLAStatus(metrics.timeToFix, this.slaDefinitions.timeToFix, true), // Lower is better
                compliance: (this.slaDefinitions.timeToFix.target / metrics.timeToFix) * 100
            };
        }

        // Fix accuracy
        compliance.fixAccuracy = {
            value: metrics.fixAccuracy,
            target: this.slaDefinitions.fixAccuracy.target,
            critical: this.slaDefinitions.fixAccuracy.critical,
            status: this.getSLAStatus(metrics.fixAccuracy, this.slaDefinitions.fixAccuracy),
            compliance: (metrics.fixAccuracy / this.slaDefinitions.fixAccuracy.target) * 100
        };

        // False positive rate (lower is better)
        compliance.falsePositiveRate = {
            value: metrics.falsePositiveRate,
            target: this.slaDefinitions.falsePositiveRate.target,
            critical: this.slaDefinitions.falsePositiveRate.critical,
            status: this.getSLAStatus(metrics.falsePositiveRate, this.slaDefinitions.falsePositiveRate, true),
            compliance: (1 - metrics.falsePositiveRate) / (1 - this.slaDefinitions.falsePositiveRate.target) * 100
        };

        // Fix acceptance rate
        compliance.fixAcceptanceRate = {
            value: metrics.fixAcceptanceRate,
            target: this.slaDefinitions.fixAcceptanceRate.target,
            critical: this.slaDefinitions.fixAcceptanceRate.critical,
            status: this.getSLAStatus(metrics.fixAcceptanceRate, this.slaDefinitions.fixAcceptanceRate),
            compliance: (metrics.fixAcceptanceRate / this.slaDefinitions.fixAcceptanceRate.target) * 100
        };

        // Overall SLA status
        const statuses = Object.values(compliance).map(c => c.status);
        compliance.overall = {
            status: statuses.includes('critical') ? 'critical' : 
                   statuses.includes('warning') ? 'warning' : 'healthy',
            compliance: Object.values(compliance)
                .filter(c => c.compliance !== undefined)
                .reduce((sum, c) => sum + c.compliance, 0) / 
                Object.values(compliance).filter(c => c.compliance !== undefined).length
        };

        return compliance;
    }

    /**
     * Get SLA status
     */
    getSLAStatus(value, definition, lowerIsBetter = false) {
        if (value === null || value === undefined) return 'unknown';

        if (lowerIsBetter) {
            if (value <= definition.target) return 'healthy';
            if (value <= definition.critical) return 'warning';
            return 'critical';
        } else {
            if (value >= definition.target) return 'healthy';
            if (value >= definition.critical) return 'warning';
            return 'critical';
        }
    }

    /**
     * Track fix quality event
     */
    async trackEvent(eventType, eventData) {
        try {
            if (!this.supabase) return { success: false, error: 'Database not available' };

            // Store in metadata or dedicated table
            // For now, update issue metadata
            if (eventData.issueId) {
                const { error } = await this.supabase
                    .from('code_roach_issues')
                    .update({
                        metadata: {
                            quality_events: [
                                {
                                    type: eventType,
                                    data: eventData,
                                    timestamp: new Date().toISOString()
                                }
                            ]
                        }
                    })
                    .eq('id', eventData.issueId);

                if (error) throw error;
            }

            return { success: true };
        } catch (error) {
            console.error('[Fix Quality Metrics] Error tracking event:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Get SLA report
     */
    async getSLAReport(projectId = null, timeRange = { days: 30 }) {
        const metrics = await this.calculateMetrics(projectId, timeRange);
        
        if (!metrics.success) {
            return metrics;
        }

        return {
            success: true,
            report: {
                period: timeRange,
                metrics: metrics.metrics,
                slaCompliance: metrics.slaCompliance,
                recommendations: this.generateRecommendations(metrics.slaCompliance),
                trends: await this.calculateTrends(projectId, timeRange)
            }
        };
    }

    /**
     * Generate recommendations based on SLA compliance
     */
    generateRecommendations(slaCompliance) {
        const recommendations = [];

        if (slaCompliance.fixSuccessRate.status === 'critical') {
            recommendations.push({
                priority: 'high',
                metric: 'fixSuccessRate',
                issue: 'Fix success rate is below critical threshold',
                action: 'Review failed fixes and improve fix generation logic'
            });
        }

        if (slaCompliance.timeToFix && slaCompliance.timeToFix.status === 'critical') {
            recommendations.push({
                priority: 'high',
                metric: 'timeToFix',
                issue: 'Time to fix exceeds critical threshold',
                action: 'Optimize fix pipeline and reduce manual review time'
            });
        }

        if (slaCompliance.falsePositiveRate.status === 'critical') {
            recommendations.push({
                priority: 'medium',
                metric: 'falsePositiveRate',
                issue: 'False positive rate is too high',
                action: 'Improve issue detection accuracy'
            });
        }

        return recommendations;
    }

    /**
     * Calculate trends
     */
    async calculateTrends(projectId, timeRange) {
        // Compare current period with previous period
        const current = await this.calculateMetrics(projectId, timeRange);
        const previous = await this.calculateMetrics(projectId, { days: timeRange.days * 2 });

        if (!current.success || !previous.success) {
            return null;
        }

        return {
            fixSuccessRate: {
                current: current.metrics.fixSuccessRate,
                previous: previous.metrics.fixSuccessRate,
                change: current.metrics.fixSuccessRate - previous.metrics.fixSuccessRate,
                trend: current.metrics.fixSuccessRate > previous.metrics.fixSuccessRate ? 'improving' : 'declining'
            },
            timeToFix: {
                current: current.metrics.timeToFix,
                previous: previous.metrics.timeToFix,
                change: current.metrics.timeToFix && previous.metrics.timeToFix 
                    ? current.metrics.timeToFix - previous.metrics.timeToFix 
                    : null,
                trend: current.metrics.timeToFix && previous.metrics.timeToFix
                    ? (current.metrics.timeToFix < previous.metrics.timeToFix ? 'improving' : 'declining')
                    : 'unknown'
            }
        };
    }
}

module.exports = new FixQualityMetricsService();

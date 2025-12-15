/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/errorTrendAnalysis.js
 * Last Sync: 2025-12-14T07:30:45.612Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Error Trend Analysis Service
 * Analyzes error trends over time to identify patterns and predict issues
 */

const errorHistoryService = require('./errorHistoryService');

class ErrorTrendAnalysis {
    constructor() {
        this.trendCache = new Map();
        this.cacheTTL = 300000; // 5 minutes
    }

    /**
     * Analyze error trends over time
     */
    analyzeTrends(timeRange = '24h') {
        const history = errorHistoryService.history;
        if (!history || history.length === 0) {
            return {
                trends: [],
                insights: [],
                predictions: []
            };
        }

        const now = Date.now();
        const rangeMs = this.getTimeRangeMs(timeRange);
        const cutoff = now - rangeMs;

        // Filter to time range
        const recentErrors = history.filter(e => e.timestamp >= cutoff);

        // Analyze trends
        const trends = this.calculateTrends(recentErrors, timeRange);
        const insights = this.generateInsights(trends, recentErrors);
        const predictions = this.generatePredictions(trends, recentErrors);

        return {
            trends,
            insights,
            predictions,
            timeRange,
            period: {
                start: cutoff,
                end: now,
                duration: rangeMs
            }
        };
    }

    /**
     * Get time range in milliseconds
     */
    getTimeRangeMs(timeRange) {
        const ranges = {
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000,
            'all': Infinity
        };
        return ranges[timeRange] || ranges['24h'];
    }

    /**
     * Calculate trends from error data
     */
    calculateTrends(errors, timeRange) {
        const trends = [];

        // Group errors by time buckets
        const buckets = this.createTimeBuckets(errors, timeRange);
        
        // Calculate error rate trend
        const errorRateTrend = this.calculateErrorRateTrend(buckets);
        trends.push({
            type: 'error-rate',
            name: 'Error Rate',
            trend: errorRateTrend.direction, // 'increasing', 'decreasing', 'stable'
            change: errorRateTrend.change, // percentage change
            current: errorRateTrend.current,
            previous: errorRateTrend.previous,
            severity: errorRateTrend.severity
        });

        // Calculate fix success rate trend
        const fixRateTrend = this.calculateFixRateTrend(buckets);
        trends.push({
            type: 'fix-success-rate',
            name: 'Fix Success Rate',
            trend: fixRateTrend.direction,
            change: fixRateTrend.change,
            current: fixRateTrend.current,
            previous: fixRateTrend.previous,
            severity: fixRateTrend.severity
        });

        // Calculate error type distribution trend
        const typeTrends = this.calculateTypeTrends(buckets);
        trends.push(...typeTrends);

        return trends;
    }

    /**
     * Create time buckets for analysis
     */
    createTimeBuckets(errors, timeRange) {
        const bucketSize = this.getBucketSize(timeRange);
        const buckets = new Map();

        errors.forEach(error => {
            const bucketTime = Math.floor(error.timestamp / bucketSize) * bucketSize;
            if (!buckets.has(bucketTime)) {
                buckets.set(bucketTime, []);
            }
            buckets.get(bucketTime).push(error);
        });

        return buckets;
    }

    /**
     * Get bucket size based on time range
     */
    getBucketSize(timeRange) {
        const sizes = {
            '1h': 5 * 60 * 1000,      // 5 minutes
            '24h': 60 * 60 * 1000,    // 1 hour
            '7d': 6 * 60 * 60 * 1000, // 6 hours
            '30d': 24 * 60 * 60 * 1000 // 24 hours
        };
        return sizes[timeRange] || sizes['24h'];
    }

    /**
     * Calculate error rate trend
     */
    calculateErrorRateTrend(buckets) {
        const bucketArray = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
        
        if (bucketArray.length < 2) {
            return { direction: 'stable', change: 0, current: 0, previous: 0, severity: 'low' };
        }

        // Split into halves
        const midpoint = Math.floor(bucketArray.length / 2);
        const firstHalf = bucketArray.slice(0, midpoint);
        const secondHalf = bucketArray.slice(midpoint);

        const firstHalfCount = firstHalf.reduce((sum, [, errors]) => sum + errors.length, 0);
        const secondHalfCount = secondHalf.reduce((sum, [, errors]) => sum + errors.length, 0);

        const firstHalfAvg = firstHalfCount / firstHalf.length;
        const secondHalfAvg = secondHalfCount / secondHalf.length;

        const change = firstHalfAvg > 0 
            ? ((secondHalfAvg - firstHalfAvg) / firstHalfAvg) * 100 
            : 0;

        let direction = 'stable';
        let severity = 'low';

        if (change > 20) {
            direction = 'increasing';
            severity = change > 50 ? 'high' : 'medium';
        } else if (change < -20) {
            direction = 'decreasing';
            severity = 'low';
        }

        return {
            direction,
            change: Math.round(change),
            current: Math.round(secondHalfAvg),
            previous: Math.round(firstHalfAvg),
            severity
        };
    }

    /**
     * Calculate fix success rate trend
     */
    calculateFixRateTrend(buckets) {
        const bucketArray = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
        
        if (bucketArray.length < 2) {
            return { direction: 'stable', change: 0, current: 0, previous: 0, severity: 'low' };
        }

        const midpoint = Math.floor(bucketArray.length / 2);
        const firstHalf = bucketArray.slice(0, midpoint);
        const secondHalf = bucketArray.slice(midpoint);

        const calculateSuccessRate = (buckets) => {
            let total = 0;
            let successful = 0;
            buckets.forEach(([, errors]) => {
                errors.forEach(error => {
                    if (error.fix) {
                        total++;
                        if (error.fix.success) {
                            successful++;
                        }
                    }
                });
            });
            return total > 0 ? (successful / total) * 100 : 0;
        };

        const firstHalfRate = calculateSuccessRate(firstHalf);
        const secondHalfRate = calculateSuccessRate(secondHalf);

        const change = secondHalfRate - firstHalfRate;

        let direction = 'stable';
        let severity = 'low';

        if (change > 5) {
            direction = 'improving';
            severity = 'low';
        } else if (change < -5) {
            direction = 'declining';
            severity = change < -10 ? 'high' : 'medium';
        }

        return {
            direction,
            change: Math.round(change),
            current: Math.round(secondHalfRate),
            previous: Math.round(firstHalfRate),
            severity
        };
    }

    /**
     * Calculate error type trends
     */
    calculateTypeTrends(buckets) {
        const typeCounts = new Map();
        
        buckets.forEach(([, errors]) => {
            errors.forEach(error => {
                const type = error.error.type || 'Unknown';
                if (!typeCounts.has(type)) {
                    typeCounts.set(type, { first: 0, second: 0 });
                }
            });
        });

        const bucketArray = Array.from(buckets.entries()).sort((a, b) => a[0] - b[0]);
        const midpoint = Math.floor(bucketArray.length / 2);
        const firstHalf = bucketArray.slice(0, midpoint);
        const secondHalf = bucketArray.slice(midpoint);

        // Count types in each half
        firstHalf.forEach(([, errors]) => {
            errors.forEach(error => {
                const type = error.error.type || 'Unknown';
                if (typeCounts.has(type)) {
                    typeCounts.get(type).first++;
                }
            });
        });

        secondHalf.forEach(([, errors]) => {
            errors.forEach(error => {
                const type = error.error.type || 'Unknown';
                if (typeCounts.has(type)) {
                    typeCounts.get(type).second++;
                }
            });
        });

        // Generate trends for each type
        const trends = [];
        typeCounts.forEach((counts, type) => {
            const total = counts.first + counts.second;
            if (total === 0) return;

            const change = counts.first > 0 
                ? ((counts.second - counts.first) / counts.first) * 100 
                : (counts.second > 0 ? 100 : 0);

            let direction = 'stable';
            if (change > 20) direction = 'increasing';
            else if (change < -20) direction = 'decreasing';

            trends.push({
                type: 'error-type',
                name: `${type} Errors`,
                errorType: type,
                trend: direction,
                change: Math.round(change),
                current: counts.second,
                previous: counts.first,
                severity: counts.second > counts.first ? 'medium' : 'low'
            });
        });

        return trends.sort((a, b) => b.current - a.current).slice(0, 5); // Top 5
    }

    /**
     * Generate insights from trends
     */
    generateInsights(trends, errors) {
        const insights = [];

        // Error rate insight
        const errorRateTrend = trends.find(t => t.type === 'error-rate');
        if (errorRateTrend && errorRateTrend.trend === 'increasing' && errorRateTrend.severity === 'high') {
            insights.push({
                type: 'warning',
                title: 'Error Rate Increasing',
                message: `Error rate has increased by ${errorRateTrend.change}% - may indicate a systemic issue`,
                severity: 'high',
                recommendation: 'Investigate recent code changes or deployments'
            });
        }

        // Fix success rate insight
        const fixRateTrend = trends.find(t => t.type === 'fix-success-rate');
        if (fixRateTrend && fixRateTrend.trend === 'declining') {
            insights.push({
                type: 'warning',
                title: 'Fix Success Rate Declining',
                message: `Fix success rate has decreased by ${Math.abs(fixRateTrend.change)}%`,
                severity: fixRateTrend.severity,
                recommendation: 'Review recent fixes and improve fix generation'
            });
        }

        // New error pattern insight
        const recentPatterns = new Set();
        const olderPatterns = new Set();
        const midpoint = Math.floor(errors.length / 2);
        
        errors.slice(0, midpoint).forEach(e => {
            // Create a simple pattern fingerprint from error
            const pattern = `${e.error.type || 'unknown'}_${(e.error.message || '').substring(0, 50)}`;
            olderPatterns.add(pattern);
        });
        
        errors.slice(midpoint).forEach(e => {
            // Create a simple pattern fingerprint from error
            const pattern = `${e.error.type || 'unknown'}_${(e.error.message || '').substring(0, 50)}`;
            recentPatterns.add(pattern);
            if (!olderPatterns.has(pattern)) {
                insights.push({
                    type: 'info',
                    title: 'New Error Pattern Detected',
                    message: `New error pattern: ${e.error.message.substring(0, 50)}...`,
                    severity: 'medium',
                    recommendation: 'Monitor this pattern closely'
                });
            }
        });

        return insights;
    }

    /**
     * Generate predictions based on trends
     */
    generatePredictions(trends, errors) {
        const predictions = [];

        // Predict error rate
        const errorRateTrend = trends.find(t => t.type === 'error-rate');
        if (errorRateTrend && errorRateTrend.trend === 'increasing') {
            const projectedIncrease = errorRateTrend.change;
            predictions.push({
                type: 'error-rate',
                prediction: `Error rate may continue to increase by ~${Math.round(projectedIncrease * 0.8)}% in next period`,
                confidence: 0.7,
                action: 'Monitor closely and investigate root cause'
            });
        }

        // Predict fix success
        const fixRateTrend = trends.find(t => t.type === 'fix-success-rate');
        if (fixRateTrend && fixRateTrend.trend === 'declining') {
            predictions.push({
                type: 'fix-quality',
                prediction: 'Fix success rate may continue to decline if patterns not addressed',
                confidence: 0.6,
                action: 'Review and improve fix generation strategies'
            });
        }

        return predictions;
    }

    /**
     * Get trend summary
     */
    getTrendSummary(timeRange = '24h') {
        const cacheKey = `trends_${timeRange}`;
        const cached = this.trendCache.get(cacheKey);
        
        if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
            return cached.data;
        }

        const analysis = this.analyzeTrends(timeRange);
        
        this.trendCache.set(cacheKey, {
            data: analysis,
            timestamp: Date.now()
        });

        // Clean old cache entries
        if (this.trendCache.size > 10) {
            const now = Date.now();
            for (const [key, value] of this.trendCache.entries()) {
                if (now - value.timestamp > this.cacheTTL) {
                    this.trendCache.delete(key);
                }
            }
        }

        return analysis;
    }
}

module.exports = new ErrorTrendAnalysis();


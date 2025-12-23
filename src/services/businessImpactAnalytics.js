/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/businessImpactAnalytics.js
 * Last Sync: 2025-12-19T23:29:57.633Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Business Impact Analytics Service
 * Connects errors and fixes to business metrics (revenue, users, conversions)
 */

const errorHistoryService = require('./errorHistoryService');
const errorTrendAnalysis = require('./errorTrendAnalysis');
const codeHealthScoring = require('./codeHealthScoring');

class BusinessImpactAnalytics {
    constructor() {
        this.metrics = {
            averageRevenuePerUser: 10, // Default, should be configured
            conversionRate: 0.03, // 3% default
            averageSessionValue: 5, // Default
            developerHourlyCost: 100 // Default
        };
    }

    /**
     * Calculate business impact of errors
     */
    async calculateBusinessImpact(timeRange = '24h') {
        const history = errorHistoryService.history || [];
        const now = Date.now();
        const rangeMs = this.getTimeRangeMs(timeRange);
        const cutoff = now - rangeMs;

        const recentErrors = history.filter(e => e.timestamp >= cutoff);
        const fixedErrors = recentErrors.filter(e => e.fix && e.fix.success);
        const unfixedErrors = recentErrors.filter(e => !e.fix || !e.fix.success);

        // Calculate impacts
        const userImpact = this.calculateUserImpact(recentErrors);
        const revenueImpact = this.calculateRevenueImpact(userImpact);
        const conversionImpact = this.calculateConversionImpact(recentErrors);
        const developerCost = this.calculateDeveloperCost(recentErrors, fixedErrors);
        const fixValue = this.calculateFixValue(fixedErrors, developerCost);

        return {
            timeRange,
            period: {
                start: new Date(cutoff).toISOString(),
                end: new Date(now).toISOString()
            },
            errors: {
                total: recentErrors.length,
                fixed: fixedErrors.length,
                unfixed: unfixedErrors.length,
                fixRate: recentErrors.length > 0 
                    ? (fixedErrors.length / recentErrors.length * 100).toFixed(1)
                    : 0
            },
            userImpact: {
                affectedUsers: userImpact.affectedUsers,
                userSessions: userImpact.userSessions,
                estimatedImpact: userImpact.estimatedImpact
            },
            revenueImpact: {
                lostRevenue: revenueImpact.lostRevenue,
                preventedLoss: revenueImpact.preventedLoss,
                netImpact: revenueImpact.netImpact
            },
            conversionImpact: {
                lostConversions: conversionImpact.lostConversions,
                conversionValue: conversionImpact.conversionValue
            },
            costAnalysis: {
                developerTimeCost: developerCost.totalCost,
                timeSpent: developerCost.timeSpent,
                fixValue: fixValue.totalValue,
                roi: fixValue.roi
            },
            summary: {
                totalBusinessImpact: revenueImpact.lostRevenue + conversionImpact.conversionValue,
                totalValueCreated: fixValue.totalValue,
                netROI: fixValue.roi
            }
        };
    }

    /**
     * Calculate user impact
     */
    calculateUserImpact(errors) {
        // Estimate users affected based on error frequency
        // This is a simplified model - in production, you'd track actual user sessions
        const errorFrequency = errors.length;
        const estimatedUsersPerError = 10; // Default estimate
        const affectedUsers = errorFrequency * estimatedUsersPerError;

        // Estimate sessions affected
        const userSessions = affectedUsers * 1.5; // Assume 1.5 sessions per user

        return {
            affectedUsers,
            userSessions,
            estimatedImpact: `${affectedUsers.toLocaleString()} users potentially affected`
        };
    }

    /**
     * Calculate revenue impact
     */
    calculateRevenueImpact(userImpact) {
        const lostRevenue = userImpact.affectedUsers * this.metrics.averageRevenuePerUser * 0.1; // 10% impact
        const preventedLoss = lostRevenue * 0.7; // Assume fixes prevented 70% of loss

        return {
            lostRevenue: Math.round(lostRevenue),
            preventedLoss: Math.round(preventedLoss),
            netImpact: Math.round(lostRevenue - preventedLoss)
        };
    }

    /**
     * Calculate conversion impact
     */
    calculateConversionImpact(errors) {
        const criticalErrors = errors.filter(e => 
            e.error?.type?.includes('critical') || 
            e.error?.message?.toLowerCase().includes('payment') ||
            e.error?.message?.toLowerCase().includes('checkout')
        );

        // Estimate lost conversions
        const estimatedUsers = errors.length * 10;
        const lostConversions = estimatedUsers * this.metrics.conversionRate * 0.2; // 20% impact
        const conversionValue = lostConversions * this.metrics.averageSessionValue;

        return {
            lostConversions: Math.round(lostConversions),
            conversionValue: Math.round(conversionValue),
            criticalErrors: criticalErrors.length
        };
    }

    /**
     * Calculate developer cost
     */
    calculateDeveloperCost(errors, fixedErrors) {
        // Estimate time spent
        const avgTimePerError = 30; // minutes
        const totalTimeMinutes = errors.length * avgTimePerError;
        const totalTimeHours = totalTimeMinutes / 60;

        // Calculate cost
        const totalCost = totalTimeHours * this.metrics.developerHourlyCost;

        // Time saved by auto-fixes
        const autoFixed = fixedErrors.filter(e => e.fix?.autoApplied).length;
        const timeSavedMinutes = autoFixed * avgTimePerError;
        const timeSavedHours = timeSavedMinutes / 60;
        const costSaved = timeSavedHours * this.metrics.developerHourlyCost;

        return {
            timeSpent: {
                hours: totalTimeHours.toFixed(1),
                minutes: totalTimeMinutes
            },
            totalCost: Math.round(totalCost),
            timeSaved: {
                hours: timeSavedHours.toFixed(1),
                minutes: timeSavedMinutes
            },
            costSaved: Math.round(costSaved)
        };
    }

    /**
     * Calculate value created by fixes
     */
    calculateFixValue(fixedErrors, developerCost) {
        // Value = prevented revenue loss + developer time saved
        const preventedRevenueLoss = fixedErrors.length * this.metrics.averageRevenuePerUser * 0.1;
        const developerTimeValue = developerCost.costSaved;
        const totalValue = preventedRevenueLoss + developerTimeValue;

        // ROI = (Value - Cost) / Cost * 100
        const cost = developerCost.totalCost - developerCost.costSaved;
        const roi = cost > 0 ? ((totalValue - cost) / cost * 100).toFixed(1) : 0;

        return {
            preventedRevenueLoss: Math.round(preventedRevenueLoss),
            developerTimeValue: Math.round(developerTimeValue),
            totalValue: Math.round(totalValue),
            cost: Math.round(cost),
            roi: `${roi}%`
        };
    }

    /**
     * Get impact by error type
     */
    async getImpactByErrorType(timeRange = '24h') {
        const history = errorHistoryService.history || [];
        const now = Date.now();
        const rangeMs = this.getTimeRangeMs(timeRange);
        const cutoff = now - rangeMs;

        const recentErrors = history.filter(e => e.timestamp >= cutoff);
        const errorTypes = {};

        recentErrors.forEach(error => {
            const type = error.error?.type || 'unknown';
            if (!errorTypes[type]) {
                errorTypes[type] = {
                    count: 0,
                    fixed: 0,
                    affectedUsers: 0,
                    revenueImpact: 0
                };
            }

            errorTypes[type].count++;
            if (error.fix && error.fix.success) {
                errorTypes[type].fixed++;
            }
            errorTypes[type].affectedUsers += 10; // Estimate
            errorTypes[type].revenueImpact += this.metrics.averageRevenuePerUser * 0.1;
        });

        return {
            timeRange,
            errorTypes: Object.entries(errorTypes).map(([type, data]) => ({
                type,
                ...data,
                fixRate: data.count > 0 ? (data.fixed / data.count * 100).toFixed(1) : 0,
                revenueImpact: Math.round(data.revenueImpact)
            })).sort((a, b) => b.revenueImpact - a.revenueImpact)
        };
    }

    /**
     * Get ROI report
     */
    async getROIReport(timeRange = '30d') {
        const impact = await this.calculateBusinessImpact(timeRange);
        const trends = errorTrendAnalysis.getTrendSummary(timeRange);

        return {
            timeRange,
            investment: {
                developerCost: impact.costAnalysis.developerTimeCost,
                toolCost: 0, // Code Roach cost (if applicable)
                totalInvestment: impact.costAnalysis.developerTimeCost
            },
            returns: {
                revenueProtected: impact.revenueImpact.preventedLoss,
                timeSaved: impact.costAnalysis.fixValue.developerTimeValue,
                totalReturns: impact.costAnalysis.fixValue.totalValue
            },
            roi: {
                percentage: impact.costAnalysis.roi,
                netValue: impact.costAnalysis.fixValue.totalValue - impact.costAnalysis.developerTimeCost,
                paybackPeriod: this.calculatePaybackPeriod(impact)
            },
            trends: {
                errorTrend: trends.trends.find(t => t.type === 'error-rate')?.trend || 'stable',
                fixTrend: trends.trends.find(t => t.type === 'fix-success-rate')?.trend || 'stable'
            }
        };
    }

    /**
     * Calculate payback period
     */
    calculatePaybackPeriod(impact) {
        const monthlyValue = impact.costAnalysis.fixValue.totalValue / 30; // Assuming 30-day period
        const monthlyCost = impact.costAnalysis.developerTimeCost / 30;
        const netMonthly = monthlyValue - monthlyCost;

        if (netMonthly <= 0) {
            return 'N/A (negative ROI)';
        }

        const paybackMonths = monthlyCost / netMonthly;
        return `${paybackMonths.toFixed(1)} months`;
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
     * Configure business metrics
     */
    configureMetrics(metrics) {
        this.metrics = { ...this.metrics, ...metrics };
    }
}

module.exports = new BusinessImpactAnalytics();


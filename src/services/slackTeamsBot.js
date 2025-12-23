/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/slackTeamsBot.js
 * Last Sync: 2025-12-19T23:29:57.625Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Slack/Teams Bot Service
 * Provides team-wide error awareness and notifications via Slack and Microsoft Teams
 */

const webhookService = require('./webhookService');
const errorHistoryService = require('./errorHistoryService');
const businessImpactAnalytics = require('./businessImpactAnalytics');
const errorTrendAnalysis = require('./errorTrendAnalysis');

class SlackTeamsBot {
    constructor() {
        this.config = {
            slack: {
                enabled: false,
                webhookUrl: null,
                channel: '#code-roach',
                username: 'Code Roach'
            },
            teams: {
                enabled: false,
                webhookUrl: null
            }
        };
    }

    /**
     * Configure Slack integration
     */
    configureSlack(webhookUrl, channel = '#code-roach') {
        this.config.slack = {
            enabled: true,
            webhookUrl,
            channel,
            username: 'Code Roach'
        };

        // Register webhook
        webhookService.registerWebhook({
            id: 'slack-notifications',
            url: webhookUrl,
            events: ['error', 'fix', 'critical'],
            enabled: true
        });

        return { success: true, message: 'Slack integration configured' };
    }

    /**
     * Configure Teams integration
     */
    configureTeams(webhookUrl) {
        this.config.teams = {
            enabled: true,
            webhookUrl
        };

        // Register webhook
        webhookService.registerWebhook({
            id: 'teams-notifications',
            url: webhookUrl,
            events: ['error', 'fix', 'critical'],
            enabled: true
        });

        return { success: true, message: 'Teams integration configured' };
    }

    /**
     * Send error notification
     */
    async sendErrorNotification(error, context = {}) {
        const message = this.formatErrorMessage(error, context);

        if (this.config.slack.enabled) {
            await this.sendSlackMessage(message);
        }

        if (this.config.teams.enabled) {
            await this.sendTeamsMessage(message);
        }

        return { success: true, sent: true };
    }

    /**
     * Send fix summary
     */
    async sendFixSummary(timeRange = '24h') {
        const history = errorHistoryService.history || [];
        const now = Date.now();
        const rangeMs = this.getTimeRangeMs(timeRange);
        const cutoff = now - rangeMs;

        const recentFixes = history.filter(e => 
            e.timestamp >= cutoff && 
            e.fix && 
            e.fix.success
        );

        const message = this.formatFixSummary(recentFixes, timeRange);

        if (this.config.slack.enabled) {
            await this.sendSlackMessage(message);
        }

        if (this.config.teams.enabled) {
            await this.sendTeamsMessage(message);
        }

        return { success: true, fixes: recentFixes.length };
    }

    /**
     * Send daily summary
     */
    async sendDailySummary() {
        const impact = await businessImpactAnalytics.calculateBusinessImpact('24h');
        const trends = errorTrendAnalysis.getTrendSummary('24h');

        const message = this.formatDailySummary(impact, trends);

        if (this.config.slack.enabled) {
            await this.sendSlackMessage(message);
        }

        if (this.config.teams.enabled) {
            await this.sendTeamsMessage(message);
        }

        return { success: true };
    }

    /**
     * Send critical alert
     */
    async sendCriticalAlert(error, context = {}) {
        const message = {
            text: `🚨 *CRITICAL ERROR DETECTED* 🚨`,
            attachments: [{
                color: 'danger',
                title: error.type || 'Error',
                text: error.message || 'Unknown error',
                fields: [
                    {
                        title: 'Source',
                        value: error.source || context.file || 'Unknown',
                        short: true
                    },
                    {
                        title: 'Severity',
                        value: 'CRITICAL',
                        short: true
                    },
                    {
                        title: 'Time',
                        value: new Date().toLocaleString(),
                        short: true
                    }
                ]
            }]
        };

        if (this.config.slack.enabled) {
            await this.sendSlackMessage(message);
        }

        if (this.config.teams.enabled) {
            await this.sendTeamsMessage(message);
        }

        return { success: true };
    }

    /**
     * Send team metrics
     */
    async sendTeamMetrics(timeRange = '7d') {
        const impact = await businessImpactAnalytics.calculateBusinessImpact(timeRange);
        const trends = errorTrendAnalysis.getTrendSummary(timeRange);

        const message = this.formatTeamMetrics(impact, trends, timeRange);

        if (this.config.slack.enabled) {
            await this.sendSlackMessage(message);
        }

        if (this.config.teams.enabled) {
            await this.sendTeamsMessage(message);
        }

        return { success: true };
    }

    /**
     * Format error message for Slack/Teams
     */
    formatErrorMessage(error, context) {
        return {
            text: `🪳 *Code Roach Alert*`,
            attachments: [{
                color: error.severity === 'critical' ? 'danger' : 'warning',
                title: `${error.type || 'Error'}: ${(error.message || '').substring(0, 100)}`,
                fields: [
                    {
                        title: 'File',
                        value: error.source || context.file || 'Unknown',
                        short: true
                    },
                    {
                        title: 'Status',
                        value: context.autoFixed ? '✅ Auto-fixed' : '⚠️ Needs attention',
                        short: true
                    }
                ],
                footer: 'Code Roach',
                ts: Math.floor(Date.now() / 1000)
            }]
        };
    }

    /**
     * Format fix summary
     */
    formatFixSummary(fixes, timeRange) {
        const byType = {};
        fixes.forEach(f => {
            const type = f.error?.type || 'Unknown';
            byType[type] = (byType[type] || 0) + 1;
        });

        let summary = `✅ *Code Roach Fix Summary (${timeRange})*\n\n`;
        summary += `*Total Fixes:* ${fixes.length}\n\n`;

        summary += `*Fixes by Type:*\n`;
        Object.entries(byType).forEach(([type, count]) => {
            summary += `• ${type}: ${count}\n`;
        });

        return {
            text: summary,
            attachments: [{
                color: 'good',
                footer: 'Code Roach',
                ts: Math.floor(Date.now() / 1000)
            }]
        };
    }

    /**
     * Format daily summary
     */
    formatDailySummary(impact, trends) {
        let summary = `📊 *Code Roach Daily Summary*\n\n`;

        summary += `*Errors:*\n`;
        summary += `• Total: ${impact.errors.total}\n`;
        summary += `• Fixed: ${impact.errors.fixed}\n`;
        summary += `• Fix Rate: ${impact.errors.fixRate}%\n\n`;

        summary += `*Business Impact:*\n`;
        summary += `• Revenue Protected: $${impact.revenueImpact.preventedLoss.toLocaleString()}\n`;
        summary += `• Users Affected: ${impact.userImpact.affectedUsers.toLocaleString()}\n\n`;

        summary += `*ROI:*\n`;
        summary += `• Value Created: $${impact.costAnalysis.fixValue.totalValue.toLocaleString()}\n`;
        summary += `• ROI: ${impact.costAnalysis.roi}\n`;

        return {
            text: summary,
            attachments: [{
                color: 'good',
                footer: 'Code Roach',
                ts: Math.floor(Date.now() / 1000)
            }]
        };
    }

    /**
     * Format team metrics
     */
    formatTeamMetrics(impact, trends, timeRange) {
        let metrics = `📈 *Code Roach Team Metrics (${timeRange})*\n\n`;

        metrics += `*Performance:*\n`;
        const errorTrend = trends.trends?.find(t => t.type === 'error-rate');
        if (errorTrend) {
            metrics += `• Error Trend: ${errorTrend.trend} (${errorTrend.change > 0 ? '+' : 
                ''}${errorTrend.change}%)\n`;
        }

        metrics += `\n*Business Value:*\n`;
        metrics += `• Total Value: $${impact.summary.totalValueCreated.toLocaleString()}\n`;
        metrics += `• ROI: ${impact.costAnalysis.roi}\n`;

        return {
            text: metrics,
            attachments: [{
                color: 'good',
                footer: 'Code Roach',
                ts: Math.floor(Date.now() / 1000)
            }]
        };
    }

    /**
     * Send Slack message
     */
    async sendSlackMessage(message) {
        if (!this.config.slack.enabled || !this.config.slack.webhookUrl) {
            return { success: false, error: 'Slack not configured' };
        }

        // In production, this would make actual Slack API call
        // For now, trigger webhook
        try {
            await webhookService.triggerWebhooks('notification', {
                platform: 'slack',
                message
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    /**
     * Send Teams message
     */
    async sendTeamsMessage(message) {
        if (!this.config.teams.enabled || !this.config.teams.webhookUrl) {
            return { success: false, error: 'Teams not configured' };
        }

        // In production, this would make actual Teams API call
        // For now, trigger webhook
        try {
            await webhookService.triggerWebhooks('notification', {
                platform: 'teams',
                message
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
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
}

module.exports = new SlackTeamsBot();


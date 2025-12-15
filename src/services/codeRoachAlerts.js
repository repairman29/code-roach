/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/codeRoachAlerts.js
 * Last Sync: 2025-12-14T07:30:45.708Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Code Roach Real-Time Alert Service
 * Monitors for critical issues and sends alerts
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

class CodeRoachAlerts {
    constructor() {
        this.supabase = null;
        this.alertInterval = null;
        
        if (config.supabase?.url && config.supabase?.serviceRoleKey) {
            this.supabase = createClient(
                config.supabase.url,
                config.supabase.serviceRoleKey
            );
        }
    }

    start() {
        if (!this.supabase) {
            console.warn('[Code Roach Alerts] Supabase not configured');
            return;
        }

        // Check for critical issues every minute
        this.alertInterval = setInterval(async () => {
            await this.checkCriticalIssues();
        }, 60000); // 1 minute

        console.log('[Code Roach Alerts] Started monitoring');
    }

    async checkCriticalIssues() {
        try {
            const { data, error } = await this.supabase
                .from('code_roach_issues')
                .select('*')
                .eq('error_severity', 'critical')
                .eq('review_status', 'pending')
                .gte('created_at', new Date(Date.now() - 3600000).toISOString()) // Last hour
                .order('created_at', { ascending: false });

            if (error) throw error;

            if (data && data.length > 0) {
                await this.sendAlert(data);
            }
        } catch (err) {
            console.error('[Code Roach Alerts] Error checking issues:', err);
        }
    }

    async sendAlert(issues) {
        // Send to Slack/Discord/webhook
        const webhookUrl = process.env.CODE_ROACH_WEBHOOK_URL;
        
        if (webhookUrl) {
            const message = {
                text: `🚨 Code Roach: ${issues.length} critical issue(s) detected!`,
                blocks: [
                    {
                        type: 'section',
                        text: {
                            type: 'mrkdwn',
                            text: `*🚨 Code Roach Alert*\n${issues.length} critical issue(s) detected in the last hour`
                        }
                    }
                ]
            };

            issues.slice(0, 5).forEach(issue => {
                message.blocks.push({
                    type: 'section',
                    text: {
                        type: 'mrkdwn',
                        text: `*${issue.error_message}*\nFile: ${issue.error_file}:${issue.
                            error_line}\nType: ${issue.error_type}`
                    }
                });
            });

            try {
                await fetch(webhookUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(message)
                });
            } catch (err) {
                console.error('[Code Roach Alerts] Failed to send webhook:', err);
            }
        }

        // Also log to console
        console.log(`🚨 [Code Roach Alerts] ${issues.length} critical issue(s) detected!`);
    }

    stop() {
        if (this.alertInterval) {
            clearInterval(this.alertInterval);
            this.alertInterval = null;
        }
    }
}

module.exports = new CodeRoachAlerts();

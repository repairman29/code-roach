/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/securityAlerts.js
 * Last Sync: 2025-12-14T07:30:45.720Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Security Alerting Service
 * Sends alerts via email, webhooks, console, etc.
 */

class SecurityAlerts {
    constructor(options = {}) {
        this.config = {
            email: {
                enabled: options.email?.enabled || false,
                to: options.email?.to || process.env.SECURITY_ALERT_EMAIL,
                from: options.email?.from || process.env.SECURITY_ALERT_FROM || 'security@smugglers.game',
                ...options.email
            },
            webhook: {
                enabled: options.webhook?.enabled || false,
                url: options.webhook?.url || process.env.SECURITY_WEBHOOK_URL,
                ...options.webhook
            },
            console: {
                enabled: options.console?.enabled !== false, // Default enabled
                ...options.console
            },
            ...options
        };

        // Rate limiting for alerts (don't spam)
        this.alertCooldown = new Map(); // type -> lastSent
        this.cooldownDuration = 300000; // 5 minutes
    }

    /**
     * Send alert
     */
    async send(alert) {
        const alertKey = `${alert.type}-${alert.securityType}`;
        const lastSent = this.alertCooldown.get(alertKey);
        const now = Date.now();

        // Check cooldown
        if (lastSent && (now - lastSent) < this.cooldownDuration) {
            return; // Still in cooldown
        }

        this.alertCooldown.set(alertKey, now);

        // Send via all enabled channels
        const promises = [];

        if (this.config.console.enabled) {
            promises.push(this.sendConsole(alert));
        }

        if (this.config.email.enabled && this.config.email.to) {
            promises.push(this.sendEmail(alert));
        }

        if (this.config.webhook.enabled && this.config.webhook.url) {
            promises.push(this.sendWebhook(alert));
        }

        await Promise.allSettled(promises);
    }

    /**
     * Send console alert
     */
    async sendConsole(alert) {
        const emoji = alert.type === 'critical_event' ? '🚨' : '⚠️';
        const message = this.formatAlertMessage(alert);
        
        console.log(`\n${emoji} SECURITY ALERT ${emoji}`);
        console.log('='.repeat(70));
        console.log(message);
        console.log('='.repeat(70) + '\n');
    }

    /**
     * Send email alert
     */
    async sendEmail(alert) {
        // Email sending would require nodemailer or similar
        // For now, just log that email would be sent
        console.log(`📧 Email alert would be sent to ${this.config.email.to}`);
        console.log(`   Subject: Security Alert - ${alert.securityType}`);
        console.log(`   Body: ${this.formatAlertMessage(alert)}`);
        
        // TODO: Implement actual email sending with nodemailer
        // const nodemailer = require('nodemailer');
        // const transporter = nodemailer.createTransport({...});
        // await transporter.sendMail({...});
    }

    /**
     * Send webhook alert
     */
    async sendWebhook(alert) {
        try {
            const http = require('http');
            const https = require('https');
            const url = require('url');

            const parsedUrl = new URL(this.config.webhook.url);
            const client = parsedUrl.protocol === 'https:' ? https : http;

            const payload = JSON.stringify({
                type: 'security_alert',
                timestamp: new Date().toISOString(),
                alert
            });

            const options = {
                hostname: parsedUrl.hostname,
                port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
                path: parsedUrl.pathname,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': Buffer.byteLength(payload)
                }
            };

            return new Promise((resolve, reject) => {
                const req = client.request(options, (res) => {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resolve();
                    } else {
                        reject(new Error(`Webhook returned ${res.statusCode}`));
                    }
                });

                req.on('error', reject);
                req.write(payload);
                req.end();
            });
        } catch (error) {
            console.error('Error sending webhook alert:', error);
        }
    }

    /**
     * Format alert message
     */
    formatAlertMessage(alert) {
        let message = '';

        if (alert.type === 'threshold_exceeded') {
            message = `Security threshold exceeded!\n\n`;
            message += `Type: ${alert.securityType}\n`;
            message += `Threshold: ${alert.threshold} per hour\n`;
            message += `Current: ${alert.currentCount} in the last hour\n`;
            if (alert.event) {
                message += `Latest Event: ${JSON.stringify(alert.event, null, 2)}\n`;
            }
        } else if (alert.type === 'critical_event') {
            message = `CRITICAL SECURITY EVENT!\n\n`;
            message += `Type: ${alert.securityType}\n`;
            message += `Event: ${JSON.stringify(alert.event, null, 2)}\n`;
        }

        message += `\nTime: ${new Date().toISOString()}`;
        return message;
    }
}

module.exports = SecurityAlerts;


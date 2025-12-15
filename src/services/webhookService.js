/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/webhookService.js
 * Last Sync: 2025-12-14T09:47:54.634Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Webhook Service
 * 
 * Manages webhooks for real-time integrations.
 * Supports event subscriptions and delivery.
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const crypto = require('crypto');

class WebhookService {
    constructor() {
        if (config.supabase?.url && config.supabase?.serviceRoleKey) {
            this.supabase = require('@supabase/supabase-js').createClient(
                config.supabase.url,
                config.supabase.serviceRoleKey
            );
        } else {
            this.supabase = null;
        }

        this.webhooks = new Map();
    }

    /**
     * Register webhook
     */
    async registerWebhook(webhookConfig) {
        try {
            const {
                url,
                events, // Array of event types
                secret,
                enabled = true
            } = webhookConfig;

            const webhookId = `webhook-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const webhookSecret = secret || crypto.randomBytes(32).toString('hex');

            const webhook = {
                id: webhookId,
                url,
                events: Array.isArray(events) ? events : [events],
                secret: webhookSecret,
                enabled,
                createdAt: new Date().toISOString(),
                lastTriggered: null,
                failureCount: 0
            };

            this.webhooks.set(webhookId, webhook);

            // Store in database
            if (this.supabase) {
                await this.supabase
                    .from('code_roach_webhooks')
                    .insert({
                        webhook_id: webhookId,
                        url,
                        events: webhook.events,
                        secret: webhookSecret,
                        enabled
                    });
            }

            return {
                success: true,
                webhook: {
                    id: webhookId,
                    url,
                    events: webhook.events,
                    secret: webhookSecret
                }
            };
        } catch (error) {
            console.error('[Webhook Service] Error registering webhook:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Trigger webhook
     */
    async triggerWebhook(eventType, payload) {
        try {
            const matchingWebhooks = Array.from(this.webhooks.values())
                .filter(w => w.enabled && w.events.includes(eventType));

            const results = [];

            for (const webhook of matchingWebhooks) {
                try {
                    const result = await this.deliverWebhook(webhook, eventType, payload);
                    results.push({
                        webhookId: webhook.id,
                        success: true,
                        ...result
                    });

                    // Update last triggered
                    webhook.lastTriggered = new Date().toISOString();
                    webhook.failureCount = 0;
                } catch (error) {
                    webhook.failureCount++;
                    results.push({
                        webhookId: webhook.id,
                        success: false,
                        error: error.message
                    });

                    // Disable after 5 failures
                    if (webhook.failureCount >= 5) {
                        webhook.enabled = false;
                    }
                }
            }

            return {
                success: true,
                triggered: results.length,
                results
            };
        } catch (error) {
            console.error('[Webhook Service] Error triggering webhooks:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Deliver webhook
     */
    async deliverWebhook(webhook, eventType, payload) {
        const signature = this.generateSignature(webhook.secret, JSON.stringify(payload));

        const response = await fetch(webhook.url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Code-Roach-Event': eventType,
                'X-Code-Roach-Signature': signature,
                'X-Code-Roach-Webhook-Id': webhook.id
            },
            body: JSON.stringify({
                event: eventType,
                timestamp: new Date().toISOString(),
                data: payload
            }),
            timeout: 10000 // 10 second timeout
        });

        if (!response.ok) {
            throw new Error(`Webhook delivery failed: ${response.status} ${response.statusText}`);
        }

        return {
            status: response.status,
            deliveredAt: new Date().toISOString()
        };
    }

    /**
     * Generate webhook signature
     */
    generateSignature(secret, payload) {
        return crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
    }

    /**
     * Verify webhook signature
     */
    verifySignature(secret, payload, signature) {
        const expectedSignature = this.generateSignature(secret, payload);
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }

    /**
     * List webhooks
     */
    async listWebhooks(filters = {}) {
        let webhooks = Array.from(this.webhooks.values());

        if (filters.enabled !== undefined) {
            webhooks = webhooks.filter(w => w.enabled === filters.enabled);
        }

        if (filters.event) {
            webhooks = webhooks.filter(w => w.events.includes(filters.event));
        }

        return {
            success: true,
            webhooks: webhooks.map(w => ({
                id: w.id,
                url: w.url,
                events: w.events,
                enabled: w.enabled,
                lastTriggered: w.lastTriggered,
                failureCount: w.failureCount
            }))
        };
    }

    /**
     * Delete webhook
     */
    async deleteWebhook(webhookId) {
        const webhook = this.webhooks.get(webhookId);
        if (!webhook) {
            return {
                success: false,
                error: 'Webhook not found'
            };
        }

        this.webhooks.delete(webhookId);

        if (this.supabase) {
            await this.supabase
                .from('code_roach_webhooks')
                .delete()
                .eq('webhook_id', webhookId);
        }

        return {
            success: true,
            webhookId
        };
    }

    /**
     * Test webhook
     */
    async testWebhook(webhookId) {
        const webhook = this.webhooks.get(webhookId);
        if (!webhook) {
            return {
                success: false,
                error: 'Webhook not found'
            };
        }

        const testPayload = {
            test: true,
            timestamp: new Date().toISOString()
        };

        return await this.triggerWebhook('test', testPayload);
    }
}

module.exports = new WebhookService();

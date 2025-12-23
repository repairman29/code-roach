/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/securityMonitoring.js
 * Last Sync: 2025-12-19T23:29:57.619Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Security Monitoring Service
 * Tracks security events, incidents, and provides real-time monitoring
 */

const fs = require('fs').promises;
const path = require('path');

class SecurityMonitoring {
    constructor(options = {}) {
        this.config = {
            logFile: options.logFile || path.join(__dirname, '../../data/security-events.jsonl'),
            maxLogSize: options.maxLogSize || 10000, // Max events in memory
            alertThresholds: {
                rateLimitViolations: options.alertThresholds?.rateLimitViolations || 50, // Per hour
                blockedIPs: options.alertThresholds?.blockedIPs || 10, // Per hour
                ddosAttempts: options.alertThresholds?.ddosAttempts || 5, // Per hour
                xssAttempts: options.alertThresholds?.xssAttempts || 10, // Per hour
                websocketFloods: options.alertThresholds?.websocketFloods || 20, // Per hour
                ...options.alertThresholds
            },
            ...options
        };

        // Event storage
        this.events = [];
        this.stats = {
            totalEvents: 0,
            rateLimitViolations: 0,
            blockedIPs: 0,
            ddosAttempts: 0,
            xssAttempts: 0,
            websocketFloods: 0,
            lastAlert: null,
            alertsSent: 0
        };

        // Time-based counters (for hourly thresholds)
        this.hourlyCounters = {
            rateLimitViolations: [],
            blockedIPs: [],
            ddosAttempts: [],
            xssAttempts: [],
            websocketFloods: []
        };

        // Alert handlers
        this.alertHandlers = [];

        // Initialize log file
        this.initializeLogFile();

        // Cleanup old events periodically
        setInterval(() => this.cleanup(), 3600000); // Every hour
    }

    /**
     * Initialize log file
     */
    async initializeLogFile() {
        try {
            const logDir = path.dirname(this.config.logFile);
            await fs.mkdir(logDir, { recursive: true });
        } catch (error) {
            console.error('Error initializing security log file:', error);
        }
    }

    /**
     * Log a security event
     */
    async logEvent(type, details) {
        const event = {
            id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            timestamp: Date.now(),
            severity: details.severity || 'medium',
            ip: details.ip || 'unknown',
            userAgent: details.userAgent || 'unknown',
            details: details.details || {},
            ...details
        };

        // Add to memory
        this.events.unshift(event);
        if (this.events.length > this.config.maxLogSize) {
            this.events.pop();
        }

        // Update stats
        this.stats.totalEvents++;
        this.updateStats(type);

        // Write to log file (async, non-blocking)
        this.writeToLogFile(event).catch(err => {
            console.error('Error writing security event to log:', err);
        });

        // Check for alerts
        this.checkAlerts(type, event);

        return event;
    }

    /**
     * Update statistics
     */
    updateStats(type) {
        const now = Date.now();
        const hourAgo = now - 3600000;

        switch (type) {
            case 'rate_limit_violation':
                this.stats.rateLimitViolations++;
                this.hourlyCounters.rateLimitViolations.push(now);
                break;
            case 'ip_blocked':
                this.stats.blockedIPs++;
                this.hourlyCounters.blockedIPs.push(now);
                break;
            case 'ddos_attempt':
                this.stats.ddosAttempts++;
                this.hourlyCounters.ddosAttempts.push(now);
                break;
            case 'xss_attempt':
                this.stats.xssAttempts++;
                this.hourlyCounters.xssAttempts.push(now);
                break;
            case 'websocket_flood':
                this.stats.websocketFloods++;
                this.hourlyCounters.websocketFloods.push(now);
                break;
        }

        // Clean up old hourly counters
        Object.keys(this.hourlyCounters).forEach(key => {
            this.hourlyCounters[key] = this.hourlyCounters[key].filter(t => t > hourAgo);
        });
    }

    /**
     * Check if alerts should be sent
     */
    checkAlerts(type, event) {
        const threshold = this.config.alertThresholds[this.getThresholdKey(type)];
        if (!threshold) return;

        const hourlyCount = this.hourlyCounters[this.getThresholdKey(type)].length;

        if (hourlyCount >= threshold) {
            // Send alert
            this.sendAlert({
                type: 'threshold_exceeded',
                securityType: type,
                threshold,
                currentCount: hourlyCount,
                event
            });
        }

        // Also alert on critical events
        if (event.severity === 'critical') {
            this.sendAlert({
                type: 'critical_event',
                securityType: type,
                event
            });
        }
    }

    /**
     * Get threshold key for event type
     */
    getThresholdKey(type) {
        const mapping = {
            'rate_limit_violation': 'rateLimitViolations',
            'ip_blocked': 'blockedIPs',
            'ddos_attempt': 'ddosAttempts',
            'xss_attempt': 'xssAttempts',
            'websocket_flood': 'websocketFloods'
        };
        return mapping[type] || type;
    }

    /**
     * Send alert
     */
    async sendAlert(alert) {
        this.stats.lastAlert = Date.now();
        this.stats.alertsSent++;

        // Call all alert handlers
        for (const handler of this.alertHandlers) {
            try {
                await handler(alert);
            } catch (error) {
                console.error('Error in alert handler:', error);
            }
        }

        // Log the alert
        await this.logEvent('alert', {
            severity: 'high',
            details: alert
        });
    }

    /**
     * Register alert handler
     */
    onAlert(handler) {
        this.alertHandlers.push(handler);
    }

    /**
     * Write event to log file
     */
    async writeToLogFile(event) {
        try {
            const logLine = JSON.stringify(event) + '\n';
            await fs.appendFile(this.config.logFile, logLine, 'utf8');
        } catch (error) {
            // Ignore errors - logging shouldn't break the app
        }
    }

    /**
     * Get recent events
     */
    getRecentEvents(limit = 100, type = null) {
        let events = this.events;
        if (type) {
            events = events.filter(e => e.type === type);
        }
        return events.slice(0, limit);
    }

    /**
     * Get statistics
     */
    getStats() {
        const now = Date.now();
        const hourAgo = now - 3600000;
        const dayAgo = now - 86400000;

        return {
            ...this.stats,
            hourly: {
                rateLimitViolations: this.hourlyCounters.rateLimitViolations.length,
                blockedIPs: this.hourlyCounters.blockedIPs.length,
                ddosAttempts: this.hourlyCounters.ddosAttempts.length,
                xssAttempts: this.hourlyCounters.xssAttempts.length,
                websocketFloods: this.hourlyCounters.websocketFloods.length
            },
            recentEvents: this.events.filter(e => e.timestamp > hourAgo).length,
            recentCriticalEvents: this.events.filter(e => 
                e.timestamp > hourAgo && e.severity === 'critical'
            ).length
        };
    }

    /**
     * Get events by IP
     */
    getEventsByIP(ip, limit = 50) {
        return this.events
            .filter(e => e.ip === ip)
            .slice(0, limit);
    }

    /**
     * Get top attacking IPs
     */
    getTopAttackingIPs(limit = 10) {
        const ipCounts = {};
        this.events.forEach(event => {
            if (event.ip && event.ip !== 'unknown') {
                ipCounts[event.ip] = (ipCounts[event.ip] || 0) + 1;
            }
        });

        return Object.entries(ipCounts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, limit)
            .map(([ip, count]) => ({ ip, count }));
    }

    /**
     * Cleanup old events
     */
    cleanup() {
        const dayAgo = Date.now() - 86400000; // 24 hours
        const initialLength = this.events.length;
        this.events = this.events.filter(e => e.timestamp > dayAgo);
        
        if (this.events.length < initialLength) {
            console.log(`Cleaned up ${initialLength - this.events.length} old security events`);
        }
    }
}

module.exports = SecurityMonitoring;


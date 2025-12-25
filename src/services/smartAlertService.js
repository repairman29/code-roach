/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/smartAlertService.js
 * Last Sync: 2025-12-25T07:02:34.017Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Smart Alert Service
 * Intelligent alerting based on error patterns and trends
 */

const errorHistoryService = require("./errorHistoryService");
const { createLogger } = require("../utils/logger");
const log = createLogger("SmartAlertService");
const errorPredictionService = require("./errorPredictionService");

class SmartAlertService {
  constructor() {
    this.alertRules = new Map();
    this.alertHistory = [];
    this.alertCooldowns = new Map();

    this.initializeAlertRules();
  }

  /**
   * Initialize alert rules
   */
  initializeAlertRules() {
    // Rule: Spike in error rate
    this.alertRules.set("error-spike", {
      name: "Error Rate Spike",
      check: (stats) => {
        // Check if error rate increased significantly
        // This would need historical comparison
        return false; // Placeholder
      },
      severity: "high",
      message: "Error rate has spiked significantly",
    });

    // Rule: New error pattern
    this.alertRules.set("new-pattern", {
      name: "New Error Pattern",
      check: (error) => {
        const pattern = errorHistoryService.generatePatternFingerprint(error);
        const stats = errorHistoryService.getPatternStats(pattern);
        return !stats || stats.occurrences === 1;
      },
      severity: "medium",
      message: "New error pattern detected",
    });

    // Rule: Fix success rate dropping
    this.alertRules.set("fix-quality-drop", {
      name: "Fix Quality Drop",
      check: (learningStats) => {
        // Check if average quality is dropping
        return learningStats.averageQuality < 0.5;
      },
      severity: "medium",
      message: "Fix success rate is below 50%",
    });

    // Rule: Critical error pattern
    this.alertRules.set("critical-pattern", {
      name: "Critical Error Pattern",
      check: (error) => {
        const criticalKeywords = [
          "corruption",
          "crash",
          "data loss",
          "security",
        ];
        return criticalKeywords.some((keyword) =>
          error.message.toLowerCase().includes(keyword),
        );
      },
      severity: "critical",
      message: "Critical error pattern detected",
    });
  }

  /**
   * Check if alert should be sent
   */
  shouldAlert(ruleId, context) {
    // Check cooldown
    const lastAlert = this.alertCooldowns.get(ruleId);
    if (lastAlert && Date.now() - lastAlert < 300000) {
      // 5 minute cooldown
      return false;
    }

    const rule = this.alertRules.get(ruleId);
    if (!rule) return false;

    return rule.check(context);
  }

  /**
   * Send alert
   */
  sendAlert(ruleId, context, details = {}) {
    const rule = this.alertRules.get(ruleId);
    if (!rule) return;

    if (!this.shouldAlert(ruleId, context)) {
      return;
    }

    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ruleId,
      ruleName: rule.name,
      severity: rule.severity,
      message: rule.message,
      details,
      timestamp: Date.now(),
    };

    this.alertHistory.push(alert);
    this.alertCooldowns.set(ruleId, Date.now());

    // Keep only last 1000 alerts
    if (this.alertHistory.length > 1000) {
      this.alertHistory.shift();
    }

    // Log alert
    console.log(
      `🚨 [Code Roach Alert] ${rule.severity.toUpperCase()}: ${rule.message}`,
      details,
    );

    return alert;
  }

  /**
   * Check for alerts based on current state
   */
  checkAlerts(error = null, stats = null, learningStats = null) {
    const alerts = [];

    // Check new pattern alert
    if (error) {
      if (this.shouldAlert("new-pattern", error)) {
        alerts.push(this.sendAlert("new-pattern", error, { error }));
      }

      if (this.shouldAlert("critical-pattern", error)) {
        alerts.push(this.sendAlert("critical-pattern", error, { error }));
      }
    }

    // Check fix quality alert
    if (learningStats) {
      if (this.shouldAlert("fix-quality-drop", learningStats)) {
        alerts.push(
          this.sendAlert("fix-quality-drop", learningStats, { learningStats }),
        );
      }
    }

    return alerts;
  }

  /**
   * Get recent alerts
   */
  getRecentAlerts(limit = 50) {
    return this.alertHistory.slice(-limit).reverse();
  }

  /**
   * Get alerts by severity
   */
  getAlertsBySeverity(severity) {
    return this.alertHistory.filter((a) => a.severity === severity);
  }
}

module.exports = new SmartAlertService();

/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/riskAlertService.js
 * Last Sync: 2025-12-25T07:02:34.017Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Risk Alert Service
 * Sprint 3: Proactive risk monitoring and alerts
 */

const config = require("../config");
const { createLogger } = require("../utils/logger");
const log = createLogger("RiskAlertService");
const developerMetricsService = require("./developerMetricsService");
const { getSupabaseService } = require("../utils/supabaseClient");
const { getSupabaseClient } = require('../utils/supabaseClient');

class RiskAlertService {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = getSupabaseClient({ requireService: true }).serviceRoleKey,
        );
      } catch (error) {
        log.warn(
          "[riskAlertService] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      log.warn(
        "[riskAlertService] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * Check file risk and create alert if high risk
   */
  async checkAndAlert(filePath, context = {}) {
    try {
      const riskScore =
        await developerMetricsService.calculateFileRisk(filePath);

      if (riskScore > 70) {
        await this.createAlert({
          type: "high_risk_file",
          severity: riskScore > 90 ? "critical" : "high",
          filePath,
          riskScore,
          message: `High risk file detected: ${filePath} (Risk Score: ${riskScore})`,
          context,
        });
      }

      return { riskScore, alerted: riskScore > 70 };
    } catch (error) {
      console.error("[RiskAlertService] Error checking risk:", error);
      return { riskScore: 0, alerted: false };
    }
  }

  /**
   * Create a risk alert
   */
  async createAlert(alert) {
    try {
      const { data, error } = await this.supabase
        .from("risk_alerts")
        .insert({
          alert_type: alert.type,
          severity: alert.severity || "medium",
          file_path: alert.filePath,
          risk_score: alert.riskScore,
          message: alert.message,
          context: alert.context || {},
          status: "active",
          created_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) throw error;

      // Notify subscribers
      this.notifySubscribers(data);

      return data;
    } catch (error) {
      console.error("[RiskAlertService] Error creating alert:", error);
      return null;
    }
  }

  /**
   * Get active risk alerts
   */
  async getActiveAlerts(limit = 50) {
    try {
      const { data, error } = await this.supabase
        .from("risk_alerts")
        .select("*")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("[RiskAlertService] Error getting alerts:", error);
      return [];
    }
  }

  /**
   * Get high-risk files
   */
  async getHighRiskFiles(minRisk = 70, limit = 20) {
    try {
      return await developerMetricsService.getHighRiskFiles(minRisk, limit);
    } catch (error) {
      console.error("[RiskAlertService] Error getting high-risk files:", error);
      return [];
    }
  }

  /**
   * Resolve an alert
   */
  async resolveAlert(alertId, resolution = {}) {
    try {
      const { data, error } = await this.supabase
        .from("risk_alerts")
        .update({
          status: "resolved",
          resolved_at: new Date().toISOString(),
          resolution: resolution,
        })
        .eq("id", alertId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("[RiskAlertService] Error resolving alert:", error);
      return null;
    }
  }

  /**
   * Subscribe to risk alerts (for real-time updates)
   */
  subscribe(callback) {
    this.alertSubscribers.add(callback);
    return () => this.alertSubscribers.delete(callback);
  }

  /**
   * Notify all subscribers of a new alert
   */
  notifySubscribers(alert) {
    for (const callback of this.alertSubscribers) {
      try {
        callback(alert);
      } catch (error) {
        console.error("[RiskAlertService] Error notifying subscriber:", error);
      }
    }
  }

  /**
   * Get risk statistics
   */
  async getRiskStats(days = 7) {
    try {
      const since = new Date();
      since.setDate(since.getDate() - days);

      const { data: alerts, error } = await this.supabase
        .from("risk_alerts")
        .select("*")
        .gte("created_at", since.toISOString());

      if (error) throw error;

      const stats = {
        total: alerts.length,
        bySeverity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
        byType: {},
        avgRiskScore: 0,
        resolved: 0,
        active: 0,
      };

      let totalRisk = 0;
      for (const alert of alerts) {
        stats.bySeverity[alert.severity] =
          (stats.bySeverity[alert.severity] || 0) + 1;
        stats.byType[alert.alert_type] =
          (stats.byType[alert.alert_type] || 0) + 1;
        if (alert.risk_score) totalRisk += alert.risk_score;
        if (alert.status === "resolved") stats.resolved++;
        if (alert.status === "active") stats.active++;
      }

      stats.avgRiskScore = alerts.length > 0 ? totalRisk / alerts.length : 0;

      return stats;
    } catch (error) {
      console.error("[RiskAlertService] Error getting stats:", error);
      return null;
    }
  }
}

module.exports = new RiskAlertService();

/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/developerMetricsService.js
 * Last Sync: 2025-12-25T07:02:34.014Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Developer Metrics Service
 * ROUND 10: Track developer performance and fix statistics
 */

const config = require("../config");
const { getSupabaseService } = require("../utils/supabaseClient");
const { createLogger } = require("../utils/logger");
const { getSupabaseClient } = require('../utils/supabaseClient');
const log = createLogger("DeveloperMetricsService");

class DeveloperMetricsService {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = getSupabaseClient({ requireService: true }).serviceRoleKey,
        );
      } catch (error) {
        log.warn(
          "[developerMetricsService] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      log.warn(
        "[developerMetricsService] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * Get developer statistics
   * ROUND 10: Personal fix statistics and performance metrics
   */
  async getDeveloperStats(developerId = "default", timeRange = "30d") {
    if (!this.supabase) {
      return this.getDefaultStats();
    }

    try {
      const timeFilter = this.getTimeFilter(timeRange);

      // Get issues fixed by developer
      const { data: fixes } = await this.supabase
        .from("fixes")
        .select("*")
        .eq("developer_id", developerId)
        .gte("created_at", timeFilter);

      return fixes || [];
    } catch (err) {
      log.warn("[Developer Metrics] Error getting developer stats:", err);
      return this.getDefaultStats();
    }
  }

  getDefaultStats() {
    return {
      totalFixes: 0,
      averageFixTime: 0,
    };
  }

  getTimeFilter(timeRange) {
    const now = new Date();
    const pastDate = new Date(now);
    pastDate.setDate(now.getDate() - parseInt(timeRange));
    return pastDate.toISOString();
  }

  /**
   * Calculate file risk score (0-100)
   * Higher score = higher risk
   */
  async calculateFileRisk(filePath) {
    try {
      // Simple risk calculation based on file path and history
      let riskScore = 0;

      // Check if file has been flagged before
      if (this.supabase) {
        try {
          const { data } = await this.supabase
            .from("code_roach_issues")
            .select("error_severity")
            .eq("file_path", filePath)
            .limit(10);

          if (data && data.length > 0) {
            // Higher risk if file has had issues before
            riskScore += Math.min(30, data.length * 5);

            // Higher risk if critical issues found
            const criticalCount = data.filter(
              (d) => d.error_severity === "critical",
            ).length;
            riskScore += criticalCount * 10;
          }
        } catch (err) {
          // Supabase query failed, continue with default risk
        }
      }

      // Add risk based on file location
      if (filePath.includes("temp/") || filePath.includes("test/")) {
        riskScore += 10; // Lower risk for temp/test files
      } else if (filePath.includes("server/") || filePath.includes("public/")) {
        riskScore += 20; // Higher risk for server/public files
      }

      return Math.min(100, riskScore);
    } catch (err) {
      // Return default low risk if calculation fails
      return 10;
    }
  }
}

module.exports = new DeveloperMetricsService();

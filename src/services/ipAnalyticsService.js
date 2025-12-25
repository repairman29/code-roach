/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/ipAnalyticsService.js
 * Last Sync: 2025-12-25T07:02:34.016Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * IP Analytics Service
 * Analytics for Code Roach IP innovations
 * Tracks usage, effectiveness, and impact of new IP features
 */

const config = require("../config");
const { getSupabaseService } = require("../utils/supabaseClient");
const { createLogger } = require("../utils/logger");
const { getSupabaseClient } = require('../utils/supabaseClient');
const log = createLogger("IpAnalyticsService");

class IPAnalyticsService {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = getSupabaseClient({ requireService: true }).serviceRoleKey,
        );
      } catch (error) {
        log.warn(
          "[ipAnalyticsService] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      log.warn(
        "[ipAnalyticsService] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * Get overall IP analytics
   */
  async getIPAnalytics() {
    return {
      codeGeneration: await this.getCodeGenerationStats(),
      testGeneration: await this.getTestGenerationStats(),
      refactoring: await this.getRefactoringStats(),
      similarity: await this.getSimilarityStats(),
      codeSmells: await this.getCodeSmellStats(),
      crossProject: await this.getCrossProjectStats(),
      overall: await this.getOverallStats(),
    };
  }

  /**
   * Get code generation statistics
   */
  async getCodeGenerationStats() {
    // Track code generation usage
    // In production, would store in Supabase
    return {
      totalGenerated: 0, // Would query from Supabase
      averageConfidence: 0,
      patternsUsed: 0,
      successRate: 0,
      timeSaved: 0, // hours
    };
  }

  /**
   * Get test generation statistics
   */
  async getTestGenerationStats() {
    if (!this.supabase) return this.getDefaultStats();

    try {
      // Count patterns with tests
      const { data, error } = await this.supabase
        .from("code_roach_patterns")
        .select("pattern_metadata")
        .not("pattern_metadata->>hasTest", "is", null)
        .eq("pattern_metadata->>hasTest", true);

      if (error) throw error;

      const { count: totalPatterns } = await this.supabase
        .from("code_roach_patterns")
        .select("*", { count: "exact", head: true });

      return {
        testsGenerated: data?.length || 0,
        totalPatterns: totalPatterns || 0,
        coverage:
          data?.length > 0 && totalPatterns > 0
            ? ((data.length / totalPatterns) * 100).toFixed(1)
            : 0,
        patternsNeedingTests: Math.max(
          0,
          (totalPatterns || 0) - (data?.length || 0),
        ),
      };
    } catch (err) {
      log.warn("[IP Analytics] Error getting test generation stats:", err);
      return this.getDefaultStats();
    }
  }

  /**
   * Get refactoring statistics
   */
  async getRefactoringStats() {
    if (!this.supabase) return this.getDefaultStats();

    try {
      // Get files with health scores
      const { data, error } = await this.supabase
        .from("code_roach_file_health")
        .select("health_score, file_path, recorded_at")
        .order("recorded_at", { ascending: false });

      if (error) throw error;

      // Group by file, get latest
      const fileMap = new Map();
      data?.forEach((record) => {
        if (
          !fileMap.has(record.file_path) ||
          new Date(record.recorded_at) >
            new Date(fileMap.get(record.file_path).recorded_at)
        ) {
          fileMap.set(record.file_path, record);
        }
      });

      const files = Array.from(fileMap.values());
      const lowHealth = files.filter((f) => f.health_score < 50).length;
      const mediumHealth = files.filter(
        (f) => f.health_score >= 50 && f.health_score < 70,
      ).length;
      const highHealth = files.filter((f) => f.health_score >= 70).length;

      return {
        totalFiles: files.length,
        lowHealthFiles: lowHealth,
        mediumHealthFiles: mediumHealth,
        highHealthFiles: highHealth,
        averageHealth:
          files.length > 0
            ? (
                files.reduce((sum, f) => sum + (f.health_score || 0), 0) /
                files.length
              ).toFixed(1)
            : 0,
        refactoringCandidates: lowHealth + mediumHealth,
      };
    } catch (err) {
      log.warn("[IP Analytics] Error getting refactoring stats:", err);
      return this.getDefaultStats();
    }
  }

  /**
   * Get similarity detection statistics
   */
  async getSimilarityStats() {
    // Would track duplicate code found
    return {
      duplicatesFound: 0,
      refactoringOpportunities: 0,
      codeReduction: 0, // lines of code
    };
  }

  /**
   * Get code smell statistics
   */
  async getCodeSmellStats() {
    if (!this.supabase) return this.getDefaultStats();

    try {
      // Get issues that might be code smells
      const { data, error } = await this.supabase
        .from("code_roach_issues")
        .select("error_type, error_severity")
        .in("error_type", ["style", "best-practice", "complexity"]);

      if (error) throw error;

      const smells = {
        total: data?.length || 0,
        byType: {},
        bySeverity: {
          critical: 0,
          high: 0,
          medium: 0,
          low: 0,
        },
      };

      data?.forEach((issue) => {
        // Count by type
        smells.byType[issue.error_type] =
          (smells.byType[issue.error_type] || 0) + 1;

        // Count by severity
        const severity = issue.error_severity || "low";
        smells.bySeverity[severity] = (smells.bySeverity[severity] || 0) + 1;
      });

      return smells;
    } catch (err) {
      log.warn("[IP Analytics] Error getting code smell stats:", err);
      return this.getDefaultStats();
    }
  }

  /**
   * Get cross-project learning statistics
   */
  async getCrossProjectStats() {
    if (!this.supabase) return this.getDefaultStats();

    try {
      // Get patterns learned from other projects
      const { data, error } = await this.supabase
        .from("code_roach_patterns")
        .select("pattern_metadata")
        .not("pattern_metadata->>learnedFromProjects", "is", null);

      if (error) throw error;

      const projects = new Set();
      data?.forEach((pattern) => {
        const learnedFrom = pattern.pattern_metadata?.learnedFromProjects || [];
        learnedFrom.forEach((p) => projects.add(p));
      });

      return {
        patternsLearned: data?.length || 0,
        projectsLearnedFrom: projects.size,
        crossProjectSuccessRate: 0, // Would calculate from success rates
      };
    } catch (err) {
      log.warn("[IP Analytics] Error getting cross-project stats:", err);
      return this.getDefaultStats();
    }
  }

  /**
   * Get overall statistics
   */
  async getOverallStats() {
    if (!this.supabase) return this.getDefaultStats();

    try {
      // Get total patterns
      const { count: totalPatterns } = await this.supabase
        .from("code_roach_patterns")
        .select("*", { count: "exact", head: true });

      // Get total issues
      const { count: totalIssues } = await this.supabase
        .from("code_roach_issues")
        .select("*", { count: "exact", head: true });

      // Get successful fixes
      const { count: successfulFixes } = await this.supabase
        .from("code_roach_issues")
        .select("*", { count: "exact", head: true })
        .eq("fix_success", true);

      return {
        totalPatterns: totalPatterns || 0,
        totalIssues: totalIssues || 0,
        successfulFixes: successfulFixes || 0,
        fixSuccessRate:
          totalIssues > 0
            ? (((successfulFixes || 0) / totalIssues) * 100).toFixed(1)
            : 0,
        timeSaved: this.calculateTimeSaved(
          totalIssues || 0,
          successfulFixes || 0,
        ),
      };
    } catch (err) {
      log.warn("[IP Analytics] Error getting overall stats:", err);
      return this.getDefaultStats();
    }
  }

  /**
   * Calculate time saved
   */
  calculateTimeSaved(totalIssues, fixedIssues) {
    // Estimate: 30 minutes per issue, 2 hours per fix
    const timeToFind = totalIssues * 0.5; // hours
    const timeToFix = fixedIssues * 2; // hours
    const timeSaved = timeToFind + timeToFix;
    return {
      hours: timeSaved.toFixed(1),
      days: (timeSaved / 8).toFixed(1),
      weeks: (timeSaved / 40).toFixed(1),
    };
  }

  /**
   * Get default stats
   */
  getDefaultStats() {
    return {
      total: 0,
      average: 0,
      successRate: 0,
    };
  }

  /**
   * Get IP feature usage over time
   */
  async getIPUsageOverTime(days = 30) {
    // Would track feature usage in Supabase
    // For now, return structure
    return {
      codeGeneration: [],
      testGeneration: [],
      refactoring: [],
      similarity: [],
      codeSmells: [],
      crossProject: [],
    };
  }

  /**
   * Get ROI metrics
   */
  async getROIMetrics() {
    const overall = await this.getOverallStats();

    return {
      timeSaved: overall.timeSaved,
      issuesPrevented: 0, // Would calculate from predictions
      costSavings: {
        developerHours: overall.timeSaved?.hours || 0,
        estimatedValue: (overall.timeSaved?.hours || 0) * 100, // $100/hour
      },
      qualityImprovement: {
        fixSuccessRate: overall.fixSuccessRate,
        healthScoreTrend: 0, // Would calculate from trends
      },
    };
  }
}

module.exports = new IPAnalyticsService();

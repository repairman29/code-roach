/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/predictiveRefactoringService.js
 * Last Sync: 2025-12-25T05:17:15.770Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Predictive Refactoring Service
 * Suggests refactorings before code becomes a problem
 * IP Innovation #11: Predictive Code Maintenance
 */

const config = require("../config");
const { createLogger } = require("../utils/logger");
const log = createLogger("PredictiveRefactoringService");
const codeHealthScoring = require("./codeHealthScoring");
const { getSupabaseService } = require("../utils/supabaseClient");
const { getSupabaseClient } = require('../utils/supabaseClient');

class PredictiveRefactoringService {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = getSupabaseClient({ requireService: true }).serviceRoleKey,
        );
      } catch (error) {
        log.warn(
          "[predictiveRefactoringService] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      log.warn(
        "[predictiveRefactoringService] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * Predict when code will need refactoring
   */
  async predictRefactorNeed(filePath) {
    // Analyze:
    // - Current complexity
    // - Historical trends
    // - Similar files that needed refactoring
    // - Issue frequency

    const currentHealth = await codeHealthScoring.getHealthScore(filePath);
    const trends = await this.analyzeHealthTrends(filePath);
    const similarRefactorings = await this.findSimilarRefactorings(filePath);
    const issueFrequency = await this.getIssueFrequency(filePath);

    // Calculate refactor score (0-1)
    const score = this.calculateRefactorScore({
      currentHealth,
      trends,
      similarRefactorings,
      issueFrequency,
    });

    return {
      score,
      needsRefactoring: score > 0.7,
      urgency: score > 0.9 ? "high" : score > 0.7 ? "medium" : "low",
      reasons: this.getRefactorReasons({
        currentHealth,
        trends,
        similarRefactorings,
        issueFrequency,
      }),
      suggestions:
        score > 0.7 ? await this.generateRefactoringSuggestions(filePath) : [],
    };
  }

  /**
   * Analyze health trends over time
   */
  async analyzeHealthTrends(filePath) {
    if (!this.supabase) return { trend: "stable", rate: 0 };

    try {
      const { data, error } = await this.supabase
        .from("code_roach_file_health")
        .select("health_score, recorded_at")
        .eq("file_path", filePath)
        .order("recorded_at", { ascending: false })
        .limit(30);

      if (error || !data || data.length < 2) {
        return { trend: "unknown", rate: 0 };
      }

      // Calculate trend
      const recent = data.slice(0, 10);
      const older = data.slice(10, 20);

      const recentAvg =
        recent.reduce((sum, d) => sum + (d.health_score || 0), 0) /
        recent.length;
      const olderAvg =
        older.reduce((sum, d) => sum + (d.health_score || 0), 0) / older.length;

      const rate = (recentAvg - olderAvg) / olderAvg; // Percentage change

      return {
        trend: rate < -0.1 ? "declining" : rate > 0.1 ? "improving" : "stable",
        rate,
        recentAvg,
        olderAvg,
      };
    } catch (err) {
      log.warn("[Predictive Refactoring] Error analyzing trends:", err);
      return { trend: "unknown", rate: 0 };
    }
  }

  /**
   * Find similar files that needed refactoring
   */
  async findSimilarRefactorings(filePath) {
    if (!this.supabase) return [];

    try {
      // Find files with similar patterns that were refactored
      const { data, error } = await this.supabase
        .from("code_roach_quality_improvements")
        .select("*")
        .eq("improvement_type", "refactoring")
        .contains("triggered_by_issues", [filePath])
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    } catch (err) {
      log.warn(
        "[Predictive Refactoring] Error finding similar refactorings:",
        err,
      );
      return [];
    }
  }

  /**
   * Get issue frequency for file
   */
  async getIssueFrequency(filePath) {
    if (!this.supabase) return { frequency: 0, trend: "stable" };

    try {
      const { data, error } = await this.supabase
        .from("code_roach_issues")
        .select("created_at, error_severity")
        .eq("error_file", filePath)
        .gte(
          "created_at",
          new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString(),
        );

      if (error) throw error;

      // Calculate frequency
      const issuesByWeek = {};
      data.forEach((issue) => {
        const week = new Date(issue.created_at).toISOString().substring(0, 10);
        issuesByWeek[week] = (issuesByWeek[week] || 0) + 1;
      });

      const frequencies = Object.values(issuesByWeek);
      const avgFrequency =
        frequencies.reduce((a, b) => a + b, 0) / frequencies.length;

      // Calculate trend
      const recent = frequencies.slice(-4);
      const older = frequencies.slice(0, -4);
      const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
      const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;
      const trend =
        recentAvg > olderAvg * 1.2
          ? "increasing"
          : recentAvg < olderAvg * 0.8
            ? "decreasing"
            : "stable";

      return {
        frequency: avgFrequency,
        trend,
        totalIssues: data.length,
        criticalIssues: data.filter((i) => i.error_severity === "critical")
          .length,
      };
    } catch (err) {
      log.warn(
        "[Predictive Refactoring] Error getting issue frequency:",
        err,
      );
      return { frequency: 0, trend: "stable" };
    }
  }

  /**
   * Calculate refactor score
   */
  calculateRefactorScore(metrics) {
    let score = 0;

    // Low health score increases need
    if (metrics.currentHealth?.overall < 50) {
      score += 0.3;
    } else if (metrics.currentHealth?.overall < 70) {
      score += 0.2;
    }

    // Declining trend increases need
    if (metrics.trends.trend === "declining") {
      score += 0.3;
    } else if (metrics.trends.rate < -0.2) {
      score += 0.4; // Rapid decline
    }

    // Similar refactorings increase need
    if (metrics.similarRefactorings.length > 3) {
      score += 0.2;
    }

    // High issue frequency increases need
    if (metrics.issueFrequency.frequency > 5) {
      score += 0.2;
    }
    if (metrics.issueFrequency.trend === "increasing") {
      score += 0.1;
    }

    return Math.min(1, score);
  }

  /**
   * Get reasons for refactoring
   */
  getRefactorReasons(metrics) {
    const reasons = [];

    if (metrics.currentHealth?.overall < 50) {
      reasons.push(`Low health score: ${metrics.currentHealth.overall}/100`);
    }

    if (metrics.trends.trend === "declining") {
      reasons.push(
        `Health declining: ${(metrics.trends.rate * 100).toFixed(1)}% per period`,
      );
    }

    if (metrics.issueFrequency.frequency > 5) {
      reasons.push(
        `High issue frequency: ${metrics.issueFrequency.frequency} issues/week`,
      );
    }

    if (metrics.similarRefactorings.length > 3) {
      reasons.push(
        `${metrics.similarRefactorings.length} similar files were refactored`,
      );
    }

    return reasons;
  }

  /**
   * Generate refactoring suggestions
   */
  async generateRefactoringSuggestions(filePath) {
    // Analyze code and suggest specific refactorings
    // - Extract functions
    // - Simplify logic
    // - Reduce complexity
    // - Improve naming

    return [
      {
        type: "extract-function",
        description: "Extract complex logic into separate functions",
        impact: "high",
        effort: "medium",
      },
      {
        type: "simplify-conditional",
        description: "Simplify nested conditionals",
        impact: "medium",
        effort: "low",
      },
    ];
  }

  /**
   * Get refactoring recommendations for codebase
   */
  async getCodebaseRefactoringRecommendations() {
    if (!this.supabase) return [];

    try {
      // Get all files with health scores
      const { data, error } = await this.supabase
        .from("code_roach_file_health")
        .select("file_path, health_score, recorded_at")
        .order("recorded_at", { ascending: false });

      if (error) throw error;

      // Group by file, get latest
      const fileMap = new Map();
      data.forEach((record) => {
        if (
          !fileMap.has(record.file_path) ||
          new Date(record.recorded_at) >
            new Date(fileMap.get(record.file_path).recorded_at)
        ) {
          fileMap.set(record.file_path, record);
        }
      });

      // Predict refactor needs
      const recommendations = [];
      for (const [filePath, health] of fileMap.entries()) {
        const prediction = await this.predictRefactorNeed(filePath);
        if (prediction.needsRefactoring) {
          recommendations.push({
            file: filePath,
            ...prediction,
          });
        }
      }

      // Sort by urgency
      recommendations.sort((a, b) => {
        if (a.urgency === "high" && b.urgency !== "high") return -1;
        if (b.urgency === "high" && a.urgency !== "high") return 1;
        return b.score - a.score;
      });

      return recommendations.slice(0, 20); // Top 20
    } catch (err) {
      console.error(
        "[Predictive Refactoring] Error getting recommendations:",
        err,
      );
      return [];
    }
  }
}

module.exports = new PredictiveRefactoringService();

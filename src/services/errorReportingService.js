/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/errorReportingService.js
 * Last Sync: 2025-12-25T04:10:02.866Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Error Reporting Service
 * Generates comprehensive error reports for stakeholders
 */

const errorHistoryService = require("./errorHistoryService");
const errorTrendAnalysis = require("./errorTrendAnalysis");
const fixLearningService = require("./fixLearningService");

class ErrorReportingService {
  constructor() {
    this.reportCache = new Map();
    this.cacheTTL = 300000; // 5 minutes
  }

  /**
   * Generate comprehensive error report
   */
  async generateReport(options = {}) {
    const {
      timeRange = "24h",
      includeTrends = true,
      includePredictions = true,
      includeRecommendations = true,
      format = "detailed", // 'summary', 'detailed', 'executive'
    } = options;

    const history = errorHistoryService.history;
    const stats = errorHistoryService.getStats();
    const patterns = errorHistoryService.getAllPatterns();
    const learningStats = fixLearningService.getLearningStats();

    const trends = includeTrends
      ? errorTrendAnalysis.getTrendSummary(timeRange)
      : null;

    // Filter to time range
    const now = Date.now();
    const rangeMs = this.getTimeRangeMs(timeRange);
    const cutoff = now - rangeMs;
    const recentErrors = history.filter((e) => e.timestamp >= cutoff);

    const report = {
      generatedAt: new Date().toISOString(),
      timeRange,
      period: {
        start: new Date(cutoff).toISOString(),
        end: new Date(now).toISOString(),
      },
      summary: {
        totalErrors: recentErrors.length,
        errorsFixed: recentErrors.filter((e) => e.fix?.success).length,
        successRate:
          recentErrors.length > 0
            ? (
                (recentErrors.filter((e) => e.fix?.success).length /
                  recentErrors.length) *
                100
              ).toFixed(1)
            : 0,
        uniquePatterns: new Set(recentErrors.map((e) => e.error.type)).size,
        averageFixTime: this.calculateAverageFixTime(recentErrors),
      },
      errorBreakdown: this.categorizeErrors(recentErrors),
      topErrors: this.getTopErrors(recentErrors, 10),
      trends: trends?.trends || [],
      insights: trends?.insights || [],
      predictions: includePredictions ? trends?.predictions || [] : [],
      recommendations: includeRecommendations
        ? this.generateRecommendations(stats, trends, learningStats)
        : [],
      patterns: patterns.slice(0, 10),
      learningMetrics: {
        averageQuality: learningStats.averageQuality || 0,
        improvementRate: learningStats.improvementRate || 0,
        suggestions: learningStats.improvementSuggestions || [],
      },
    };

    // Format based on report type
    if (format === "summary") {
      return this.formatSummaryReport(report);
    } else if (format === "executive") {
      return this.formatExecutiveReport(report);
    }

    return report;
  }

  /**
   * Generate executive summary report
   */
  formatExecutiveReport(report) {
    return {
      generatedAt: report.generatedAt,
      timeRange: report.timeRange,
      keyMetrics: {
        totalErrors: report.summary.totalErrors,
        successRate: `${report.summary.successRate}%`,
        trend:
          report.trends.find((t) => t.type === "error-rate")?.trend || "stable",
        topIssue:
          report.topErrors[0]?.error?.message?.substring(0, 100) || "None",
      },
      criticalInsights: report.insights
        .filter((i) => i.severity === "high")
        .slice(0, 3),
      recommendations: report.recommendations.slice(0, 3),
      status: this.determineOverallStatus(report),
    };
  }

  /**
   * Generate summary report
   */
  formatSummaryReport(report) {
    return {
      generatedAt: report.generatedAt,
      timeRange: report.timeRange,
      summary: report.summary,
      topErrors: report.topErrors.slice(0, 5),
      trends: report.trends,
      insights: report.insights,
      recommendations: report.recommendations,
    };
  }

  /**
   * Determine overall system status
   */
  determineOverallStatus(report) {
    const errorRateTrend = report.trends.find((t) => t.type === "error-rate");
    const fixRateTrend = report.trends.find(
      (t) => t.type === "fix-success-rate",
    );
    const criticalInsights = report.insights.filter(
      (i) => i.severity === "high",
    ).length;

    if (
      criticalInsights > 0 ||
      (errorRateTrend &&
        errorRateTrend.trend === "increasing" &&
        errorRateTrend.severity === "high")
    ) {
      return "critical";
    } else if (errorRateTrend && errorRateTrend.trend === "increasing") {
      return "warning";
    } else if (fixRateTrend && fixRateTrend.trend === "declining") {
      return "warning";
    } else {
      return "healthy";
    }
  }

  /**
   * Categorize errors by type
   */
  categorizeErrors(errors) {
    const categories = {
      javascript: 0,
      network: 0,
      resource: 0,
      promise: 0,
      security: 0,
      other: 0,
    };

    errors.forEach((error) => {
      const type = (error.error.type || "").toLowerCase();
      if (type.includes("network") || type.includes("fetch")) {
        categories.network++;
      } else if (type.includes("resource") || type.includes("load")) {
        categories.resource++;
      } else if (type.includes("promise")) {
        categories.promise++;
      } else if (type.includes("security") || type.includes("csrf")) {
        categories.security++;
      } else if (type.includes("error") || type.includes("exception")) {
        categories.javascript++;
      } else {
        categories.other++;
      }
    });

    return categories;
  }

  /**
   * Get top errors by frequency
   */
  getTopErrors(errors, limit = 10) {
    const errorCounts = new Map();

    errors.forEach((error) => {
      const key = `${error.error.type || "unknown"}_${error.error.message?.substring(0, 100) || "unknown"}`;
      if (!errorCounts.has(key)) {
        errorCounts.set(key, {
          error: error.error,
          count: 0,
          firstSeen: error.timestamp,
          lastSeen: error.timestamp,
          fixes: [],
        });
      }
      const entry = errorCounts.get(key);
      entry.count++;
      entry.lastSeen = Math.max(entry.lastSeen, error.timestamp);
      if (error.fix) {
        entry.fixes.push(error.fix);
      }
    });

    return Array.from(errorCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, limit)
      .map((entry) => ({
        error: entry.error,
        count: entry.count,
        firstSeen: new Date(entry.firstSeen).toISOString(),
        lastSeen: new Date(entry.lastSeen).toISOString(),
        fixSuccessRate:
          entry.fixes.length > 0
            ? (
                (entry.fixes.filter((f) => f.success).length /
                  entry.fixes.length) *
                100
              ).toFixed(1)
            : 0,
      }));
  }

  /**
   * Calculate average fix time
   */
  calculateAverageFixTime(errors) {
    const fixedErrors = errors.filter((e) => e.fix && e.fix.appliedAt);
    if (fixedErrors.length === 0) return 0;

    const totalTime = fixedErrors.reduce((sum, e) => {
      const fixTime = e.fix.appliedAt - e.timestamp;
      return sum + fixTime;
    }, 0);

    return Math.round(totalTime / fixedErrors.length);
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(stats, trends, learningStats) {
    const recommendations = [];

    // Check error rate trend
    const errorRateTrend = trends?.trends?.find((t) => t.type === "error-rate");
    if (
      errorRateTrend &&
      errorRateTrend.trend === "increasing" &&
      errorRateTrend.severity === "high"
    ) {
      recommendations.push({
        priority: "high",
        category: "error-rate",
        title: "Address Increasing Error Rate",
        description: `Error rate has increased by ${errorRateTrend.change}%. Investigate recent deployments or code changes.`,
        action:
          "Review recent code changes and deployments for potential issues",
      });
    }

    // Check fix success rate
    const fixRateTrend = trends?.trends?.find(
      (t) => t.type === "fix-success-rate",
    );
    if (fixRateTrend && fixRateTrend.trend === "declining") {
      recommendations.push({
        priority: "medium",
        category: "fix-quality",
        title: "Improve Fix Success Rate",
        description: `Fix success rate has declined by ${Math.abs(fixRateTrend.change)}%.`,
        action:
          "Review fix generation strategies and improve error pattern matching",
      });
    }

    // Check learning metrics
    if (learningStats && learningStats.averageQuality < 70) {
      recommendations.push({
        priority: "medium",
        category: "learning",
        title: "Improve Fix Quality",
        description: `Average fix quality is ${learningStats.averageQuality}%. Consider refining fix generation.`,
        action: "Review and improve fix generation prompts and patterns",
      });
    }

    // Check for recurring patterns
    if (stats && stats.uniquePatterns > 50) {
      recommendations.push({
        priority: "low",
        category: "patterns",
        title: "High Pattern Diversity",
        description: `Detected ${stats.uniquePatterns} unique error patterns. Consider root cause analysis.`,
        action: "Investigate common root causes across error patterns",
      });
    }

    return recommendations;
  }

  /**
   * Get time range in milliseconds
   */
  getTimeRangeMs(timeRange) {
    const ranges = {
      "1h": 60 * 60 * 1000,
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
      all: Infinity,
    };
    return ranges[timeRange] || ranges["24h"];
  }

  /**
   * Schedule automatic reports
   */
  scheduleReport(options) {
    // This would integrate with a job scheduler
    // For now, just return the report configuration
    return {
      scheduled: true,
      options,
      nextRun: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Daily
    };
  }
}

module.exports = new ErrorReportingService();

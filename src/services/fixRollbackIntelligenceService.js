/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixRollbackIntelligenceService.js
 * Last Sync: 2025-12-25T05:17:15.787Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Rollback Intelligence Service
 * Smart rollback detection and strategies
 *
 * Critical Missing Feature #3
 */

const config = require("../config");
const { createLogger } = require("../utils/logger");
const log = createLogger("FixRollbackIntelligenceService");
const fixVerificationService = require("./fixVerificationService");
const codebaseSearch = require("./codebaseSearch");
const { getSupabaseService } = require("../utils/supabaseClient");
const { getSupabaseClient } = require('../utils/supabaseClient');

class FixRollbackIntelligenceService {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = getSupabaseClient({ requireService: true }).serviceRoleKey,
        );
      } catch (error) {
        log.warn(
          "[fixRollbackIntelligenceService] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      log.warn(
        "[fixRollbackIntelligenceService] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * Monitor a fix for potential rollback
   */
  async monitorFix(fixId, fixData, context = {}) {
    const { filePath, originalCode, fixedCode, issue, projectId } = context;

    try {
      // Start monitoring
      this.monitoringActive.set(fixId, {
        fixId,
        filePath,
        originalCode,
        fixedCode,
        issue,
        projectId,
        appliedAt: Date.now(),
        checks: [],
        rollbackScore: 0,
      });

      // Schedule monitoring checks
      this.scheduleMonitoringChecks(fixId);

      return {
        success: true,
        monitoring: true,
        fixId,
        nextCheck: Date.now() + 300000, // 5 minutes
      };
    } catch (error) {
      console.error(
        "[Fix Rollback Intelligence] Error starting monitoring:",
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if a fix should be rolled back
   */
  async shouldRollback(fixId, context = {}) {
    const monitoring = this.monitoringActive.get(fixId);
    if (!monitoring) {
      return {
        shouldRollback: false,
        reason: "Fix not being monitored",
      };
    }

    try {
      // 1. Check for new errors in the file
      const newErrors = await this.checkForNewErrors(
        monitoring.filePath,
        monitoring.appliedAt,
      );

      // 2. Check for test failures
      const testFailures = await this.checkTestFailures(
        monitoring.filePath,
        monitoring.appliedAt,
      );

      // 3. Check for performance degradation
      const performanceIssues = await this.checkPerformanceIssues(
        monitoring.filePath,
        monitoring.appliedAt,
      );

      // 4. Check for cascade failures
      const cascadeFailures = await this.checkCascadeFailures(
        monitoring.filePath,
        monitoring.appliedAt,
      );

      // 5. Check historical rollback patterns
      const patternMatch = await this.checkRollbackPatterns(monitoring);

      // Calculate rollback score
      const rollbackScore = this.calculateRollbackScore({
        newErrors,
        testFailures,
        performanceIssues,
        cascadeFailures,
        patternMatch,
      });

      // Update monitoring
      monitoring.rollbackScore = rollbackScore;
      monitoring.checks.push({
        timestamp: Date.now(),
        rollbackScore,
        factors: {
          newErrors: newErrors.length,
          testFailures: testFailures.length,
          performanceIssues: performanceIssues.length,
          cascadeFailures: cascadeFailures.length,
        },
      });

      const shouldRollback = rollbackScore >= 0.7;

      return {
        shouldRollback,
        rollbackScore,
        confidence: this.calculateConfidence(monitoring.checks),
        reasons: this.getRollbackReasons({
          newErrors,
          testFailures,
          performanceIssues,
          cascadeFailures,
          patternMatch,
        }),
        recommendation: shouldRollback ? "rollback" : "monitor",
        strategy: shouldRollback ? this.getRollbackStrategy(monitoring) : null,
      };
    } catch (error) {
      console.error(
        "[Fix Rollback Intelligence] Error checking rollback:",
        error,
      );
      return {
        shouldRollback: false,
        error: error.message,
      };
    }
  }

  /**
   * Check for new errors in the file
   */
  async checkForNewErrors(filePath, appliedAt) {
    if (!this.supabase) return [];

    try {
      const { data, error } = await this.supabase
        .from("code_roach_issues")
        .select("*")
        .eq("error_file", filePath)
        .gt("created_at", new Date(appliedAt).toISOString())
        .in("error_severity", ["critical", "high"]);

      if (error) throw error;
      return data || [];
    } catch (error) {
      log.warn(
        "[Fix Rollback Intelligence] Error checking new errors:",
        error,
      );
      return [];
    }
  }

  /**
   * Check for test failures
   */
  async checkTestFailures(filePath, appliedAt) {
    try {
      // Check if tests are failing for this file
      // This would integrate with test runner
      // For now, check if there are test-related issues
      if (!this.supabase) return [];

      const { data, error } = await this.supabase
        .from("code_roach_issues")
        .select("*")
        .eq("error_file", filePath)
        .gt("created_at", new Date(appliedAt).toISOString())
        .or("error_type.eq.test,error_message.ilike.%test%");

      if (error) throw error;
      return data || [];
    } catch (error) {
      log.warn(
        "[Fix Rollback Intelligence] Error checking test failures:",
        error,
      );
      return [];
    }
  }

  /**
   * Check for performance issues
   */
  async checkPerformanceIssues(filePath, appliedAt) {
    try {
      if (!this.supabase) return [];

      const { data, error } = await this.supabase
        .from("code_roach_issues")
        .select("*")
        .eq("error_file", filePath)
        .gt("created_at", new Date(appliedAt).toISOString())
        .eq("error_type", "performance");

      if (error) throw error;
      return data || [];
    } catch (error) {
      log.warn(
        "[Fix Rollback Intelligence] Error checking performance:",
        error,
      );
      return [];
    }
  }

  /**
   * Check for cascade failures
   */
  async checkCascadeFailures(filePath, appliedAt) {
    try {
      // Find files that depend on this file
      const dependentFiles = await codebaseSearch.semanticSearch(
        `files that import or depend on ${require("path").basename(filePath)}`,
        { limit: 20, threshold: 0.6 },
      );

      if (!this.supabase || !dependentFiles.results) return [];

      const dependentPaths = dependentFiles.results.map((r) => r.file_path);
      if (dependentPaths.length === 0) return [];

      const { data, error } = await this.supabase
        .from("code_roach_issues")
        .select("*")
        .in("error_file", dependentPaths)
        .gt("created_at", new Date(appliedAt).toISOString())
        .in("error_severity", ["critical", "high"]);

      if (error) throw error;
      return data || [];
    } catch (error) {
      log.warn(
        "[Fix Rollback Intelligence] Error checking cascade failures:",
        error,
      );
      return [];
    }
  }

  /**
   * Check historical rollback patterns
   */
  async checkRollbackPatterns(monitoring) {
    try {
      // Find similar fixes that were rolled back
      const similarRollbacks = await this.findSimilarRollbacks(monitoring);

      if (similarRollbacks.length === 0) {
        return { match: false, confidence: 0 };
      }

      // Calculate pattern match
      const matchScore = this.calculatePatternMatch(
        monitoring,
        similarRollbacks,
      );

      return {
        match: matchScore > 0.6,
        confidence: matchScore,
        similarRollbacks: similarRollbacks.length,
      };
    } catch (error) {
      log.warn(
        "[Fix Rollback Intelligence] Error checking patterns:",
        error,
      );
      return { match: false, confidence: 0 };
    }
  }

  /**
   * Find similar fixes that were rolled back
   */
  async findSimilarRollbacks(monitoring) {
    if (!this.supabase) return [];

    try {
      // Query for rolled back fixes
      const { data, error } = await this.supabase
        .from("code_roach_issues")
        .select("*")
        .eq("error_type", monitoring.issue?.type || "")
        .eq("fix_applied", true)
        .not("review_status", "eq", "approved")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Filter for similar fixes (same error type, similar file patterns)
      const similar = (data || []).filter((issue) => {
        const filePattern = this.extractFilePattern(issue.error_file);
        const monitoringPattern = this.extractFilePattern(monitoring.filePath);
        return (
          filePattern === monitoringPattern ||
          issue.error_type === monitoring.issue?.type
        );
      });

      return similar;
    } catch (error) {
      log.warn(
        "[Fix Rollback Intelligence] Error finding similar rollbacks:",
        error,
      );
      return [];
    }
  }

  /**
   * Extract file pattern (e.g., "services/*.js")
   */
  extractFilePattern(filePath) {
    if (!filePath) return "";
    const parts = filePath.split("/");
    if (parts.length > 2) {
      return parts.slice(0, -1).join("/") + "/*";
    }
    return filePath;
  }

  /**
   * Calculate pattern match score
   */
  calculatePatternMatch(monitoring, similarRollbacks) {
    if (similarRollbacks.length === 0) return 0;

    // Simple scoring: more similar rollbacks = higher match
    const baseScore = Math.min(0.8, similarRollbacks.length * 0.1);

    // Check if error types match
    const typeMatch = similarRollbacks.some(
      (r) => r.error_type === monitoring.issue?.type,
    )
      ? 0.2
      : 0;

    return Math.min(1, baseScore + typeMatch);
  }

  /**
   * Calculate rollback score
   */
  calculateRollbackScore(factors) {
    const {
      newErrors,
      testFailures,
      performanceIssues,
      cascadeFailures,
      patternMatch,
    } = factors;

    let score = 0;

    // New errors (critical/high severity)
    if (newErrors.length > 0) {
      score += Math.min(0.4, newErrors.length * 0.1);
    }

    // Test failures
    if (testFailures.length > 0) {
      score += Math.min(0.3, testFailures.length * 0.15);
    }

    // Performance issues
    if (performanceIssues.length > 0) {
      score += Math.min(0.2, performanceIssues.length * 0.1);
    }

    // Cascade failures
    if (cascadeFailures.length > 0) {
      score += Math.min(0.3, cascadeFailures.length * 0.1);
    }

    // Pattern match
    if (patternMatch.match) {
      score += patternMatch.confidence * 0.2;
    }

    return Math.min(1, score);
  }

  /**
   * Calculate confidence in rollback decision
   */
  calculateConfidence(checks) {
    if (checks.length < 2) return "low";
    if (checks.length >= 5) return "high";
    return "medium";
  }

  /**
   * Get rollback reasons
   */
  getRollbackReasons(factors) {
    const reasons = [];

    if (factors.newErrors.length > 0) {
      reasons.push(`${factors.newErrors.length} new error(s) detected`);
    }

    if (factors.testFailures.length > 0) {
      reasons.push(`${factors.testFailures.length} test failure(s)`);
    }

    if (factors.performanceIssues.length > 0) {
      reasons.push(`${factors.performanceIssues.length} performance issue(s)`);
    }

    if (factors.cascadeFailures.length > 0) {
      reasons.push(
        `${factors.cascadeFailures.length} cascade failure(s) in dependent files`,
      );
    }

    if (factors.patternMatch.match) {
      reasons.push(
        `Similar fixes were rolled back (${factors.patternMatch.similarRollbacks} cases)`,
      );
    }

    return reasons;
  }

  /**
   * Get rollback strategy
   */
  getRollbackStrategy(monitoring) {
    const strategy = {
      type: "full", // 'full', 'partial', 'selective'
      steps: [],
      estimatedTime: 0,
    };

    // Determine strategy based on monitoring data
    if (monitoring.checks.length > 0) {
      const latestCheck = monitoring.checks[monitoring.checks.length - 1];

      if (latestCheck.factors.cascadeFailures > 0) {
        strategy.type = "full";
        strategy.steps = [
          "1. Rollback fix in original file",
          "2. Verify dependent files are working",
          "3. Investigate root cause",
          "4. Create new fix with better impact analysis",
        ];
        strategy.estimatedTime = 30; // minutes
      } else if (latestCheck.factors.testFailures > 0) {
        strategy.type = "selective";
        strategy.steps = [
          "1. Rollback fix",
          "2. Run test suite to verify",
          "3. Fix tests or adjust fix",
        ];
        strategy.estimatedTime = 15;
      } else {
        strategy.type = "partial";
        strategy.steps = [
          "1. Review specific changes",
          "2. Rollback problematic parts",
          "3. Keep working parts",
        ];
        strategy.estimatedTime = 10;
      }
    }

    return strategy;
  }

  /**
   * Execute rollback
   */
  async executeRollback(fixId, strategy = null) {
    const monitoring = this.monitoringActive.get(fixId);
    if (!monitoring) {
      return {
        success: false,
        error: "Fix not found in monitoring",
      };
    }

    try {
      // Get rollback strategy if not provided
      if (!strategy) {
        const rollbackCheck = await this.shouldRollback(fixId);
        strategy =
          rollbackCheck.strategy || this.getRollbackStrategy(monitoring);
      }

      // Restore original code
      const fs = require("fs").promises;
      await fs.writeFile(monitoring.filePath, monitoring.originalCode, "utf8");

      // Record rollback
      await this.recordRollback(fixId, monitoring, strategy);

      // Stop monitoring
      this.monitoringActive.delete(fixId);

      return {
        success: true,
        fixId,
        strategy: strategy.type,
        filePath: monitoring.filePath,
        rolledBackAt: Date.now(),
      };
    } catch (error) {
      console.error(
        "[Fix Rollback Intelligence] Error executing rollback:",
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Record rollback in database
   */
  async recordRollback(fixId, monitoring, strategy) {
    if (!this.supabase) return;

    try {
      // Update issue status
      await this.supabase
        .from("code_roach_issues")
        .update({
          review_status: "rejected",
          review_notes: `Rolled back: ${strategy.steps.join("; ")}`,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", fixId);

      // Store rollback pattern for learning
      const pattern = {
        fixId,
        filePath: monitoring.filePath,
        issueType: monitoring.issue?.type,
        rollbackReason: strategy.type,
        rollbackScore: monitoring.rollbackScore,
        timestamp: Date.now(),
      };

      this.rollbackPatterns.set(fixId, pattern);
    } catch (error) {
      log.warn(
        "[Fix Rollback Intelligence] Error recording rollback:",
        error,
      );
    }
  }

  /**
   * Schedule monitoring checks
   */
  scheduleMonitoringChecks(fixId) {
    // Check after 5 minutes
    setTimeout(async () => {
      const check = await this.shouldRollback(fixId);
      if (check.shouldRollback) {
        console.log(
          `[Fix Rollback Intelligence] Rollback recommended for fix ${fixId}`,
        );
        // Could auto-rollback or alert
      }
    }, 300000); // 5 minutes

    // Check after 1 hour
    setTimeout(async () => {
      const check = await this.shouldRollback(fixId);
      if (check.shouldRollback) {
        console.log(
          `[Fix Rollback Intelligence] Rollback recommended for fix ${fixId}`,
        );
      }
    }, 3600000); // 1 hour

    // Stop monitoring after 24 hours
    setTimeout(() => {
      this.monitoringActive.delete(fixId);
    }, 86400000); // 24 hours
  }

  /**
   * Get rollback statistics
   */
  async getRollbackStats(projectId = null) {
    if (!this.supabase) return null;

    try {
      let query = this.supabase
        .from("code_roach_issues")
        .select("*")
        .eq("fix_applied", true)
        .eq("review_status", "rejected");

      if (projectId) {
        // Would need project_id column
        // query = query.eq('project_id', projectId);
      }

      const { data, error } = await query;

      if (error) throw error;

      const total = data?.length || 0;
      const recent =
        data?.filter((d) => {
          const created = new Date(d.created_at);
          const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
          return created.getTime() > weekAgo;
        }).length || 0;

      return {
        totalRollbacks: total,
        recentRollbacks: recent,
        rollbackRate: total > 0 ? recent / total : 0,
      };
    } catch (error) {
      log.warn("[Fix Rollback Intelligence] Error getting stats:", error);
      return null;
    }
  }
}

module.exports = new FixRollbackIntelligenceService();

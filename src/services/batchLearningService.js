/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/batchLearningService.js
 * Last Sync: 2025-12-25T04:10:02.848Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Batch Learning Service
 * Teaches Code Roach from batch reviews and fixes
 * Learns patterns for automatic fixing and batching
 */

const agentKnowledgeService = require("./agentKnowledgeService");
const { createLogger } = require("../utils/logger");
const log = createLogger("BatchLearningService");
const fixLearningSystem = require("./fixLearningSystem");
const fixSuccessTracker = require("./fixSuccessTracker");
const { createClient } = require("@supabase/supabase-js");
const config = require("../config");
const { getSupabaseService } = require("../utils/supabaseClient");

class BatchLearningService {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = createClient(
          config.getSupabaseService().url,
          config.getSupabaseService().serviceRoleKey,
        );
      } catch (error) {
        console.warn(
          "[batchLearningService] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      console.warn(
        "[batchLearningService] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * Learn from a batch of fixes
   */
  async learnFromBatch(batchData) {
    const { issues, fixes, patterns = [], metadata = {} } = batchData;

    const results = {
      learned: 0,
      patterns: 0,
      errors: [],
    };

    try {
      // Learn from each fix
      for (const fix of fixes) {
        try {
          await this.learnFromFix(fix);
          results.learned++;
        } catch (err) {
          results.errors.push({ fix: fix.id, error: err.message });
        }
      }

      // Learn batch patterns
      if (patterns.length > 0) {
        for (const pattern of patterns) {
          try {
            await this.learnBatchPattern(pattern, issues, fixes);
            results.patterns++;
          } catch (err) {
            results.errors.push({ pattern: pattern.name, error: err.message });
          }
        }
      }

      // Record batch metadata
      await this.recordBatchMetadata(issues, fixes, metadata);

      return results;
    } catch (err) {
      console.error("[BatchLearning] Error learning from batch:", err);
      throw err;
    }
  }

  /**
   * Learn from a single fix
   */
  async learnFromFix(fixData) {
    const {
      issue,
      fix,
      filePath,
      success = true,
      confidence = 0.9,
      method = "manual",
      notes = "",
    } = fixData;

    if (!success) return; // Don't learn from failed fixes

    // Record to fix learning system
    await fixLearningSystem.recordFixAttempt({
      issue: {
        type: issue.type || issue.error?.type,
        message: issue.message || issue.error?.message,
        severity: issue.severity || issue.error?.severity,
      },
      fix: {
        code: fix.code || fix,
        type: fix.type || "manual",
        safety: fix.safety || "safe",
      },
      method,
      confidence,
      success: true,
      filePath: filePath || issue.file || issue.error?.file,
    });

    // Add to knowledge base if confidence is high
    if (confidence >= 0.7) {
      await fixSuccessTracker.recordSuccessfulFix({
        fix: fix.code || fix,
        error: issue.error || issue,
        filePath: filePath || issue.file || issue.error?.file,
        agentType: "batch-reviewer",
        confidence,
        applied: true,
      });
    }

    // Record to Supabase for tracking
    try {
      await this.supabase
        .from("code_roach_issues")
        .update({
          review_status: "approved",
          reviewed_at: new Date().toISOString(),
          review_notes: notes,
          fix_applied: true,
          fix_success: true,
          resolved_at: new Date().toISOString(),
        })
        .eq("id", issue.id || issue.error?.id);
    } catch (err) {
      console.warn("[BatchLearning] Failed to update Supabase:", err.message);
    }
  }

  /**
   * Learn batch processing patterns
   */
  async learnBatchPattern(pattern, issues, fixes) {
    const {
      name,
      description,
      criteria,
      action,
      successRate,
      examples = [],
    } = pattern;

    // Create pattern knowledge
    const patternContent = `
Batch Processing Pattern: ${name}

Description: ${description}

Criteria:
${JSON.stringify(criteria, null, 2)}

Action: ${action}

Success Rate: ${successRate}%

Examples:
${examples.map((ex, i) => `${i + 1}. ${ex}`).join("\n")}

This pattern can be used to automatically batch process similar issues.
`;

    await agentKnowledgeService.addKnowledge({
      type: "pattern",
      content: patternContent,
      sourceAgent: "batch-learning",
      confidence: Math.min(successRate / 100, 0.95),
      tags: ["batch", "pattern", "automation", name.toLowerCase()],
      metadata: {
        patternName: name,
        criteria,
        action,
        successRate,
        exampleCount: examples.length,
        learnedFrom: "batch-review",
      },
    });
  }

  /**
   * Record batch metadata for analytics
   */
  async recordBatchMetadata(issues, fixes, metadata) {
    try {
      const batchInfo = {
        timestamp: new Date().toISOString(),
        issueCount: issues.length,
        fixCount: fixes.length,
        successRate:
          fixes.length > 0
            ? (fixes.filter((f) => f.success !== false).length / fixes.length) *
              100
            : 0,
        bySeverity: {},
        byType: {},
        metadata,
      };

      // Analyze issues
      issues.forEach((issue) => {
        const severity = issue.error?.severity || issue.severity || "unknown";
        const type = issue.error?.type || issue.type || "unknown";
        batchInfo.bySeverity[severity] =
          (batchInfo.bySeverity[severity] || 0) + 1;
        batchInfo.byType[type] = (batchInfo.byType[type] || 0) + 1;
      });

      // Store in metadata table or log
      console.log(
        "[BatchLearning] Batch metadata:",
        JSON.stringify(batchInfo, null, 2),
      );
    } catch (err) {
      console.warn("[BatchLearning] Failed to record metadata:", err.message);
    }
  }

  /**
   * Generate batch processing rules from learned patterns
   */
  async generateBatchRules() {
    try {
      // Search for batch patterns in knowledge base
      const patterns = await agentKnowledgeService.searchKnowledge(
        "batch processing pattern automation",
        { knowledgeType: "pattern", limit: 20 },
      );

      const rules = patterns.map((pattern) => {
        const metadata = pattern.metadata || {};
        return {
          name: metadata.patternName || "Unknown Pattern",
          criteria: metadata.criteria || {},
          action: metadata.action || "review",
          confidence: pattern.confidence || 0.5,
          successRate: metadata.successRate || 0,
        };
      });

      return rules;
    } catch (err) {
      console.error("[BatchLearning] Error generating rules:", err);
      return [];
    }
  }

  /**
   * Auto-batch similar issues based on learned patterns
   */
  async autoBatchIssues(issues) {
    const rules = await this.generateBatchRules();
    const batches = {};

    for (const issue of issues) {
      // Match issue to rules
      for (const rule of rules) {
        if (this.matchesRule(issue, rule)) {
          const batchKey = `${rule.name}-${rule.action}`;
          if (!batches[batchKey]) {
            batches[batchKey] = {
              rule,
              issues: [],
            };
          }
          batches[batchKey].issues.push(issue);
          break;
        }
      }
    }

    return Object.values(batches);
  }

  /**
   * Check if issue matches rule criteria
   */
  matchesRule(issue, rule) {
    const criteria = rule.criteria || {};

    if (criteria.severity && issue.error?.severity !== criteria.severity) {
      return false;
    }
    if (criteria.type && issue.error?.type !== criteria.type) {
      return false;
    }
    if (criteria.hasFix !== undefined) {
      const hasFix = !!(issue.fix && issue.fix.code);
      if (hasFix !== criteria.hasFix) {
        return false;
      }
    }
    if (criteria.safety && issue.fix?.safety !== criteria.safety) {
      return false;
    }

    return true;
  }

  /**
   * Get learning statistics
   */
  async getLearningStats() {
    try {
      const fixStats = fixLearningSystem.getStats();

      // Get knowledge base stats
      const { data: kbStats } = await this.supabase
        .from("agent_knowledge_base")
        .select("knowledge_type")
        .eq("source_agent", "batch-reviewer");

      const batchPatterns = (kbStats || []).filter(
        (k) => k.knowledge_type === "pattern",
      ).length;
      const batchFixes = (kbStats || []).filter(
        (k) => k.knowledge_type === "fix",
      ).length;

      return {
        fixLearning: fixStats,
        knowledgeBase: {
          batchPatterns,
          batchFixes,
          total: kbStats?.length || 0,
        },
      };
    } catch (err) {
      console.error("[BatchLearning] Error getting stats:", err);
      return null;
    }
  }
}

module.exports = new BatchLearningService();

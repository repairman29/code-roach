/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/expertLearningService.js
 * Last Sync: 2025-12-25T07:02:34.027Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Expert Learning Service
 * Self-learning system that improves experts based on fix success/failure
 */

const config = require("../config");
const { createLogger } = require("../utils/logger");
const log = createLogger("ExpertLearningService");
const customerExpertHelper = require("./customerExpertHelper");
const expertTrainingService = require("./expertTrainingService");
const { getSupabaseService } = require("../utils/supabaseClient");
const { getSupabaseClient } = require('../utils/supabaseClient');

class ExpertLearningService {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = getSupabaseClient({ requireService: true }).serviceRoleKey,
        );
      } catch (error) {
        log.warn(
          "[expertLearningService] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      log.warn(
        "[expertLearningService] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * Record fix outcome for learning
   * @param {string} projectId - Project ID
   * @param {string} expertType - Expert type used
   * @param {Object} fixResult - Fix result with outcome
   */
  async recordFixOutcome(projectId, expertType, fixResult) {
    if (!this.supabase) return;

    try {
      const {
        issue,
        fix,
        outcome, // 'success', 'failure', 'partial'
        confidence,
        userFeedback,
        applied,
        reverted,
      } = fixResult;

      // Store learning data
      const { error } = await this.supabase
        .from("expert_learning_data")
        .insert({
          project_id: projectId,
          expert_type: expertType,
          issue_type: issue?.type || issue?.error_type,
          issue_message: issue?.message || issue?.error_message,
          fix_code: fix?.code || fix?.fixedCode,
          outcome: outcome || (applied && !reverted ? "success" : "failure"),
          confidence: confidence || fix?.confidence,
          user_feedback: userFeedback,
          applied: applied || false,
          reverted: reverted || false,
          recorded_at: new Date().toISOString(),
        });

      if (error) {
        log.warn("[Expert Learning] Error recording outcome:", error);
      } else {
        // Trigger learning analysis if we have enough data
        await this.analyzeAndImprove(projectId, expertType);
      }
    } catch (err) {
      log.warn("[Expert Learning] Error recording fix outcome:", err);
    }
  }

  /**
   * Analyze fix outcomes and improve experts
   */
  async analyzeAndImprove(projectId, expertType) {
    if (!this.supabase) return;

    try {
      // Get recent outcomes for this expert
      const { data: outcomes, error } = await this.supabase
        .from("expert_learning_data")
        .select("*")
        .eq("project_id", projectId)
        .eq("expert_type", expertType)
        .order("recorded_at", { ascending: false })
        .limit(50);

      if (error || !outcomes || outcomes.length < 10) {
        // Not enough data yet
        return;
      }

      // Calculate success rate
      const successCount = outcomes.filter(
        (o) => o.outcome === "success",
      ).length;
      const successRate = successCount / outcomes.length;

      // If success rate is low, trigger expert update
      if (successRate < 0.6) {
        console.log(
          `[Expert Learning] Low success rate (${successRate.toFixed(2)}) for ${expertType}, triggering update...`,
        );
        await this.triggerExpertUpdate(projectId, expertType, outcomes);
      }

      // Update expert quality score based on outcomes
      await this.updateExpertQualityScore(projectId, expertType, successRate);
    } catch (err) {
      log.warn("[Expert Learning] Error analyzing outcomes:", err);
    }
  }

  /**
   * Trigger expert update based on learning
   */
  async triggerExpertUpdate(projectId, expertType, outcomes) {
    try {
      // Get current expert
      const { data: currentExpert } = await this.supabase
        .from("customer_expert_guides")
        .select("*")
        .eq("project_id", projectId)
        .eq("expert_type", expertType)
        .single();

      if (!currentExpert) return;

      // Analyze common failure patterns
      const failures = outcomes.filter((o) => o.outcome === "failure");
      const commonIssues = this.identifyCommonIssues(failures);

      // Get codebase analysis
      const { data: analysis } = await this.supabase
        .from("customer_codebase_analysis")
        .select("*")
        .eq("project_id", projectId)
        .single();

      if (!analysis) return;

      // Update expert guide with learned patterns
      const updatedGuide = await this.updateGuideWithLearning(
        currentExpert.guide_content,
        commonIssues,
        outcomes,
      );

      // Update expert in database
      const newQualityScore = this.calculateUpdatedQualityScore(
        currentExpert.quality_score,
        outcomes,
      );

      await this.supabase
        .from("customer_expert_guides")
        .update({
          guide_content: updatedGuide,
          quality_score: newQualityScore,
          updated_at: new Date().toISOString(),
        })
        .eq("project_id", projectId)
        .eq("expert_type", expertType);

      console.log(
        `[Expert Learning] Updated ${expertType} expert (new quality: ${newQualityScore.toFixed(2)})`,
      );
    } catch (err) {
      log.warn("[Expert Learning] Error updating expert:", err);
    }
  }

  /**
   * Identify common issues from failures
   */
  identifyCommonIssues(failures) {
    const issuePatterns = {};

    failures.forEach((failure) => {
      const issueType = failure.issue_type || "unknown";
      if (!issuePatterns[issueType]) {
        issuePatterns[issueType] = {
          count: 0,
          messages: [],
          fixes: [],
        };
      }
      issuePatterns[issueType].count++;
      if (failure.issue_message) {
        issuePatterns[issueType].messages.push(failure.issue_message);
      }
      if (failure.fix_code) {
        issuePatterns[issueType].fixes.push(failure.fix_code);
      }
    });

    return issuePatterns;
  }

  /**
   * Update guide with learned patterns
   */
  async updateGuideWithLearning(currentGuide, commonIssues, outcomes) {
    // Add troubleshooting section with learned issues
    if (!currentGuide.troubleshooting) {
      currentGuide.troubleshooting = [];
    }

    // Add learned patterns to troubleshooting
    Object.entries(commonIssues).forEach(([issueType, data]) => {
      if (data.count >= 3) {
        // Only add if it's a recurring issue
        currentGuide.troubleshooting.push({
          issue: issueType,
          frequency: data.count,
          common_causes: this.extractCommonCauses(data.messages),
          learned_solutions: this.extractLearnedSolutions(data.fixes),
        });
      }
    });

    // Update best practices based on successful fixes
    const successes = outcomes.filter((o) => o.outcome === "success");
    if (successes.length > 0 && !currentGuide.learned_best_practices) {
      currentGuide.learned_best_practices =
        this.extractBestPractices(successes);
    }

    return currentGuide;
  }

  /**
   * Extract common causes from failure messages
   */
  extractCommonCauses(messages) {
    // Simple keyword extraction
    const keywords = {};
    messages.forEach((msg) => {
      const words = msg.toLowerCase().split(/\s+/);
      words.forEach((word) => {
        if (word.length > 4) {
          keywords[word] = (keywords[word] || 0) + 1;
        }
      });
    });

    return Object.entries(keywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }

  /**
   * Extract learned solutions from successful fixes
   */
  extractLearnedSolutions(fixes) {
    // Return common fix patterns
    return fixes.slice(0, 3).map((fix) => ({
      pattern: fix.substring(0, 100),
      success_rate: 1.0,
    }));
  }

  /**
   * Extract best practices from successful fixes
   */
  extractBestPractices(successes) {
    return successes
      .filter((s) => s.confidence && s.confidence > 0.8)
      .slice(0, 5)
      .map((s) => ({
        pattern: s.fix_code?.substring(0, 100) || "High confidence fix",
        confidence: s.confidence,
      }));
  }

  /**
   * Update expert quality score based on outcomes
   */
  async updateExpertQualityScore(projectId, expertType, successRate) {
    try {
      const { data: expert } = await this.supabase
        .from("customer_expert_guides")
        .select("quality_score")
        .eq("project_id", projectId)
        .eq("expert_type", expertType)
        .single();

      if (!expert) return;

      // Adjust quality score based on success rate
      // If success rate is high, increase quality; if low, decrease
      const adjustment = (successRate - 0.7) * 0.1; // Max ±0.1 adjustment
      const newScore = Math.max(
        0,
        Math.min(1, (expert.quality_score || 0.5) + adjustment),
      );

      await this.supabase
        .from("customer_expert_guides")
        .update({
          quality_score: newScore,
          updated_at: new Date().toISOString(),
        })
        .eq("project_id", projectId)
        .eq("expert_type", expertType);
    } catch (err) {
      log.warn("[Expert Learning] Error updating quality score:", err);
    }
  }

  /**
   * Calculate updated quality score
   */
  calculateUpdatedQualityScore(currentScore, outcomes) {
    const successRate =
      outcomes.filter((o) => o.outcome === "success").length / outcomes.length;
    const adjustment = (successRate - 0.7) * 0.1;
    return Math.max(0, Math.min(1, (currentScore || 0.5) + adjustment));
  }

  /**
   * Get learning statistics
   */
  async getLearningStats(projectId, expertType = null) {
    if (!this.supabase) return null;

    try {
      let query = this.supabase
        .from("expert_learning_data")
        .select("*")
        .eq("project_id", projectId);

      if (expertType) {
        query = query.eq("expert_type", expertType);
      }

      const { data: outcomes, error } = await query;

      if (error || !outcomes) return null;

      const total = outcomes.length;
      const success = outcomes.filter((o) => o.outcome === "success").length;
      const failure = outcomes.filter((o) => o.outcome === "failure").length;
      const successRate = total > 0 ? success / total : 0;

      // Group by expert type
      const byExpertType = {};
      outcomes.forEach((o) => {
        if (!byExpertType[o.expert_type]) {
          byExpertType[o.expert_type] = { total: 0, success: 0, failure: 0 };
        }
        byExpertType[o.expert_type].total++;
        if (o.outcome === "success") byExpertType[o.expert_type].success++;
        if (o.outcome === "failure") byExpertType[o.expert_type].failure++;
      });

      return {
        total,
        success,
        failure,
        successRate,
        byExpertType,
      };
    } catch (err) {
      log.warn("[Expert Learning] Error getting stats:", err);
      return null;
    }
  }
}

module.exports = new ExpertLearningService();

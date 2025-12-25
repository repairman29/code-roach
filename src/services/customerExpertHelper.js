/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/customerExpertHelper.js
 * Last Sync: 2025-12-25T07:02:34.027Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Customer Expert Helper Service
 * Helper service to get and use customer-specific expert guides
 */

const config = require("../config");
const { getSupabaseService } = require("../utils/supabaseClient");
const { createLogger } = require("../utils/logger");
const { getSupabaseClient } = require('../utils/supabaseClient');
const log = createLogger("CustomerExpertHelper");

class CustomerExpertHelper {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = getSupabaseClient({ requireService: true }).serviceRoleKey,
        );
      } catch (error) {
        log.warn(
          "[customerExpertHelper] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      log.warn(
        "[customerExpertHelper] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * Get customer experts for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Object>} Map of expert_type -> expert guide
   */
  async getCustomerExperts(projectId) {
    if (!projectId || !this.supabase) {
      return {};
    }

    // Check cache
    const cacheKey = `experts-${projectId}`;
    const cached = this.expertCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.experts;
    }

    try {
      const { data, error } = await this.supabase
        .from("customer_expert_guides")
        .select("*")
        .eq("project_id", projectId)
        .gt("quality_score", 0.5); // Only get quality experts

      if (error) {
        log.warn("[Customer Expert Helper] Error fetching experts:", error);
        return {};
      }

      // Convert to map
      const experts = {};
      if (data) {
        data.forEach((expert) => {
          experts[expert.expert_type] = {
            guide: expert.guide_content,
            quick_reference: expert.quick_reference,
            helper_service: expert.helper_service_code,
            integration_guide: expert.integration_guide,
            quality_score: expert.quality_score,
          };
        });
      }

      // Cache results
      this.expertCache.set(cacheKey, {
        experts,
        timestamp: Date.now(),
      });

      return experts;
    } catch (err) {
      log.warn(
        "[Customer Expert Helper] Error getting customer experts:",
        err,
      );
      return {};
    }
  }

  /**
   * Get relevant expert for an issue
   * @param {string} projectId - Project ID
   * @param {Object} issue - Issue object
   * @returns {Promise<Object|null>} Relevant expert or null
   */
  async getRelevantExpert(projectId, issue) {
    const experts = await this.getCustomerExperts(projectId);
    if (!experts || Object.keys(experts).length === 0) {
      return null;
    }

    // Determine expert type from issue
    const expertType = this.determineExpertType(issue);
    return experts[expertType] || null;
  }

  /**
   * Determine expert type from issue
   */
  determineExpertType(issue) {
    const errorType = issue.error_type || issue.type || "";
    const message = (issue.error_message || issue.message || "").toLowerCase();
    const filePath = (issue.file_path || issue.file || "").toLowerCase();

    // Database-related
    if (
      errorType.includes("database") ||
      errorType.includes("sql") ||
      message.includes("database") ||
      message.includes("sql") ||
      message.includes("postgres") ||
      message.includes("supabase")
    ) {
      return "database";
    }

    // Testing-related
    if (
      errorType.includes("test") ||
      filePath.includes("test") ||
      filePath.includes("spec")
    ) {
      return "testing";
    }

    // Security-related
    if (
      errorType.includes("security") ||
      errorType.includes("auth") ||
      message.includes("security") ||
      message.includes("auth") ||
      message.includes("xss") ||
      message.includes("csrf")
    ) {
      return "security";
    }

    // API-related
    if (
      errorType.includes("api") ||
      filePath.includes("api") ||
      filePath.includes("route")
    ) {
      return "api";
    }

    // Framework-specific (check file path)
    if (filePath.includes("react") || filePath.includes("component")) {
      return "framework-react";
    }
    if (filePath.includes("express") || filePath.includes("server")) {
      return "framework-express";
    }

    // Default to code-style
    return "code-style";
  }

  /**
   * Build expert context for LLM prompts
   * @param {string} projectId - Project ID
   * @param {Object} issue - Issue object
   * @returns {Promise<string>} Expert context string
   */
  async buildExpertContext(projectId, issue) {
    const expert = await this.getRelevantExpert(projectId, issue);
    if (!expert) {
      return "";
    }

    // Build context from expert guide
    let context = `\n## Customer-Specific Expert Context\n`;
    context += `Expert Type: ${this.determineExpertType(issue)}\n`;
    context += `Quality Score: ${expert.quality_score}\n\n`;

    // Add relevant sections from guide
    if (expert.guide) {
      if (expert.guide.overview) {
        context += `### Overview\n${expert.guide.overview}\n\n`;
      }
      if (
        expert.guide.best_practices &&
        expert.guide.best_practices.length > 0
      ) {
        context += `### Best Practices\n`;
        expert.guide.best_practices.slice(0, 3).forEach((practice) => {
          context += `- ${practice}\n`;
        });
        context += `\n`;
      }
    }

    // Add quick reference if available
    if (expert.quick_reference && expert.quick_reference.common_patterns) {
      context += `### Common Patterns\n`;
      expert.quick_reference.common_patterns.slice(0, 2).forEach((pattern) => {
        context += `- ${pattern.title || pattern}\n`;
      });
      context += `\n`;
    }

    return context;
  }

  /**
   * Clear cache for a project
   */
  clearCache(projectId) {
    if (projectId) {
      this.expertCache.delete(`experts-${projectId}`);
    } else {
      this.expertCache.clear();
    }
  }
}

module.exports = new CustomerExpertHelper();

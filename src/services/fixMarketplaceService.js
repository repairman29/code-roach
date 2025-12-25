/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixMarketplaceService.js
 * Last Sync: 2025-12-25T04:10:02.888Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Marketplace Service
 * Community fix pattern sharing and marketplace
 *
 * Improvement #3: Fix Marketplace & Community
 */

const { createClient } = require("@supabase/supabase-js");
const config = require("../config");
const { createLogger } = require("../utils/logger");
const log = createLogger("FixMarketplaceService");
const crossProjectLearningService = require("./crossProjectLearningService");
const { getSupabaseService } = require("../utils/supabaseClient");

class FixMarketplaceService {
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
          "[fixMarketplaceService] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      console.warn(
        "[fixMarketplaceService] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * List marketplace patterns
   */
  async listPatterns(options = {}) {
    const {
      limit = 50,
      offset = 0,
      sortBy = "rating", // 'rating', 'usage', 'recent', 'success_rate'
      minRating = 0,
      category = null,
      search = null,
    } = options;

    try {
      let query = this.supabase
        .from("code_roach_patterns")
        .select("*")
        .eq("shared", true)
        .gt("success_count", 0);

      // Filter by category
      if (category) {
        query = query.eq("pattern_metadata->>category", category);
      }

      // Search
      if (search) {
        query = query.or(
          `error_pattern->>type.ilike.%${search}%,error_pattern->>message.ilike.%${search}%`,
        );
      }

      // Sort
      switch (sortBy) {
        case "rating":
          query = query.order("success_count", { ascending: false });
          break;
        case "usage":
          query = query.order("occurrence_count", { ascending: false });
          break;
        case "recent":
          query = query.order("last_seen", { ascending: false });
          break;
        case "success_rate":
          // Would need calculated field
          query = query.order("success_count", { ascending: false });
          break;
      }

      const { data, error } = await query.range(offset, offset + limit - 1);

      if (error) throw error;

      // Enhance with ratings and metadata
      const patterns = (data || [])
        .map((pattern) => this.enhancePattern(pattern))
        .filter((p) => p.rating >= minRating);

      return {
        success: true,
        patterns,
        total: patterns.length,
        limit,
        offset,
      };
    } catch (error) {
      console.error("[Fix Marketplace] Error listing patterns:", error);
      return {
        success: false,
        error: error.message,
        patterns: [],
      };
    }
  }

  /**
   * Enhance pattern with marketplace data
   */
  enhancePattern(pattern) {
    const successRate =
      pattern.occurrence_count > 0
        ? (pattern.success_count || 0) / pattern.occurrence_count
        : 0;

    const rating = this.calculateRating(pattern, successRate);
    const usageCount = pattern.occurrence_count || 0;
    const projectsUsed = pattern.pattern_metadata?.projectsUsed || 1;

    return {
      ...pattern,
      rating,
      successRate,
      usageCount,
      projectsUsed,
      marketplace: {
        featured: rating >= 0.8 && usageCount >= 10,
        verified: projectsUsed >= 5,
        trending: this.isTrending(pattern),
      },
    };
  }

  /**
   * Calculate pattern rating
   */
  calculateRating(pattern, successRate) {
    // Weighted rating: success rate (70%) + usage (20%) + recency (10%)
    const usageScore = Math.min(1, (pattern.occurrence_count || 0) / 100);
    const recencyScore = this.calculateRecencyScore(pattern.last_seen);

    return successRate * 0.7 + usageScore * 0.2 + recencyScore * 0.1;
  }

  /**
   * Calculate recency score
   */
  calculateRecencyScore(lastSeen) {
    if (!lastSeen) return 0;

    const daysSince =
      (Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24);

    if (daysSince < 7) return 1.0;
    if (daysSince < 30) return 0.8;
    if (daysSince < 90) return 0.6;
    if (daysSince < 180) return 0.4;
    return 0.2;
  }

  /**
   * Check if pattern is trending
   */
  isTrending(pattern) {
    // Pattern is trending if used frequently recently
    const daysSince =
      (Date.now() - new Date(pattern.last_seen).getTime()) /
      (1000 * 60 * 60 * 24);
    const recentUsage =
      pattern.occurrence_count > 0
        ? (pattern.occurrence_count || 0) / Math.max(1, daysSince)
        : 0;

    return recentUsage > 1; // More than 1 usage per day
  }

  /**
   * Submit pattern to marketplace
   */
  async submitPattern(pattern, projectId, options = {}) {
    const {
      makePublic = true,
      category = "general",
      description = null,
      tags = [],
    } = options;

    try {
      if (!this.supabase) {
        return { success: false, error: "Database not available" };
      }

      // Anonymize pattern
      const anonymized = crossProjectLearningService.anonymizePattern
        ? await crossProjectLearningService.anonymizePattern(pattern)
        : pattern;

      // Prepare marketplace entry
      const marketplacePattern = {
        ...anonymized,
        project_id: projectId,
        shared: makePublic,
        shared_at: new Date().toISOString(),
        pattern_metadata: {
          ...(pattern.pattern_metadata || {}),
          marketplace: {
            category,
            description,
            tags,
            submittedAt: new Date().toISOString(),
            public: makePublic,
          },
        },
      };

      // Upsert pattern
      const { data, error } = await this.supabase
        .from("code_roach_patterns")
        .upsert(marketplacePattern, { onConflict: "fingerprint" })
        .select()
        .single();

      if (error) throw error;

      return {
        success: true,
        pattern: data,
        message: makePublic
          ? "Pattern submitted to marketplace"
          : "Pattern saved (not public)",
      };
    } catch (error) {
      console.error("[Fix Marketplace] Error submitting pattern:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Rate a pattern
   */
  async ratePattern(patternId, rating, userId, comment = null) {
    try {
      if (!this.supabase) {
        return { success: false, error: "Database not available" };
      }

      // Store rating (would need ratings table)
      // For now, update pattern metadata
      const { data: pattern, error: fetchError } = await this.supabase
        .from("code_roach_patterns")
        .select("pattern_metadata")
        .eq("fingerprint", patternId)
        .single();

      if (fetchError) throw fetchError;

      const metadata = pattern.pattern_metadata || {};
      if (!metadata.ratings) {
        metadata.ratings = [];
      }

      metadata.ratings.push({
        userId,
        rating,
        comment,
        timestamp: new Date().toISOString(),
      });

      // Calculate average rating
      const avgRating =
        metadata.ratings.reduce((sum, r) => sum + r.rating, 0) /
        metadata.ratings.length;

      const { error: updateError } = await this.supabase
        .from("code_roach_patterns")
        .update({
          pattern_metadata: {
            ...metadata,
            averageRating: avgRating,
            ratingCount: metadata.ratings.length,
          },
        })
        .eq("fingerprint", patternId);

      if (updateError) throw updateError;

      return {
        success: true,
        averageRating: avgRating,
        ratingCount: metadata.ratings.length,
      };
    } catch (error) {
      console.error("[Fix Marketplace] Error rating pattern:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get pattern details
   */
  async getPatternDetails(patternId) {
    try {
      if (!this.supabase) {
        return { success: false, error: "Database not available" };
      }

      const { data, error } = await this.supabase
        .from("code_roach_patterns")
        .select("*")
        .eq("fingerprint", patternId)
        .single();

      if (error) throw error;

      const enhanced = this.enhancePattern(data);

      return {
        success: true,
        pattern: enhanced,
      };
    } catch (error) {
      console.error("[Fix Marketplace] Error getting pattern details:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Search marketplace
   */
  async searchMarketplace(query, options = {}) {
    const { limit = 20, category = null, minRating = 0 } = options;

    try {
      return await this.listPatterns({
        search: query,
        limit,
        category,
        minRating,
        sortBy: "rating",
      });
    } catch (error) {
      return {
        success: false,
        error: error.message,
        patterns: [],
      };
    }
  }

  /**
   * Get featured patterns
   */
  async getFeaturedPatterns(limit = 10) {
    try {
      const result = await this.listPatterns({
        limit,
        sortBy: "rating",
        minRating: 0.7,
      });

      if (result.success) {
        return {
          success: true,
          patterns: result.patterns.filter((p) => p.marketplace.featured),
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        patterns: [],
      };
    }
  }

  /**
   * Get trending patterns
   */
  async getTrendingPatterns(limit = 10) {
    try {
      const result = await this.listPatterns({
        limit: limit * 2, // Get more to filter
        sortBy: "recent",
      });

      if (result.success) {
        return {
          success: true,
          patterns: result.patterns
            .filter((p) => p.marketplace.trending)
            .slice(0, limit),
        };
      }

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        patterns: [],
      };
    }
  }

  /**
   * Get categories
   */
  async getCategories() {
    try {
      if (!this.supabase) {
        return { success: false, error: "Database not available" };
      }

      const { data, error } = await this.supabase
        .from("code_roach_patterns")
        .select("pattern_metadata")
        .eq("shared", true);

      if (error) throw error;

      const categories = new Map();
      (data || []).forEach((pattern) => {
        const category =
          pattern.pattern_metadata?.marketplace?.category || "general";
        const count = categories.get(category) || 0;
        categories.set(category, count + 1);
      });

      return {
        success: true,
        categories: Array.from(categories.entries()).map(([name, count]) => ({
          name,
          count,
        })),
      };
    } catch (error) {
      console.error("[Fix Marketplace] Error getting categories:", error);
      return {
        success: false,
        error: error.message,
        categories: [],
      };
    }
  }
}

module.exports = new FixMarketplaceService();

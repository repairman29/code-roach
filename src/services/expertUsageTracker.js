/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/expertUsageTracker.js
 * Last Sync: 2025-12-25T07:02:34.028Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Expert Usage Tracker
 * Tracks when experts are used in fix generation
 */

const config = require("../config");
const { getSupabaseService } = require("../utils/supabaseClient");
const { createLogger } = require("../utils/logger");
const { getSupabaseClient } = require('../utils/supabaseClient');
const log = createLogger("ExpertUsageTracker");

class ExpertUsageTracker {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = getSupabaseClient({ requireService: true }).serviceRoleKey,
        );
      } catch (error) {
        log.warn(
          "[expertUsageTracker] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      log.warn(
        "[expertUsageTracker] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * Track expert usage
   */
  async trackUsage(projectId, expertType) {
    if (!this.supabase || !projectId || !expertType) return;

    try {
      await this.supabase
        .from("expert_usage_tracking")
        .upsert(
          {
            project_id: projectId,
            expert_type: expertType,
            usage_count: this.getSupabaseService().rpc("increment", { n: 1 }),
            last_used_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "project_id,expert_type",
            // Increment usage_count
            ignoreDuplicates: false,
          },
        )
        .catch(async () => {
          // Fallback: get current count and increment
          const { data: current } = await this.supabase
            .from("expert_usage_tracking")
            .select("usage_count")
            .eq("project_id", projectId)
            .eq("expert_type", expertType)
            .single();

          await this.supabase.from("expert_usage_tracking").upsert(
            {
              project_id: projectId,
              expert_type: expertType,
              usage_count: (current?.usage_count || 0) + 1,
              last_used_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "project_id,expert_type",
            },
          );
        });
    } catch (err) {
      // Silently fail - tracking is non-critical
    }
  }

  /**
   * Track fix outcome
   */
  async trackOutcome(projectId, expertType, success) {
    if (!this.supabase || !projectId || !expertType) return;

    try {
      await this.supabase
        .from("expert_usage_tracking")
        .upsert(
          {
            project_id: projectId,
            expert_type: expertType,
            success_count: success
              ? this.getSupabaseService().rpc("increment", { n: 1 })
              : undefined,
            failure_count: !success
              ? this.getSupabaseService().rpc("increment", { n: 1 })
              : undefined,
            updated_at: new Date().toISOString(),
          },
          {
            onConflict: "project_id,expert_type",
          },
        )
        .catch(async () => {
          // Fallback: get current counts and increment
          const { data: current } = await this.supabase
            .from("expert_usage_tracking")
            .select("success_count, failure_count")
            .eq("project_id", projectId)
            .eq("expert_type", expertType)
            .single();

          await this.supabase.from("expert_usage_tracking").upsert(
            {
              project_id: projectId,
              expert_type: expertType,
              success_count: success
                ? (current?.success_count || 0) + 1
                : current?.success_count || 0,
              failure_count: !success
                ? (current?.failure_count || 0) + 1
                : current?.failure_count || 0,
              updated_at: new Date().toISOString(),
            },
            {
              onConflict: "project_id,expert_type",
            },
          );
        });
    } catch (err) {
      // Silently fail
    }
  }

  /**
   * Get usage statistics
   */
  async getUsageStats(projectId) {
    if (!this.supabase || !projectId) return null;

    try {
      const { data, error } = await this.supabase
        .from("expert_usage_tracking")
        .select("*")
        .eq("project_id", projectId)
        .order("usage_count", { ascending: false });

      if (error) return null;

      return data || [];
    } catch (err) {
      return null;
    }
  }
}

module.exports = new ExpertUsageTracker();

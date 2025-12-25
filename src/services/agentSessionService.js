/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/agentSessionService.js
 * Last Sync: 2025-12-25T04:10:02.841Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Agent Session Service
 * Manages persistent agent memory across sessions
 */

const { createClient } = require("@supabase/supabase-js");
const config = require("../config");
const { getSupabaseService } = require("../utils/supabaseClient");
const { createLogger } = require("../utils/logger");
const log = createLogger("AgentSessionService");

class AgentSessionService {
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
          "[AgentSessionService] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      console.warn(
        "[AgentSessionService] Supabase credentials not configured. Agent session service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * Get or create agent session
   */
  async getOrCreateSession(agentType, sessionId, context = {}) {
    if (!this.supabase) {
      console.warn(
        "[AgentSessionService] Cannot get session: Supabase not configured",
      );
      return null;
    }
    try {
      const { data, error } = await this.getSupabaseService().rpc(
        "get_or_create_agent_session",
        {
          p_agent_type: agentType,
          p_session_id: sessionId,
          p_context: context,
        },
      );

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("[AgentSessionService] Error getting session:", error);
      return null;
    }
  }

  /**
   * Record successful action
   */
  async recordSuccess(agentType, sessionId, action) {
    if (!this.supabase) return false;
    try {
      const { error } = await this.getSupabaseService().rpc(
        "record_agent_success",
        {
          p_agent_type: agentType,
          p_session_id: sessionId,
          p_action: action,
        },
      );

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("[AgentSessionService] Error recording success:", error);
      return false;
    }
  }

  /**
   * Record failed action
   */
  async recordFailure(agentType, sessionId, action) {
    if (!this.supabase) return false;
    try {
      const { error } = await this.getSupabaseService().rpc(
        "record_agent_failure",
        {
          p_agent_type: agentType,
          p_session_id: sessionId,
          p_action: action,
        },
      );

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("[AgentSessionService] Error recording failure:", error);
      return false;
    }
  }

  /**
   * Record agent decision
   */
  async recordDecision(decision) {
    if (!this.supabase) return false;
    try {
      const { error } = await this.supabase.from("agent_decisions").insert({
        agent_type: decision.agentType,
        session_id: decision.sessionId,
        decision_type: decision.decisionType,
        input_context: decision.inputContext || {},
        decision_made: decision.decisionMade || {},
        outcome: decision.outcome,
        confidence: decision.confidence,
        time_taken_ms: decision.timeTakenMs,
        error_message: decision.errorMessage,
        metadata: decision.metadata || {},
      });

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("[AgentSessionService] Error recording decision:", error);
      return false;
    }
  }

  /**
   * Get learned patterns from session
   */
  async getLearnedPatterns(agentType, sessionId) {
    if (!this.supabase) return { patterns: [], successfulActions: [] };
    try {
      const { data, error } = await this.supabase
        .from("agent_sessions")
        .select("learned_patterns, successful_actions")
        .eq("agent_type", agentType)
        .eq("session_id", sessionId)
        .single();

      if (error) throw error;
      return {
        patterns: data?.learned_patterns || [],
        successfulActions: data?.successful_actions || [],
      };
    } catch (error) {
      console.error("[AgentSessionService] Error getting patterns:", error);
      return { patterns: [], successfulActions: [] };
    }
  }

  /**
   * Get decision statistics
   */
  async getDecisionStats(agentType, days = 7) {
    if (!this.supabase) return [];
    try {
      const { data, error } = await this.getSupabaseService().rpc(
        "get_agent_decision_stats",
        {
          p_agent_type: agentType,
          p_days: days,
        },
      );

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error("[AgentSessionService] Error getting stats:", error);
      return [];
    }
  }
}

module.exports = new AgentSessionService();

/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/agentKnowledgeService.js
 * Last Sync: 2025-12-25T05:17:15.764Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Agent Knowledge Base Service
 * Shared knowledge repository for all AI agents
 */

const config = require("../config");
const { createLogger } = require("../utils/logger");
const log = createLogger("AgentKnowledgeService");
const codebaseSearch = require("./codebaseSearch");
const { getSupabaseService } = require("../utils/supabaseClient");
const { getSupabaseClient } = require('../utils/supabaseClient');

class AgentKnowledgeService {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = getSupabaseClient({ requireService: true }).serviceRoleKey,
        );
      } catch (error) {
        log.warn(
          "[AgentKnowledgeService] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      log.warn(
        "[AgentKnowledgeService] Supabase credentials not configured. Knowledge service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * Search knowledge base semantically
   */
  async searchKnowledge(query, options = {}) {
    if (!this.supabase) {
      log.warn(
        "[AgentKnowledgeService] Cannot search: Supabase not configured",
      );
      return [];
    }
    const { knowledgeType = null, threshold = 0.7, limit = 10 } = options;

    try {
      // Generate embedding for query
      const embedding = await codebaseSearch.generateQueryEmbedding(query);

      // Search knowledge base
      const { data, error } = await this.getSupabaseService().rpc(
        "search_agent_knowledge",
        {
          query_embedding: embedding,
          knowledge_type_filter: knowledgeType,
          match_threshold: threshold,
          match_count: limit,
        },
      );

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(
        "[AgentKnowledgeService] Error searching knowledge:",
        error,
      );
      return [];
    }
  }

  /**
   * Add knowledge to base
   */
  async addKnowledge(knowledge) {
    try {
      // Generate embedding if content provided
      let embedding = null;
      if (knowledge.content) {
        embedding = await codebaseSearch.generateQueryEmbedding(
          knowledge.content,
        );
      }

      const { data, error } = await this.supabase
        .from("agent_knowledge_base")
        .insert({
          knowledge_type: knowledge.type,
          content: knowledge.content,
          embedding: embedding,
          source_agent: knowledge.sourceAgent,
          confidence: knowledge.confidence || 0.5,
          tags: knowledge.tags || [],
          metadata: knowledge.metadata || {},
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error("[AgentKnowledgeService] Error adding knowledge:", error);
      return null;
    }
  }

  /**
   * Record knowledge usage
   */
  async recordUsage(knowledgeId, success) {
    try {
      if (!this.supabase) {
        return false;
      }
      const { error } = await this.getSupabaseService().rpc(
        "record_knowledge_usage",
        {
          p_knowledge_id: knowledgeId,
          p_success: success,
        },
      );

      if (error) throw error;
      return true;
    } catch (error) {
      console.error("[AgentKnowledgeService] Error recording usage:", error);
      return false;
    }
  }

  /**
   * Get best knowledge for task type
   */
  async getBestKnowledge(knowledgeType, limit = 5) {
    try {
      const { data, error } = await this.getSupabaseService().rpc(
        "get_best_knowledge",
        {
          p_knowledge_type: knowledgeType,
          p_limit: limit,
        },
      );

      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error(
        "[AgentKnowledgeService] Error getting best knowledge:",
        error,
      );
      return [];
    }
  }
}

module.exports = new AgentKnowledgeService();

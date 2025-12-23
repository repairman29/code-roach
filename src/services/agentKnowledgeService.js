/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/agentKnowledgeService.js
 * Last Sync: 2025-12-20T22:26:03.324Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Agent Knowledge Base Service
 * Shared knowledge repository for all AI agents
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const codebaseSearch = require('./codebaseSearch');

class AgentKnowledgeService {
    constructor() {
        // Only create Supabase client if credentials are available
        if (config.supabase.serviceRoleKey) {
            try {
                this.supabase = createClient(
                    config.supabase.url,
                    config.supabase.serviceRoleKey
                );
            } catch (error) {
                console.warn('[AgentKnowledgeService] Supabase not configured:', error.message);
                this.supabase = null;
            }
        } else {
            console.warn('[AgentKnowledgeService] Supabase credentials not configured. Knowledge service will be disabled.');
            this.supabase = null;
        }
    }

    /**
     * Search knowledge base semantically
     */
    async searchKnowledge(query, options = {}) {
        if (!this.supabase) {
            console.warn('[AgentKnowledgeService] Cannot search: Supabase not configured');
            return [];
        }
        const {
            knowledgeType = null,
            threshold = 0.7,
            limit = 10
        } = options;

        try {
            // Generate embedding for query
            const embedding = await codebaseSearch.generateQueryEmbedding(query);

            // Search knowledge base
            const { data, error } = await this.supabase.rpc('search_agent_knowledge', {
                query_embedding: embedding,
                knowledge_type_filter: knowledgeType,
                match_threshold: threshold,
                match_count: limit
            });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[AgentKnowledgeService] Error searching knowledge:', error);
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
                embedding = await codebaseSearch.generateQueryEmbedding(knowledge.content);
            }

            const { data, error } = await this.supabase
                .from('agent_knowledge_base')
                .insert({
                    knowledge_type: knowledge.type,
                    content: knowledge.content,
                    embedding: embedding,
                    source_agent: knowledge.sourceAgent,
                    confidence: knowledge.confidence || 0.5,
                    tags: knowledge.tags || [],
                    metadata: knowledge.metadata || {}
                })
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('[AgentKnowledgeService] Error adding knowledge:', error);
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
            const { error } = await this.supabase.rpc('record_knowledge_usage', {
                p_knowledge_id: knowledgeId,
                p_success: success
            });

            if (error) throw error;
            return true;
        } catch (error) {
            console.error('[AgentKnowledgeService] Error recording usage:', error);
            return false;
        }
    }

    /**
     * Get best knowledge for task type
     */
    async getBestKnowledge(knowledgeType, limit = 5) {
        try {
            const { data, error } = await this.supabase.rpc('get_best_knowledge', {
                p_knowledge_type: knowledgeType,
                p_limit: limit
            });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('[AgentKnowledgeService] Error getting best knowledge:', error);
            return [];
        }
    }
}

module.exports = new AgentKnowledgeService();

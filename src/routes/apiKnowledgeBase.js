/**
 * Knowledge Base API Routes
 * Provides endpoints for knowledge base analytics and management
 */

const express = require('express');
const router = express.Router();
const agentKnowledgeService = require('../services/agentKnowledgeService');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

const supabase = createClient(
    config.supabase.url,
    config.supabase.serviceRoleKey
);

// Simple logger fallback
const log = {
    info: (...args) => console.log('[INFO]', ...args),
    error: (...args) => console.error('[ERROR]', ...args),
    warn: (...args) => console.warn('[WARN]', ...args)
};

/**
 * GET /api/knowledge-base/stats
 * Get knowledge base statistics
 */
router.get('/stats', async (req, res) => {
    try {
        const { data: allKnowledge, error } = await supabase
            .from('agent_knowledge_base')
            .select('*');

        if (error) throw error;

        // Calculate statistics
        const stats = {
            total: allKnowledge.length,
            byType: {},
            bySource: {},
            avgConfidence: 0,
            avgSuccessRate: 0,
            avgUsage: 0,
            topKnowledge: []
        };

        let totalConfidence = 0;
        let totalSuccessRate = 0;
        let totalUsage = 0;

        for (const item of allKnowledge) {
            // By type
            stats.byType[item.knowledge_type] = (stats.byType[item.knowledge_type] || 0) + 1;

            // By source
            stats.bySource[item.source_agent] = (stats.bySource[item.source_agent] || 0) + 1;

            // Averages
            if (item.confidence) totalConfidence += item.confidence;
            if (item.success_rate) totalSuccessRate += item.success_rate;
            if (item.usage_count) totalUsage += item.usage_count;
        }

        stats.avgConfidence = allKnowledge.length > 0 ? totalConfidence / allKnowledge.length : 0;
        stats.avgSuccessRate = allKnowledge.length > 0 ? totalSuccessRate / allKnowledge.length : 0;
        stats.avgUsage = allKnowledge.length > 0 ? totalUsage / allKnowledge.length : 0;

        // Top knowledge by success rate and usage
        stats.topKnowledge = allKnowledge
            .filter(k => k.usage_count > 0)
            .sort((a, b) => {
                const scoreA = (a.success_rate || 0) * (a.confidence || 0) * (a.usage_count || 0);
                const scoreB = (b.success_rate || 0) * (b.confidence || 0) * (b.usage_count || 0);
                return scoreB - scoreA;
            })
            .slice(0, 10)
            .map(k => ({
                id: k.id,
                type: k.knowledge_type,
                content: k.content.substring(0, 200),
                successRate: k.success_rate,
                confidence: k.confidence,
                usageCount: k.usage_count
            }));

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        log.error('Error getting knowledge base stats:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/knowledge-base/effectiveness
 * Get knowledge base effectiveness metrics
 */
router.get('/effectiveness', async (req, res) => {
    try {
        const days = parseInt(req.query.days) || 7;

        // Get decisions that used knowledge base
        const { data: decisions, error } = await supabase
            .from('agent_decisions')
            .select('*')
            .gte('created_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString());

        if (error) throw error;

        const effectiveness = {
            totalDecisions: decisions.length,
            decisionsWithKnowledge: 0,
            avgConfidence: 0,
            successRate: 0,
            byAgent: {}
        };

        let totalConfidence = 0;
        let successful = 0;
        let withKnowledge = 0;

        for (const decision of decisions) {
            // Check if decision used knowledge (via metadata)
            const usedKnowledge = decision.metadata?.usedLearnedFixes || 
                                 decision.metadata?.knowledgeId ||
                                 false;

            if (usedKnowledge) {
                withKnowledge++;
            }

            if (decision.outcome === 'success') {
                successful++;
            }

            if (decision.confidence) {
                totalConfidence += decision.confidence;
            }

            // By agent
            if (!effectiveness.byAgent[decision.agent_type]) {
                effectiveness.byAgent[decision.agent_type] = {
                    total: 0,
                    withKnowledge: 0,
                    success: 0
                };
            }
            effectiveness.byAgent[decision.agent_type].total++;
            if (usedKnowledge) {
                effectiveness.byAgent[decision.agent_type].withKnowledge++;
            }
            if (decision.outcome === 'success') {
                effectiveness.byAgent[decision.agent_type].success++;
            }
        }

        effectiveness.decisionsWithKnowledge = withKnowledge;
        effectiveness.avgConfidence = decisions.length > 0 ? totalConfidence / decisions.length : 0;
        effectiveness.successRate = decisions.length > 0 ? (successful / decisions.length) * 100 : 0;

        // Calculate success rates by agent
        for (const [agent, data] of Object.entries(effectiveness.byAgent)) {
            data.successRate = data.total > 0 ? (data.success / data.total) * 100 : 0;
            data.knowledgeUsageRate = data.total > 0 ? (data.withKnowledge / data.total) * 100 : 0;
        }

        res.json({
            success: true,
            data: effectiveness
        });
    } catch (error) {
        log.error('Error getting effectiveness:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/knowledge-base/top
 * Get top knowledge items by various metrics
 */
router.get('/top', async (req, res) => {
    try {
        const metric = req.query.metric || 'success'; // success, usage, confidence
        const limit = parseInt(req.query.limit) || 10;

        let orderBy = 'success_rate';
        if (metric === 'usage') orderBy = 'usage_count';
        if (metric === 'confidence') orderBy = 'confidence';

        const { data, error } = await supabase
            .from('agent_knowledge_base')
            .select('*')
            .order(orderBy, { ascending: false })
            .limit(limit);

        if (error) throw error;

        res.json({
            success: true,
            data: data.map(k => ({
                id: k.id,
                type: k.knowledge_type,
                content: k.content.substring(0, 300),
                sourceAgent: k.source_agent,
                confidence: k.confidence,
                successRate: k.success_rate,
                usageCount: k.usage_count,
                tags: k.tags
            }))
        });
    } catch (error) {
        log.error('Error getting top knowledge:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

module.exports = router;

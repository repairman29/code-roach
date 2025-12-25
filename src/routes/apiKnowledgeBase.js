/**
 * Knowledge Base API Routes
 * Provides endpoints for knowledge base analytics and management
 */

const { log } = require("../utils/logger");
const express = require("express");
const { createLogger } = require("../utils/logger");
const log = createLogger("ApiKnowledgeBase");
const router = express.Router();
const agentKnowledgeService = require("../services/agentKnowledgeService");

// Use shared Supabase client utility
const {
  getSupabaseService,
  isSupabaseConfigured,
} = require("../utils/supabaseClient");

// Standardized response utilities
const { asyncHandler } = require("../utils/errorHandler");
const { sendSuccess } = require("../utils/responseHandler");

// Log Supabase status on load
if (!isSupabaseConfigured()) {
  console.warn(
    "[apiKnowledgeBase] Supabase config not available - knowledge base endpoints will return empty results",
  );
}

// Helper to get Supabase client lazily
const getSupabase = () => getSupabaseService();

// Helper to check if error is a "table not found" type error
const isTableNotFoundError = (error) => {
  return (
    error?.message &&
    (error.message.includes("does not exist") ||
      error.message.includes("relation") ||
      error.message.includes("Invalid API key") ||
      error.message.includes("JWT") ||
      error.code === "PGRST116" ||
      error.code === "42P01")
  );
};

// Empty stats response for when KB is not configured
const emptyStats = {
  total: 0,
  byType: {},
  bySource: {},
  avgConfidence: 0,
  avgSuccessRate: 0,
  avgUsage: 0,
  topKnowledge: [],
};

// Empty effectiveness response
const emptyEffectiveness = {
  totalDecisions: 0,
  decisionsWithKnowledge: 0,
  avgConfidence: 0,
  successRate: 0,
  byAgent: {},
};

/**
 * GET /api/knowledge-base/stats
 * Get knowledge base statistics
 */
router.get(
  "/stats",
  asyncHandler(async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) {
      return sendSuccess(res, emptyStats);
    }

    const { data: allKnowledge, error } = await supabase
      .from("agent_knowledge_base")
      .select("*");

    if (error) {
      if (isTableNotFoundError(error)) {
        return sendSuccess(res, emptyStats);
      }
      throw error;
    }

    // Calculate statistics
    const stats = {
      total: allKnowledge.length,
      byType: {},
      bySource: {},
      avgConfidence: 0,
      avgSuccessRate: 0,
      avgUsage: 0,
      topKnowledge: [],
    };

    let totalConfidence = 0;
    let totalSuccessRate = 0;
    let totalUsage = 0;

    for (const item of allKnowledge) {
      stats.byType[item.knowledge_type] =
        (stats.byType[item.knowledge_type] || 0) + 1;
      stats.bySource[item.source_agent] =
        (stats.bySource[item.source_agent] || 0) + 1;
      if (item.confidence) totalConfidence += item.confidence;
      if (item.success_rate) totalSuccessRate += item.success_rate;
      if (item.usage_count) totalUsage += item.usage_count;
    }

    stats.avgConfidence =
      allKnowledge.length > 0 ? totalConfidence / allKnowledge.length : 0;
    stats.avgSuccessRate =
      allKnowledge.length > 0 ? totalSuccessRate / allKnowledge.length : 0;
    stats.avgUsage =
      allKnowledge.length > 0 ? totalUsage / allKnowledge.length : 0;

    stats.topKnowledge = allKnowledge
      .filter((k) => k.usage_count > 0)
      .sort((a, b) => {
        const scoreA =
          (a.success_rate || 0) * (a.confidence || 0) * (a.usage_count || 0);
        const scoreB =
          (b.success_rate || 0) * (b.confidence || 0) * (b.usage_count || 0);
        return scoreB - scoreA;
      })
      .slice(0, 10)
      .map((k) => ({
        id: k.id,
        type: k.knowledge_type,
        content: k.content.substring(0, 200),
        successRate: k.success_rate,
        confidence: k.confidence,
        usageCount: k.usage_count,
      }));

    sendSuccess(res, stats);
  }),
);

/**
 * GET /api/knowledge-base/effectiveness
 * Get knowledge base effectiveness metrics
 */
router.get(
  "/effectiveness",
  asyncHandler(async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) {
      return sendSuccess(res, emptyEffectiveness);
    }

    const days = parseInt(req.query.days) || 7;

    const { data: decisions, error } = await supabase
      .from("agent_decisions")
      .select("*")
      .gte(
        "created_at",
        new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString(),
      );

    if (error) {
      if (isTableNotFoundError(error)) {
        return sendSuccess(res, emptyEffectiveness);
      }
      throw error;
    }

    const effectiveness = {
      totalDecisions: decisions.length,
      decisionsWithKnowledge: 0,
      avgConfidence: 0,
      successRate: 0,
      byAgent: {},
    };

    let totalConfidence = 0;
    let successful = 0;
    let withKnowledge = 0;

    for (const decision of decisions) {
      const usedKnowledge =
        decision.metadata?.usedLearnedFixes ||
        decision.metadata?.knowledgeId ||
        false;

      if (usedKnowledge) withKnowledge++;
      if (decision.outcome === "success") successful++;
      if (decision.confidence) totalConfidence += decision.confidence;

      if (!effectiveness.byAgent[decision.agent_type]) {
        effectiveness.byAgent[decision.agent_type] = {
          total: 0,
          withKnowledge: 0,
          success: 0,
        };
      }
      effectiveness.byAgent[decision.agent_type].total++;
      if (usedKnowledge)
        effectiveness.byAgent[decision.agent_type].withKnowledge++;
      if (decision.outcome === "success")
        effectiveness.byAgent[decision.agent_type].success++;
    }

    effectiveness.decisionsWithKnowledge = withKnowledge;
    effectiveness.avgConfidence =
      decisions.length > 0 ? totalConfidence / decisions.length : 0;
    effectiveness.successRate =
      decisions.length > 0 ? (successful / decisions.length) * 100 : 0;

    for (const [agent, data] of Object.entries(effectiveness.byAgent)) {
      data.successRate = data.total > 0 ? (data.success / data.total) * 100 : 0;
      data.knowledgeUsageRate =
        data.total > 0 ? (data.withKnowledge / data.total) * 100 : 0;
    }

    sendSuccess(res, effectiveness);
  }),
);

/**
 * GET /api/knowledge-base/top
 * Get top knowledge items by various metrics
 */
router.get(
  "/top",
  asyncHandler(async (req, res) => {
    const supabase = getSupabase();
    if (!supabase) {
      return sendSuccess(res, []);
    }

    const metric = req.query.metric || "success";
    const limit = parseInt(req.query.limit) || 10;

    let orderBy = "success_rate";
    if (metric === "usage") orderBy = "usage_count";
    if (metric === "confidence") orderBy = "confidence";

    const { data, error } = await supabase
      .from("agent_knowledge_base")
      .select("*")
      .order(orderBy, { ascending: false })
      .limit(limit);

    if (error) {
      if (isTableNotFoundError(error)) {
        return sendSuccess(res, []);
      }
      throw error;
    }

    sendSuccess(
      res,
      data.map((k) => ({
        id: k.id,
        type: k.knowledge_type,
        content: k.content.substring(0, 300),
        sourceAgent: k.source_agent,
        confidence: k.confidence,
        successRate: k.success_rate,
        usageCount: k.usage_count,
        tags: k.tags,
      })),
    );
  }),
);

/**
 * GET /api/knowledge-base
 * Root endpoint - returns basic knowledge base info
 */
router.get(
  "/",
  asyncHandler(async (req, res) => {
    const endpoints = {
      stats: "/api/knowledge-base/stats",
      effectiveness: "/api/knowledge-base/effectiveness",
      top: "/api/knowledge-base/top",
      search: "/api/knowledge-base/search",
    };

    const supabase = getSupabase();
    if (!supabase) {
      return sendSuccess(res, {
        total: 0,
        items: [],
        endpoints,
        note: "Knowledge base not configured",
      });
    }

    const { data: allKnowledge, error } = await supabase
      .from("agent_knowledge_base")
      .select("id, knowledge_type, content, created_at")
      .limit(100);

    if (error) {
      if (isTableNotFoundError(error)) {
        log.warn("Knowledge base not available:", error.message);
        return sendSuccess(res, {
          total: 0,
          items: [],
          endpoints,
          note: "Knowledge base not configured",
        });
      }
      throw error;
    }

    sendSuccess(res, {
      total: allKnowledge ? allKnowledge.length : 0,
      items: (allKnowledge || []).map((k) => ({
        id: k.id,
        type: k.knowledge_type,
        preview: k.content ? k.content.substring(0, 200) : "",
        createdAt: k.created_at,
      })),
      endpoints,
    });
  }),
);

/**
 * GET /api/knowledge-base/search
 * Search knowledge base content
 */
router.get(
  "/search",
  asyncHandler(async (req, res) => {
    const query = req.query.q || "";
    if (!query) {
      return sendSuccess(res, []);
    }

    const supabase = getSupabase();
    if (!supabase) {
      return sendSuccess(res, []);
    }

    const { data, error } = await supabase
      .from("agent_knowledge_base")
      .select("*")
      .ilike("content", `%${query}%`)
      .limit(20);

    if (error) {
      if (isTableNotFoundError(error)) {
        return sendSuccess(res, []);
      }
      throw error;
    }

    sendSuccess(
      res,
      data.map((k) => ({
        id: k.id,
        type: k.knowledge_type,
        content: k.content.substring(0, 500),
        sourceAgent: k.source_agent,
        confidence: k.confidence,
        successRate: k.success_rate,
        usageCount: k.usage_count,
      })),
    );
  }),
);

module.exports = router;

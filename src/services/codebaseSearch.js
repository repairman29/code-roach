/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/codebaseSearch.js
 * Last Sync: 2025-12-25T04:10:02.825Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Codebase Search Service
 * Provides semantic search capabilities over indexed codebase
 */

const { createClient } = require("@supabase/supabase-js");
const config = require("../config");
const performanceTrackingService = require("./performanceTrackingService");
const { createLogger } = require("../utils/logger");

const log = createLogger("CodebaseSearch");

class CodebaseSearch {
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
          "[CodebaseSearch] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      console.warn(
        "[CodebaseSearch] Supabase credentials not configured. Codebase search will be disabled.",
      );
      this.supabase = null;
    }
    this.openaiApiKey =
      process.env.OPENAI_API_KEY || config.imageGeneration?.openai?.apiKey;
  }

  /**
   * Generate embedding for search query
   */
  async generateQueryEmbedding(query) {
    if (!this.openaiApiKey) {
      throw new Error("OpenAI API key not found");
    }

    const startTime = Date.now();
    try {
      const response = await fetch("https://api.openai.com/v1/embeddings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.openaiApiKey}`,
        },
        body: JSON.stringify({
          model: "text-embedding-3-small",
          input: query,
        }),
      });

      if (!response.ok) {
        const error = await response
          .json()
          .catch(() => ({ error: "Unknown error" }));
        throw new Error(`OpenAI API error: ${JSON.stringify(error)}`);
      }

      const data = await response.json();
      const executionTime = Date.now() - startTime;
      const tokensUsed = data.usage?.total_tokens || 0;

      // SPRINT 4: Track embedding API cost
      // text-embedding-3-small: $0.02 per 1M tokens
      const embeddingCost = (tokensUsed / 1000000) * 0.02;
      if (embeddingCost > 0 || tokensUsed > 0) {
        performanceTrackingService
          .trackAPICost({
            service: "openai",
            operationType: "embedding",
            costUsd: embeddingCost,
            tokensUsed: tokensUsed,
            cacheUsed: false,
            requestId: `embedding-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            metadata: {
              model: "text-embedding-3-small",
              executionTimeMs: executionTime,
            },
          })
          .catch((err) => {
            log.warn("Failed to track embedding cost:", err.message);
          });
      }

      return data.data[0].embedding;
    } catch (error) {
      log.error("Error generating query embedding:", error);
      throw error;
    }
  }

  /**
   * Semantic search using vector similarity
   */
  async semanticSearch(query, options = {}) {
    const {
      limit = 10,
      threshold = 0.3, // Lower default threshold for better results (0.3 = 30% similarity)
      fileFilter = null,
      languageFilter = null,
    } = options;

    if (!this.supabase) {
      log.warn(
        "[CodebaseSearch] Supabase not configured, using fallback search",
      );
      return await this.fallbackSearch(query, options);
    }

    const startTime = Date.now();
    let queryError = null;

    try {
      // Generate query embedding
      const queryEmbedding = await this.generateQueryEmbedding(query);

      // Build query
      let dbQuery = this.getSupabaseService().rpc("match_codebase_chunks", {
        query_embedding: queryEmbedding,
        match_threshold: threshold,
        match_count: limit,
      });

      // Apply filters if provided
      if (fileFilter) {
        dbQuery = this.supabase
          .from("codebase_index")
          .select("*")
          .eq("file_path", fileFilter);
      }

      if (languageFilter) {
        dbQuery = dbQuery.eq("metadata->>language", languageFilter);
      }

      const { data, error } = await dbQuery;
      const executionTime = Date.now() - startTime;

      // SPRINT 4: Track query performance
      try {
        await performanceTrackingService.logSlowQuery({
          queryType: "codebase_semantic_search",
          executionTimeMs: executionTime,
          rowsReturned: data?.length || 0,
          cacheHit: false,
          queryText: query.substring(0, 200),
          errorMessage: error?.message || null,
        });
      } catch (trackErr) {
        // Don't block on tracking errors
        log.warn("Failed to track query performance:", trackErr.message);
      }

      if (error) {
        queryError = error;
        // Fallback to simple text search if RPC doesn't exist yet
        log.warn(
          "RPC function not found, using fallback search:",
          error.message,
        );
        return await this.fallbackSearch(query, options);
      }

      return {
        results: data || [],
        query: query,
        count: data?.length || 0,
      };
    } catch (error) {
      log.error("Error in semantic search:", error);
      // Fallback to text search
      return await this.fallbackSearch(query, options);
    }
  }

  /**
   * Fallback text-based search
   */
  async fallbackSearch(query, options = {}) {
    const { limit = 10, fileFilter = null, languageFilter = null } = options;

    if (!this.supabase) {
      log.warn(
        "[CodebaseSearch] Supabase not configured, returning empty results",
      );
      return {
        results: [],
        query: query,
        count: 0,
        method: "text_search",
        error: "Supabase not configured",
      };
    }

    try {
      let dbQuery = this.supabase
        .from("codebase_index")
        .select("*")
        .ilike("search_text", `%${query}%`)
        .limit(limit);

      if (fileFilter) {
        dbQuery = dbQuery.eq("file_path", fileFilter);
      }

      if (languageFilter) {
        dbQuery = dbQuery.eq("metadata->>language", languageFilter);
      }

      const { data, error } = await dbQuery;

      if (error) {
        throw error;
      }

      return {
        results: data || [],
        query: query,
        count: data?.length || 0,
        method: "text_search",
      };
    } catch (error) {
      log.error("Error in fallback search:", error);
      return {
        results: [],
        query: query,
        count: 0,
        error: error.message,
      };
    }
  }

  /**
   * Hybrid search (semantic + keyword)
   * Now uses advanced hybrid retrieval service for better results
   */
  async hybridSearch(query, options = {}) {
    try {
      // Use advanced hybrid retrieval service if available
      const hybridRetrieval = require("./hybridRetrieval");
      const { getSupabaseService } = require("../utils/supabaseClient");
      return await hybridRetrieval.hybridSearch(query, options);
    } catch (error) {
      // Fallback to simple hybrid search
      log.warn(
        "[Codebase Search] Advanced hybrid retrieval not available, using fallback:",
        error.message,
      );
      return await this.simpleHybridSearch(query, options);
    }
  }

  /**
   * Simple hybrid search (fallback)
   */
  async simpleHybridSearch(query, options = {}) {
    const { limit = 10, semanticWeight = 0.7 } = options;

    // Get semantic results
    const semanticResults = await this.semanticSearch(query, {
      ...options,
      limit: limit * 2,
    });

    // Get keyword results
    const keywordResults = await this.fallbackSearch(query, {
      ...options,
      limit: limit * 2,
    });

    // Combine and deduplicate
    const resultMap = new Map();

    // Add semantic results with weight
    semanticResults.results.forEach((result, index) => {
      const key = `${result.file_path}:${result.line_start}`;
      resultMap.set(key, {
        ...result,
        score: (1 - index / semanticResults.results.length) * semanticWeight,
        source: "semantic",
      });
    });

    // Add keyword results with weight
    keywordResults.results.forEach((result, index) => {
      const key = `${result.file_path}:${result.line_start}`;
      const existing = resultMap.get(key);
      if (existing) {
        existing.score +=
          (1 - index / keywordResults.results.length) * (1 - semanticWeight);
        existing.source = "hybrid";
      } else {
        resultMap.set(key, {
          ...result,
          score:
            (1 - index / keywordResults.results.length) * (1 - semanticWeight),
          source: "keyword",
        });
      }
    });

    // Sort by score and limit
    const results = Array.from(resultMap.values())
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);

    return {
      results,
      query: query,
      count: results.length,
      method: "hybrid",
    };
  }

  /**
   * Find files by pattern
   */
  async findFiles(pattern) {
    if (!this.supabase) {
      log.warn(
        "[CodebaseSearch] Supabase not configured, returning empty file list",
      );
      return { files: [], count: 0, error: "Supabase not configured" };
    }
    try {
      const { data, error } = await this.supabase
        .from("codebase_index")
        .select("file_path")
        .ilike("file_path", `%${pattern}%`)
        .limit(100);

      if (error) throw error;

      // Get unique file paths
      const uniqueFiles = [...new Set(data.map((r) => r.file_path))];

      return {
        files: uniqueFiles,
        count: uniqueFiles.length,
      };
    } catch (error) {
      log.error("Error finding files:", error);
      return {
        files: [],
        count: 0,
        error: error.message,
      };
    }
  }

  /**
   * Get file context (all chunks for a file)
   */
  async getFileContext(filePath) {
    if (!this.supabase) {
      log.warn(
        "[CodebaseSearch] Supabase not configured, returning empty context",
      );
      return {
        file: filePath,
        chunks: [],
        count: 0,
        error: "Supabase not configured",
      };
    }
    const startTime = Date.now();
    try {
      const { data, error } = await this.supabase
        .from("codebase_index")
        .select("*")
        .eq("file_path", filePath)
        .order("line_start", { ascending: true });

      const executionTime = Date.now() - startTime;

      // SPRINT 4: Track query performance
      try {
        await performanceTrackingService.logSlowQuery({
          queryType: "codebase_get_file_context",
          executionTimeMs: executionTime,
          rowsReturned: data?.length || 0,
          cacheHit: false,
          queryText: `file_path=${filePath}`,
          errorMessage: error?.message || null,
        });
      } catch (trackErr) {
        log.warn("Failed to track query performance:", trackErr.message);
      }

      if (error) throw error;

      return {
        file: filePath,
        chunks: data || [],
        count: data?.length || 0,
      };
    } catch (error) {
      log.error("Error getting file context:", error);
      return {
        file: filePath,
        chunks: [],
        count: 0,
        error: error.message,
      };
    }
  }

  /**
   * Search for code patterns
   */
  async searchPattern(pattern, options = {}) {
    const { limit = 10, language = null } = options;

    if (!this.supabase) {
      log.warn(
        "[CodebaseSearch] Supabase not configured, returning empty results",
      );
      return {
        results: [],
        pattern: pattern,
        count: 0,
        error: "Supabase not configured",
      };
    }

    try {
      let query = this.supabase
        .from("codebase_index")
        .select("*")
        .ilike("content", `%${pattern}%`)
        .limit(limit);

      if (language) {
        query = query.eq("metadata->>language", language);
      }

      const { data, error } = await query;

      if (error) throw error;

      return {
        results: data || [],
        pattern: pattern,
        count: data?.length || 0,
      };
    } catch (error) {
      log.error("Error searching pattern:", error);
      return {
        results: [],
        pattern: pattern,
        count: 0,
        error: error.message,
      };
    }
  }
}

module.exports = new CodebaseSearch();

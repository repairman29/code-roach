/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/codeSimilarityDetector.js
 * Last Sync: 2025-12-25T07:02:33.976Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Code Similarity Detector Service
 * Finds duplicate/similar code patterns for refactoring opportunities
 * IP Innovation #13: Automated Code Deduplication
 */

const codebaseSearch = require("./codebaseSearch");
const { createLogger } = require("../utils/logger");
const log = createLogger("CodeSimilarityDetector");
const config = require("../config");
const { getSupabaseService } = require("../utils/supabaseClient");
const { getSupabaseClient } = require('../utils/supabaseClient');

class CodeSimilarityDetector {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = getSupabaseClient({ requireService: true }).serviceRoleKey,
        );
      } catch (error) {
        log.warn(
          "[codeSimilarityDetector] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      log.warn(
        "[codeSimilarityDetector] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * Find duplicates for a specific file
   * SPRINT 8: Added for refactoring service
   */
  async findDuplicates(filePath) {
    try {
      // Use semantic search to find similar code
      const results = await codebaseSearch.semanticSearch(
        `code similar to file ${filePath}`,
        { limit: 20 },
      );

      // Filter results from different files
      const duplicates = (results.results || []).filter(
        (r) => r.file_path && r.file_path !== filePath,
      );

      return duplicates.slice(0, 5); // Return top 5 duplicates
    } catch (error) {
      log.warn("[CodeSimilarityDetector] Error finding duplicates:", error);
      return [];
    }
  }

  /**
   * Find similar code patterns
   */
  async findSimilarCode(options = {}) {
    const {
      minSimilarity = 0.8,
      minOccurrences = 3,
      fileTypes = ["js", "ts"],
    } = options;

    console.log("[Code Similarity] Finding similar code patterns...");

    // Use codebase search embeddings to find similar code
    const results = await codebaseSearch.semanticSearch(
      "find duplicate or similar code patterns",
      { limit: 100 },
    );

    // Group by similarity
    const similarGroups = await this.groupBySimilarity(
      results.results,
      minSimilarity,
    );

    // Filter by minimum occurrences
    const duplicates = similarGroups.filter(
      (group) => group.length >= minOccurrences,
    );

    // Generate refactoring suggestions
    const suggestions = [];
    for (const group of duplicates) {
      const suggestion = await this.generateRefactoringSuggestion(group);
      if (suggestion) {
        suggestions.push(suggestion);
      }
    }

    return {
      duplicatesFound: duplicates.length,
      totalSimilarGroups: similarGroups.length,
      suggestions: suggestions.sort((a, b) => b.impact - a.impact),
    };
  }

  /**
   * Group code chunks by similarity
   */
  async groupBySimilarity(chunks, threshold) {
    const groups = [];
    const processed = new Set();

    for (let i = 0; i < chunks.length; i++) {
      if (processed.has(i)) continue;

      const group = [chunks[i]];
      processed.add(i);

      for (let j = i + 1; j < chunks.length; j++) {
        if (processed.has(j)) continue;

        const similarity = await this.calculateSimilarity(chunks[i], chunks[j]);
        if (similarity >= threshold) {
          group.push(chunks[j]);
          processed.add(j);
        }
      }

      if (group.length > 1) {
        groups.push(group);
      }
    }

    return groups;
  }

  /**
   * Calculate similarity between two code chunks
   */
  async calculateSimilarity(chunk1, chunk2) {
    // Use embedding similarity if available
    if (chunk1.embedding && chunk2.embedding) {
      return this.cosineSimilarity(chunk1.embedding, chunk2.embedding);
    }

    // Fallback to text similarity
    return this.textSimilarity(chunk1.content, chunk2.content);
  }

  /**
   * Cosine similarity
   */
  cosineSimilarity(vec1, vec2) {
    if (vec1.length !== vec2.length) return 0;

    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (let i = 0; i < vec1.length; i++) {
      dotProduct += vec1[i] * vec2[i];
      norm1 += vec1[i] * vec1[i];
      norm2 += vec2[i] * vec2[i];
    }

    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }

  /**
   * Text similarity (simplified)
   */
  textSimilarity(text1, text2) {
    // Simple Jaccard similarity
    const words1 = new Set(text1.toLowerCase().split(/\W+/));
    const words2 = new Set(text2.toLowerCase().split(/\W+/));

    const intersection = new Set([...words1].filter((x) => words2.has(x)));
    const union = new Set([...words1, ...words2]);

    return intersection.size / union.size;
  }

  /**
   * Generate refactoring suggestion
   */
  async generateRefactoringSuggestion(group) {
    // Analyze the group to suggest extraction
    const commonPattern = this.findCommonPattern(group);

    return {
      type: "extract-function",
      description: `Extract common pattern into shared function`,
      files: group.map((c) => c.file_path),
      occurrences: group.length,
      impact: group.length * 10, // Higher impact for more occurrences
      estimatedEffort: "medium",
      pattern: commonPattern,
    };
  }

  /**
   * Find common pattern in group
   */
  findCommonPattern(group) {
    // Find longest common substring or pattern
    // Simplified implementation
    return group[0].content.substring(0, 100);
  }
}

module.exports = new CodeSimilarityDetector();

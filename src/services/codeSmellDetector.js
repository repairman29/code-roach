/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/codeSmellDetector.js
 * Last Sync: 2025-12-25T07:02:33.977Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Code Smell Detector Service
 * Detects and fixes code smells automatically
 * IP Innovation #24: Automated Code Smell Remediation
 */

const config = require("../config");
const { createLogger } = require("../utils/logger");
const log = createLogger("CodeSmellDetector");
const codebaseSearch = require("./codebaseSearch");
const { getSupabaseService } = require("../utils/supabaseClient");
const { getSupabaseClient } = require('../utils/supabaseClient');

class CodeSmellDetector {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = getSupabaseClient({ requireService: true }).serviceRoleKey,
        );
      } catch (error) {
        log.warn(
          "[codeSmellDetector] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      log.warn(
        "[codeSmellDetector] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * Detect code smells in code
   */
  async detectCodeSmells(code, filePath) {
    const smells = [];

    for (const pattern of this.smellPatterns) {
      if (pattern.pattern && pattern.pattern.test(code)) {
        smells.push({
          type: pattern.name,
          severity: pattern.severity,
          fix: pattern.fix,
          description: this.getSmellDescription(pattern.name),
          location: this.findSmellLocation(code, pattern),
        });
      }
    }

    // Check for duplicate code
    const duplicates = await this.detectDuplicates(code, filePath);
    smells.push(...duplicates);

    return smells;
  }

  /**
   * Get smell description
   */
  getSmellDescription(type) {
    const descriptions = {
      "Long Method": "Method is too long and does too much",
      "Large Class": "Class has too many responsibilities",
      "Duplicate Code": "Code is duplicated across multiple locations",
      "Magic Numbers": "Numeric literals should be named constants",
      "Deep Nesting": "Code has too many nested levels",
    };
    return descriptions[type] || "Code smell detected";
  }

  /**
   * Find smell location in code
   */
  findSmellLocation(code, pattern) {
    // Find line number where pattern matches
    const lines = code.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (pattern.pattern && pattern.pattern.test(lines[i])) {
        return { line: i + 1, column: 1 };
      }
    }
    return { line: 1, column: 1 };
  }

  /**
   * Detect duplicate code
   */
  async detectDuplicates(code, filePath) {
    try {
      // Search for similar code in codebase
      const results = await codebaseSearch.semanticSearch(
        code.substring(0, 200),
        { limit: 10 },
      );

      const duplicates = results.results
        .filter((r) => r.file_path !== filePath && r.similarity > 0.8)
        .map((r) => ({
          type: "Duplicate Code",
          severity: "medium",
          fix: "extract-function",
          description: `Similar code found in ${r.file_path}`,
          location: { line: 1, column: 1 },
          similarFile: r.file_path,
        }));

      return duplicates;
    } catch (err) {
      log.warn("[Code Smell Detector] Error detecting duplicates:", err);
      return [];
    }
  }

  /**
   * Generate fix for code smell
   */
  async generateFix(smell, code, filePath) {
    switch (smell.fix) {
      case "extract-method":
        return await this.generateExtractMethodFix(smell, code);
      case "extract-constant":
        return await this.generateExtractConstantFix(smell, code);
      case "reduce-nesting":
        return await this.generateReduceNestingFix(smell, code);
      default:
        return null;
    }
  }

  /**
   * Generate extract method fix
   */
  async generateExtractMethodFix(smell, code) {
    // Simplified - would use LLM in production
    return {
      type: "extract-method",
      description: "Extract long method into smaller functions",
      code: code, // Would contain refactored code
      confidence: 0.7,
    };
  }

  /**
   * Generate extract constant fix
   */
  async generateExtractConstantFix(smell, code) {
    // Find magic numbers and suggest constants
    const magicNumbers = code.match(/\b\d{3,}\b/g);
    if (!magicNumbers) return null;

    return {
      type: "extract-constant",
      description: `Extract magic numbers: ${magicNumbers.join(", ")}`,
      code: code, // Would contain constants
      confidence: 0.9,
    };
  }

  /**
   * Generate reduce nesting fix
   */
  async generateReduceNestingFix(smell, code) {
    return {
      type: "reduce-nesting",
      description: "Reduce nesting levels using early returns",
      code: code, // Would contain refactored code
      confidence: 0.8,
    };
  }

  /**
   * Get code smells for entire codebase
   */
  async getCodebaseSmells() {
    if (!this.supabase) return [];

    try {
      // Get files with most issues (likely have smells)
      const { data, error } = await this.supabase
        .from("code_roach_issues")
        .select("error_file, COUNT(*)")
        .not("error_file", "is", null)
        .group("error_file")
        .order("count", { ascending: false })
        .limit(50);

      if (error) throw error;

      // Analyze each file for smells
      const allSmells = [];
      for (const file of data) {
        // Would read file and analyze
        // For now, return structure
        allSmells.push({
          file: file.error_file,
          issueCount: file.count,
          likelySmells: ["Long Method", "Duplicate Code"], // Simplified
        });
      }

      return allSmells;
    } catch (err) {
      console.error(
        "[Code Smell Detector] Error getting codebase smells:",
        err,
      );
      return [];
    }
  }
}

module.exports = new CodeSmellDetector();

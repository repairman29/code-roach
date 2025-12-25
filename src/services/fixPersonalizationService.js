/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixPersonalizationService.js
 * Last Sync: 2025-12-25T05:17:15.790Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Personalization Service
 * Adapt fixes to team preferences and coding style
 *
 * Improvement #5: Fix Personalization
 */

const config = require("../config");
const { createLogger } = require("../utils/logger");
const log = createLogger("FixPersonalizationService");
const codebaseSearch = require("./codebaseSearch");
const { getSupabaseService } = require("../utils/supabaseClient");
const { getSupabaseClient } = require('../utils/supabaseClient');

class FixPersonalizationService {
  constructor() {
    // Only create Supabase client if credentials are available
    if (config.getSupabaseService().serviceRoleKey) {
      try {
        this.supabase = getSupabaseClient({ requireService: true }).serviceRoleKey,
        );
      } catch (error) {
        log.warn(
          "[fixPersonalizationService] Supabase not configured:",
          error.message,
        );
        this.supabase = null;
      }
    } else {
      log.warn(
        "[fixPersonalizationService] Supabase credentials not configured. Service will be disabled.",
      );
      this.supabase = null;
    }
  }

  /**
   * Personalize fix based on team preferences
   */
  async personalizeFix(fix, context = {}) {
    const { projectId, teamId, filePath, originalCode } = context;

    try {
      // Get team profile
      const profile = await this.getTeamProfile(projectId, teamId);

      // Analyze codebase style
      const codebaseStyle = await this.analyzeCodebaseStyle(
        filePath,
        originalCode,
      );

      // Personalize fix
      const personalized = {
        ...fix,
        personalized: true,
        style: this.applyStylePreferences(fix, profile, codebaseStyle),
        preferences: this.applyPreferences(fix, profile),
        conventions: this.applyConventions(fix, codebaseStyle),
      };

      return {
        success: true,
        fix: personalized,
        profile: profile.summary,
      };
    } catch (error) {
      console.error("[Fix Personalization] Error personalizing fix:", error);
      return {
        success: false,
        error: error.message,
        fix: fix, // Return original if personalization fails
      };
    }
  }

  /**
   * Get team profile
   */
  async getTeamProfile(projectId, teamId) {
    const cacheKey = `${projectId}:${teamId}`;

    if (this.teamProfiles.has(cacheKey)) {
      return this.teamProfiles.get(cacheKey);
    }

    try {
      // Load from database or create default
      const profile =
        (await this.loadTeamProfile(projectId, teamId)) ||
        this.createDefaultProfile();

      this.teamProfiles.set(cacheKey, profile);
      return profile;
    } catch (error) {
      log.warn("[Fix Personalization] Error loading profile:", error);
      return this.createDefaultProfile();
    }
  }

  /**
   * Load team profile from database
   */
  async loadTeamProfile(projectId, teamId) {
    if (!this.supabase) return null;

    try {
      // Would query team_profiles table
      // For now, return null to use default
      return null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Create default profile
   */
  createDefaultProfile() {
    return {
      preferences: {
        fixStyle: "conservative", // 'conservative', 'aggressive', 'balanced'
        autoApply: false,
        requireReview: true,
        minConfidence: 0.8,
      },
      conventions: {
        naming: "camelCase",
        indentation: "spaces",
        quoteStyle: "single",
        semicolons: true,
        trailingCommas: true,
      },
      patterns: {
        errorHandling: "try-catch",
        asyncPattern: "async-await",
        testing: "jest",
      },
    };
  }

  /**
   * Analyze codebase style
   */
  async analyzeCodebaseStyle(filePath, code) {
    const style = {
      indentation: this.detectIndentation(code),
      quoteStyle: this.detectQuoteStyle(code),
      semicolons: this.detectSemicolons(code),
      trailingCommas: this.detectTrailingCommas(code),
      naming: this.detectNamingConvention(code),
      errorHandling: this.detectErrorHandlingPattern(code),
      asyncPattern: this.detectAsyncPattern(code),
    };

    return style;
  }

  /**
   * Detect indentation style
   */
  detectIndentation(code) {
    const tabs = (code.match(/^\t+/gm) || []).length;
    const spaces2 = (code.match(/^  [^\t]/gm) || []).length;
    const spaces4 = (code.match(/^    [^\t]/gm) || []).length;

    if (tabs > spaces2 && tabs > spaces4) return "tabs";
    if (spaces4 > spaces2) return "spaces-4";
    return "spaces-2";
  }

  /**
   * Detect quote style
   */
  detectQuoteStyle(code) {
    const single = (code.match(/'/g) || []).length;
    const double = (code.match(/"/g) || []).length;
    return single > double ? "single" : "double";
  }

  /**
   * Detect semicolon usage
   */
  detectSemicolons(code) {
    const lines = code.split("\n");
    const withSemicolons = lines.filter((l) => l.trim().endsWith(";")).length;
    return withSemicolons / lines.length > 0.5;
  }

  /**
   * Detect trailing commas
   */
  detectTrailingCommas(code) {
    const trailing = (code.match(/,\s*[\n\r]/g) || []).length;
    const without = (code.match(/[^,]\s*[\n\r]/g) || []).length;
    return trailing / (trailing + without) > 0.3;
  }

  /**
   * Detect naming convention
   */
  detectNamingConvention(code) {
    const camelCase = (code.match(/\b[a-z][a-zA-Z0-9]*\b/g) || []).length;
    const snakeCase = (code.match(/\b[a-z]+_[a-z]+\b/g) || []).length;
    return camelCase > snakeCase ? "camelCase" : "snake_case";
  }

  /**
   * Detect error handling pattern
   */
  detectErrorHandlingPattern(code) {
    const tryCatch = (code.match(/try\s*\{/g) || []).length;
    const promises = (code.match(/\.catch\s*\(/g) || []).length;
    return tryCatch > promises ? "try-catch" : "promise-catch";
  }

  /**
   * Detect async pattern
   */
  detectAsyncPattern(code) {
    const asyncAwait = (code.match(/async\s+function|await\s+/g) || []).length;
    const promises = (code.match(/\.then\s*\(/g) || []).length;
    return asyncAwait > promises ? "async-await" : "promises";
  }

  /**
   * Apply style preferences
   */
  applyStylePreferences(fix, profile, codebaseStyle) {
    let fixedCode = fix.code || "";

    // Apply indentation
    if (codebaseStyle.indentation === "tabs") {
      fixedCode = fixedCode.replace(/^    /gm, "\t");
    } else if (codebaseStyle.indentation === "spaces-2") {
      fixedCode = fixedCode.replace(/^\t/gm, "  ");
      fixedCode = fixedCode.replace(/^    /gm, "  ");
    }

    // Apply quote style
    if (codebaseStyle.quoteStyle === "single") {
      fixedCode = fixedCode.replace(/"/g, "'");
    } else {
      fixedCode = fixedCode.replace(/'/g, '"');
    }

    // Apply semicolons
    if (!codebaseStyle.semicolons) {
      fixedCode = fixedCode.replace(/;\s*$/gm, "");
    } else {
      // Add semicolons where missing (simplified)
      fixedCode = fixedCode.replace(/([^;}])\s*$/gm, "$1;");
    }

    return fixedCode;
  }

  /**
   * Apply team preferences
   */
  applyPreferences(fix, profile) {
    const preferences = {
      autoApply:
        profile.preferences.autoApply &&
        fix.confidence >= profile.preferences.minConfidence,
      requireReview: profile.preferences.requireReview,
      fixStyle: profile.preferences.fixStyle,
    };

    return preferences;
  }

  /**
   * Apply codebase conventions
   */
  applyConventions(fix, codebaseStyle) {
    return {
      naming: codebaseStyle.naming,
      errorHandling: codebaseStyle.errorHandling,
      asyncPattern: codebaseStyle.asyncPattern,
    };
  }

  /**
   * Learn from team feedback
   */
  async learnFromFeedback(fixId, feedback) {
    try {
      const { approved, rejected, modified, comments } = feedback;

      // Update team profile based on feedback
      // This would store in database and update preferences

      return {
        success: true,
        learned: true,
      };
    } catch (error) {
      console.error(
        "[Fix Personalization] Error learning from feedback:",
        error,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Update team preferences
   */
  async updateTeamPreferences(projectId, teamId, preferences) {
    try {
      // Store preferences in database
      // For now, update cache
      const cacheKey = `${projectId}:${teamId}`;
      const profile = await this.getTeamProfile(projectId, teamId);
      profile.preferences = { ...profile.preferences, ...preferences };
      this.teamProfiles.set(cacheKey, profile);

      return {
        success: true,
        profile,
      };
    } catch (error) {
      console.error("[Fix Personalization] Error updating preferences:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = new FixPersonalizationService();

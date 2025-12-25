/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/multiAgentFixTeam.js
 * Last Sync: 2025-12-25T04:53:21.505Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Multi-Agent Fix Team Service
 * Deploys specialized teams of agents to fix issues in parallel
 * Each team focuses on a specific type of issue for maximum efficiency
 */

const codebaseCrawler = require("./codebaseCrawler");
const { createLogger } = require("../utils/logger");
const log = createLogger("MultiAgentFixTeam");
const fixHelpers = require("./codebaseCrawlerFixHelpers");
const fixApplication = require("./codebaseCrawlerFixApplication");
const llmFixGenerator = require("./llmFixGenerator");
const contextAwareFixGenerator = require("./contextAwareFixGenerator");
const codebaseAwareFixGenerator = require("./codebaseAwareFixGenerator");
const advancedFixGenerator = require("./advancedFixGenerator");
const fs = require("fs").promises;
const path = require("path");

class MultiAgentFixTeam {
  constructor() {
    this.activeTeams = new Map(); // teamId -> { status, issues, results }
    this.maxConcurrentTeams = 5; // Run up to 5 fix teams in parallel
  }

  /**
   * Deploy fix teams for a batch of issues
   * Groups issues by type and assigns specialized teams to process them in parallel
   *
   * @param {Array} issues - Array of issues to fix
   * @param {string} code - Current code content
   * @param {string} filePath - Path to the file being fixed
   * @param {Object} options - Options for fix generation
   * @returns {Promise<Array>} Array of fix results
   */
  async deployFixTeams(issues, code, filePath, options = {}) {
    if (!issues || issues.length === 0) {
      return [];
    }

    // Group issues by type for specialized team processing
    const issuesByType = {};
    for (const issue of issues) {
      const type = issue.type || "unknown";
      if (!issuesByType[type]) {
        issuesByType[type] = [];
      }
      issuesByType[type].push(issue);
    }

    const results = [];
    let currentCode = code;

    // Process each issue type group
    for (const [type, typeIssues] of Object.entries(issuesByType)) {
      // Process issues in this type group (can be parallelized in future)
      for (const issue of typeIssues) {
        try {
          const fixResult = await this.generateFixForIssue(
            issue,
            currentCode,
            filePath,
            options,
          );

          if (fixResult && fixResult.success) {
            // Update code for next fix
            currentCode = fixResult.fixedCode;
            results.push({
              success: true,
              issue: issue,
              fixedCode: fixResult.fixedCode,
              method: fixResult.method || "multi-agent",
              confidence: fixResult.confidence || 0.7,
            });
          } else {
            // Record failed attempt
            results.push({
              success: false,
              issue: issue,
              fixedCode: currentCode,
              method: fixResult?.method || "multi-agent",
              confidence: fixResult?.confidence || 0,
              error: fixResult?.error || "Failed to generate fix",
            });
          }
        } catch (err) {
          log.warn(
            `[Multi-Agent Fix Team] Error fixing issue ${issue.type} at line ${issue.line}:`,
            err.message,
          );
          results.push({
            success: false,
            issue: issue,
            fixedCode: currentCode,
            method: "multi-agent",
            confidence: 0,
            error: err.message,
          });
        }
      }
    }

    return results;
  }

  /**
   * Generate a fix for a single issue
   * Tries multiple fix generators in order of preference
   */
  async generateFixForIssue(issue, code, filePath, options = {}) {
    // Try different fix generators in order of preference
    const generators = [
      { name: "llmFixGenerator", service: llmFixGenerator, method: "llm" },
      {
        name: "contextAwareFixGenerator",
        service: contextAwareFixGenerator,
        method: "contextual",
      },
      {
        name: "codebaseAwareFixGenerator",
        service: codebaseAwareFixGenerator,
        method: "codebase-aware",
      },
      {
        name: "advancedFixGenerator",
        service: advancedFixGenerator,
        method: "advanced",
      },
    ];

    for (const generator of generators) {
      try {
        if (
          generator.service &&
          typeof generator.service.generateFix === "function"
        ) {
          const fix = await generator.service.generateFix(
            issue,
            code,
            filePath,
            options,
          );

          if (fix && fix.code && fix.code !== code) {
            return {
              success: true,
              fixedCode: fix.code,
              method: generator.method,
              confidence: fix.confidence || 0.7,
            };
          }
        }
      } catch (err) {
        // Try next generator if this one fails
        continue;
      }
    }

    // If all generators fail, try simple pattern matching
    try {
      const simpleFix = await this.trySimplePatternFix(issue, code, filePath);
      if (simpleFix && simpleFix !== code) {
        return {
          success: true,
          fixedCode: simpleFix,
          method: "simple-pattern",
          confidence: 0.6,
        };
      }
    } catch (err) {
      // Simple pattern fix also failed
    }

    return {
      success: false,
      error: "No fix generator was able to produce a fix",
    };
  }

  /**
   * Try a simple pattern-based fix
   */
  async trySimplePatternFix(issue, code, filePath) {
    // Simple pattern fixes for common issues
    const lines = code.split("\n");
    const issueLine = issue.line ? parseInt(issue.line) - 1 : -1;

    if (issueLine < 0 || issueLine >= lines.length) {
      return null;
    }

    const line = lines[issueLine];
    let fixedLine = line;

    // Common pattern fixes
    if (issue.type === "syntax" && issue.message) {
      // Try to fix common syntax errors
      if (issue.message.includes("missing semicolon")) {
        if (
          !line.trim().endsWith(";") &&
          !line.trim().endsWith("{") &&
          !line.trim().endsWith("}")
        ) {
          fixedLine = line.trim() + ";";
        }
      } else if (issue.message.includes("unexpected token")) {
        // Skip this - too risky to auto-fix
        return null;
      }
    }

    if (fixedLine !== line) {
      lines[issueLine] = fixedLine;
      return lines.join("\n");
    }

    return null;
  }
}

module.exports = new MultiAgentFixTeam();

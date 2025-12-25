/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/codeReviewAssistant.js
 * Last Sync: 2025-12-25T04:10:02.831Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * AI Code Review Assistant
 * Provides real-time code review with instant feedback
 */

const llmService = require("./llmService");
const { createLogger } = require("../utils/logger");
const log = createLogger("CodeReviewAssistant");
const codebaseSearch = require("./codebaseSearch");
const codeHealthScoring = require("./codeHealthScoring");
const securityAutoFix = require("./securityAutoFix");
const performanceOptimizer = require("./performanceOptimizer");

class CodeReviewAssistant {
  constructor() {
    this.reviewCache = new Map();
    this.cacheTTL = 300000; // 5 minutes
  }

  /**
   * Review code and provide feedback
   */
  async reviewCode(code, filePath, options = {}) {
    try {
      const {
        checkStyle = true,
        checkSecurity = true,
        checkPerformance = true,
        checkBestPractices = true,
        suggestImprovements = true,
      } = options;

      const review = {
        file: filePath,
        timestamp: Date.now(),
        issues: [],
        suggestions: [],
        score: 100,
        summary: "",
      };

      // Check code style
      if (checkStyle) {
        const styleIssues = await this.checkCodeStyle(code, filePath);
        review.issues.push(...styleIssues);
      }

      // Check security
      if (checkSecurity) {
        const securityIssues = await this.checkSecurity(code, filePath);
        review.issues.push(...securityIssues);
      }

      // Check performance
      if (checkPerformance) {
        const performanceIssues = await this.checkPerformance(code, filePath);
        review.issues.push(...performanceIssues);
      }

      // Check best practices
      if (checkBestPractices) {
        const bestPracticeIssues = await this.checkBestPractices(
          code,
          filePath,
        );
        review.issues.push(...bestPracticeIssues);
      }

      // Generate suggestions
      if (suggestImprovements) {
        const suggestions = await this.generateSuggestions(
          code,
          filePath,
          review.issues,
        );
        review.suggestions = suggestions;
      }

      // Calculate score
      review.score = this.calculateScore(review.issues);

      // Generate summary
      review.summary = await this.generateSummary(review);

      return {
        success: true,
        review,
      };
    } catch (error) {
      console.error("[Code Review Assistant] Error:", error);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Check code style
   */
  async checkCodeStyle(code, filePath) {
    const issues = [];

    // Check line length
    const lines = code.split("\n");
    lines.forEach((line, index) => {
      if (line.length > 120) {
        issues.push({
          type: "style",
          severity: "low",
          line: index + 1,
          message: `Line ${index + 1} exceeds 120 characters (${line.length} chars)`,
          suggestion: "Break long lines for better readability",
        });
      }
    });

    // Check indentation consistency
    const inconsistentIndent = lines.some((line, i) => {
      if (i === 0) return false;
      const prevIndent = lines[i - 1].match(/^\s*/)[0].length;
      const currIndent = line.match(/^\s*/)[0].length;
      return Math.abs(currIndent - prevIndent) > 4 && currIndent > 0;
    });

    if (inconsistentIndent) {
      issues.push({
        type: "style",
        severity: "low",
        message: "Inconsistent indentation detected",
        suggestion: "Use consistent indentation (2 or 4 spaces)",
      });
    }

    // Check for console.log in production code
    if (code.includes("console.log(") && !filePath.includes("test")) {
      issues.push({
        type: "style",
        severity: "low",
        message: "console.log() found in code",
        suggestion: "Remove or replace with proper logging",
      });
    }

    return issues;
  }

  /**
   * Check security issues
   */
  async checkSecurity(code, filePath) {
    const issues = [];
    const vulnerabilities = await securityAutoFix.scanForVulnerabilities(
      code,
      filePath,
    );

    vulnerabilities.forEach((vuln) => {
      issues.push({
        type: "security",
        severity: vuln.severity,
        line: vuln.line,
        message: `${vuln.type} vulnerability detected`,
        code: vuln.code,
        suggestion: `Fix ${vuln.type} vulnerability`,
        fixType: vuln.fixType,
      });
    });

    return issues;
  }

  /**
   * Check performance issues
   */
  async checkPerformance(code, filePath) {
    const issues = [];
    const bottlenecks = await performanceOptimizer.analyzePerformance(
      code,
      filePath,
    );

    bottlenecks.forEach((bottleneck) => {
      issues.push({
        type: "performance",
        severity: bottleneck.severity,
        line: bottleneck.line,
        message: `${bottleneck.type} performance issue detected`,
        code: bottleneck.code,
        suggestion: `Optimize ${bottleneck.category}`,
        category: bottleneck.category,
      });
    });

    return issues;
  }

  /**
   * Check best practices
   */
  async checkBestPractices(code, filePath) {
    const issues = [];

    // Check for error handling
    if (code.includes("async") || code.includes("await")) {
      const hasTryCatch = code.includes("try") && code.includes("catch");
      if (!hasTryCatch) {
        issues.push({
          type: "best-practice",
          severity: "medium",
          message: "Async code without error handling",
          suggestion: "Add try-catch blocks for async operations",
        });
      }
    }

    // Check for null checks
    const propertyAccess = code.match(/\w+\.\w+/g) || [];
    const hasNullChecks =
      code.includes("?.") ||
      (code.includes("if") &&
        (code.includes("null") || code.includes("undefined")));
    if (propertyAccess.length > 5 && !hasNullChecks) {
      issues.push({
        type: "best-practice",
        severity: "medium",
        message: "Missing null/undefined checks",
        suggestion: "Add optional chaining or null checks",
      });
    }

    // Check for magic numbers
    const magicNumbers = code.match(/\b\d{3,}\b/g) || [];
    if (magicNumbers.length > 3) {
      issues.push({
        type: "best-practice",
        severity: "low",
        message: "Magic numbers detected",
        suggestion: "Extract magic numbers to named constants",
      });
    }

    // Check for hardcoded strings
    if (code.match(/['"](https?:\/\/|api\/|localhost)/)) {
      issues.push({
        type: "best-practice",
        severity: "low",
        message: "Hardcoded URLs detected",
        suggestion: "Move URLs to configuration",
      });
    }

    return issues;
  }

  /**
   * Generate improvement suggestions
   */
  async generateSuggestions(code, filePath, issues) {
    const suggestions = [];

    // Generate suggestions based on issues
    if (issues.some((i) => i.type === "security")) {
      suggestions.push({
        type: "security",
        priority: "high",
        title: "Fix Security Vulnerabilities",
        description: "Address security issues to prevent vulnerabilities",
        action: "Run security scan and apply fixes",
      });
    }

    if (issues.some((i) => i.type === "performance")) {
      suggestions.push({
        type: "performance",
        priority: "medium",
        title: "Optimize Performance",
        description: "Improve code performance",
        action: "Review and optimize bottlenecks",
      });
    }

    // Use LLM for additional suggestions
    const prompt = `Review this code and suggest improvements:

Code:
${code.substring(0, 2000)}

File: ${filePath}

Issues found: ${issues.length}

Provide 2-3 specific improvement suggestions. Be concise.`;

    try {
      const llmResponse = await llmService.generateText(prompt, {
        model: "gpt-4o-mini",
        systemPrompt:
          "You are a code review assistant. Provide helpful suggestions for improving code quality.",
        temperature: 0.3,
        maxTokens: 400,
      });

      // Handle both string and object responses
      const llmSuggestions =
        typeof llmResponse === "string"
          ? llmResponse
          : llmResponse.text ||
            llmResponse.content ||
            llmResponse.narrative ||
            JSON.stringify(llmResponse);

      // Parse suggestions
      const suggestionLines = llmSuggestions
        .split("\n")
        .filter((l) => l.trim().length > 0);
      suggestionLines.forEach((line) => {
        if (line.match(/^[-*•]\s+/)) {
          suggestions.push({
            type: "general",
            priority: "low",
            title: "Code Improvement",
            description: line.replace(/^[-*•]\s+/, "").trim(),
          });
        }
      });
    } catch (error) {
      console.warn("[Code Review] LLM suggestions failed:", error.message);
    }

    return suggestions;
  }

  /**
   * Calculate review score
   */
  calculateScore(issues) {
    let score = 100;

    issues.forEach((issue) => {
      switch (issue.severity) {
        case "critical":
          score -= 10;
          break;
        case "high":
          score -= 5;
          break;
        case "medium":
          score -= 3;
          break;
        case "low":
          score -= 1;
          break;
      }
    });

    return Math.max(0, score);
  }

  /**
   * Generate review summary
   */
  async generateSummary(review) {
    const critical = review.issues.filter(
      (i) => i.severity === "critical",
    ).length;
    const high = review.issues.filter((i) => i.severity === "high").length;
    const medium = review.issues.filter((i) => i.severity === "medium").length;
    const low = review.issues.filter((i) => i.severity === "low").length;

    let summary = `Code review completed. Score: ${review.score}/100. `;

    if (critical > 0) {
      summary += `${critical} critical issue(s) found. `;
    }
    if (high > 0) {
      summary += `${high} high priority issue(s). `;
    }
    if (medium > 0) {
      summary += `${medium} medium priority issue(s). `;
    }
    if (low > 0) {
      summary += `${low} low priority issue(s). `;
    }

    if (review.issues.length === 0) {
      summary = "Code review passed! No issues found.";
    }

    return summary;
  }

  /**
   * Generate inline comments for code
   */
  async generateInlineComments(code, filePath) {
    const review = await this.reviewCode(code, filePath);
    const comments = [];

    review.review.issues.forEach((issue) => {
      if (issue.line) {
        comments.push({
          line: issue.line,
          severity: issue.severity,
          message: issue.message,
          suggestion: issue.suggestion,
        });
      }
    });

    return comments;
  }

  /**
   * Auto-fix issues
   */
  async autoFixIssues(code, filePath, issueTypes = ["style", "best-practice"]) {
    const review = await this.reviewCode(code, filePath);
    const fixableIssues = review.review.issues.filter(
      (i) => issueTypes.includes(i.type) && i.fixType,
    );

    let fixedCode = code;
    const fixes = [];

    for (const issue of fixableIssues) {
      try {
        if (issue.fixType === "security") {
          const securityAutoFix = require("./securityAutoFix");
          const fix = await securityAutoFix.generateFix(
            {
              type: issue.type,
              code: issue.code,
              line: issue.line,
              fixType: issue.fixType,
            },
            { code: fixedCode, filePath },
          );

          if (fix.success) {
            fixedCode = fixedCode.replace(issue.code, fix.fixed);
            fixes.push({
              issue,
              fix: fix.fixed,
              applied: true,
            });
          }
        }
      } catch (error) {
        console.warn(`[Code Review] Failed to fix issue:`, error);
      }
    }

    return {
      success: true,
      originalCode: code,
      fixedCode,
      fixesApplied: fixes.length,
      fixes,
    };
  }
}

module.exports = new CodeReviewAssistant();

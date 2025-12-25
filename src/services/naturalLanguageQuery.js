/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/naturalLanguageQuery.js
 * Last Sync: 2025-12-25T04:10:02.869Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Natural Language Code Query Service
 * Allows developers to ask questions in plain English about code, errors, and fixes
 */

const codebaseSearch = require("./codebaseSearch");
const { createLogger } = require("../utils/logger");
const log = createLogger("NaturalLanguageQuery");
const errorHistoryService = require("./errorHistoryService");
const rootCauseAnalysis = require("./rootCauseAnalysis");
const llmService = require("./llmService");

class NaturalLanguageQuery {
  constructor() {
    this.queryCache = new Map();
    this.cacheTTL = 300000; // 5 minutes
  }

  /**
   * Process natural language query
   */
  async processQuery(query, context = {}) {
    try {
      // Classify query type
      const queryType = this.classifyQuery(query);

      // Route to appropriate handler
      switch (queryType) {
        case "error-explanation":
          return await this.explainError(query, context);
        case "fix-guide":
          return await this.getFixGuide(query, context);
        case "performance-analysis":
          return await this.analyzePerformance(query, context);
        case "security-audit":
          return await this.auditSecurity(query, context);
        case "refactoring-suggestion":
          return await this.suggestRefactoring(query, context);
        case "code-search":
          return await this.searchCode(query, context);
        case "pattern-question":
          return await this.answerPatternQuestion(query, context);
        default:
          return await this.generalQuery(query, context);
      }
    } catch (error) {
      console.error("[Natural Language Query] Error:", error);
      return {
        success: false,
        error: error.message,
        answer:
          "I'm sorry, I couldn't process your query. Please try rephrasing it.",
      };
    }
  }

  /**
   * Classify query type
   */
  classifyQuery(query) {
    const lowerQuery = query.toLowerCase();

    if (
      lowerQuery.includes("why") &&
      (lowerQuery.includes("error") || lowerQuery.includes("fail"))
    ) {
      return "error-explanation";
    }
    if (
      lowerQuery.includes("how") &&
      (lowerQuery.includes("fix") || lowerQuery.includes("solve"))
    ) {
      return "fix-guide";
    }
    if (
      lowerQuery.includes("performance") ||
      lowerQuery.includes("slow") ||
      lowerQuery.includes("fast")
    ) {
      return "performance-analysis";
    }
    if (
      lowerQuery.includes("security") ||
      lowerQuery.includes("vulnerable") ||
      lowerQuery.includes("safe")
    ) {
      return "security-audit";
    }
    if (
      lowerQuery.includes("refactor") ||
      lowerQuery.includes("improve") ||
      lowerQuery.includes("better")
    ) {
      return "refactoring-suggestion";
    }
    if (
      lowerQuery.includes("find") ||
      lowerQuery.includes("search") ||
      lowerQuery.includes("where")
    ) {
      return "code-search";
    }
    if (
      lowerQuery.includes("pattern") ||
      lowerQuery.includes("similar") ||
      lowerQuery.includes("like")
    ) {
      return "pattern-question";
    }

    return "general";
  }

  /**
   * Explain why an error happened
   */
  async explainError(query, context) {
    // Extract error from query or context
    const error = context.error || this.extractErrorFromQuery(query);

    if (!error) {
      return {
        success: false,
        answer:
          "I couldn't identify the error you're asking about. Please provide more details.",
      };
    }

    // Get root cause analysis
    const rootCause = await rootCauseAnalysis.analyzeRootCause(error, context);

    // Generate explanation using LLM
    const prompt = `Explain why this error occurred in simple, clear language.

Error: ${JSON.stringify(error, null, 2)}

Root Cause Analysis:
${JSON.stringify(rootCause, null, 2)}

Provide a clear explanation that a developer can understand. Include:
1. What went wrong
2. Why it happened
3. What the root cause is
4. How to prevent it in the future

Keep it concise and actionable.`;

    const result = await llmService.generateOpenAI("", prompt, "gpt-4o-mini");
    const explanation = result.narrative || result.text || result;

    return {
      success: true,
      query,
      type: "error-explanation",
      answer: explanation.trim(),
      rootCause: rootCause.rootCause,
      recommendations: rootCause.recommendations,
      confidence: rootCause.confidence,
    };
  }

  /**
   * Get step-by-step fix guide
   */
  async getFixGuide(query, context) {
    const error = context.error || this.extractErrorFromQuery(query);

    if (!error) {
      return {
        success: false,
        answer:
          "I couldn't identify what needs to be fixed. Please provide more details.",
      };
    }

    // Search for similar fixes
    const similarErrors = await rootCauseAnalysis.findSimilarErrors(error);
    const history = errorHistoryService.history || [];
    const successfulFixes = history.filter(
      (e) =>
        e.fix &&
        e.fix.success &&
        (e.error.type === error.type ||
          e.error.message?.includes(error.message?.substring(0, 20))),
    );

    // Generate fix guide
    const prompt = `Provide a step-by-step guide to fix this error.

Error: ${JSON.stringify(error, null, 2)}

Similar fixes found: ${successfulFixes.length}
${successfulFixes.length > 0 ? `Example fix: ${JSON.stringify(successfulFixes[0].fix, null, 2)}` : ""}

Provide a clear, numbered step-by-step guide. Include code examples where helpful.`;

    const result = await llmService.generateOpenAI("", prompt, "gpt-4o-mini");
    const guide = result.narrative || result.text || result;

    return {
      success: true,
      query,
      type: "fix-guide",
      answer: guide.trim(),
      similarFixes: successfulFixes.length,
      steps: this.extractSteps(guide),
    };
  }

  /**
   * Analyze performance
   */
  async analyzePerformance(query, context) {
    const prompt = `Analyze performance based on this query: "${query}"

Context: ${JSON.stringify(context, null, 2)}

Provide performance analysis and recommendations.`;

    const result = await llmService.generateOpenAI("", prompt, "gpt-4o-mini");
    const analysis = result.narrative || result.text || result;

    return {
      success: true,
      query,
      type: "performance-analysis",
      answer: analysis.trim(),
    };
  }

  /**
   * Audit security
   */
  async auditSecurity(query, context) {
    const code = context.code || "";
    const filePath = context.filePath || "";

    if (!code) {
      return {
        success: false,
        answer:
          "I need code to analyze for security issues. Please provide the code.",
      };
    }

    const securityAutoFix = require("./securityAutoFix");
    const vulnerabilities = await securityAutoFix.scanForVulnerabilities(
      code,
      filePath,
    );

    const prompt = `Provide a security audit based on this query: "${query}"

Vulnerabilities found: ${vulnerabilities.length}
${vulnerabilities.length > 0 ? JSON.stringify(vulnerabilities.slice(0, 5), null, 2) : "None"}

Provide a security analysis and recommendations.`;

    const result = await llmService.generateOpenAI("", prompt, "gpt-4o-mini");
    const audit = result.narrative || result.text || result;

    return {
      success: true,
      query,
      type: "security-audit",
      answer: audit.trim(),
      vulnerabilities: vulnerabilities.length,
      critical: vulnerabilities.filter((v) => v.severity === "critical").length,
    };
  }

  /**
   * Suggest refactoring
   */
  async suggestRefactoring(query, context) {
    const code = context.code || "";
    const filePath = context.filePath || "";

    if (!code) {
      return {
        success: false,
        answer: "I need code to suggest refactoring. Please provide the code.",
      };
    }

    const prompt = `Suggest refactoring improvements for this code based on the query: "${query}"

Code:
${code.substring(0, 2000)}

File: ${filePath}

Provide specific refactoring suggestions with code examples.`;

    const result = await llmService.generateOpenAI("", prompt, "gpt-4o-mini");
    const suggestions = result.narrative || result.text || result;

    return {
      success: true,
      query,
      type: "refactoring-suggestion",
      answer: suggestions.trim(),
    };
  }

  /**
   * Search code
   */
  async searchCode(query, context) {
    // Extract search terms
    const searchTerms = this.extractSearchTerms(query);

    const results = await codebaseSearch.semanticSearch(searchTerms.join(" "), {
      limit: 10,
    });

    return {
      success: true,
      query,
      type: "code-search",
      answer: `Found ${results.results?.length || 0} relevant code locations.`,
      results:
        results.results?.slice(0, 5).map((r) => ({
          file: r.file_path,
          relevance: r.score,
          snippet: r.content?.substring(0, 200),
        })) || [],
    };
  }

  /**
   * Answer pattern questions
   */
  async answerPatternQuestion(query, context) {
    const error = context.error || this.extractErrorFromQuery(query);

    if (!error) {
      return {
        success: false,
        answer: "I need an error or code pattern to answer this question.",
      };
    }

    const similarErrors = await rootCauseAnalysis.findSimilarErrors(error);

    const prompt = `Answer this question about error patterns: "${query}"

Error: ${JSON.stringify(error, null, 2)}
Similar patterns found: ${similarErrors.length}

Provide a clear answer about the pattern.`;

    const result = await llmService.generateOpenAI("", prompt, "gpt-4o-mini");
    const answer = result.narrative || result.text || result;

    return {
      success: true,
      query,
      type: "pattern-question",
      answer: answer.trim(),
      similarPatterns: similarErrors.length,
    };
  }

  /**
   * Handle general queries
   */
  async generalQuery(query, context) {
    // Try to find relevant information
    const searchResults = await codebaseSearch.semanticSearch(query, {
      limit: 5,
    });
    const history = errorHistoryService.history || [];

    const prompt = `Answer this question about the codebase: "${query}"

Relevant code found: ${searchResults.results?.length || 0} results
Error history: ${history.length} errors recorded

Provide a helpful answer based on available information.`;

    const result = await llmService.generateOpenAI("", prompt, "gpt-4o-mini");
    const answer = result.narrative || result.text || result;

    return {
      success: true,
      query,
      type: "general",
      answer: answer.trim(),
      relevantResults: searchResults.results?.length || 0,
    };
  }

  /**
   * Extract error from query
   */
  extractErrorFromQuery(query) {
    // Try to find error message or type in query
    const errorMatch = query.match(
      /(TypeError|ReferenceError|SyntaxError|Error):\s*(.+)/i,
    );
    if (errorMatch) {
      return {
        type: errorMatch[1],
        message: errorMatch[2],
      };
    }
    return null;
  }

  /**
   * Extract search terms
   */
  extractSearchTerms(query) {
    // Remove common words
    const stopWords = [
      "find",
      "search",
      "where",
      "show",
      "me",
      "the",
      "a",
      "an",
      "is",
      "are",
      "how",
      "what",
      "why",
    ];
    const words = query.toLowerCase().split(/\s+/);
    return words.filter((w) => !stopWords.includes(w) && w.length > 2);
  }

  /**
   * Extract steps from guide text
   */
  extractSteps(text) {
    const stepMatches = text.matchAll(
      /(?:^|\n)\s*(\d+)\.\s*(.+?)(?=\n\s*\d+\.|$)/g,
    );
    const steps = [];
    for (const match of stepMatches) {
      steps.push({
        number: parseInt(match[1]),
        description: match[2].trim(),
      });
    }
    return steps;
  }
}

module.exports = new NaturalLanguageQuery();

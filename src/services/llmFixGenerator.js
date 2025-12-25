/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/llmFixGenerator.js
 * Last Sync: 2025-12-25T07:02:33.981Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * LLM-Powered Fix Generator Service
 * Generates intelligent fixes for any issue type using LLM
 */

const llmService = require("./llmService");
const { createLogger } = require("../utils/logger");
const log = createLogger("LlmFixGenerator");
const codebaseSearch = require("./codebaseSearch");
const errorHistoryService = require("./errorHistoryService");
const agentSessionService = require("./agentSessionService");
const agentKnowledgeService = require("./agentKnowledgeService");
const fixSuccessTracker = require("./fixSuccessTracker");
const developerMetricsService = require("./developerMetricsService");
const customerExpertHelper = require("./customerExpertHelper");
const expertLearningService = require("./expertLearningService");
const expertUsageTracker = require("./expertUsageTracker");

class LLMFixGenerator {
  constructor() {
    this.fixCache = new Map(); // Cache fixes for similar issues
    this.fixStats = {
      generated: 0,
      applied: 0,
      successful: 0,
      failed: 0,
    };
  }

  /**
   * Generate a fix for an issue using LLM
   */
  async generateFix(issue, code, filePath, context = {}) {
    try {
      // SPRINT 3: Check file risk before generating fix
      let fileRiskScore = 0;
      let isHighRisk = false;
      try {
        if (filePath) {
          fileRiskScore =
            await developerMetricsService.calculateFileRisk(filePath);
          isHighRisk = fileRiskScore > 70;
          if (isHighRisk) {
            console.log(
              `[LLM Fix] ⚠️  HIGH RISK FILE (${fileRiskScore}): ${filePath} - Extra validation required`,
            );
          }
        }
      } catch (err) {
        log.warn("[LLM Fix] Failed to calculate file risk:", err.message);
      }

      // Check cache first
      const cacheKey = this.getCacheKey(issue, code);
      if (this.fixCache.has(cacheKey) && !isHighRisk) {
        const cached = this.fixCache.get(cacheKey);
        if (cached.confidence > 0.8) {
          return cached;
        }
      }

      // Get context from codebase
      const codebaseContext = await this.getCodebaseContext(issue, filePath);

      // Get similar fixes from history
      const similarFixes = await this.getSimilarFixes(issue);

      // Get customer expert context if project_id is available
      let customerExpertContext = "";
      let expertTypeUsed = null;
      if (context.project_id) {
        try {
          expertTypeUsed = customerExpertHelper.determineExpertType(issue);
          customerExpertContext = await customerExpertHelper.buildExpertContext(
            context.project_id,
            issue,
          );

          // Track expert usage
          if (expertTypeUsed && customerExpertContext) {
            await expertUsageTracker.trackUsage(
              context.project_id,
              expertTypeUsed,
            );
          }
        } catch (err) {
          log.warn(
            "[LLM Fix Generator] Failed to get customer expert context:",
            err.message,
          );
        }
      }

      // Merge context-aware data if provided
      const enhancedContext = {
        ...context,
        codebaseContext,
        similarFixes,
        customerExpertContext,
        conventions: context.conventions || null,
        similarPatterns: context.similarPatterns || null,
        existingFixes: context.existingFixes || null,
        codeStyle: context.codeStyle || null,
      };

      // Generate fix using LLM
      const startTime = Date.now();
      const fix = await this.generateFixWithLLM(
        issue,
        code,
        filePath,
        enhancedContext,
      );
      const duration = Date.now() - startTime;

      // SPRINT 3: Add risk warnings and extra validation for high-risk files
      if (isHighRisk) {
        fix.riskScore = fileRiskScore;
        fix.riskWarning = `⚠️ HIGH RISK FILE (${fileRiskScore}): This file has a high risk score. Extra validation and testing recommended before applying this fix.`;
        fix.requiresExtraValidation = true;
        fix.requiresTesting = true;

        // Lower confidence for high-risk files to encourage review
        if (fix.confidence > 0.8) {
          fix.confidence = Math.max(0.7, fix.confidence - 0.1);
        }
      } else if (fileRiskScore > 0) {
        fix.riskScore = fileRiskScore;
      }

      // Cache the fix (but not high-risk ones to ensure fresh validation)
      if (fix.confidence > 0.7 && !isHighRisk) {
        this.fixCache.set(cacheKey, fix);
      }

      // Record decision for learning (Sprint 1)
      try {
        const sessionId = `llm-fix-${Date.now()}`;
        const session = await agentSessionService.getOrCreateSession(
          "llm-fix-generator",
          sessionId,
          { filePath, errorType: issue.type || issue.category },
        );

        await agentSessionService.recordDecision({
          agentType: "llm-fix-generator",
          sessionId: session.session_id || sessionId,
          decisionType: "fix",
          inputContext: {
            error: issue.message || issue.description,
            errorType: issue.type || issue.category,
            filePath,
            fileRiskScore: fileRiskScore, // SPRINT 3: Include risk score
            isHighRisk: isHighRisk, // SPRINT 3: Include risk flag
          },
          decisionMade: {
            fix:
              fix.fixedCode?.substring(0, 200) || fix.code?.substring(0, 200),
            confidence: fix.confidence,
            riskScore: fileRiskScore, // SPRINT 3: Include risk in decision
            riskWarning: fix.riskWarning, // SPRINT 3: Include risk warning
          },
          outcome: "pending",
          confidence: fix.confidence || 0.5,
          timeTakenMs: duration,
        });

        // Record successful fix to knowledge base
        if (fix.success && fix.confidence >= 0.7) {
          fixSuccessTracker
            .recordSuccessfulFix({
              fix: fix.fixedCode || fix.code,
              error: issue,
              filePath: filePath,
              agentType: "llm-fix-generator",
              sessionId: session.session_id || sessionId,
              confidence: fix.confidence,
              applied: false,
            })
            .catch((err) => {
              log.warn(
                "[LLM Fix] Failed to record to knowledge base:",
                err.message,
              );
            });
        }
      } catch (err) {
        log.warn("[LLM Fix] Failed to record decision:", err.message);
      }

      this.fixStats.generated++;
      return fix;
    } catch (err) {
      console.error("[LLM Fix Generator] Error generating fix:", err);
      return {
        success: false,
        error: err.message,
        confidence: 0,
      };
    }
  }

  /**
   * Generate fix using LLM
   */
  async generateFixWithLLM(issue, code, filePath, context) {
    const {
      codebaseContext,
      similarFixes,
      conventions,
      similarPatterns,
      existingFixes,
      codeStyle,
    } = context;

    // Build prompt for LLM (with enhanced context)
    const prompt = this.buildFixPrompt(issue, code, filePath, {
      codebaseContext,
      similarFixes,
      conventions,
      similarPatterns,
      existingFixes,
      codeStyle,
    });

    try {
      // Use new multi-provider LLM system with context-aware routing
      // Determine cost mode based on issue severity
      const costMode =
        issue.severity === "critical" || issue.severity === "high"
          ? "quality" // Use best quality for critical issues
          : "balanced"; // Smart routing for others

      // Determine context type for routing
      const contextType = this.getContextTypeForIssue(issue);

      // Generate fix using new LLM service with smart routing
      const response = await llmService.generateNarrative({
        userMessage: prompt,
        gameStateContext: this.buildContextForFix(
          issue,
          code,
          filePath,
          context,
        ),
        costMode: costMode,
        source: "code-roach-fix", // Track Code Roach usage
        // Context for smart routing
        context: {
          contextType: contextType,
          importance:
            issue.severity === "critical"
              ? "critical"
              : issue.severity === "high"
                ? "high"
                : "medium",
          isCritical: issue.severity === "critical",
        },
      });

      // Parse LLM response
      const fix = this.parseFixResponse(response.narrative, issue, code);

      // Add provider info to fix metadata
      fix.provider = response.provider;
      fix.model = response.model;
      fix.cost = response.cost;
      fix.responseTime = response.responseTime;

      return fix;
    } catch (err) {
      console.error("[LLM Fix Generator] LLM error:", err);
      // Fallback to pattern-based fix
      return this.generatePatternBasedFix(issue, code, filePath);
    }
  }

  /**
   * Get context type for issue (for smart routing)
   */
  getContextTypeForIssue(issue) {
    const typeMap = {
      "syntax-error": "routine",
      "type-error": "routine",
      "reference-error": "routine",
      "security-issue": "critical",
      "logic-error": "complex",
      "async-error": "complex",
      "performance-issue": "high",
      "race-condition": "complex",
      "database-error": "high",
      "api-error": "high",
    };
    return typeMap[issue.type] || "routine";
  }

  /**
   * Build context string for fix generation
   */
  buildContextForFix(issue, code, filePath, context) {
    const codeSnippet = this.getCodeSnippet(code, issue.line || 1, 10);
    return `File: ${filePath}\nIssue: ${issue.type}\nSeverity: ${issue.severity}\nCode:\n${codeSnippet}`;
  }

  /**
   * Build prompt for LLM fix generation
   */
  buildFixPrompt(issue, code, filePath, context = {}) {
    const {
      codebaseContext,
      similarFixes,
      conventions,
      similarPatterns,
      existingFixes,
      codeStyle,
    } = context;
    const codeSnippet = this.getCodeSnippet(code, issue.line || 1, 10);

    let prompt = `You are an expert code fixer. Generate a fix for the following issue.

FILE: ${filePath}
ISSUE TYPE: ${issue.type || "unknown"}
SEVERITY: ${issue.severity || "medium"}
MESSAGE: ${issue.message}
LINE: ${issue.line || "unknown"}

CODE CONTEXT:
\`\`\`javascript
${codeSnippet}
\`\`\`

`;

    // Add codebase context if available
    if (codebaseContext && codebaseContext.length > 0) {
      prompt += `SIMILAR CODE PATTERNS IN CODEBASE:
\`\`\`javascript
${codebaseContext.substring(0, 1000)}
\`\`\`

`;
    }

    // Add similar fixes if available
    if (similarFixes && similarFixes.length > 0) {
      prompt += `SIMILAR FIXES THAT WORKED:
${similarFixes.map((f) => `- ${f.fix?.code?.substring(0, 200)}`).join("\n")}

`;
    }

    // Add project conventions if available
    if (conventions && Object.keys(conventions).length > 0) {
      prompt += `PROJECT CONVENTIONS:
- Naming: ${conventions.naming?.variables || "camelCase"}
- Indentation: ${conventions.style?.indent || "2 spaces"}
- Patterns: ${(conventions.patterns || []).join(", ") || "none"}

`;
    }

    // Add similar patterns if available
    if (similarPatterns && similarPatterns.length > 0) {
      prompt += `SIMILAR CODE PATTERNS IN PROJECT:
${similarPatterns
  .slice(0, 3)
  .map(
    (p) =>
      `File: ${p.file}\n\`\`\`javascript\n${p.code.substring(0, 300)}\n\`\`\``,
  )
  .join("\n\n")}

`;
    }

    // Add code style if available
    if (codeStyle && Object.keys(codeStyle).length > 0) {
      prompt += `CODE STYLE FOR THIS FILE:
- Indent size: ${codeStyle.indentSize || 2} spaces
- Uses semicolons: ${codeStyle.usesSemicolons ? "yes" : "no"}
- Quote style: ${codeStyle.usesQuotes || "double"}
- Max line length: ${codeStyle.lineLength || 120} chars

`;
    }

    // Add customer expert context if available
    const customerExpertContext = context.customerExpertContext || "";
    if (customerExpertContext) {
      prompt += customerExpertContext;
    }

    prompt += `REQUIREMENTS:
1. Generate ONLY the fixed code (not the entire file)
2. Maintain the same code style and conventions
3. Fix the issue completely
4. Don't break existing functionality
5. Add error handling if needed
6. Follow best practices

RESPONSE FORMAT (JSON):
{
  "fixedCode": "the fixed code snippet",
  "explanation": "brief explanation of the fix",
  "confidence": 0.0-1.0,
  "safety": "safe|medium|risky",
  "changes": ["list of what changed"]
}

Generate the fix:`;

    return prompt;
  }

  /**
   * Parse LLM response into fix object
   */
  parseFixResponse(response, issue, code) {
    try {
      // Ensure response is a string
      if (!response || typeof response !== "string") {
        log.warn(
          "[LLM Fix Generator] Response is not a string:",
          typeof response,
        );
        return {
          success: false,
          error: "Invalid response format",
          confidence: 0,
        };
      }

      // Try to extract JSON from response
      let jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        // If no JSON, try to extract code block
        const codeMatch = response.match(
          /```(?:javascript|js|typescript|ts)?\n([\s\S]*?)\n```/,
        );
        if (codeMatch) {
          return {
            success: true,
            fixedCode: codeMatch[1],
            explanation: "Fix generated from code block",
            confidence: 0.7,
            safety: "medium",
            changes: ["Applied fix from LLM response"],
          };
        }
        // Last resort: use entire response as fix
        return {
          success: true,
          fixedCode: response.trim(),
          explanation: "Fix generated from LLM response",
          confidence: 0.6,
          safety: "risky",
          changes: ["Applied fix from LLM response"],
        };
      }

      const fixData = JSON.parse(jsonMatch[0]);

      return {
        success: true,
        fixedCode: fixData.fixedCode || fixData.code || "",
        explanation: fixData.explanation || "Fix generated by LLM",
        confidence: fixData.confidence || 0.7,
        safety: fixData.safety || "medium",
        changes: fixData.changes || [],
        metadata: {
          model: "gpt-4",
          timestamp: Date.now(),
        },
      };
    } catch (err) {
      console.error("[LLM Fix Generator] Error parsing response:", err);
      return {
        success: false,
        error: "Failed to parse LLM response",
        confidence: 0,
      };
    }
  }

  /**
   * Get codebase context for similar patterns
   */
  async getCodebaseContext(issue, filePath) {
    try {
      // Search for similar code patterns
      const query = `${issue.type} ${issue.message} fix pattern`;
      const results = await codebaseSearch.semanticSearch(query, {
        limit: 3,
        threshold: 0.7,
      });

      if (results && results.results && results.results.length > 0) {
        // Get context from similar files
        const contexts = await Promise.all(
          results.results.slice(0, 3).map(async (result) => {
            try {
              const fileContext = await codebaseSearch.getFileContext(
                result.file_path,
              );
              return fileContext.substring(0, 500);
            } catch (err) {
              return null;
            }
          }),
        );

        return contexts.filter((c) => c).join("\n\n---\n\n");
      }

      return null;
    } catch (err) {
      log.warn(
        "[LLM Fix Generator] Error getting codebase context:",
        err.message,
      );
      return null;
    }
  }

  /**
   * Get similar fixes from error history
   */
  async getSimilarFixes(issue) {
    try {
      const patterns = await errorHistoryService.getAllPatterns();

      // Find similar patterns
      const similar = patterns
        .filter((p) => {
          const pattern = p.errorPattern;
          if (!pattern) return false;

          // Match by type
          if (pattern.type === issue.type) return true;

          // Match by message similarity
          if (pattern.message && issue.message) {
            const similarity = this.calculateSimilarity(
              pattern.message.toLowerCase(),
              issue.message.toLowerCase(),
            );
            return similarity > 0.6;
          }

          return false;
        })
        .filter((p) => p.fixes && p.fixes.length > 0)
        .slice(0, 3);

      return similar.map((p) => ({
        pattern: p.errorPattern,
        fix: p.fixes[0], // Get best fix
        successRate: p.stats?.successRate || 0,
      }));
    } catch (err) {
      log.warn(
        "[LLM Fix Generator] Error getting similar fixes:",
        err.message,
      );
      return [];
    }
  }

  /**
   * Generate pattern-based fix (fallback)
   */
  generatePatternBasedFix(issue, code, filePath) {
    const lines = code.split("\n");
    const lineIndex = (issue.line || 1) - 1;
    const originalLine = lines[lineIndex] || "";

    // Pattern-based fixes for common issues
    if (
      issue.type === "error-handling" ||
      issue.message?.toLowerCase().includes("error")
    ) {
      // Add try-catch
      return {
        success: true,
        fixedCode: `try {\n    ${originalLine}\n} catch (err) {\n    console.error('Error:', err);\n    throw err;\n}`,
        explanation: "Added error handling",
        confidence: 0.8,
        safety: "safe",
        changes: ["Added try-catch block"],
      };
    }

    if (
      issue.type === "null-check" ||
      issue.message?.toLowerCase().includes("null") ||
      issue.message?.toLowerCase().includes("undefined")
    ) {
      // Add null check
      return {
        success: true,
        fixedCode: `if (${originalLine.match(/\w+/)?.[0]} != null) {\n    ${originalLine}\n}`,
        explanation: "Added null check",
        confidence: 0.7,
        safety: "safe",
        changes: ["Added null check"],
      };
    }

    // Default: return original code
    return {
      success: false,
      error: "No pattern match found",
      confidence: 0,
    };
  }

  /**
   * Get code snippet around line
   */
  getCodeSnippet(code, line, contextLines = 10) {
    const lines = code.split("\n");
    const lineIndex = Math.max(0, line - 1);
    const start = Math.max(0, lineIndex - contextLines);
    const end = Math.min(lines.length, lineIndex + contextLines + 1);

    return lines.slice(start, end).join("\n");
  }

  /**
   * Get cache key for issue
   */
  getCacheKey(issue, code) {
    const snippet = this.getCodeSnippet(code, issue.line || 1, 5);
    return `${issue.type}:${issue.message}:${snippet.substring(0, 100)}`;
  }

  /**
   * Calculate string similarity (simple)
   */
  calculateSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer, shorter);
    return (longer.length - distance) / longer.length;
  }

  /**
   * Levenshtein distance
   */
  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i];
    }
    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j;
    }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1,
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.fixStats,
      cacheSize: this.fixCache.size,
      successRate:
        this.fixStats.generated > 0
          ? (this.fixStats.successful / this.fixStats.generated) * 100
          : 0,
    };
  }
}

module.exports = new LLMFixGenerator();

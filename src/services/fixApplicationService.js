/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixApplicationService.js
 * Last Sync: 2025-12-25T04:10:02.835Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Application Service
 * Handles safe application of code fixes with rollback capability
 */

/* eslint-disable no-undef */
const fixSuccessTracker = require("./fixSuccessTracker");
const { createLogger } = require("../utils/logger");
const log = createLogger("FixApplicationService");
const agentSessionService = require("./agentSessionService");
const expertLearningService = require("./expertLearningService");
const expertUsageTracker = require("./expertUsageTracker");
const fs = require("fs").promises;
const path = require("path");

class FixApplicationService {
  constructor() {
    this.appliedFixes = new Map(); // Track applied fixes for rollback
    this.fixHistory = []; // History of all fix attempts
  }

  /**
   * Categorize fix safety level
   */
  categorizeSafety(fix) {
    if (!fix || !fix.code) {
      return "risky"; // No code = can't apply safely
    }

    const code = fix.code.toLowerCase();
    const type = fix.type || "";

    // Safe fixes: null checks, variable initialization, simple error handling
    if (
      type === "null-check" ||
      type === "variable-init" ||
      (code.includes("if (") &&
        code.includes("!== null") &&
        code.includes("!== undefined")) ||
      (code.includes("let ") && code.includes("= null")) ||
      (code.includes("const ") && code.includes("= null"))
    ) {
      return "safe";
    }

    // Medium fixes: error handling, try-catch, function wrapping
    if (
      type === "error-handling" ||
      code.includes("try {") ||
      code.includes("catch (") ||
      (code.includes("function") && code.includes("return"))
    ) {
      return "medium";
    }

    // Risky: code injection, eval, complex operations
    if (
      code.includes("eval(") ||
      code.includes("Function(") ||
      code.includes("innerHTML") ||
      code.includes("document.write") ||
      code.length > 500
    ) {
      // Long code is risky
      return "risky";
    }

    // Default to medium if unsure
    return "medium";
  }

  /**
   * Validate fix code for safety
   */
  validateFix(fix) {
    if (!fix || !fix.code) {
      return { valid: false, reason: "No fix code provided" };
    }

    const code = fix.code;

    // Block dangerous patterns
    const dangerousPatterns = [
      /eval\s*\(/i,
      /Function\s*\(/i,
      /document\.write/i,
      /\.innerHTML\s*=/i,
      /\.outerHTML\s*=/i,
      /<script/i,
      /javascript:/i,
      /on\w+\s*=/i, // Event handlers
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(code)) {
        return {
          valid: false,
          reason: `Dangerous pattern detected: ${pattern}`,
        };
      }
    }

    return { valid: true };
  }

  /**
   * Create a rollback point
   */
  createRollbackPoint(error, fix) {
    const rollbackId = `rollback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Store original state if applicable
    const rollback = {
      id: rollbackId,
      errorId: error.id,
      timestamp: Date.now(),
      fix: fix,
      originalState: this.captureState(error, fix),
    };

    return rollback;
  }

  /**
   * Capture current state for rollback
   */
  captureState(error, fix) {
    const state = {
      error: {
        message: error.message,
        type: error.type,
        source: error.source,
      },
    };

    // If fix targets a specific variable/function, capture it
    if (fix.type === "variable-init" && fix.variable) {
      try {
        // This would need to be done client-side
        state.variableName = fix.variable;
      } catch (e) {
        // Can't capture, that's okay
      }
    }

    return state;
  }

  /**
   * Generate fix application instructions
   */
  generateApplicationInstructions(fix, error) {
    const instructions = {
      type: fix.type || "code-injection",
      code: fix.code,
      method: this.determineApplicationMethod(fix, error),
      target: this.determineTarget(fix, error),
      safety: fix.safety || this.categorizeSafety(fix),
    };

    return instructions;
  }

  /**
   * Determine how to apply the fix
   */
  determineApplicationMethod(fix, error) {
    const type = fix.type || "";
    const code = fix.code || "";

    if (type === "null-check") {
      return "function-patch";
    }

    if (type === "variable-init") {
      return "variable-injection";
    }

    if (type === "error-handling") {
      return "function-wrap";
    }

    if (code.includes("function") || code.includes("=>")) {
      return "function-patch";
    }

    return "code-injection";
  }

  /**
   * Determine target for fix application
   */
  determineTarget(fix, error) {
    // Try to extract target from error stack
    if (error.stack) {
      const stackMatch = error.stack.match(/at\s+(\w+)\s*\(/);
      if (stackMatch) {
        return {
          function: stackMatch[1],
          file: error.source,
        };
      }
    }

    // Use fix metadata if available
    if (fix.target) {
      return fix.target;
    }

    // Default to global scope
    return {
      scope: "global",
      file: error.source,
    };
  }

  /**
   * Record fix application
   */
  async recordFixApplication(error, fix, success, rollbackId, metadata = {}) {
    const record = {
      id: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      errorId: error.id,
      error: {
        message: error.message,
        type: error.type,
        fingerprint: error.fingerprint,
      },
      fix: {
        code: fix.code,
        type: fix.type,
        safety: fix.safety,
        knowledgeId: metadata.knowledgeId, // Track if from knowledge base
      },
      success,
      rollbackId,
      timestamp: Date.now(),
      agentType: metadata.agentType || "unknown",
    };

    this.fixHistory.push(record);
    this.appliedFixes.set(error.id, record);

    // Keep only last 1000 records
    if (this.fixHistory.length > 1000) {
      this.fixHistory.shift();
    }

    // Record to Supabase for learning (Sprint 2)
    try {
      // Update decision outcome if we have session info
      if (metadata.sessionId && metadata.decisionId) {
        await agentSessionService.recordDecision({
          agentType: metadata.agentType || "fix-application",
          sessionId: metadata.sessionId,
          decisionType: "fix",
          outcome: success ? "success" : "failure",
          confidence: fix.confidence || 0.5,
          metadata: {
            fixType: fix.type,
            safety: fix.safety,
            applied: true,
          },
        });
      }

      // Record successful fix to knowledge base
      if (success && fix.confidence >= 0.7) {
        await fixSuccessTracker.recordSuccessfulFix({
          fix: fix.code,
          error: error,
          filePath: error.source || metadata.filePath,
          agentType: metadata.agentType || "fix-application",
          sessionId: metadata.sessionId,
          confidence: fix.confidence || 0.8,
          applied: true,
        });
      }

      // Update knowledge base usage if fix came from knowledge base
      if (metadata.knowledgeId) {
        await fixSuccessTracker.recordFixApplication(
          metadata.knowledgeId,
          success,
        );
      }

      // Record expert learning outcome if expert was used
      if (fix.expertTypeUsed && fix.projectId) {
        const outcome = success ? "success" : "failure";
        await expertLearningService
          .recordFixOutcome(fix.projectId, fix.expertTypeUsed, {
            issue: error,
            fix: fix,
            outcome: outcome,
            confidence: fix.confidence,
            applied: success,
            reverted: !success,
          })
          .catch((err) => {
            console.warn(
              "[Fix Application] Failed to record expert learning:",
              err.message,
            );
          });

        // Track usage outcome
        await expertUsageTracker
          .trackOutcome(fix.projectId, fix.expertTypeUsed, success)
          .catch(() => {
            // Silently fail - tracking is non-critical
          });
      }
    } catch (err) {
      console.warn(
        "[FixApplication] Failed to record to Supabase:",
        err.message,
      );
    }

    return record;
  }

  /**
   * Get fix statistics
   */
  getStats() {
    const total = this.fixHistory.length;
    const successful = this.fixHistory.filter((f) => f.success).length;
    const failed = total - successful;

    const bySafety = {
      safe: this.fixHistory.filter((f) => f.fix.safety === "safe").length,
      medium: this.fixHistory.filter((f) => f.fix.safety === "medium").length,
      risky: this.fixHistory.filter((f) => f.fix.safety === "risky").length,
    };

    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total) * 100 : 0,
      bySafety,
    };
  }

  /**
   * Get fix history
   */
  getHistory(limit = 100) {
    return this.fixHistory.slice(-limit).reverse();
  }

  /**
   * Apply fix to a file
   * This is a simplified version - in production, you'd want more sophisticated code patching
   */
  async applyFix(fix, options = {}) {
    const {
      ticketId,
      rollbackId,
      autoApply = false,
      filePath = null,
    } = options;

    // Validate fix first
    const validation = this.validateFix(fix);
    if (!validation.valid) {
      throw new Error(`Fix validation failed: ${validation.reason}`);
    }

    // Categorize safety
    const safety = this.categorizeSafety(fix);

    // If not auto-apply and risky, require approval
    if (!autoApply && safety === "risky") {
      return {
        success: false,
        requiresApproval: true,
        safety: safety,
        fix: fix,
      };
    }

    // If file path provided, try to apply to file
    const targetFile = filePath || fix.filePath || fix.target?.file;

    if (targetFile && fix.code) {
      try {
        // Read current file
        const fullPath = path.resolve(process.cwd(), targetFile);
        const currentContent = await fs.readFile(fullPath, "utf8");

        // Create backup
        const backupPath = `${fullPath}.backup.${Date.now()}`;
        await fs.writeFile(backupPath, currentContent);

        // Apply fix based on type
        let newContent = currentContent;

        if (fix.type === "null-check" || fix.type === "error-handling") {
          // Insert fix at appropriate location
          // This is simplified - in production, use AST parsing
          const insertPoint = this.findInsertPoint(currentContent, fix);
          if (insertPoint >= 0) {
            newContent =
              currentContent.slice(0, insertPoint) +
              fix.code +
              "\n" +
              currentContent.slice(insertPoint);
          } else {
            // Append at end of function/file
            newContent = currentContent + "\n" + fix.code;
          }
        } else if (fix.type === "variable-init") {
          // Find variable declaration location
          const varMatch = currentContent.match(
            new RegExp(`(let|const|var)\\s+${fix.variable || "\\w+"}`),
          );
          if (varMatch) {
            // Variable exists, update it
            newContent = currentContent.replace(
              new RegExp(
                `(let|const|var)\\s+${fix.variable || "\\w+"}([^=]*)=([^;]+);`,
              ),
              `$1 ${fix.variable || "var"} = ${fix.code};`,
            );
          } else {
            // Add variable at top of scope
            newContent = `const ${fix.variable || "var"} = ${fix.code};\n${currentContent}`;
          }
        } else {
          // Generic code injection
          const insertPoint = this.findInsertPoint(currentContent, fix);
          if (insertPoint >= 0) {
            newContent =
              currentContent.slice(0, insertPoint) +
              fix.code +
              "\n" +
              currentContent.slice(insertPoint);
          } else {
            newContent = currentContent + "\n" + fix.code;
          }
        }

        // Write new content
        await fs.writeFile(fullPath, newContent, "utf8");

        // Record application
        const result = {
          success: true,
          fixId: `fix_${Date.now()}`,
          filePath: fullPath,
          backupPath: backupPath,
          rollbackId: rollbackId,
          safety: safety,
          applied: true,
        };

        // Record in history
        await this.recordFixApplication(
          {
            id: ticketId || "unknown",
            message: fix.description || "Fix applied",
          },
          fix,
          true,
          rollbackId,
          { agentType: "ai-support-agent", filePath: fullPath },
        );

        return result;
      } catch (error) {
        console.error("[Fix Application] Error applying fix to file:", error);
        return {
          success: false,
          error: error.message,
          requiresApproval: true,
        };
      }
    } else {
      // No file path - return fix instructions
      return {
        success: true,
        fixId: `fix_${Date.now()}`,
        instructions: this.generateApplicationInstructions(fix, {
          id: ticketId || "unknown",
        }),
        requiresManualApplication: true,
        safety: safety,
      };
    }
  }

  /**
   * Find insertion point for fix in code
   */
  findInsertPoint(content, fix) {
    // Try to find function start
    if (fix.target?.function) {
      const funcMatch = content.match(
        new RegExp(`function\\s+${fix.target.function}\\s*\\([^)]*\\)\\s*\\{`),
      );
      if (funcMatch) {
        return funcMatch.index + funcMatch[0].length;
      }
    }

    // Try to find class or module
    const classMatch = content.match(/class\s+\w+\s*\{/);
    if (classMatch) {
      return classMatch.index + classMatch[0].length;
    }

    // Default to end of file
    return -1;
  }

  /**
   * Rollback a fix
   */
  async rollbackFix(rollbackId) {
    // Find rollback point
    const rollback = this.fixHistory.find((f) => f.rollbackId === rollbackId);
    if (!rollback) {
      throw new Error("Rollback point not found");
    }

    // If backup file exists, restore it
    if (rollback.backupPath) {
      try {
        const backupContent = await fs.readFile(rollback.backupPath, "utf8");
        const originalPath = rollback.backupPath.replace(/\.backup\.\d+$/, "");
        await fs.writeFile(originalPath, backupContent, "utf8");

        // Delete backup
        await fs.unlink(rollback.backupPath);

        return { success: true, restored: originalPath };
      } catch (error) {
        console.error("[Fix Application] Error rolling back:", error);
        throw error;
      }
    }

    return { success: false, error: "No backup found" };
  }
}

module.exports = new FixApplicationService();

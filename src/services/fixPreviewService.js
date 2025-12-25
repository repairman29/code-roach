/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixPreviewService.js
 * Last Sync: 2025-12-25T04:10:02.836Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
const { createLogger } = require('../utils/logger');
const log = createLogger('FixPreviewService');
 * Fix Preview Service
 * ROUND 6: Generate fix previews and diffs for approval workflow
 */

// Use built-in diff or simple implementation
let diff;
try {
  diff = require("diff");
} catch (err) {
  // Fallback: simple diff implementation
  diff = {
    diffLines: (oldText, newText) => {
      const oldLines = oldText.split("\n");
      const newLines = newText.split("\n");
      const result = [];
      let i = 0,
        j = 0;

      while (i < oldLines.length || j < newLines.length) {
        if (i >= oldLines.length) {
          result.push({ value: newLines[j] + "\n", added: true });
          j++;
        } else if (j >= newLines.length) {
          result.push({ value: oldLines[i] + "\n", removed: true });
          i++;
        } else if (oldLines[i] === newLines[j]) {
          result.push({ value: oldLines[i] + "\n" });
          i++;
          j++;
        } else {
          result.push({ value: oldLines[i] + "\n", removed: true });
          result.push({ value: newLines[j] + "\n", added: true });
          i++;
          j++;
        }
      }

      return result;
    },
  };
}

class FixPreviewService {
  constructor() {
    this.previewEnabled = true;
  }

  /**
   * Generate fix preview with diff
   * ROUND 6: Show what will change before applying
   */
  async generatePreview(
    originalCode,
    fixedCode,
    issue,
    filePath,
    options = {},
  ) {
    try {
      const preview = {
        filePath,
        issue: {
          type: issue.type,
          severity: issue.severity,
          message: issue.message,
          line: issue.line,
        },
        diff: this.generateDiff(originalCode, fixedCode),
        summary: this.generateSummary(originalCode, fixedCode),
        stats: this.calculateStats(originalCode, fixedCode),
        risk: this.assessRisk(originalCode, fixedCode, issue),
        timestamp: new Date().toISOString(),
      };

      // Add confidence if provided
      if (options.confidence) {
        preview.confidence = options.confidence;
      }

      // Add validation results if provided
      if (options.validation) {
        preview.validation = options.validation;
      }

      return preview;
    } catch (err) {
      console.warn(`[Fix Preview] Error generating preview:`, err.message);
      return null;
    }
  }

  /**
   * Generate unified diff
   */
  generateDiff(originalCode, fixedCode) {
    try {
      const originalLines = originalCode.split("\n");
      const fixedLines = fixedCode.split("\n");

      const changes = diff.diffLines(originalCode, fixedCode, {
        ignoreWhitespace: false,
        newlineIsToken: true,
      });

      const diffLines = [];
      let originalLineNum = 1;
      let fixedLineNum = 1;

      for (const part of changes) {
        const lines = part.value.split("\n").filter((l) => l !== "");

        if (part.added) {
          for (const line of lines) {
            diffLines.push({
              type: "added",
              line: fixedLineNum++,
              content: line,
              originalLine: null,
            });
          }
        } else if (part.removed) {
          for (const line of lines) {
            diffLines.push({
              type: "removed",
              line: originalLineNum++,
              content: line,
              fixedLine: null,
            });
          }
        } else {
          // Unchanged
          for (const line of lines) {
            diffLines.push({
              type: "unchanged",
              line: originalLineNum++,
              content: line,
              originalLine: originalLineNum - 1,
              fixedLine: fixedLineNum++,
            });
          }
        }
      }

      return {
        lines: diffLines,
        unified: this.generateUnifiedDiff(originalCode, fixedCode),
        context: this.getContext(diffLines, 3),
      };
    } catch (err) {
      return {
        lines: [],
        unified: "",
        context: [],
      };
    }
  }

  /**
   * Generate unified diff format
   */
  generateUnifiedDiff(originalCode, fixedCode) {
    try {
      const changes = diff.diffLines(originalCode, fixedCode);
      let unified = "";
      let originalLineNum = 1;
      let fixedLineNum = 1;

      for (const part of changes) {
        const lines = part.value.split("\n").filter((l) => l !== "");

        if (part.added) {
          for (const line of lines) {
            unified += `+${line}\n`;
            fixedLineNum++;
          }
        } else if (part.removed) {
          for (const line of lines) {
            unified += `-${line}\n`;
            originalLineNum++;
          }
        } else {
          for (const line of lines) {
            unified += ` ${line}\n`;
            originalLineNum++;
            fixedLineNum++;
          }
        }
      }

      return unified;
    } catch (err) {
      return "";
    }
  }

  /**
   * Generate summary of changes
   */
  generateSummary(originalCode, fixedCode) {
    const originalLines = originalCode.split("\n");
    const fixedLines = fixedCode.split("\n");

    const added = fixedLines.length - originalLines.length;
    const removed = originalLines.length - fixedLines.length;
    const modified = Math.min(originalLines.length, fixedLines.length);

    return {
      linesAdded: Math.max(0, added),
      linesRemoved: Math.max(0, removed),
      linesModified: modified,
      totalChanges: Math.abs(added) + Math.abs(removed),
    };
  }

  /**
   * Calculate statistics
   */
  calculateStats(originalCode, fixedCode) {
    return {
      originalSize: originalCode.length,
      fixedSize: fixedCode.length,
      sizeChange: fixedCode.length - originalCode.length,
      originalLines: originalCode.split("\n").length,
      fixedLines: fixedCode.split("\n").length,
      lineChange:
        fixedCode.split("\n").length - originalCode.split("\n").length,
    };
  }

  /**
   * Assess risk of the fix
   */
  assessRisk(originalCode, fixedCode, issue) {
    let riskScore = 0;
    const riskFactors = [];

    // Large changes are riskier
    const sizeChange = Math.abs(fixedCode.length - originalCode.length);
    if (sizeChange > 1000) {
      riskScore += 0.3;
      riskFactors.push("Large code change");
    }

    // Many line changes are riskier
    const lineChange = Math.abs(
      fixedCode.split("\n").length - originalCode.split("\n").length,
    );
    if (lineChange > 50) {
      riskScore += 0.2;
      riskFactors.push("Many lines changed");
    }

    // Security fixes are riskier
    if (issue.type === "security") {
      riskScore += 0.2;
      riskFactors.push("Security-related change");
    }

    // Critical issues are riskier
    if (issue.severity === "critical") {
      riskScore += 0.2;
      riskFactors.push("Critical severity issue");
    }

    // Architecture/refactoring changes are riskier
    if (["architecture", "refactoring", "design"].includes(issue.type)) {
      riskScore += 0.3;
      riskFactors.push("Architectural change");
    }

    // Determine risk level
    let riskLevel = "low";
    if (riskScore >= 0.7) {
      riskLevel = "high";
    } else if (riskScore >= 0.4) {
      riskLevel = "medium";
    }

    return {
      score: Math.min(1.0, riskScore),
      level: riskLevel,
      factors: riskFactors,
    };
  }

  /**
   * Get context around changes
   */
  getContext(diffLines, contextLines = 3) {
    const changedLines = diffLines.filter((l) => l.type !== "unchanged");
    if (changedLines.length === 0) {
      return [];
    }

    const contexts = [];
    for (const changedLine of changedLines) {
      const lineNum = changedLine.originalLine || changedLine.line;
      const start = Math.max(0, lineNum - contextLines - 1);
      const end = lineNum + contextLines;

      contexts.push({
        line: lineNum,
        start,
        end,
        before: diffLines.slice(start, lineNum - 1).map((l) => l.content),
        after: diffLines.slice(lineNum, end).map((l) => l.content),
      });
    }

    return contexts;
  }

  /**
   * Format preview for display
   */
  formatPreview(preview, format = "text") {
    if (format === "json") {
      return JSON.stringify(preview, null, 2);
    }

    if (format === "html") {
      return this.formatHTML(preview);
    }

    // Default: text format
    return this.formatText(preview);
  }

  /**
   * Format as text
   */
  formatText(preview) {
    let text = `Fix Preview for ${preview.filePath}\n`;
    text += `Issue: ${preview.issue.type} - ${preview.issue.message}\n`;
    text += `Risk: ${preview.risk.level} (${(preview.risk.score * 100).toFixed(0)}%)\n\n`;
    text += `Summary:\n`;
    text += `  Lines added: ${preview.summary.linesAdded}\n`;
    text += `  Lines removed: ${preview.summary.linesRemoved}\n`;
    text += `  Total changes: ${preview.summary.totalChanges}\n\n`;
    text += `Diff:\n${preview.diff.unified}\n`;

    return text;
  }

  /**
   * Format as HTML
   */
  formatHTML(preview) {
    let html = `<div class="fix-preview">`;
    html += `<h3>Fix Preview: ${preview.filePath}</h3>`;
    html += `<div class="issue-info">`;
    html += `<p><strong>Issue:</strong> ${preview.issue.type} - ${preview.issue.message}</p>`;
    html += `<p><strong>Risk:</strong> <span class="risk-${preview.risk.level}">${
      preview.risk.level
    }</span> (${(preview.risk.score * 100).toFixed(0)}%)</p>`;
    html += `</div>`;
    html += `<div class="diff">`;

    for (const line of preview.diff.lines) {
      const className =
        line.type === "added"
          ? "added"
          : line.type === "removed"
            ? "removed"
            : "unchanged";
      html += `<div class="diff-line ${className}">`;
      html += `<span class="line-num">${line.line}</span>`;
      html += `<span class="line-content">${this.escapeHTML(line.content)}</span>`;
      html += `</div>`;
    }

    html += `</div>`;
    html += `</div>`;

    return html;
  }

  /**
   * Escape HTML
   */
  escapeHTML(text) {
    return String(text)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }
}

module.exports = new FixPreviewService();

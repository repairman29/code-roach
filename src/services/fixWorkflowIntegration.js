/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixWorkflowIntegration.js
 * Last Sync: 2025-12-25T07:02:33.985Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Workflow Integration Service
 * Sprint 6: Integrates fixes into development workflow (Git, CI/CD, etc.)
 */

const { exec } = require("child_process");
const { promisify } = require("util");
const fs = require("fs").promises;
const path = require("path");
const { createLogger } = require("../utils/logger");
const log = createLogger("FixWorkflowIntegration");

const execAsync = promisify(exec);

class FixWorkflowIntegration {
  constructor() {
    this.gitEnabled = false;
    this.ciEnabled = false;
    this.checkGitAvailability();
  }

  /**
   * Check if Git is available
   */
  async checkGitAvailability() {
    try {
      await execAsync("git --version");
      this.gitEnabled = true;
    } catch (err) {
      this.gitEnabled = false;
    }
  }

  /**
   * Apply fix with workflow integration
   */
  async applyFixWithWorkflow(fixData) {
    const {
      filePath,
      originalCode,
      fixedCode,
      issue,
      fix,
      options = {},
    } = fixData;

    const {
      createBranch = false,
      commit = false,
      createPR = false,
      skipGit = false,
    } = options;

    try {
      // 1. Write fix to file
      await fs.writeFile(filePath, fixedCode, "utf8");

      // 2. Git operations if enabled
      if (!skipGit && this.gitEnabled) {
        if (createBranch) {
          await this.createFixBranch(issue, filePath);
        }

        if (commit) {
          await this.commitFix(issue, fix, filePath);
        }

        if (createPR) {
          await this.createPullRequest(issue, fix, filePath);
        }
      }

      return {
        success: true,
        filePath,
        git: {
          branchCreated: createBranch,
          committed: commit,
          prCreated: createPR,
        },
      };
    } catch (err) {
      console.error("[Workflow Integration] Error:", err);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Create a branch for the fix
   */
  async createFixBranch(issue, filePath) {
    try {
      const branchName = this.generateBranchName(issue);

      // Check if branch exists
      try {
        await execAsync(
          `git show-ref --verify --quiet refs/heads/${branchName}`,
        );
        // Branch exists, use it
      } catch (err) {
        // Branch doesn't exist, create it
        await execAsync(`git checkout -b ${branchName}`);
      }

      return {
        success: true,
        branchName,
      };
    } catch (err) {
      log.warn(
        "[Workflow Integration] Failed to create branch:",
        err.message,
      );
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Commit the fix
   */
  async commitFix(issue, fix, filePath) {
    try {
      const commitMessage = this.generateCommitMessage(issue, fix);

      // Stage the file
      await execAsync(`git add "${filePath}"`);

      // Commit
      await execAsync(`git commit -m "${commitMessage}"`);

      return {
        success: true,
        commitMessage,
      };
    } catch (err) {
      log.warn("[Workflow Integration] Failed to commit:", err.message);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Create a pull request (if GitHub CLI is available)
   */
  async createPullRequest(issue, fix, filePath) {
    try {
      // Check if gh CLI is available
      try {
        await execAsync("gh --version");
      } catch (err) {
        return {
          success: false,
          error: "GitHub CLI (gh) not available",
        };
      }

      const branchName = this.generateBranchName(issue);
      const title = this.generatePRTitle(issue, fix);
      const body = this.generatePRBody(issue, fix, filePath);

      // Create PR
      const { stdout } = await execAsync(
        `gh pr create --title "${title}" --body "${body}" --base main`,
      );

      return {
        success: true,
        prUrl: stdout.trim(),
      };
    } catch (err) {
      log.warn("[Workflow Integration] Failed to create PR:", err.message);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  /**
   * Generate branch name from issue
   */
  generateBranchName(issue) {
    const type = (issue.type || "fix").toLowerCase().replace(/[^a-z0-9]/g, "-");
    const message = (issue.message || "issue")
      .toLowerCase()
      .substring(0, 40)
      .replace(/[^a-z0-9]/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");

    return `code-roach/${type}-${message}-${Date.now().toString().slice(-6)}`;
  }

  /**
   * Generate commit message
   */
  generateCommitMessage(issue, fix) {
    const type = issue.type || "fix";
    const message = issue.message || "Issue";
    const method = fix.method || "auto-fix";

    return `fix(${type}): ${message.substring(0, 50)}\n\nAuto-fixed by Code Roach (
            ${method})\n\nIssue: ${message}\nFix confidence: ${((fix.confidence || 0) * 100).toFixed(0)}%`;
  }

  /**
   * Generate PR title
   */
  generatePRTitle(issue, fix) {
    const type = issue.type || "fix";
    const message = issue.message || "Issue";
    return `[Code Roach] Fix ${type}: ${message.substring(0, 60)}`;
  }

  /**
   * Generate PR body
   */
  generatePRBody(issue, fix, filePath) {
    return `## Auto-fixed by Code Roach

**Issue Type:** ${issue.type || "unknown"}
**Severity:** ${issue.severity || "medium"}
**File:** ${filePath}
**Line:** ${issue.line || "unknown"}

### Issue
${issue.message || "No description"}

### Fix
- **Method:** ${fix.method || "auto-fix"}
- **Confidence:** ${((fix.confidence || 0) * 100).toFixed(0)}%
- **Safety:** ${fix.safety || "medium"}

### Changes
${(fix.changes || []).map((c) => `- ${c}`).join("\n")}

### Explanation
${fix.explanation || "Auto-fixed by Code Roach"}

---
*This PR was automatically created by Code Roach. Please review before merging.*`;
  }

  /**
   * Generate fix summary for CI/CD
   */
  generateFixSummary(fixes) {
    const summary = {
      total: fixes.length,
      byType: {},
      byMethod: {},
      byConfidence: {
        high: 0,
        medium: 0,
        low: 0,
      },
    };

    fixes.forEach((fix) => {
      // By type
      const type = fix.issue.type || "unknown";
      summary.byType[type] = (summary.byType[type] || 0) + 1;

      // By method
      const method = fix.fix.method || "unknown";
      summary.byMethod[method] = (summary.byMethod[method] || 0) + 1;

      // By confidence
      const confidence = fix.fix.confidence || 0;
      if (confidence >= 0.8) summary.byConfidence.high++;
      else if (confidence >= 0.6) summary.byConfidence.medium++;
      else summary.byConfidence.low++;
    });

    return summary;
  }

  /**
   * Generate CI/CD report
   */
  async generateCICDReport(fixes, options = {}) {
    const {
      format = "json", // 'json', 'markdown', 'text'
      includeDetails = true,
    } = options;

    const summary = this.generateFixSummary(fixes);

    if (format === "json") {
      return JSON.stringify(
        {
          summary,
          fixes: includeDetails ? fixes : undefined,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      );
    }

    if (format === "markdown") {
      let markdown = `# Code Roach Fix Report\n\n`;
      markdown += `**Total Fixes:** ${summary.total}\n\n`;
      markdown += `## By Type\n\n`;
      Object.entries(summary.byType).forEach(([type, count]) => {
        markdown += `- ${type}: ${count}\n`;
      });
      markdown += `\n## By Method\n\n`;
      Object.entries(summary.byMethod).forEach(([method, count]) => {
        markdown += `- ${method}: ${count}\n`;
      });
      markdown += `\n## By Confidence\n\n`;
      markdown += `- High (≥80%): ${summary.byConfidence.high}\n`;
      markdown += `- Medium (60-80%): ${summary.byConfidence.medium}\n`;
      markdown += `- Low (<60%): ${summary.byConfidence.low}\n`;

      if (includeDetails) {
        markdown += `\n## Fix Details\n\n`;
        fixes.forEach((fix, index) => {
          markdown += `### Fix ${index + 1}\n\n`;
          markdown += `- **File:** ${fix.filePath}\n`;
          markdown += `- **Issue:** ${fix.issue.message}\n`;
          markdown += `- **Method:** ${fix.fix.method}\n`;
          markdown += `- **Confidence:** ${((fix.fix.confidence || 0) * 100).toFixed(0)}%\n\n`;
        });
      }

      return markdown;
    }

    // Text format
    let text = `Code Roach Fix Report\n`;
    text += `Total Fixes: ${summary.total}\n\n`;
    text += `By Type:\n`;
    Object.entries(summary.byType).forEach(([type, count]) => {
      text += `  ${type}: ${count}\n`;
    });
    text += `\nBy Method:\n`;
    Object.entries(summary.byMethod).forEach(([method, count]) => {
      text += `  ${method}: ${count}\n`;
    });

    return text;
  }

  /**
   * Check if in CI/CD environment
   */
  isCIEnvironment() {
    return !!(
      process.env.CI ||
      process.env.GITHUB_ACTIONS ||
      process.env.GITLAB_CI ||
      process.env.JENKINS_URL ||
      process.env.CIRCLECI
    );
  }

  /**
   * Get CI/CD environment info
   */
  getCIEnvironment() {
    if (process.env.GITHUB_ACTIONS) {
      return {
        provider: "github-actions",
        repo: process.env.GITHUB_REPOSITORY,
        workflow: process.env.GITHUB_WORKFLOW,
        runId: process.env.GITHUB_RUN_ID,
      };
    }
    if (process.env.GITLAB_CI) {
      return {
        provider: "gitlab-ci",
        project: process.env.CI_PROJECT_NAME,
        pipeline: process.env.CI_PIPELINE_ID,
      };
    }
    if (process.env.JENKINS_URL) {
      return {
        provider: "jenkins",
        job: process.env.JOB_NAME,
        build: process.env.BUILD_NUMBER,
      };
    }
    if (process.env.CIRCLECI) {
      return {
        provider: "circleci",
        repo: process.env.CIRCLE_PROJECT_REPONAME,
        build: process.env.CIRCLE_BUILD_NUM,
      };
    }
    return null;
  }
}

module.exports = new FixWorkflowIntegration();

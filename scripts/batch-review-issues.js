/**
 * Batch Review Issues Script
 * Helps review and fix Code Roach issues in batches
 * Teaches Code Roach to learn from fixes
 */

const http = require("http");
const fs = require("fs").promises;
const path = require("path");
const readline = require("readline");
const { createLogger } = require('../utils/logger');
const log = createLogger('batch-review-issues');


const SERVER_URL = process.env.CODE_ROACH_URL || "http://localhost:3000";
const BATCH_SIZE = 50;

// Color codes for terminal
const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

class BatchReviewer {
  constructor() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    this.stats = {
      reviewed: 0,
      approved: 0,
      rejected: 0,
      deferred: 0,
      fixed: 0,
      learned: 0,
    };
  }

  /**
   * Make HTTP request
   */
  async request(method, path, data = null) {
    return new Promise((resolve, reject) => {
      const url = new URL(path, SERVER_URL);
      const options = {
        method,
        hostname: url.hostname,
        port: url.port || 3000,
        path: url.pathname + url.search,
        headers: {
          "Content-Type": "application/json",
        },
      };

      const req = http.request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          try {
            const json = JSON.parse(body);
            resolve({ status: res.statusCode, data: json });
          } catch (e) {
            resolve({ status: res.statusCode, data: body });
          }
        });
      });

      req.on("error", reject);
      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  /**
   * Get issues needing review
   */
  async getIssuesForReview(filters = {}) {
    const { status, data } = await this.request(
      "GET",
      "/api/code-roach/issues/review",
    );
    if (status !== 200 || !data.success) {
      throw new Error(
        `Failed to fetch issues: ${data.error || "Unknown error"}`,
      );
    }

    let issues = data.issues || [];

    // Apply filters
    if (filters.severity) {
      issues = issues.filter((i) => i.error?.severity === filters.severity);
    }
    if (filters.type) {
      issues = issues.filter((i) => i.error?.type === filters.type);
    }
    if (filters.file) {
      issues = issues.filter((i) => i.error?.file?.includes(filters.file));
    }

    return issues;
  }

  /**
   * Prioritize issues
   */
  prioritizeIssues(issues) {
    const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    const typeOrder = {
      security: 0,
      performance: 1,
      "best-practice": 2,
      style: 3,
    };

    return issues.sort((a, b) => {
      const aSev = severityOrder[a.error?.severity] ?? 3;
      const bSev = severityOrder[b.error?.severity] ?? 3;
      if (aSev !== bSev) return aSev - bSev;

      const aType = typeOrder[a.error?.type] ?? 3;
      const bType = typeOrder[b.error?.type] ?? 3;
      if (aType !== bType) return aType - bType;

      return (b.timestamp || 0) - (a.timestamp || 0);
    });
  }

  /**
   * Generate report
   */
  generateReport(issues) {
    const report = {
      total: issues.length,
      bySeverity: {},
      byType: {},
      byFile: {},
      critical: [],
      high: [],
      security: [],
      performance: [],
    };

    issues.forEach((issue) => {
      const severity = issue.error?.severity || "unknown";
      const type = issue.error?.type || "unknown";
      const file = issue.error?.file || "unknown";

      report.bySeverity[severity] = (report.bySeverity[severity] || 0) + 1;
      report.byType[type] = (report.byType[type] || 0) + 1;
      report.byFile[file] = (report.byFile[file] || 0) + 1;

      if (severity === "critical") report.critical.push(issue);
      if (severity === "high") report.high.push(issue);
      if (type === "security") report.security.push(issue);
      if (type === "performance") report.performance.push(issue);
    });

    return report;
  }

  /**
   * Display report
   */
  displayReport(report) {
    console.log(
      `\n${colors.cyan}${colors.bright}═══════════════════════════════════════════════════${colors.reset}`,
    );
    console.log(
      `${colors.cyan}${colors.bright}  Code Roach Issues Report${colors.reset}`,
    );
    console.log(
      `${colors.cyan}${colors.bright}═══════════════════════════════════════════════════${colors.reset}\n`,
    );

    console.log(
      `${colors.bright}Total Issues:${colors.reset} ${report.total}\n`,
    );

    console.log(`${colors.bright}By Severity:${colors.reset}`);
    Object.entries(report.bySeverity)
      .sort((a, b) => {
        const order = { critical: 0, high: 1, medium: 2, low: 3, unknown: 4 };
        return (order[a[0]] || 4) - (order[b[0]] || 4);
      })
      .forEach(([sev, count]) => {
        const color =
          sev === "critical"
            ? colors.red
            : sev === "high"
              ? colors.yellow
              : colors.reset;
        console.log(`  ${color}${sev.padEnd(10)}${colors.reset}: ${count}`);
      });

    console.log(`\n${colors.bright}By Type:${colors.reset}`);
    Object.entries(report.byType)
      .sort((a, b) => b[1] - a[1])
      .forEach(([type, count]) => {
        console.log(`  ${type.padEnd(20)}: ${count}`);
      });

    console.log(`\n${colors.bright}Top Files:${colors.reset}`);
    Object.entries(report.byFile)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([file, count]) => {
        console.log(`  ${file.padEnd(50)}: ${count}`);
      });

    if (report.critical.length > 0) {
      console.log(
        `\n${colors.red}${colors.bright}⚠️  Critical Issues: ${report.critical.length}${colors.reset}`,
      );
    }
    if (report.security.length > 0) {
      console.log(
        `${colors.yellow}${colors.bright}🔒 Security Issues: ${report.security.length}${colors.reset}`,
      );
    }
  }

  /**
   * Review issue
   */
  async reviewIssue(issue, action, notes = "") {
    const { status, data } = await this.request(
      "POST",
      `/api/code-roach/issues/${issue.id}/review`,
      { action, notes },
    );

    if (status === 200 && data.success) {
      this.stats.reviewed++;
      if (action === "approve") this.stats.approved++;
      else if (action === "reject") this.stats.rejected++;
      else if (action === "defer") this.stats.deferred++;
      return true;
    }

    return false;
  }

  /**
   * Apply fix and teach Code Roach
   */
  async applyFixAndLearn(issue, fixCode, filePath) {
    try {
      // Record to knowledge base via API
      const { status, data } = await this.request(
        "POST",
        "/api/code-roach/learning/fix",
        {
          issue: {
            id: issue.id,
            type: issue.error?.type,
            message: issue.error?.message,
            severity: issue.error?.severity,
            file: issue.error?.file,
            line: issue.error?.line,
          },
          fix: {
            code: fixCode,
            type: "manual",
            safety: issue.fix?.safety || "safe",
            confidence: issue.fix?.confidence || 0.95,
          },
          filePath: filePath || issue.error?.file,
          success: true,
          confidence: issue.fix?.confidence || 0.95,
          method: "batch-review",
          notes: "Applied via batch review",
        },
      );

      if (status === 200 && data.success) {
        this.stats.fixed++;
        this.stats.learned++;
        console.log(
          `${colors.green}✓${colors.reset} Learned from fix: ${issue.id}`,
        );
        return true;
      }

      return false;
    } catch (err) {
      console.error(
        `${colors.red}Error applying fix: ${err.message}${colors.reset}`,
      );
      return false;
    }
  }

  /**
   * Batch review with auto-fix
   */
  async batchReview(issues, options = {}) {
    const {
      autoApprove = false,
      autoFix = false,
      severity = null,
      type = null,
      dryRun = false,
    } = options;

    console.log(
      `\n${colors.cyan}Starting batch review of ${issues.length} issues...${colors.reset}\n`,
    );

    let processed = 0;
    const batch = [];

    for (const issue of issues) {
      if (severity && issue.error?.severity !== severity) continue;
      if (type && issue.error?.type !== type) continue;

      processed++;
      batch.push(issue);

      if (batch.length >= BATCH_SIZE || processed === issues.length) {
        await this.processBatch(batch, { autoApprove, autoFix, dryRun });
        batch.length = 0;
      }
    }

    this.displayStats();
  }

  /**
   * Process batch of issues
   */
  async processBatch(batch, options) {
    const { autoApprove, autoFix, dryRun } = options;
    const fixes = [];

    for (const issue of batch) {
      if (dryRun) {
        console.log(
          `[DRY RUN] Would review: ${issue.id} - ${issue.error?.message}`,
        );
        continue;
      }

      // Auto-approve safe fixes
      if (autoApprove && issue.fix && issue.fix.safety === "safe") {
        await this.reviewIssue(issue, "approve", "Auto-approved safe fix");
        if (autoFix && issue.fix.code) {
          await this.applyFixAndLearn(issue, issue.fix.code, issue.error?.file);
          fixes.push({
            issue: issue.error || issue,
            fix: issue.fix,
            filePath: issue.error?.file,
            success: true,
            confidence: issue.fix.confidence || 0.9,
          });
        }
        continue;
      }

      // Auto-approve all if flag is set
      if (autoApprove) {
        await this.reviewIssue(issue, "approve", "Batch approved");
        if (autoFix && issue.fix?.code) {
          await this.applyFixAndLearn(issue, issue.fix.code, issue.error?.file);
          fixes.push({
            issue: issue.error || issue,
            fix: issue.fix,
            filePath: issue.error?.file,
            success: true,
            confidence: issue.fix.confidence || 0.8,
          });
        }
      }
    }

    // Learn batch patterns if we processed fixes
    if (fixes.length > 0 && !dryRun) {
      await this.learnBatchPatterns(batch, fixes);
    }
  }

  /**
   * Learn batch patterns from processed fixes
   */
  async learnBatchPatterns(issues, fixes) {
    try {
      // Group fixes by type and severity
      const groups = {};
      fixes.forEach((fix) => {
        const key = `${fix.issue.type}-${fix.issue.severity}`;
        if (!groups[key]) {
          groups[key] = {
            type: fix.issue.type,
            severity: fix.issue.severity,
            count: 0,
            successRate: 0,
          };
        }
        groups[key].count++;
      });

      // Create patterns for groups with multiple fixes
      const patterns = [];
      Object.values(groups).forEach((group) => {
        if (group.count >= 3) {
          // Only create patterns for groups with 3+ fixes
          patterns.push({
            name: `Auto-approve ${group.type} ${group.severity} fixes`,
            description: `Automatically approve ${group.severity} severity ${group.type} fixes`,
            criteria: {
              type: group.type,
              severity: group.severity,
              hasFix: true,
            },
            action: "auto-approve",
            successRate: 95,
            examples: fixes
              .filter(
                (f) =>
                  f.issue.type === group.type &&
                  f.issue.severity === group.severity,
              )
              .slice(0, 3)
              .map((f) => f.issue.message),
          });
        }
      });

      if (patterns.length > 0) {
        const { status, data } = await this.request(
          "POST",
          "/api/code-roach/learning/batch",
          {
            issues: issues.map((i) => i.error || i),
            fixes: fixes,
            patterns: patterns,
            metadata: {
              batchSize: issues.length,
              fixCount: fixes.length,
              timestamp: new Date().toISOString(),
            },
          },
        );

        if (status === 200 && data.success) {
          console.log(
            `${colors.magenta}✓${colors.reset} Learned ${patterns.length} batch patterns`,
          );
          this.stats.learned += patterns.length;
        }
      }
    } catch (err) {
      log.warn(
        `${colors.yellow}Warning: Failed to learn batch patterns: ${err.message}${colors.reset}`,
      );
    }
  }

  /**
   * Display stats
   */
  displayStats() {
    console.log(
      `\n${colors.green}${colors.bright}═══════════════════════════════════════════════════${colors.reset}`,
    );
    console.log(
      `${colors.green}${colors.bright}  Review Complete!${colors.reset}`,
    );
    console.log(
      `${colors.green}${colors.bright}═══════════════════════════════════════════════════${colors.reset}\n`,
    );

    console.log(
      `${colors.bright}Reviewed:${colors.reset} ${this.stats.reviewed}`,
    );
    console.log(
      `${colors.green}Approved:${colors.reset} ${this.stats.approved}`,
    );
    console.log(`${colors.red}Rejected:${colors.reset} ${this.stats.rejected}`);
    console.log(
      `${colors.yellow}Deferred:${colors.reset} ${this.stats.deferred}`,
    );
    console.log(`${colors.cyan}Fixed:${colors.reset} ${this.stats.fixed}`);
    console.log(
      `${colors.magenta}Learned:${colors.reset} ${this.stats.learned} patterns added to knowledge base\n`,
    );
  }

  /**
   * Interactive review
   */
  async interactiveReview(issues) {
    console.log(`\n${colors.cyan}Interactive Review Mode${colors.reset}\n`);
    console.log(
      `Commands: approve (a), reject (r), defer (d), skip (s), quit (q)\n`,
    );

    for (const issue of issues) {
      console.log(`\n${colors.bright}Issue: ${issue.id}${colors.reset}`);
      console.log(`File: ${issue.error?.file}:${issue.error?.line}`);
      console.log(
        `Type: ${issue.error?.type} | Severity: ${issue.error?.severity}`,
      );
      console.log(`Message: ${issue.error?.message}`);
      if (issue.fix) {
        console.log(`Fix: ${issue.fix.code?.substring(0, 100)}...`);
      }

      const answer = await this.question("Action (a/r/d/s/q): ");

      if (answer === "q") break;
      if (answer === "s") continue;

      let action = null;
      if (answer === "a") action = "approve";
      else if (answer === "r") action = "reject";
      else if (answer === "d") action = "defer";

      if (action) {
        const notes = await this.question("Notes (optional): ");
        await this.reviewIssue(issue, action, notes);

        if (action === "approve" && issue.fix?.code) {
          const shouldFix = await this.question("Apply fix? (y/n): ");
          if (shouldFix === "y") {
            await this.applyFixAndLearn(
              issue,
              issue.fix.code,
              issue.error?.file,
            );
          }
        }
      }
    }
  }

  /**
   * Question helper
   */
  question(query) {
    return new Promise((resolve) => this.rl.question(query, resolve));
  }

  /**
   * Close
   */
  close() {
    this.rl.close();
  }
}

// CLI interface
async function main() {
  const reviewer = new BatchReviewer();
  const args = process.argv.slice(2);

  try {
    // Get issues
    console.log(`${colors.cyan}Fetching issues...${colors.reset}`);
    let issues = await reviewer.getIssuesForReview();

    if (issues.length === 0) {
      console.log(`${colors.green}No issues need review!${colors.reset}`);
      reviewer.close();
      return;
    }

    // Prioritize
    issues = reviewer.prioritizeIssues(issues);

    // Generate and display report
    const report = reviewer.generateReport(issues);
    reviewer.displayReport(report);

    // Parse arguments
    const mode = args[0] || "report";
    const filters = {};

    if (args.includes("--severity")) {
      const idx = args.indexOf("--severity");
      filters.severity = args[idx + 1];
    }
    if (args.includes("--type")) {
      const idx = args.indexOf("--type");
      filters.type = args[idx + 1];
    }

    // Apply filters
    if (filters.severity || filters.type) {
      issues = await reviewer.getIssuesForReview(filters);
      issues = reviewer.prioritizeIssues(issues);
    }

    // Execute mode
    if (mode === "report") {
      // Just show report
    } else if (mode === "batch") {
      const dryRun = args.includes("--dry-run");
      const autoApprove = args.includes("--auto-approve");
      const autoFix = args.includes("--auto-fix");

      await reviewer.batchReview(issues, {
        autoApprove,
        autoFix,
        dryRun,
        ...filters,
      });
    } else if (mode === "interactive") {
      await reviewer.interactiveReview(issues.slice(0, 100)); // Limit to 100 for interactive
    } else if (mode === "critical") {
      const critical = issues.filter((i) => i.error?.severity === "critical");
      console.log(
        `\n${colors.red}Found ${critical.length} critical issues${colors.reset}`,
      );
      await reviewer.interactiveReview(critical);
    }
  } catch (err) {
    console.error(`${colors.red}Error: ${err.message}${colors.reset}`);
    process.exit(1);
  } finally {
    reviewer.close();
  }
}

if (require.main === module) {
  main().catch(console.error);
}

module.exports = BatchReviewer;

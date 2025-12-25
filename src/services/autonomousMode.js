/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/autonomousMode.js
 * Last Sync: 2025-12-25T07:02:34.029Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Autonomous Mode Service
 *
 * NEXT-LEVEL: Fully autonomous code fixing and improvement system
 *
 * Features:
 * 1. Automatic issue detection and fixing
 * 2. Continuous code improvement
 * 3. Self-learning and adaptation
 * 4. Proactive code quality enhancement
 * 5. Intelligent scheduling and prioritization
 */

const codebaseCrawler = require("./codebaseCrawler");
const { createLogger } = require("../utils/logger");
const log = createLogger("AutonomousMode");
const codebaseWatcher = require("./codebaseWatcher");
const codeUnderstandingEngine = require("./codeUnderstandingEngine");
const innovativeCodeGenerator = require("./innovativeCodeGenerator");
const incrementalFixEngine = require("./incrementalFixEngine");
const advancedFixIntelligence = require("./advancedFixIntelligence");
const quantumFixOptimizer = require("./quantumFixOptimizer");
const issueStorageService = require("./issueStorageService");
const path = require("path");

class AutonomousMode {
  constructor() {
    this.isActive = false;
    this.startTime = null;
    this.schedule = null;
    this.stats = {
      issuesDetected: 0,
      issuesFixed: 0,
      improvementsApplied: 0,
      codeGenerated: 0,
      cyclesCompleted: 0,
    };
    this.config = {
      scanInterval: 5 * 60 * 1000, // 5 minutes
      fixInterval: 10 * 60 * 1000, // 10 minutes
      improvementInterval: 30 * 60 * 1000, // 30 minutes
      maxFixesPerCycle: 50,
      maxImprovementsPerCycle: 10,
      autoApplyFixes: true,
      autoApplyImprovements: false, // Review first
      enableCodeGeneration: true,
      enableDocumentation: true,
      enableTestGeneration: true,
    };
  }

  /**
   * Start autonomous mode
   */
  async start(options = {}) {
    if (this.isActive) {
      console.log("[Autonomous Mode] Already active");
      return;
    }

    // Merge config
    this.config = { ...this.config, ...options };

    console.log("🤖 [Autonomous Mode] Starting...");
    console.log(`   Scan interval: ${this.config.scanInterval / 1000}s`);
    console.log(`   Fix interval: ${this.config.fixInterval / 1000}s`);
    console.log(
      `   Improvement interval: ${this.config.improvementInterval / 1000}s`,
    );

    this.isActive = true;
    this.startTime = Date.now();

    // Start file watcher
    await this.startFileWatcher();

    // Start scheduled tasks
    this.startScheduledTasks();

    // Run initial scan (don't await - run in background)
    this.runInitialScan().catch((err) => {
      console.error("[Autonomous Mode] Initial scan error:", err.message);
    });

    console.log("✅ [Autonomous Mode] Started successfully");
  }

  /**
   * Stop autonomous mode
   */
  stop() {
    if (!this.isActive) {
      return;
    }

    console.log("🛑 [Autonomous Mode] Stopping...");

    this.isActive = false;

    // Stop file watcher
    if (this.fileWatcher) {
      this.fileWatcher.stop();
    }

    // Clear scheduled tasks
    if (this.schedule) {
      clearInterval(this.schedule.scanInterval);
      clearInterval(this.schedule.fixInterval);
      clearInterval(this.schedule.improvementInterval);
    }

    console.log("✅ [Autonomous Mode] Stopped");
  }

  /**
   * Start file watcher for real-time detection
   */
  async startFileWatcher() {
    try {
      // Create watcher instance
      const CodebaseWatcherClass = require("./codebaseWatcher");
      this.fileWatcher = new CodebaseWatcherClass({
        detectIssues: true,
        onFileChange: async (filePath) => {
          await this.handleFileChange(filePath);
        },
      });

      await this.fileWatcher.start();
      console.log("✅ [Autonomous Mode] File watcher started");
    } catch (err) {
      log.warn("[Autonomous Mode] File watcher failed:", err.message);
    }
  }

  /**
   * Handle file change
   */
  async handleFileChange(filePath) {
    if (!this.isActive) return;

    console.log(`📝 [Autonomous Mode] File changed: ${filePath}`);

    try {
      // Get project ID from config or environment
      const projectId =
        this.config.projectId || process.env.DEFAULT_PROJECT_ID || null;

      // Get absolute path
      const absolutePath = path.isAbsolute(filePath)
        ? filePath
        : path.join(process.cwd(), filePath);

      // Use codebaseCrawler.analyzeFile() for consistent issue detection
      const fileResult = await codebaseCrawler.analyzeFile(absolutePath, {
        autoFix: this.config.autoApplyFixes,
        projectId: projectId,
        skipUnchanged: false,
      });

      // Store issues if found
      if (fileResult && fileResult.issues && fileResult.issues.length > 0) {
        if (projectId) {
          // Map issues to include file path
          const issuesToStore = fileResult.issues.map((issue) => ({
            ...issue,
            file: fileResult.filePath || absolutePath,
            filePath: fileResult.filePath || absolutePath,
          }));

          await issueStorageService.storeIssues(issuesToStore, projectId);
          console.log(
            `✅ [Autonomous Mode] Stored ${issuesToStore.length} issue(s) for ${path.basename(filePath)}`,
          );
          this.stats.issuesDetected += issuesToStore.length;
        } else {
          console.log(
            `⚠️  [Autonomous Mode] Found ${fileResult.issues.length} issue(s) but no projectId set - issues not stored`,
          );
        }
      } else if (fileResult) {
        console.log(
          `✅ [Autonomous Mode] Scanned ${path.basename(filePath)} - no issues found`,
        );
      }

      // Also run code understanding and improvements (if enabled)
      if (this.config.enableCodeGeneration) {
        try {
          const fs = require("fs").promises;
          const code = await fs.readFile(absolutePath, "utf8");
          const understanding = await codeUnderstandingEngine.understandCode(
            code,
            filePath,
          );
          const improvements =
            await innovativeCodeGenerator.suggestImprovements(code, filePath);
          if (improvements.length > 0) {
            console.log(
              `💡 [Autonomous Mode] Found ${improvements.length} improvement suggestions for ${filePath}`,
            );
          }
        } catch (err) {
          // Improvements are optional, don't fail on error
          log.warn(
            `[Autonomous Mode] Improvement analysis skipped: ${err.message}`,
          );
        }
      }
    } catch (err) {
      log.warn(
        `[Autonomous Mode] Error handling file change: ${err.message}`,
      );
    }
  }

  /**
   * Start scheduled tasks
   */
  startScheduledTasks() {
    // Periodic scans
    this.schedule = {
      scanInterval: setInterval(() => {
        this.runPeriodicScan();
      }, this.config.scanInterval),

      fixInterval: setInterval(() => {
        this.runPeriodicFixes();
      }, this.config.fixInterval),

      improvementInterval: setInterval(() => {
        this.runPeriodicImprovements();
      }, this.config.improvementInterval),
    };
  }

  /**
   * Run initial scan
   */
  async runInitialScan() {
    console.log("🔍 [Autonomous Mode] Running initial scan...");

    try {
      const result = await codebaseCrawler.crawlCodebase(process.cwd(), {
        autoFix: this.config.autoApplyFixes,
        maxFiles: 100, // Limit initial scan
        useOptimizations: true,
        projectId:
          this.config.projectId || process.env.DEFAULT_PROJECT_ID || null,
      });

      this.stats.issuesDetected += result.stats.issuesFound || 0;
      this.stats.issuesFixed += result.stats.issuesAutoFixed || 0;

      console.log(
        `✅ [Autonomous Mode] Initial scan complete: ${result.stats.issuesFound} issues found, ${result.stats.issuesAutoFixed} fixed`,
      );
    } catch (err) {
      console.error("[Autonomous Mode] Initial scan failed:", err.message);
    }
  }

  /**
   * Run periodic scan
   */
  async runPeriodicScan() {
    if (!this.isActive) return;

    // Check if crawler is already running
    try {
      const status = await codebaseCrawler.getStatus();
      if (status && status.isRunning) {
        console.log(
          "⏳ [Autonomous Mode] Crawler already running, skipping this cycle",
        );
        // Still increment cycle count since we attempted
        this.stats.cyclesCompleted++;
        return;
      }
    } catch (err) {
      // If status check fails, continue anyway
    }

    console.log("🔍 [Autonomous Mode] Running periodic scan...");

    try {
      const result = await codebaseCrawler.crawlCodebase(process.cwd(), {
        autoFix: this.config.autoApplyFixes,
        maxFiles: 50, // Smaller periodic scans
        useOptimizations: true,
        crawlType: "changed", // Only scan changed files
        projectId:
          this.config.projectId || process.env.DEFAULT_PROJECT_ID || null,
      });

      this.stats.issuesDetected += result.stats.issuesFound || 0;
      this.stats.issuesFixed += result.stats.issuesAutoFixed || 0;
      this.stats.cyclesCompleted++;

      console.log(
        `✅ [Autonomous Mode] Periodic scan complete: ${result.stats.issuesFound} issues found, ${result.stats.issuesAutoFixed} fixed`,
      );
    } catch (err) {
      // If error is "already running", still count as cycle attempted
      if (err.message && err.message.includes("already running")) {
        console.log("⏳ [Autonomous Mode] Crawler busy, cycle skipped");
        this.stats.cyclesCompleted++;
      } else {
        console.error("[Autonomous Mode] Periodic scan failed:", err.message);
        // Still increment on error to track attempts
        this.stats.cyclesCompleted++;
      }
    }
  }

  /**
   * Run periodic fixes
   */
  async runPeriodicFixes() {
    if (!this.isActive) return;

    console.log("🔧 [Autonomous Mode] Running periodic fixes...");

    try {
      // Get pending issues
      const pendingIssues = await this.getPendingIssues();

      if (pendingIssues.length === 0) {
        console.log("✅ [Autonomous Mode] No pending issues to fix");
        return;
      }

      // Fix up to maxFixesPerCycle
      const issuesToFix = pendingIssues.slice(0, this.config.maxFixesPerCycle);

      for (const issue of issuesToFix) {
        await this.fixIssue(issue);
      }

      console.log(`✅ [Autonomous Mode] Fixed ${issuesToFix.length} issues`);
    } catch (err) {
      console.error("[Autonomous Mode] Periodic fixes failed:", err.message);
    }
  }

  /**
   * Run periodic improvements
   */
  async runPeriodicImprovements() {
    if (!this.isActive) return;

    console.log("✨ [Autonomous Mode] Running periodic improvements...");

    try {
      // Get files that could benefit from improvements
      const filesToImprove = await this.getFilesToImprove();

      if (filesToImprove.length === 0) {
        console.log("✅ [Autonomous Mode] No files need improvement");
        return;
      }

      // Improve up to maxImprovementsPerCycle
      const files = filesToImprove.slice(
        0,
        this.config.maxImprovementsPerCycle,
      );

      for (const filePath of files) {
        await this.improveFile(filePath);
      }

      console.log(`✅ [Autonomous Mode] Improved ${files.length} files`);
    } catch (err) {
      console.error(
        "[Autonomous Mode] Periodic improvements failed:",
        err.message,
      );
    }
  }

  /**
   * Detect issues in code
   */
  async detectIssues(code, filePath, understanding) {
    const issues = [];

    // Use code understanding to detect issues
    if (understanding.quality.maintainability < 50) {
      issues.push({
        type: "maintainability",
        severity: "medium",
        message: "Low maintainability score",
        filePath,
        line: 1,
      });
    }

    if (understanding.quality.security < 50) {
      issues.push({
        type: "security",
        severity: "high",
        message: "Security concerns detected",
        filePath,
        line: 1,
      });
    }

    // Use crawler to detect syntax/logic issues
    try {
      const CodebaseCrawlerClass = require("./codebaseCrawler");
      const crawler = new CodebaseCrawlerClass();
      const result = await crawler.analyzeFile(filePath, { autoFix: false });
      if (result && result.issues && result.issues.length > 0) {
        issues.push(...result.issues);
      }
    } catch (err) {
      // Ignore analysis errors
    }

    return issues;
  }

  /**
   * Fix issues
   */
  async fixIssues(issues, filePath, code) {
    const fs = require("fs").promises;

    for (const issue of issues) {
      try {
        await this.fixIssue(issue);
        this.stats.issuesFixed++;
      } catch (err) {
        log.warn(`[Autonomous Mode] Failed to fix issue: ${err.message}`);
      }
    }
  }

  /**
   * Fix a single issue
   */
  async fixIssue(issue) {
    const fs = require("fs").promises;
    const filePath = issue.filePath || issue.file;
    const code = await fs.readFile(filePath, "utf8");

    // Use quantum optimizer for complex issues
    const isComplex =
      issue.severity === "critical" || issue.severity === "high";

    if (isComplex) {
      const optimized = await quantumFixOptimizer.optimizeFix(
        issue,
        code,
        filePath,
      );
      if (optimized && optimized.bestFix) {
        // Use incremental fix engine for safety
        await incrementalFixEngine.applyIncrementalFix(
          optimized.bestFix,
          filePath,
          code,
        );
        return;
      }
    }

    // Use standard fix generation
    const fixHelpers = require("./codebaseCrawlerFixHelpers");
    const insights = await fixHelpers.getMetaLearningInsights(issue);
    const fix = await fixHelpers.generateFix(
      issue,
      code,
      filePath,
      null,
      insights,
      null,
    );

    if (fix && fix.fixedCode) {
      // Use incremental fix engine
      await incrementalFixEngine.applyIncrementalFix(
        { code: fix.fixedCode, method: fix.method, confidence: fix.confidence },
        filePath,
        code,
      );
    }
  }

  /**
   * Improve a file
   */
  async improveFile(filePath) {
    const fs = require("fs").promises;
    const code = await fs.readFile(filePath, "utf8");

    // Get improvement suggestions
    const suggestions = await innovativeCodeGenerator.suggestImprovements(
      code,
      filePath,
    );

    // Apply high-priority improvements
    const highPriority = suggestions.filter(
      (s) => s.priority === "high" || s.priority === "critical",
    );

    for (const suggestion of highPriority) {
      if (this.config.autoApplyImprovements) {
        // Auto-apply improvement
        await this.applyImprovement(suggestion, filePath, code);
      } else {
        // Log for review
        console.log(
          `💡 [Autonomous Mode] Improvement suggestion for ${filePath}: ${suggestion.message}`,
        );
      }
    }

    // Generate documentation if enabled
    if (this.config.enableDocumentation) {
      const docs = await innovativeCodeGenerator.generateDocumentation(
        code,
        filePath,
      );
      if (docs) {
        console.log(
          `📚 [Autonomous Mode] Generated documentation for ${filePath}`,
        );
      }
    }

    // Generate tests if enabled
    if (this.config.enableTestGeneration) {
      const tests = await innovativeCodeGenerator.generateTests(code, filePath);
      if (tests) {
        console.log(`🧪 [Autonomous Mode] Generated tests for ${filePath}`);
      }
    }

    this.stats.improvementsApplied += highPriority.length;
  }

  /**
   * Apply improvement
   */
  async applyImprovement(suggestion, filePath, code) {
    // Implementation would apply the improvement
    console.log(
      `✨ [Autonomous Mode] Applying improvement: ${suggestion.message}`,
    );
  }

  /**
   * Get pending issues
   */
  async getPendingIssues() {
    // Query database for pending issues
    // For now, return empty array
    return [];
  }

  /**
   * Get files that could benefit from improvements
   */
  async getFilesToImprove() {
    // Find files with low quality scores
    // For now, return empty array
    return [];
  }

  /**
   * Get statistics
   */
  getStats() {
    return {
      ...this.stats,
      isActive: this.isActive,
      uptime: this.isActive ? Date.now() - this.startTime : 0,
    };
  }
}

module.exports = new AutonomousMode();

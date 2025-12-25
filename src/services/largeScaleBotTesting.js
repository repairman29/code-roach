/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/largeScaleBotTesting.js
 * Last Sync: 2025-12-25T07:02:34.004Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Large Scale Bot Testing Service
 * Handles execution of 1000+ bot games with parallel execution, progress tracking,
 * resource management, and result aggregation
 */

const botTestingService = require("./botTestingService");
const { createLogger } = require("../utils/logger");
const log = createLogger("LargeScaleBotTesting");
const gameSystemCoverage = require("./gameSystemCoverage");
const gameSelfImprovement = require("./gameSelfImprovement");
const fs = require("fs").promises;
const path = require("path");

class LargeScaleBotTesting {
  constructor(config = {}) {
    this.botTestingService = botTestingService;
    this.resultsDir =
      config.resultsDir || path.join(__dirname, "../../bot-feedback-results");
    this.batchResultsDir = path.join(this.resultsDir, "large-scale-batches");

    // Batch execution configuration - optimized for high concurrency
    this.config = {
      maxConcurrent: config.maxConcurrent || 20, // Increased from 10 to 20 (server can handle more now)
      batchSize: config.batchSize || 100, // Sessions per batch
      delayBetweenBatches: config.delayBetweenBatches || 3000, // 3 seconds (reduced from 5)
      delayBetweenSessions: config.delayBetweenSessions || 500, // 0.5 seconds (reduced from 1)
      timeout: config.timeout || 180000, // 3 minutes per session (increased from 2 for stability)
      retryFailed: config.retryFailed !== false, // Retry failed sessions
      maxRetries: config.maxRetries || 3, // Increased from 2 to 3
      saveProgress: config.saveProgress !== false, // Save progress periodically
      progressInterval: config.progressInterval || 10000, // Save every 10 sessions
      // Connection retry settings
      connectionRetryDelay: config.connectionRetryDelay || 2000, // 2 seconds between connection retries
      maxConnectionRetries: config.maxConnectionRetries || 5, // Max connection retries
    };

    // Active batch tracking
    this.activeBatches = new Map();
    this.batchProgress = new Map();

    // Initialize directories
    this.initializeDirectories();
  }

  /**
   * Initialize required directories
   */
  async initializeDirectories() {
    await fs.mkdir(this.batchResultsDir, { recursive: true });
  }

  /**
   * Run large scale test batch (1000 games)
   */
  async runLargeScaleBatch(config = {}) {
    const batchId = `batch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const totalGames = config.totalGames || 1000;
    const scenarios = config.scenarios || [
      "ghost_station",
      "crimson_run",
      "asteroid_field_race",
      "authority_heist",
    ];
    const behaviors = config.behaviors || [
      "aggressive",
      "cautious",
      "balanced",
      "roleplay",
    ];
    const modes = config.modes || ["solo", "multiplayer"];

    console.log(
      `\n🚀 [LargeScaleBotTesting] Starting large scale batch: ${batchId}`,
    );
    console.log(`   Total Games: ${totalGames}`);
    console.log(`   Max Concurrent: ${this.config.maxConcurrent}`);
    console.log(`   Batch Size: ${this.config.batchSize}`);

    const batchState = {
      batchId,
      totalGames,
      startedAt: Date.now(),
      completed: 0,
      successful: 0,
      failed: 0,
      retried: 0,
      sessions: [],
      progress: 0,
      estimatedCompletion: null,
      status: "running",
    };

    this.activeBatches.set(batchId, batchState);
    this.batchProgress.set(batchId, batchState);

    // Save initial batch state
    await this.saveBatchState(batchId, batchState);

    try {
      // Generate session configurations - ensure comprehensive testing
      const sessionConfigs = this.generateSessionConfigs(
        totalGames,
        scenarios,
        behaviors,
        modes,
      );

      // Mark that we're running comprehensive tests
      console.log(
        `   ✅ Comprehensive system testing enabled - all 21 game systems will be tested`,
      );

      // Execute in batches with concurrency control
      const results = await this.executeBatchWithConcurrency(
        batchId,
        sessionConfigs,
        batchState,
      );

      // Finalize batch
      batchState.completed = results.length;
      batchState.successful = results.filter((r) => r.success).length;
      batchState.failed = results.filter((r) => !r.success).length;
      batchState.status = "completed";
      batchState.completedAt = Date.now();
      batchState.duration = batchState.completedAt - batchState.startedAt;

      // Generate batch report
      const report = await this.generateBatchReport(
        batchId,
        batchState,
        results,
      );

      // Automatically analyze and improve based on results
      if (results.length > 0) {
        try {
          console.log(
            "\n🔧 [LargeScaleBotTesting] Analyzing results for self-improvement...\n",
          );

          // Clean results before saving (remove circular references)
          const cleanResults = results.map((result) => {
            const clean = { ...result };
            // Remove socket objects and other circular references
            delete clean.socket;
            delete clean.warden;
            delete clean.player;
            delete clean.bot;
            if (clean.metrics) {
              const cleanMetrics = { ...clean.metrics };
              delete cleanMetrics.socket;
              clean.metrics = cleanMetrics;
            }
            return clean;
          });

          // Save cleaned results to temp file for analysis
          const resultsFile = path.join(
            this.batchResultsDir,
            `${batchId}-results.json`,
          );
          await fs.writeFile(
            resultsFile,
            JSON.stringify(cleanResults, null, 2),
          );

          // Run self-improvement analysis
          const improvement =
            await gameSelfImprovement.analyzeAndImprove(resultsFile);

          if (improvement.applied > 0) {
            console.log(
              `\n✅ [GameSelfImprovement] Applied ${improvement.applied} fixes automatically`,
            );
            report.selfImprovement = improvement;
          } else {
            console.log(
              "\n✅ [GameSelfImprovement] No fixes needed - game is performing well",
            );
          }
        } catch (error) {
          console.error(
            "\n⚠️  [GameSelfImprovement] Error during self-improvement:",
            error.message,
          );
          // Don't fail the batch if self-improvement fails
        }
      }

      // Generate coverage report
      const coverageReport = gameSystemCoverage.generateCoverageReport();
      report.coverage = coverageReport;

      // Save final state and report
      await this.saveBatchState(batchId, batchState);
      await this.saveBatchReport(batchId, report);

      // Save coverage report
      await this.saveCoverageReport(batchId, coverageReport);

      console.log(`\n✅ [LargeScaleBotTesting] Batch ${batchId} completed`);
      console.log(
        `   Successful: ${batchState.successful}/${batchState.totalGames}`,
      );
      console.log(`   Failed: ${batchState.failed}/${batchState.totalGames}`);
      console.log(
        `   Duration: ${(batchState.duration / 1000 / 60).toFixed(2)} minutes`,
      );

      return {
        batchId,
        state: batchState,
        report,
        results: results.slice(0, 100), // Return first 100 for preview
      };
    } catch (error) {
      batchState.status = "error";
      batchState.error = error.message;
      await this.saveBatchState(batchId, batchState);
      throw error;
    } finally {
      this.activeBatches.delete(batchId);
    }
  }

  /**
   * Generate session configurations
   */
  generateSessionConfigs(totalGames, scenarios, behaviors, modes) {
    const configs = [];

    for (let i = 0; i < totalGames; i++) {
      configs.push({
        sessionNumber: i + 1,
        behavior: behaviors[Math.floor(Math.random() * behaviors.length)],
        scenario: scenarios[Math.floor(Math.random() * scenarios.length)],
        mode: modes[Math.floor(Math.random() * modes.length)],
        maxActions: 15 + Math.floor(Math.random() * 10), // 15-25 actions
        timeout: this.config.timeout,
      });
    }

    return configs;
  }

  /**
   * Execute batch with concurrency control
   */
  async executeBatchWithConcurrency(batchId, sessionConfigs, batchState) {
    const results = [];
    const queue = [...sessionConfigs];
    const active = new Set();
    let completed = 0;
    let lastProgressSave = Date.now();

    // Process queue
    while (queue.length > 0 || active.size > 0) {
      // Start new sessions up to concurrency limit
      while (active.size < this.config.maxConcurrent && queue.length > 0) {
        const config = queue.shift();
        const sessionPromise = this.executeSessionWithRetry(
          batchId,
          config,
          batchState,
        );
        active.add(sessionPromise);

        sessionPromise
          .then((result) => {
            active.delete(sessionPromise);
            results.push(result);
            completed++;
            batchState.completed = completed;
            batchState.progress = (completed / batchState.totalGames) * 100;

            if (result.success) {
              batchState.successful++;
            } else {
              batchState.failed++;
            }

            // Update estimated completion
            if (completed > 0) {
              const elapsed = Date.now() - batchState.startedAt;
              const avgTimePerSession = elapsed / completed;
              const remaining = batchState.totalGames - completed;
              batchState.estimatedCompletion =
                Date.now() + remaining * avgTimePerSession;
            }

            // Save progress periodically
            if (Date.now() - lastProgressSave > this.config.progressInterval) {
              this.saveBatchState(batchId, batchState).catch(console.error);
              lastProgressSave = Date.now();
            }

            // Log progress every 10%
            if (
              completed %
                Math.max(1, Math.floor(batchState.totalGames / 10)) ===
              0
            ) {
              console.log(
                `   Progress: ${completed}/${batchState.totalGames} (${batchState.progress.toFixed(1)}%)`,
              );
            }
          })
          .catch((error) => {
            active.delete(sessionPromise);
            results.push({
              sessionNumber: config.sessionNumber,
              success: false,
              error: error.message,
            });
            completed++;
            batchState.failed++;
          });

        // Delay between starting sessions (increased to avoid overwhelming server)
        if (queue.length > 0) {
          await this.delay(Math.max(this.config.delayBetweenSessions, 2000)); // At least 2 seconds
        }
      }

      // Wait for at least one session to complete
      if (active.size > 0) {
        await Promise.race(Array.from(active));
      }
    }

    return results;
  }

  /**
   * Execute session with retry logic
   */
  async executeSessionWithRetry(batchId, config, batchState) {
    let attempts = 0;
    let lastError = null;

    while (attempts < this.config.maxRetries + 1) {
      try {
        // Run test session - use CompleteGameplayLoopBot for comprehensive system testing
        // This ensures all 21 game systems are tested in each session
        const useCompleteLoop = Math.random() < 0.5; // 50% use complete loop for comprehensive coverage

        let result;
        if (useCompleteLoop) {
          // Use CompleteGameplayLoopBot for comprehensive testing (tests all 21 systems)
          result = await this.botTestingService.runCompleteLoopTest({
            behavior: config.behavior,
            scenario: config.scenario,
            mode: config.mode,
            maxActions: config.maxActions || 20,
            timeout: config.timeout,
            testAllSystems: true, // Test all systems
            testShipSystems: true,
            testCargoSystems: true,
            testCrewSystems: true,
            testCombatSystems: true,
            testSocialSystems: true,
            testStealthSystems: true,
            testHackingSystems: true,
            testDowntimeSystems: true,
            testTravelSystems: true,
            testMissionSystems: true,
            testProgressionSystems: true,
            testEquipmentSystems: true,
            testResourceSystems: true,
            testHeatSystems: true,
            testEnvironmentalSystems: true,
            testWorldStateSystems: true,
            testInvestigationSystems: true,
            testHealingSystems: true,
            testEconomySystems: true,
          });
        } else {
          // Use regular test session (still tests core gameplay)
          // These sessions will test basic systems through normal gameplay
          result = await this.botTestingService.runTestSession({
            behavior: config.behavior,
            scenario: config.scenario,
            mode: config.mode,
            maxActions: config.maxActions,
            timeout: config.timeout,
          });

          // Mark systems as tested based on what was used in regular session
          // Regular sessions test: character, combat, social, missions, safehouse
          if (result.success && gameSystemCoverage) {
            gameSystemCoverage.markSystemTested(
              "character",
              result.sessionId,
              {},
            );
            gameSystemCoverage.markSystemTested(
              "missions",
              result.sessionId,
              {},
            );
            gameSystemCoverage.markSystemTested(
              "safehouse",
              result.sessionId,
              {},
            );
            if (result.mode === "solo" || result.mode === "multiplayer") {
              gameSystemCoverage.markSystemTested(
                "combat",
                result.sessionId,
                {},
              );
              gameSystemCoverage.markSystemTested(
                "social",
                result.sessionId,
                {},
              );
            }
          }
        }

        if (result.success) {
          return {
            sessionNumber: config.sessionNumber,
            sessionId: result.sessionId,
            success: true,
            ...result,
          };
        } else {
          lastError = result.error || "Unknown error";
          if (this.config.retryFailed && attempts < this.config.maxRetries) {
            attempts++;
            batchState.retried++;
            await this.delay(2000 * attempts); // Exponential backoff
            continue;
          }
          return {
            sessionNumber: config.sessionNumber,
            success: false,
            error: lastError,
            attempts,
          };
        }
      } catch (error) {
        lastError = error.message;
        if (this.config.retryFailed && attempts < this.config.maxRetries) {
          attempts++;
          batchState.retried++;
          await this.delay(2000 * attempts);
          continue;
        }
        return {
          sessionNumber: config.sessionNumber,
          success: false,
          error: lastError,
          attempts,
        };
      }
    }

    return {
      sessionNumber: config.sessionNumber,
      success: false,
      error: lastError || "Max retries exceeded",
      attempts,
    };
  }

  /**
   * Generate batch report
   */
  async generateBatchReport(batchId, batchState, results) {
    const report = {
      batchId,
      summary: {
        totalGames: batchState.totalGames,
        successful: batchState.successful,
        failed: batchState.failed,
        retried: batchState.retried,
        successRate: (batchState.successful / batchState.totalGames) * 100,
        duration: batchState.duration,
        averageDuration: batchState.duration / batchState.totalGames,
      },
      distribution: {
        behaviors: {},
        scenarios: {},
        modes: {},
      },
      performance: {
        averageSessionDuration: 0,
        averageRollsPerSession: 0,
        averageNarrativesPerSession: 0,
        totalErrors: 0,
      },
      issues: [],
      recommendations: [],
    };

    // Calculate distributions
    results.forEach((result) => {
      if (result.behavior) {
        report.distribution.behaviors[result.behavior] =
          (report.distribution.behaviors[result.behavior] || 0) + 1;
      }
      if (result.scenario) {
        report.distribution.scenarios[result.scenario] =
          (report.distribution.scenarios[result.scenario] || 0) + 1;
      }
      if (result.mode) {
        report.distribution.modes[result.mode] =
          (report.distribution.modes[result.mode] || 0) + 1;
      }

      // Aggregate performance metrics
      if (result.metrics) {
        const duration = result.duration || result.metrics.duration || 0;
        report.performance.averageSessionDuration += duration;
        report.performance.averageRollsPerSession +=
          result.metrics.rolls?.length || 0;
        report.performance.averageNarrativesPerSession +=
          result.metrics.narratives?.length || 0;
      }

      if (!result.success) {
        report.performance.totalErrors++;
      }
    });

    // Calculate averages
    const successfulResults = results.filter((r) => r.success);
    if (successfulResults.length > 0) {
      report.performance.averageSessionDuration /= successfulResults.length;
      report.performance.averageRollsPerSession /= successfulResults.length;
      report.performance.averageNarrativesPerSession /=
        successfulResults.length;
    }

    // Identify common issues
    const errorTypes = {};
    results
      .filter((r) => !r.success)
      .forEach((r) => {
        const errorType = r.error || "unknown";
        errorTypes[errorType] = (errorTypes[errorType] || 0) + 1;
      });

    Object.entries(errorTypes)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([error, count]) => {
        report.issues.push({
          type: error,
          count,
          percentage: (count / batchState.failed) * 100,
        });
      });

    // Generate recommendations
    if (report.summary.successRate < 80) {
      report.recommendations.push({
        priority: "high",
        issue: "Low success rate",
        recommendation:
          "Investigate common failure patterns and improve error handling",
      });
    }

    if (report.performance.totalErrors > batchState.totalGames * 0.1) {
      report.recommendations.push({
        priority: "high",
        issue: "High error rate",
        recommendation: "Review error handling and system stability",
      });
    }

    return report;
  }

  /**
   * Get batch status
   */
  async getBatchStatus(batchId) {
    const state = this.batchProgress.get(batchId);
    if (state) {
      return state;
    }

    // Try to load from disk
    try {
      const stateFile = path.join(
        this.batchResultsDir,
        `${batchId}-state.json`,
      );
      const data = await fs.readFile(stateFile, "utf8");
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * List all batches
   */
  async listBatches() {
    try {
      const files = await fs.readdir(this.batchResultsDir);
      const batchFiles = files.filter((f) => f.endsWith("-state.json"));

      const batches = [];
      for (const file of batchFiles) {
        try {
          const data = await fs.readFile(
            path.join(this.batchResultsDir, file),
            "utf8",
          );
          const state = JSON.parse(data);
          batches.push({
            batchId: state.batchId,
            status: state.status,
            progress: state.progress,
            totalGames: state.totalGames,
            completed: state.completed,
            successful: state.successful,
            failed: state.failed,
            startedAt: state.startedAt,
            completedAt: state.completedAt,
          });
        } catch (err) {
          // Skip invalid files
        }
      }

      return batches.sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
    } catch (error) {
      return [];
    }
  }

  /**
   * Save batch state
   */
  async saveBatchState(batchId, state) {
    const stateFile = path.join(this.batchResultsDir, `${batchId}-state.json`);
    await fs.writeFile(stateFile, JSON.stringify(state, null, 2));
  }

  /**
   * Save batch report
   */
  async saveBatchReport(batchId, report) {
    const reportFile = path.join(
      this.batchResultsDir,
      `${batchId}-report.json`,
    );
    await fs.writeFile(reportFile, JSON.stringify(report, null, 2));

    // Also save markdown version
    const markdownFile = path.join(
      this.batchResultsDir,
      `${batchId}-report.md`,
    );
    await fs.writeFile(markdownFile, this.generateMarkdownReport(report));
  }

  /**
   * Generate markdown report
   */
  generateMarkdownReport(report) {
    let md = `# Large Scale Bot Testing Report\n\n`;
    md += `**Batch ID:** ${report.batchId}\n\n`;
    md += `## Summary\n\n`;
    md += `- **Total Games:** ${report.summary.totalGames}\n`;
    md += `- **Successful:** ${report.summary.successful} (${report.summary.successRate.toFixed(1)}%)\n`;
    md += `- **Failed:** ${report.summary.failed}\n`;
    md += `- **Retried:** ${report.summary.retried}\n`;
    md += `- **Duration:** ${(report.summary.duration / 1000 / 60).toFixed(2)} minutes\n`;
    md += `- **Average Duration:** ${(report.summary.averageDuration / 1000).toFixed(1)} seconds per session\n\n`;

    md += `## Distribution\n\n`;
    md += `### Behaviors\n`;
    Object.entries(report.distribution.behaviors).forEach(
      ([behavior, count]) => {
        md += `- **${behavior}:** ${count}\n`;
      },
    );
    md += `\n### Scenarios\n`;
    Object.entries(report.distribution.scenarios).forEach(
      ([scenario, count]) => {
        md += `- **${scenario}:** ${count}\n`;
      },
    );
    md += `\n### Modes\n`;
    Object.entries(report.distribution.modes).forEach(([mode, count]) => {
      md += `- **${mode}:** ${count}\n`;
    });

    md += `\n## Performance\n\n`;
    md += `- **Average Session Duration:** ${(report.performance.averageSessionDuration / 1000).toFixed(1)}s\n`;
    md += `- **Average Rolls/Session:** ${report.performance.averageRollsPerSession.toFixed(1)}\n`;
    md += `- **Average Narratives/Session:** ${report.performance.averageNarrativesPerSession.toFixed(1)}\n`;
    md += `- **Total Errors:** ${report.performance.totalErrors}\n\n`;

    if (report.issues.length > 0) {
      md += `## Common Issues\n\n`;
      report.issues.forEach((issue) => {
        md += `- **${issue.type}:** ${issue.count} occurrences (${issue.percentage.toFixed(1)}% of failures)\n`;
      });
      md += `\n`;
    }

    if (report.recommendations.length > 0) {
      md += `## Recommendations\n\n`;
      report.recommendations.forEach((rec) => {
        md += `- **[${rec.priority.toUpperCase()}]** ${rec.issue}: ${rec.recommendation}\n`;
      });
    }

    return md;
  }

  /**
   * Save coverage report
   */
  async saveCoverageReport(batchId, coverageReport) {
    const coverageFile = path.join(
      this.batchResultsDir,
      `${batchId}-coverage.json`,
    );
    await fs.writeFile(coverageFile, JSON.stringify(coverageReport, null, 2));

    // Also save markdown version
    const markdownFile = path.join(
      this.batchResultsDir,
      `${batchId}-coverage.md`,
    );
    await fs.writeFile(
      markdownFile,
      this.generateCoverageMarkdown(coverageReport),
    );
  }

  /**
   * Generate coverage markdown report
   */
  generateCoverageMarkdown(coverageReport) {
    let md = `# Game System Coverage Report\n\n`;
    md += `**Generated:** ${coverageReport.summary.timestamp}\n\n`;
    md += `## Summary\n\n`;
    md += `- **Systems Tested:** ${coverageReport.summary.systemsTested}/${coverageReport.summary.totalSystems} (${coverageReport.summary.systemsPercentage.toFixed(1)}%)\n`;
    md += `- **Features Tested:** ${coverageReport.summary.featuresTested}/${coverageReport.summary.totalFeatures} (${coverageReport.summary.featuresPercentage.toFixed(1)}%)\n\n`;

    md += `## System Coverage\n\n`;
    Object.entries(coverageReport.systems).forEach(([key, system]) => {
      const status = system.tested ? "✅" : "❌";
      md += `### ${status} ${system.name}\n\n`;
      md += `- **Tested:** ${system.tested ? "Yes" : "No"}\n`;
      md += `- **Features:** ${system.featuresTested}/${system.featuresTotal} (${system.featuresCoverage.toFixed(1)}%)\n`;
      if (system.missingFeatures && system.missingFeatures.length > 0) {
        md += `- **Missing Features:** ${system.missingFeatures.join(", ")}\n`;
      }
      md += `\n`;
    });

    if (coverageReport.untestedSystems.length > 0) {
      md += `## Untested Systems\n\n`;
      coverageReport.untestedSystems.forEach((system) => {
        md += `- **${system.name}** - ${system.features.length} features\n`;
      });
      md += `\n`;
    }

    if (coverageReport.incompleteSystems.length > 0) {
      md += `## Incomplete Systems\n\n`;
      coverageReport.incompleteSystems.forEach((system) => {
        md += `- **${system.name}** - Missing: ${system.missingFeatures.join(", ")}\n`;
      });
      md += `\n`;
    }

    if (coverageReport.recommendations.length > 0) {
      md += `## Recommendations\n\n`;
      coverageReport.recommendations.forEach((rec) => {
        md += `- **[${rec.priority.toUpperCase()}]** ${rec.message}\n`;
      });
    }

    return md;
  }

  /**
   * Delay helper
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

module.exports = new LargeScaleBotTesting();

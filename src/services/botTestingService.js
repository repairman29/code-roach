/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/botTestingService.js
 * Last Sync: 2025-12-25T04:53:21.515Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Bot Testing Service
 * Manages continuous bot testing pipeline, metrics tracking, and bot comparison
 */

const BotPlayer = require("../../tests/bots/BotPlayer");
const { createLogger } = require("../utils/logger");
const log = createLogger("BotTestingService");
const BotWarden = require("../../tests/bots/BotWarden");
const SoloModeBotAPI = require("../../tests/bots/SoloModeBotAPI");
const BotSurveySystem = require("../../tests/bots/BotSurveySystem");
const CompleteGameplayLoopBot = require("../../tests/bots/CompleteGameplayLoopBot");
const AutomatedFeedbackLoop = require("../../tests/bots/AutomatedFeedbackLoop");
const gameSystemCoverage = require("./gameSystemCoverage");
const fs = require("fs").promises;
const path = require("path");

class BotTestingService {
  constructor(config = {}) {
    this.resultsDir =
      config.resultsDir || path.join(__dirname, "../../bot-feedback-results");
    this.metricsDir =
      config.metricsDir || path.join(__dirname, "../../bot-metrics");
    this.serverUrl = config.serverUrl || "http://localhost:3000";

    // Active bot sessions
    this.activeBots = new Map();
    this.activeSessions = new Map();

    // Metrics tracking
    this.metrics = {
      totalBots: 0,
      totalSessions: 0,
      successfulSessions: 0,
      failedSessions: 0,
      averageSessionDuration: 0,
      averageRollsPerSession: 0,
      averageNarrativesPerSession: 0,
      behaviorDistribution: {},
      scenarioDistribution: {},
      issueFrequency: {},
      performanceMetrics: {
        averageResponseTime: 0,
        averageConnectionTime: 0,
        averageRollTime: 0,
      },
    };

    // Bot learning database
    this.learningDB = {
      botExperiences: new Map(),
      successfulPatterns: new Map(),
      failedPatterns: new Map(),
      behaviorOutcomes: new Map(),
    };

    // Continuous testing configuration
    this.continuousTesting = {
      enabled: false,
      interval: 3600000, // 1 hour default
      botsPerRun: 5,
      scenarios: ["ghost_station", "crimson_run", "asteroid_field_race"],
      behaviors: ["aggressive", "cautious", "balanced", "roleplay"],
    };

    // Initialize directories
    this.initializeDirectories();
  }

  /**
   * Initialize required directories
   */
  async initializeDirectories() {
    await fs.mkdir(this.resultsDir, { recursive: true });
    await fs.mkdir(this.metricsDir, { recursive: true });
  }

  /**
   * Run comprehensive bot test session
   */
  async runTestSession(config = {}) {
    const sessionId = `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const sessionConfig = {
      sessionId,
      behavior: config.behavior || this.getRandomBehavior(),
      scenario: config.scenario || this.getRandomScenario(),
      mode: config.mode || (Math.random() > 0.5 ? "solo" : "multiplayer"),
      maxActions: config.maxActions || 20,
      timeout: config.timeout || 120000,
      ...config,
    };

    console.log(`\n🤖 [BotTestingService] Starting test session: ${sessionId}`);
    console.log(
      `   Behavior: ${sessionConfig.behavior}, Scenario: ${sessionConfig.scenario}, Mode: ${sessionConfig.mode}`,
    );

    const startTime = Date.now();
    let result;

    try {
      if (sessionConfig.mode === "solo") {
        result = await this.runSoloTest(sessionConfig);
      } else {
        result = await this.runMultiplayerTest(sessionConfig);
      }

      const duration = Date.now() - startTime;
      result.duration = duration;
      result.sessionId = sessionId;
      result.timestamp = new Date().toISOString();

      // Track metrics
      await this.updateMetrics(result);

      // Learn from session
      await this.learnFromSession(result);

      // Save results
      await this.saveSessionResult(sessionId, result);

      console.log(
        `✅ [BotTestingService] Session ${sessionId} completed in ${(duration / 1000).toFixed(2)}s`,
      );

      return result;
    } catch (error) {
      console.error(
        `❌ [BotTestingService] Session ${sessionId} failed:`,
        error,
      );
      const errorResult = {
        sessionId,
        success: false,
        error: error.message,
        duration: Date.now() - startTime,
        timestamp: new Date().toISOString(),
      };

      await this.updateMetrics(errorResult);
      await this.saveSessionResult(sessionId, errorResult);

      return errorResult;
    }
  }

  /**
   * Run solo mode test
   */
  async runSoloTest(config) {
    const bot = new SoloModeBotAPI({
      serverUrl: this.serverUrl,
      behavior: config.behavior,
      maxActions: config.maxActions,
      timeout: config.timeout,
      rollDelay: this.getRollDelayForBehavior(config.behavior),
    });

    this.activeBots.set(config.sessionId, bot);

    try {
      await bot.connect();
      await bot.wait(3000); // Wait for warden connection

      // Enable AI GM with scenario
      let aiGMEnabled = false;
      try {
        const enableResult = await bot.enableAIGM(config.scenario);
        aiGMEnabled = enableResult?.success || bot.aiGMEnabled || false;
        await bot.wait(3000);
      } catch (error) {
        log.warn(
          `[BotTestingService] AI GM enable failed: ${error.message}`,
        );
      }

      // Play session
      await bot.play();

      // Extract metrics and transcript
      const transcript = bot.gameLog || [];
      const metrics = {
        gameLog: transcript,
        transcript: transcript, // Also save as transcript for easy access
        narratives: bot.narratives || [],
        choices: bot.choices || [],
        rolls: bot.rolls || [],
        actions: bot.analysis || {},
        events: bot.events || [],
        aiGMEnabled,
        duration: bot.duration || 0,
      };

      return {
        success: true,
        mode: "solo",
        behavior: config.behavior,
        scenario: config.scenario,
        bot: bot,
        metrics,
        transcript, // Include transcript at top level for easy access
      };
    } catch (error) {
      return {
        success: false,
        mode: "solo",
        behavior: config.behavior,
        scenario: config.scenario,
        error: error.message,
      };
    } finally {
      this.activeBots.delete(config.sessionId);
      if (bot && bot.socket) {
        bot.socket.disconnect();
      }
    }
  }

  /**
   * Run multiplayer test
   */
  async runMultiplayerTest(config) {
    const warden = new BotWarden({
      serverUrl: this.serverUrl,
      sessionCode: null,
      behavior: config.behavior,
    });

    const player = new BotPlayer({
      serverUrl: this.serverUrl,
      sessionCode: null,
      name: `Test Bot ${Date.now()}`,
      behavior: config.behavior,
      stats: this.getStatsForBehavior(config.behavior),
    });

    this.activeBots.set(`${config.sessionId}-warden`, warden);
    this.activeBots.set(`${config.sessionId}-player`, player);

    try {
      await warden.connect();
      const sessionCode = await warden.createSession();

      await player.connect();
      await player.joinSession(sessionCode);
      await new Promise((resolve) => setTimeout(resolve, 2000));

      // Enable AI GM
      let aiGMEnabled = false;
      try {
        if (warden.enableAIGM) {
          const enableResult = await warden.enableAIGM(config.scenario);
          aiGMEnabled = enableResult?.success || warden.aiGMEnabled || false;
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error) {
        log.warn(
          `[BotTestingService] AI GM enable failed: ${error.message}`,
        );
      }

      // Play for duration
      const playDuration = Math.min(config.timeout || 60000, 60000);
      const startTime = Date.now();
      const actions = [];
      const rolls = [];

      while (Date.now() - startTime < playDuration) {
        const actionType = Math.random();
        if (actionType < 0.7) {
          // Roll dice
          const stats = ["pilot", "fight", "smooth"];
          const stat = stats[Math.floor(Math.random() * stats.length)];
          try {
            const rollData = await player.roll(stat);
            rolls.push(rollData);
            actions.push({ type: "roll", stat, timestamp: Date.now() });
            await new Promise((resolve) => setTimeout(resolve, 1000));
          } catch (error) {
            // Continue
          }
        } else {
          // Send chat
          const messages = [
            "Checking this out",
            "Let's go",
            "What do you see?",
          ];
          const message = messages[Math.floor(Math.random() * messages.length)];
          try {
            await player.sendChat(message);
            actions.push({ type: "chat", message, timestamp: Date.now() });
          } catch (error) {
            // Continue
          }
        }

        await new Promise((resolve) =>
          setTimeout(resolve, 1000 + Math.random() * 2000),
        );
      }

      // Wait for AI GM responses
      await new Promise((resolve) => setTimeout(resolve, 5000));

      // Extract narratives from gameLog
      const gameLogEntries = player.gameLog || [];
      const narratives = gameLogEntries.filter((entry) => {
        const message = entry.message || entry.text || "";
        return (
          entry.aiGM === true ||
          entry.sender === "AI GM" ||
          (entry.type === "system" &&
            message.length > 15 &&
            (message.includes("You manage") ||
              message.includes("You pull") ||
              message.includes("You succeed") ||
              message.includes("You fail")))
        );
      });

      const transcript = gameLogEntries;
      return {
        success: true,
        mode: "multiplayer",
        behavior: config.behavior,
        scenario: config.scenario,
        warden: warden,
        player: player,
        metrics: {
          actions,
          rolls,
          events: player.events || [],
          gameLog: transcript,
          transcript: transcript, // Also save as transcript
          narratives,
          aiGMEnabled,
          duration: Date.now() - startTime,
        },
        transcript, // Include transcript at top level
      };
    } catch (error) {
      return {
        success: false,
        mode: "multiplayer",
        behavior: config.behavior,
        scenario: config.scenario,
        error: error.message,
      };
    } finally {
      this.activeBots.delete(`${config.sessionId}-warden`);
      this.activeBots.delete(`${config.sessionId}-player`);
      if (warden && warden.socket) {
        warden.socket.disconnect();
      }
      if (player) {
        await player.disconnect();
      }
    }
  }

  /**
   * Run complete gameplay loop test
   */
  async runCompleteLoopTest(config = {}) {
    const bot = new CompleteGameplayLoopBot({
      serverUrl: this.serverUrl,
      behavior: config.behavior || "balanced",
      rollDelay: config.rollDelay || 2000,
      maxRolls: config.maxRolls || 10,
      timeout: config.timeout || 120000,
      testAllSystems: config.testAllSystems !== false,
      systemCoverage: gameSystemCoverage, // Pass coverage tracker
    });

    const result = await bot.runCompleteLoop();

    // Track metrics
    await this.updateMetrics({
      ...result,
      mode: "complete_loop",
      behavior: config.behavior,
    });

    return result;
  }

  /**
   * Run survey on bots
   */
  async runSurvey(maxBots = null) {
    const surveySystem = new BotSurveySystem({
      serverUrl: this.serverUrl,
    });

    const report = await surveySystem.runSurvey(maxBots);

    // Save survey results
    await this.saveSurveyResults(report);

    return report;
  }

  /**
   * Analyze bot test results
   */
  async analyzeResults(resultsFile) {
    const feedbackLoop = new AutomatedFeedbackLoop();
    const analysis = await feedbackLoop.analyzeResults(resultsFile);

    // Generate fix suggestions
    const suggestions = await feedbackLoop.generateFixSuggestions(
      analysis.prioritizedFixes,
    );

    return {
      analysis,
      suggestions,
    };
  }

  /**
   * Compare bot experiences
   */
  async compareBotExperiences(botIds) {
    const comparisons = [];

    for (let i = 0; i < botIds.length; i++) {
      for (let j = i + 1; j < botIds.length; j++) {
        const bot1Id = botIds[i];
        const bot2Id = botIds[j];

        const bot1Data = await this.loadBotExperience(bot1Id);
        const bot2Data = await this.loadBotExperience(bot2Id);

        if (bot1Data && bot2Data) {
          const comparison = this.compareBots(bot1Data, bot2Data);
          comparisons.push({
            bot1: bot1Id,
            bot2: bot2Id,
            comparison,
          });
        }
      }
    }

    return comparisons;
  }

  /**
   * Compare two bot experiences
   */
  compareBots(bot1Data, bot2Data) {
    return {
      successRate: {
        bot1: bot1Data.successRate || 0,
        bot2: bot2Data.successRate || 0,
        difference: (bot1Data.successRate || 0) - (bot2Data.successRate || 0),
      },
      averageRolls: {
        bot1: bot1Data.averageRolls || 0,
        bot2: bot2Data.averageRolls || 0,
        difference: (bot1Data.averageRolls || 0) - (bot2Data.averageRolls || 0),
      },
      averageNarratives: {
        bot1: bot1Data.averageNarratives || 0,
        bot2: bot2Data.averageNarratives || 0,
        difference:
          (bot1Data.averageNarratives || 0) - (bot2Data.averageNarratives || 0),
      },
      behavior: {
        bot1: bot1Data.behavior || "unknown",
        bot2: bot2Data.behavior || "unknown",
      },
      scenarios: {
        bot1: bot1Data.scenarios || [],
        bot2: bot2Data.scenarios || [],
      },
      issues: {
        bot1: bot1Data.issues || [],
        bot2: bot2Data.issues || [],
      },
    };
  }

  /**
   * Load bot experience data
   */
  async loadBotExperience(botId) {
    try {
      const experienceFile = path.join(this.metricsDir, `bot-${botId}.json`);
      const data = await fs.readFile(experienceFile, "utf8");
      return JSON.parse(data);
    } catch (error) {
      return null;
    }
  }

  /**
   * Update metrics from session result
   */
  async updateMetrics(result) {
    this.metrics.totalSessions++;

    if (result.success) {
      this.metrics.successfulSessions++;
    } else {
      this.metrics.failedSessions++;
    }

    // Update behavior distribution
    if (result.behavior) {
      this.metrics.behaviorDistribution[result.behavior] =
        (this.metrics.behaviorDistribution[result.behavior] || 0) + 1;
    }

    // Update scenario distribution
    if (result.scenario) {
      this.metrics.scenarioDistribution[result.scenario] =
        (this.metrics.scenarioDistribution[result.scenario] || 0) + 1;
    }

    // Update performance metrics
    if (result.duration) {
      const totalDuration =
        this.metrics.averageSessionDuration * (this.metrics.totalSessions - 1) +
        result.duration;
      this.metrics.averageSessionDuration =
        totalDuration / this.metrics.totalSessions;
    }

    if (result.metrics) {
      const rolls = result.metrics.rolls?.length || 0;
      const narratives = result.metrics.narratives?.length || 0;

      const totalRolls =
        this.metrics.averageRollsPerSession * (this.metrics.totalSessions - 1) +
        rolls;
      this.metrics.averageRollsPerSession =
        totalRolls / this.metrics.totalSessions;

      const totalNarratives =
        this.metrics.averageNarrativesPerSession *
          (this.metrics.totalSessions - 1) +
        narratives;
      this.metrics.averageNarrativesPerSession =
        totalNarratives / this.metrics.totalSessions;
    }

    // Save metrics
    await this.saveMetrics();
  }

  /**
   * Learn from session
   */
  async learnFromSession(result) {
    const behavior = result.behavior || "unknown";
    const scenario = result.scenario || "unknown";
    const key = `${behavior}_${scenario}`;

    if (!this.learningDB.botExperiences.has(key)) {
      this.learningDB.botExperiences.set(key, []);
    }

    this.learningDB.botExperiences.get(key).push({
      timestamp: Date.now(),
      success: result.success,
      metrics: result.metrics,
      duration: result.duration,
    });

    // Track successful patterns
    if (result.success) {
      if (!this.learningDB.successfulPatterns.has(key)) {
        this.learningDB.successfulPatterns.set(key, []);
      }
      this.learningDB.successfulPatterns.get(key).push({
        timestamp: Date.now(),
        metrics: result.metrics,
      });
    } else {
      // Track failed patterns
      if (!this.learningDB.failedPatterns.has(key)) {
        this.learningDB.failedPatterns.set(key, []);
      }
      this.learningDB.failedPatterns.get(key).push({
        timestamp: Date.now(),
        error: result.error,
        metrics: result.metrics,
      });
    }

    // Save learning data
    await this.saveLearningData();
  }

  /**
   * Get roll delay for behavior
   */
  getRollDelayForBehavior(behavior) {
    const delays = {
      aggressive: 500,
      cautious: 3000,
      balanced: 1500,
      roleplay: 2000,
      normal: 1000,
    };
    return delays[behavior] || 1000;
  }

  /**
   * Get stats for behavior
   */
  getStatsForBehavior(behavior) {
    const baseStats = {
      pilot: 40 + Math.floor(Math.random() * 20),
      fight: 40 + Math.floor(Math.random() * 20),
      smooth: 40 + Math.floor(Math.random() * 20),
    };

    if (behavior === "aggressive") {
      baseStats.fight += 10;
      baseStats.pilot -= 5;
    } else if (behavior === "cautious") {
      baseStats.pilot += 10;
      baseStats.fight -= 5;
    } else if (behavior === "roleplay") {
      baseStats.smooth += 10;
    }

    return baseStats;
  }

  /**
   * Get random behavior
   */
  getRandomBehavior() {
    const behaviors = ["aggressive", "cautious", "balanced", "roleplay"];
    return behaviors[Math.floor(Math.random() * behaviors.length)];
  }

  /**
   * Get random scenario
   */
  getRandomScenario() {
    const scenarios = [
      "ghost_station",
      "crimson_run",
      "asteroid_field_race",
      "authority_heist",
    ];
    return scenarios[Math.floor(Math.random() * scenarios.length)];
  }

  /**
   * Save session result
   */
  async saveSessionResult(sessionId, result) {
    const resultFile = path.join(this.resultsDir, `session-${sessionId}.json`);

    // Remove circular references (socket objects) before saving
    const cleanResult = this.cleanResultForSaving(result);

    await fs.writeFile(resultFile, JSON.stringify(cleanResult, null, 2));
  }

  /**
   * Clean result object to remove circular references
   */
  cleanResultForSaving(result) {
    if (!result || typeof result !== "object") {
      return result;
    }

    const cleaned = {};

    for (const [key, value] of Object.entries(result)) {
      // Skip socket objects and other circular references
      if (
        key === "socket" ||
        key === "warden" ||
        key === "player" ||
        key === "bot"
      ) {
        // Replace with summary
        if (value && typeof value === "object") {
          if (value.id) cleaned[`${key}_id`] = value.id;
          if (value.connected !== undefined)
            cleaned[`${key}_connected`] = value.connected;
          if (value.joined !== undefined)
            cleaned[`${key}_joined`] = value.joined;
        }
        continue;
      }

      // Recursively clean nested objects
      if (value && typeof value === "object" && !Array.isArray(value)) {
        // Check if it's a socket-like object
        if (value.constructor && value.constructor.name === "Socket") {
          continue; // Skip socket objects
        }
        cleaned[key] = this.cleanResultForSaving(value);
      } else if (Array.isArray(value)) {
        cleaned[key] = value.map((item) => {
          if (
            item &&
            typeof item === "object" &&
            item.constructor &&
            item.constructor.name === "Socket"
          ) {
            return { _skipped: "socket_object" };
          }
          return this.cleanResultForSaving(item);
        });
      } else {
        cleaned[key] = value;
      }
    }

    return cleaned;
  }

  /**
   * Save metrics
   */
  async saveMetrics() {
    const metricsFile = path.join(this.metricsDir, "metrics.json");
    await fs.writeFile(metricsFile, JSON.stringify(this.metrics, null, 2));
  }

  /**
   * Save learning data
   */
  async saveLearningData() {
    const learningFile = path.join(this.metricsDir, "learning-db.json");
    const data = {
      botExperiences: Array.from(this.learningDB.botExperiences.entries()),
      successfulPatterns: Array.from(
        this.learningDB.successfulPatterns.entries(),
      ),
      failedPatterns: Array.from(this.learningDB.failedPatterns.entries()),
      behaviorOutcomes: Array.from(this.learningDB.behaviorOutcomes.entries()),
    };
    await fs.writeFile(learningFile, JSON.stringify(data, null, 2));
  }

  /**
   * Save survey results
   */
  async saveSurveyResults(report) {
    const surveyFile = path.join(this.metricsDir, `survey-${Date.now()}.json`);
    await fs.writeFile(surveyFile, JSON.stringify(report, null, 2));
  }

  /**
   * Start continuous testing
   */
  startContinuousTesting(config = {}) {
    this.continuousTesting = {
      ...this.continuousTesting,
      ...config,
      enabled: true,
    };

    this.continuousTestingInterval = setInterval(async () => {
      console.log(`\n🔄 [BotTestingService] Running continuous test batch...`);

      for (let i = 0; i < this.continuousTesting.botsPerRun; i++) {
        const behavior =
          this.continuousTesting.behaviors[
            Math.floor(Math.random() * this.continuousTesting.behaviors.length)
          ];
        const scenario =
          this.continuousTesting.scenarios[
            Math.floor(Math.random() * this.continuousTesting.scenarios.length)
          ];

        await this.runTestSession({
          behavior,
          scenario,
          mode: Math.random() > 0.5 ? "solo" : "multiplayer",
        });

        // Delay between bots
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
    }, this.continuousTesting.interval);

    console.log(
      `✅ [BotTestingService] Continuous testing started (interval: ${this.continuousTesting.interval / 1000}s)`,
    );
  }

  /**
   * Stop continuous testing
   */
  stopContinuousTesting() {
    if (this.continuousTestingInterval) {
      clearInterval(this.continuousTestingInterval);
      this.continuousTesting.enabled = false;
      console.log(`⏹️  [BotTestingService] Continuous testing stopped`);
    }
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      successRate:
        this.metrics.totalSessions > 0
          ? (this.metrics.successfulSessions / this.metrics.totalSessions) * 100
          : 0,
      activeBots: this.activeBots.size,
      activeSessions: this.activeSessions.size,
      continuousTesting: this.continuousTesting.enabled,
    };
  }
}

module.exports = new BotTestingService();

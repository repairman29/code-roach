/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/deploymentMonitor.js
 * Last Sync: 2025-12-25T07:02:34.009Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

// Review and improve deploymentMonitor.js
// Audit server file server/services/deploymentMonitor.js for security, performance, error handling, and best practices

/**
 * Automatic Post-Deployment Monitoring Service
 *
 * Automatically starts monitoring after deployments and integrates
 * with the server's monitoring system.
 */

/* eslint-disable no-undef */
const path = require("path");
const fs = require("fs").promises;
const DeploymentMonitor = require("../../scripts/monitor-deployment");
const PostDeploymentFeedbackCollector = require("../../scripts/collect-post-deployment-feedback");
const { createLogger } = require("../utils/logger");
const log = createLogger("DeploymentMonitor");

class AutomaticDeploymentMonitor {
  /**
   */
  constructor(config = {}) {
    this.enabled = config.enabled !== false; // Default to enabled
    this.deploymentMarkerFile = path.join(
      __dirname,
      "../../data/.deployment-marker",
    );
    this.monitoringDataDir = path.join(
      __dirname,
      "../../data/deployment-monitoring",
    );
    this.feedbackWindow = config.feedbackWindow || 3600000; // 1 hour default
    this.monitoringInterval = config.monitoringInterval || 60000; // 1 minute
    this.monitor = null;
    this.feedbackCollector = null;
    this.isMonitoring = false;
    this.deploymentTime = null;
  }

  /**
   * Initialize and start monitoring if deployment detected
   */
  async initialize(deploymentUrl) {
    /**
     */
    if (!this.enabled) {
      log.warn("⚠️  Automatic deployment monitoring is disabled");
      return;
    }

    try {
      // Check if this is a new deployment
      const isNewDeployment = await this.detectNewDeployment();

      /**
       */
      if (isNewDeployment) {
        log.info("\n" + "=".repeat(70));
        log.info("🚀 NEW DEPLOYMENT DETECTED");
        log.info("=".repeat(70) + "\n");

        this.deploymentTime = Date.now();

        // Mark deployment
        await this.markDeployment();

        // Start monitoring
        await this.startMonitoring(deploymentUrl);

        // Start feedback collection
        await this.startFeedbackCollection(deploymentUrl);

        log.info("✅ Automatic deployment monitoring started\n");
      } else {
        log.info(
          "ℹ️  No new deployment detected, skipping automatic monitoring",
        );
      }
    } catch (err) {
      console.error(
        "❌ Error initializing automatic deployment monitoring:",
        err.message,
      );
      // Don't fail server startup if monitoring fails
    }
  }

  /**
   * Detect if this is a new deployment
   */
  async detectNewDeployment() {
    try {
      // Check if deployment marker exists
      const markerExists = await fs
        .access(this.deploymentMarkerFile)
        .then(() => true)
        .catch(() => false);

      /**
       */
      if (!markerExists) {
        // No marker = new deployment
        return true;
      }

      // Check marker timestamp
      const markerContent = await fs.readFile(
        this.deploymentMarkerFile,
        "utf8",
      );
      const marker = JSON.parse(markerContent);

      // Consider it a new deployment if marker is older than 24 hours
      // or if explicitly marked as new deployment
      const markerAge = Date.now() - marker.timestamp;
      const hoursSinceDeployment = markerAge / (1000 * 60 * 60);

      // Check for explicit new deployment flag (set by CI/CD or manual trigger)
      /**
       */
      if (
        process.env.NEW_DEPLOYMENT === "true" ||
        process.env.FORCE_MONITORING === "true"
      ) {
        return true;
      }

      // If marker is older than 24 hours, treat as new deployment
      /**
       */
      if (hoursSinceDeployment > 24) {
        return true;
      }

      return false;
    } catch (err) {
      // If we can't read marker, assume new deployment
      log.warn(
        "⚠️  Could not read deployment marker, assuming new deployment:",
        err.message,
      );
      return true;
    }
  }

  /**
   * Mark current deployment
   */
  async markDeployment() {
    try {
      await fs.mkdir(path.dirname(this.deploymentMarkerFile), {
        recursive: true,
      });

      const marker = {
        timestamp: this.deploymentTime,
        version: process.env.npm_package_version || "unknown",
        commit:
          process.env.GIT_COMMIT ||
          process.env.RAILWAY_GIT_COMMIT_SHA ||
          "unknown",
        environment: process.env.NODE_ENV || "development",
        deploymentUrl: process.env.DEPLOYMENT_URL || "http://localhost:3000",
      };

      await fs.writeFile(
        this.deploymentMarkerFile,
        JSON.stringify(marker, null, 2),
        "utf8",
      );
    } catch (err) {
      log.warn("⚠️  Could not write deployment marker:", err.message);
    }
  }

  /**
   * Start monitoring
   */
  async startMonitoring(deploymentUrl) {
    try {
      this.monitor = new DeploymentMonitor({
        deploymentUrl:
          deploymentUrl ||
          process.env.DEPLOYMENT_URL ||
          "http://localhost:3000",
        monitoringInterval: this.monitoringInterval,
        dataDir: this.monitoringDataDir,
      });

      // Start monitoring (non-blocking)
      this.monitor.startMonitoring().catch((err) => {
        console.error("Error in deployment monitoring:", err.message);
      });

      this.isMonitoring = true;

      // Stop monitoring after feedback window
      setTimeout(() => {
        /**
         */
        if (this.monitor) {
          this.monitor.stopMonitoring();
          this.isMonitoring = false;
          log.info("⏹️  Deployment monitoring stopped (feedback window ended)");
        }
      }, this.feedbackWindow);
    } catch (err) {
      console.error("❌ Error starting deployment monitoring:", err.message);
    }
  }

  /**
   * Start feedback collection
   */
  async startFeedbackCollection(deploymentUrl) {
    try {
      this.feedbackCollector = new PostDeploymentFeedbackCollector({
        deploymentUrl:
          deploymentUrl ||
          process.env.DEPLOYMENT_URL ||
          "http://localhost:3000",
        deploymentTime: this.deploymentTime,
        feedbackWindow: this.feedbackWindow,
        dataDir: path.join(__dirname, "../../data/post-deployment-feedback"),
      });

      // Start feedback collection (non-blocking)
      this.feedbackCollector.startCollection().catch((err) => {
        console.error("Error in feedback collection:", err.message);
      });
    } catch (err) {
      console.error("❌ Error starting feedback collection:", err.message);
    }
  }

  /**
   * Get current monitoring status
   */
  getStatus() {
    return {
      enabled: this.enabled,
      isMonitoring: this.isMonitoring,
      deploymentTime: this.deploymentTime,
      monitor: this.monitor
        ? {
            isRunning: this.monitor.isMonitoring,
          }
        : null,
      feedbackCollector: this.feedbackCollector
        ? {
            isCollecting: true,
          }
        : null,
    };
  }

  /**
   * Stop monitoring
   */
  async stop() {
    if (this.monitor) {
      this.monitor.stopMonitoring();
    }
    this.isMonitoring = false;
  }
}

module.exports = AutomaticDeploymentMonitor;

/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/analyticsService.js
 * Last Sync: 2025-12-25T04:10:02.879Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Analytics Service
 * Server-side analytics processing and storage
 * Part of Stream 27: Analytics & Telemetry System
 */

const fs = require("fs").promises;
const path = require("path");
const { createLogger } = require("../utils/logger");

const log = createLogger("AnalyticsService");

class AnalyticsService {
  constructor(config = {}) {
    this.dataDir =
      config.dataDir || path.join(__dirname, "../../data/analytics");
    this.eventsDir = path.join(this.dataDir, "events");
    this.aggregatesDir = path.join(this.dataDir, "aggregates");
    this.reportsDir = path.join(this.dataDir, "reports");

    // Initialize directories
    this.initialize();
  }

  /**
   * Initialize directories
   */
  async initialize() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(this.eventsDir, { recursive: true });
      await fs.mkdir(this.aggregatesDir, { recursive: true });
      await fs.mkdir(this.reportsDir, { recursive: true });
    } catch (err) {
      log.error("Error initializing analytics directories:", err.message);
    }
  }

  /**
   * Store analytics events
   */
  async storeEvents(events, sessionId, userId = null) {
    try {
      await this.initialize();

      if (!Array.isArray(events) || events.length === 0) {
        return { stored: 0 };
      }

      // Group events by date for efficient storage
      const eventsByDate = {};
      events.forEach((event) => {
        const date = new Date(event.data.timestamp || Date.now())
          .toISOString()
          .split("T")[0];
        if (!eventsByDate[date]) {
          eventsByDate[date] = [];
        }
        eventsByDate[date].push({
          ...event,
          sessionId: sessionId,
          userId: userId,
          receivedAt: Date.now(),
        });
      });

      // Save events by date
      let totalStored = 0;
      for (const [date, dateEvents] of Object.entries(eventsByDate)) {
        const filename = `events-${date}.json`;
        const filepath = path.join(this.eventsDir, filename);

        // Load existing events for this date
        let existingEvents = [];
        try {
          const existing = await fs.readFile(filepath, "utf8");
          existingEvents = JSON.parse(existing);
        } catch (err) {
          // File doesn't exist yet, start fresh
        }

        // Append new events
        existingEvents.push(...dateEvents);

        // Keep only last 50000 events per day
        if (existingEvents.length > 50000) {
          existingEvents = existingEvents.slice(-50000);
        }

        // Save
        await fs.writeFile(
          filepath,
          JSON.stringify(existingEvents, null, 2),
          "utf8",
        );

        totalStored += dateEvents.length;
      }

      // Update aggregates
      await this.updateAggregates(events, sessionId, userId);

      return { stored: totalStored };
    } catch (err) {
      log.error("Error storing analytics events:", err.message);
      throw err;
    }
  }

  /**
   * Update aggregate metrics
   */
  async updateAggregates(events, sessionId, userId) {
    try {
      const today = new Date().toISOString().split("T")[0];
      const aggregateFile = path.join(
        this.aggregatesDir,
        `aggregate-${today}.json`,
      );

      // Load existing aggregates
      let aggregates = {
        date: today,
        sessions: new Set(),
        users: new Set(),
        eventCounts: {},
        gameplayMetrics: {
          actions: 0,
          decisions: 0,
          outcomes: 0,
          rolls: 0,
          missions: 0,
        },
        featureUsage: {},
        errors: 0,
        performanceMetrics: 0,
      };

      try {
        const existing = await fs.readFile(aggregateFile, "utf8");
        const parsed = JSON.parse(existing);
        aggregates = {
          ...parsed,
          sessions: new Set(parsed.sessions || []),
          users: new Set(parsed.users || []),
        };
      } catch (err) {
        // File doesn't exist, use defaults
      }

      // Update aggregates from events
      aggregates.sessions.add(sessionId);
      if (userId) {
        aggregates.users.add(userId);
      }

      events.forEach((event) => {
        // Count events by category
        const category = event.category || "unknown";
        if (!aggregates.eventCounts[category]) {
          aggregates.eventCounts[category] = 0;
        }
        aggregates.eventCounts[category]++;

        // Update gameplay metrics
        if (event.category === "gameplay") {
          if (event.event === "action") {
            aggregates.gameplayMetrics.actions++;
          } else if (event.event === "decision") {
            aggregates.gameplayMetrics.decisions++;
          } else if (event.event === "outcome") {
            aggregates.gameplayMetrics.outcomes++;
          } else if (event.event === "roll") {
            aggregates.gameplayMetrics.rolls++;
          } else if (event.event === "mission") {
            aggregates.gameplayMetrics.missions++;
          }
        }

        // Update feature usage
        if (event.category === "feature" && event.event === "usage") {
          const featureName = event.data?.feature;
          if (featureName) {
            if (!aggregates.featureUsage[featureName]) {
              aggregates.featureUsage[featureName] = 0;
            }
            aggregates.featureUsage[featureName]++;
          }
        }

        // Count errors
        if (event.category === "error") {
          aggregates.errors++;
        }

        // Count performance metrics
        if (event.category === "performance") {
          aggregates.performanceMetrics++;
        }
      });

      // Convert Sets to Arrays for JSON serialization
      aggregates.sessions = Array.from(aggregates.sessions);
      aggregates.users = Array.from(aggregates.users);

      // Save aggregates
      await fs.writeFile(
        aggregateFile,
        JSON.stringify(aggregates, null, 2),
        "utf8",
      );
    } catch (err) {
      log.error("Error updating aggregates:", err.message);
    }
  }

  /**
   * Get aggregate metrics for date range
   */
  async getAggregates(startDate, endDate) {
    try {
      await this.initialize();

      const aggregates = [];
      const start = new Date(startDate);
      const end = new Date(endDate);

      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const dateStr = d.toISOString().split("T")[0];
        const aggregateFile = path.join(
          this.aggregatesDir,
          `aggregate-${dateStr}.json`,
        );

        try {
          const data = await fs.readFile(aggregateFile, "utf8");
          aggregates.push(JSON.parse(data));
        } catch (err) {
          // File doesn't exist for this date, skip
        }
      }

      return aggregates;
    } catch (err) {
      log.error("Error getting aggregates:", err.message);
      return [];
    }
  }

  /**
   * Get summary statistics
   */
  async getSummary(days = 7) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const aggregates = await this.getAggregates(startDate, endDate);

      // Combine aggregates
      const summary = {
        totalSessions: 0,
        uniqueUsers: new Set(),
        totalEvents: 0,
        gameplayMetrics: {
          actions: 0,
          decisions: 0,
          outcomes: 0,
          rolls: 0,
          missions: 0,
        },
        featureUsage: {},
        totalErrors: 0,
        totalPerformanceMetrics: 0,
      };

      aggregates.forEach((agg) => {
        summary.totalSessions += agg.sessions?.length || 0;
        (agg.users || []).forEach((user) => summary.uniqueUsers.add(user));
        summary.totalEvents += Object.values(agg.eventCounts || {}).reduce(
          (a, b) => a + b,
          0,
        );

        if (agg.gameplayMetrics) {
          summary.gameplayMetrics.actions += agg.gameplayMetrics.actions || 0;
          summary.gameplayMetrics.decisions +=
            agg.gameplayMetrics.decisions || 0;
          summary.gameplayMetrics.outcomes += agg.gameplayMetrics.outcomes || 0;
          summary.gameplayMetrics.rolls += agg.gameplayMetrics.rolls || 0;
          summary.gameplayMetrics.missions += agg.gameplayMetrics.missions || 0;
        }

        Object.entries(agg.featureUsage || {}).forEach(([feature, count]) => {
          if (!summary.featureUsage[feature]) {
            summary.featureUsage[feature] = 0;
          }
          summary.featureUsage[feature] += count;
        });

        summary.totalErrors += agg.errors || 0;
        summary.totalPerformanceMetrics += agg.performanceMetrics || 0;
      });

      summary.uniqueUsers = summary.uniqueUsers.size;

      return summary;
    } catch (err) {
      log.error("Error getting summary:", err.message);
      return null;
    }
  }

  /**
   * Generate report
   */
  async generateReport(startDate, endDate, reportType = "full") {
    try {
      await this.initialize();

      const aggregates = await this.getAggregates(startDate, endDate);
      const summary = await this.getSummary(
        Math.ceil(
          (new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24),
        ),
      );

      const report = {
        type: reportType,
        generatedAt: new Date().toISOString(),
        period: {
          start: startDate,
          end: endDate,
        },
        summary: summary,
        dailyAggregates: aggregates,
      };

      // Save report
      const reportFile = path.join(
        this.reportsDir,
        `report-${Date.now()}.json`,
      );
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2), "utf8");

      return report;
    } catch (err) {
      log.error("Error generating report:", err.message);
      throw err;
    }
  }

  /**
   * Cleanup old data
   */
  async cleanup(daysToKeep = 90) {
    try {
      await this.initialize();

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Cleanup events
      const eventFiles = await fs.readdir(this.eventsDir);
      for (const file of eventFiles) {
        if (file.startsWith("events-")) {
          const dateStr = file.replace("events-", "").replace(".json", "");
          const fileDate = new Date(dateStr);

          if (fileDate < cutoffDate) {
            await fs.unlink(path.join(this.eventsDir, file));
            log.info(`Deleted old event file: ${file}`);
          }
        }
      }

      // Cleanup aggregates
      const aggregateFiles = await fs.readdir(this.aggregatesDir);
      for (const file of aggregateFiles) {
        if (file.startsWith("aggregate-")) {
          const dateStr = file.replace("aggregate-", "").replace(".json", "");
          const fileDate = new Date(dateStr);

          if (fileDate < cutoffDate) {
            await fs.unlink(path.join(this.aggregatesDir, file));
            log.info(`Deleted old aggregate file: ${file}`);
          }
        }
      }

      // Cleanup reports (keep last 30)
      const reportFiles = await fs.readdir(this.reportsDir);
      const sortedReports = reportFiles
        .filter((f) => f.startsWith("report-"))
        .sort()
        .reverse();

      if (sortedReports.length > 30) {
        for (const file of sortedReports.slice(30)) {
          await fs.unlink(path.join(this.reportsDir, file));
          log.info(`Deleted old report file: ${file}`);
        }
      }
    } catch (err) {
      log.error("Error cleaning up old data:", err.message);
    }
  }
}

// Export singleton instance
module.exports = new AnalyticsService();

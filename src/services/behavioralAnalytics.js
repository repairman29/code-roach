/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/behavioralAnalytics.js
 * Last Sync: 2025-12-25T04:10:02.882Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

// Review and improve behavioralAnalytics.js
// Audit server file server/services/behavioralAnalytics.js for security, performance, error handling, and best practices

/**
 * Behavioral Analytics Service
 *
 * Processes and analyzes behavioral tracking data.
 * Provides insights into actual user behavior.
 *
 * Priority: HIGH
 * Impact: Understand actual user behavior vs stated preferences
 */

const fs = require("fs").promises;
const path = require("path");
const { createLogger } = require("../utils/logger");

const log = createLogger("BehavioralAnalytics");

class BehavioralAnalytics {
  constructor(config = {}) {
    this.dataDir =
      config.dataDir || path.join(__dirname, "../../data/behavioral-analytics");
    this.eventsDir = path.join(this.dataDir, "events");
    this.aggregatesDir = path.join(this.dataDir, "aggregates");
  }

  async initialize() {
    try {
      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.mkdir(this.eventsDir, { recursive: true });
      await fs.mkdir(this.aggregatesDir, { recursive: true });
    } catch (err) {
      log.error(
        "Error initializing Behavioral Analytics directories:",
        err.message,
      );
    }
  }

  /**
   * Record behavioral events
   */
  async recordEvents(events) {
    try {
      await this.initialize();

      if (!Array.isArray(events) || events.length === 0) {
        return { eventsRecorded: 0 };
      }

      // Group events by date for efficient storage
      const eventsByDate = {};
      events.forEach((event) => {
        const date = new Date(event.timestamp).toISOString().split("T")[0];
        if (!eventsByDate[date]) {
          eventsByDate[date] = [];
        }
        eventsByDate[date].push(event);
      });

      // Save events by date
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

        // Keep only last 10000 events per day
        if (existingEvents.length > 10000) {
          existingEvents = existingEvents.slice(-10000);
        }

        // Save
        await fs.writeFile(
          filepath,
          JSON.stringify(existingEvents, null, 2),
          "utf8",
        );
      }

      return { eventsRecorded: events.length };
    } catch (err) {
      log.error("Error recording behavioral events:", err.message);
      throw err;
    }
  }

  /**
   * Generate behavioral analytics report
   */
  async generateReport(duration = 24 * 60 * 60 * 1000) {
    // 1 day default
    try {
      const endTime = Date.now();
      const startTime = endTime - duration;

      // Load events from period
      const events = await this.loadEvents(startTime, endTime);

      // Analyze
      const report = {
        metadata: {
          generatedAt: new Date().toISOString(),
          period: {
            start: new Date(startTime).toISOString(),
            end: new Date(endTime).toISOString(),
            duration: duration / 1000 / 60 / 60, // hours
          },
        },
        summary: {
          totalEvents: events.length,
          uniqueSessions: new Set(events.map((e) => e.sessionId)).size,
          uniqueUsers: new Set(events.map((e) => e.userId)).size,
          eventsByType: this.groupBy(events, "type"),
          pageViews: events.filter((e) => e.type === "page_view").length,
          clicks: events.filter((e) => e.type === "click").length,
          errors: events.filter((e) => e.type === "error").length,
        },
        insights: {
          topPages: this.analyzeTopPages(events),
          clickPatterns: this.analyzeClickPatterns(events),
          navigationFlows: this.analyzeNavigationFlows(events),
          featureUsage: this.analyzeFeatureUsage(events),
          dropOffPoints: this.analyzeDropOffPoints(events),
          scrollDepth: this.analyzeScrollDepth(events),
          errorAnalysis: this.analyzeErrors(events),
        },
        recommendations: this.generateRecommendations(events),
      };

      // Save report
      await this.saveReport(report);

      return report;
    } catch (err) {
      log.error("Error generating behavioral analytics report:", err.message);
      throw err;
    }
  }

  /**
   * Load events from time period
   */
  async loadEvents(startTime, endTime) {
    try {
      const files = await fs.readdir(this.eventsDir);
      const events = [];

      // Get date range
      const startDate = new Date(startTime).toISOString().split("T")[0];
      const endDate = new Date(endTime).toISOString().split("T")[0];

      for (const file of files) {
        if (!file.startsWith("events-") || !file.endsWith(".json")) continue;

        const fileDate = file.replace("events-", "").replace(".json", "");
        if (fileDate < startDate || fileDate > endDate) continue;

        try {
          const content = await fs.readFile(
            path.join(this.eventsDir, file),
            "utf8",
          );
          const fileEvents = JSON.parse(content);

          fileEvents.forEach((event) => {
            const eventTime = new Date(event.timestamp).getTime();
            if (eventTime >= startTime && eventTime <= endTime) {
              events.push(event);
            }
          });
        } catch (err) {
          // Skip invalid files
        }
      }

      return events.sort(
        (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
      );
    } catch (err) {
      return [];
    }
  }

  /**
   * Group events by field
   */
  groupBy(events, field) {
    const groups = {};
    events.forEach((event) => {
      const value = event[field] || "unknown";
      groups[value] = (groups[value] || 0) + 1;
    });
    return groups;
  }

  /**
   * Analyze top pages
   */
  analyzeTopPages(events) {
    const pageViews = events.filter((e) => e.type === "page_view");
    const pages = {};

    pageViews.forEach((event) => {
      const path = event.path || event.url || "unknown";
      pages[path] = (pages[path] || 0) + 1;
    });

    return Object.entries(pages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([page, count]) => ({ page, views: count }));
  }

  /**
   * Analyze click patterns
   */
  analyzeClickPatterns(events) {
    const clicks = events.filter((e) => e.type === "click");
    const patterns = {
      byTag: {},
      byId: {},
      byClass: {},
      topElements: [],
    };

    clicks.forEach((event) => {
      const element = event.element || {};

      if (element.tag) {
        patterns.byTag[element.tag] = (patterns.byTag[element.tag] || 0) + 1;
      }

      if (element.id) {
        patterns.byId[element.id] = (patterns.byId[element.id] || 0) + 1;
      }

      if (element.className) {
        const classes = element.className.split(" ").filter((c) => c);
        classes.forEach((cls) => {
          patterns.byClass[cls] = (patterns.byClass[cls] || 0) + 1;
        });
      }
    });

    // Top clicked elements
    const elementCounts = {};
    clicks.forEach((event) => {
      const key = `${event.element?.tag || "unknown"}#${event.element?.id || "no-id"}`;
      elementCounts[key] = (elementCounts[key] || 0) + 1;
    });

    patterns.topElements = Object.entries(elementCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([element, count]) => ({ element, clicks: count }));

    return patterns;
  }

  /**
   * Analyze navigation flows
   */
  analyzeNavigationFlows(events) {
    const pageViews = events.filter((e) => e.type === "page_view");
    const flows = [];

    for (let i = 0; i < pageViews.length - 1; i++) {
      const from = pageViews[i].path || pageViews[i].url || "unknown";
      const to = pageViews[i + 1].path || pageViews[i + 1].url || "unknown";

      const flowKey = `${from} → ${to}`;
      const existing = flows.find((f) => f.flow === flowKey);

      if (existing) {
        existing.count++;
      } else {
        flows.push({ flow: flowKey, from, to, count: 1 });
      }
    }

    return flows.sort((a, b) => b.count - a.count).slice(0, 20);
  }

  /**
   * Analyze feature usage
   */
  analyzeFeatureUsage(events) {
    const featureEvents = events.filter((e) => e.type === "feature_usage");
    const features = {};

    featureEvents.forEach((event) => {
      const feature = event.feature || "unknown";
      features[feature] = (features[feature] || 0) + 1;
    });

    return Object.entries(features)
      .sort((a, b) => b[1] - a[1])
      .map(([feature, count]) => ({ feature, usageCount: count }));
  }

  /**
   * Analyze drop-off points
   */
  analyzeDropOffPoints(events) {
    // Identify pages where users leave (no subsequent page view)
    const pageViews = events.filter((e) => e.type === "page_view");
    const sessions = {};

    pageViews /**
     */
      .forEach((event) => {
        const sessionId = event.sessionId;
        if (!sessions[sessionId]) {
          sessions[sessionId] = [];
        }
        sessions[sessionId].push(event);
      });

    // Find last page in each session
    const lastPages = {};
    Object.values(sessions).forEach((sessionEvents) => {
      const lastEvent = sessionEvents[sessionEvents.length - 1];
      const page = lastEvent.path || lastEvent.url || "unknown";
      lastPages[page] = (lastPages[page] || 0) + 1;
    });

    return Object.entries(lastPages)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([page, dropOffs]) => ({ page, dropOffs }));
  }

  /**
   * Analyze scroll depth
   */
  analyzeScrollDepth(events) {
    const scrollEvents = events.filter(
      (e) => e.type === "scroll" && e.scrollDepth,
    );
    if (scrollEvents.length === 0) return null;

    const depths = scrollEvents.map((e) => e.scrollDepth);
    const average = depths.reduce((sum, d) => sum + d, 0) / depths.length;

    // Distribution
    const distribution = {
      "0-25%": depths.filter((d) => d <= 25).length,
      "26-50%": depths.filter((d) => d > 25 && d <= 50).length,
      "51-75%": depths.filter((d) => d > 50 && d <= 75).length,
      "76-100%": depths.filter((d) => d > 75).length,
    };

    return {
      average,
      distribution,
      totalScrollEvents: scrollEvents.length,
    };
  }

  /**
   * Analyze errors
   */
  analyzeErrors(events) {
    const errors = events.filter((e) => e.type === "error");

    const errorTypes = {};
    const errorMessages = {};

    errors.forEach((error) => {
      const type = error.message ? "javascript" : "unknown";
      errorTypes[type] = (errorTypes[type] || 0) + 1;

      /**
       */
      if (error.message) {
        const msg = error.message.substring(0, 100);
        errorMessages[msg] = (errorMessages[msg] || 0) + 1;
      }
    });

    return {
      totalErrors: errors.length,
      errorTypes,
      topErrors: Object.entries(errorMessages)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([message, count]) => ({ message, count })),
    };
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(events) {
    const recommendations = [];

    // Check error rate
    const errorRate =
      events.filter((e) => e.type === "error").length / events.length;
    /**
     */
    if (errorRate > 0.01) {
      // >1% error rate
      recommendations.push({
        priority: "high",
        issue: "High error rate",
        recommendation: `${(errorRate * 100).toFixed(2)}% of events are errors. Investigate and fix common errors.`,
      });
    }

    // Check drop-off points
    const dropOffs = this.analyzeDropOffPoints(events);
    /**
     */
    if (dropOffs.length > 0 && dropOffs[0].dropOffs > 10) {
      recommendations.push({
        priority: "medium",
        issue: `High drop-off on ${dropOffs[0].page}`,
        recommendation: `${dropOffs[0].dropOffs} sessions end on this page. Investigate why users leave here.`,
      });
    }

    // Check scroll depth
    const scrollDepth = this.analyzeScrollDepth(events);
    /**
     */
    if (scrollDepth && scrollDepth.average < 50) {
      recommendations.push({
        priority: "low",
        issue: "Low scroll depth",
        recommendation: `Average scroll depth is ${scrollDepth.average.toFixed(1)}%. Consider improving content engagement.`,
      });
    }

    return recommendations;
  }

  /**
   * Save report
   */
  async saveReport(report) {
    try {
      const filename = `behavioral-report-${Date.now()}.json`;
      const filepath = path.join(this.dataDir, filename);

      await fs.writeFile(filepath, JSON.stringify(report, null, 2), "utf8");
    } catch (err) {
      /**
       */
      log.error("Error saving behavioral analytics report:", err.message);
    }
  }
}

module.exports = BehavioralAnalytics;

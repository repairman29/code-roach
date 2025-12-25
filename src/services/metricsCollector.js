/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/metricsCollector.js
 * Last Sync: 2025-12-25T07:02:34.015Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Performance Metrics Collector Service
 *
 * Collects, stores, and analyzes performance metrics for patent documentation
 * and system optimization.
 *
 * PATENTABLE TECHNOLOGY:
 * This service implements a comprehensive metrics collection system that tracks
 * performance improvements, accuracy metrics, and efficiency gains for patent
 * documentation purposes.
 *
 * Metrics Tracked:
 * - Embedding generation time
 * - Search response time
 * - Error prediction accuracy
 * - Fix success rate
 * - Cache hit/miss rates
 * - System throughput
 */

const config = require("../config");
const { createLogger } = require("../utils/logger");
const log = createLogger("MetricsCollector");
const fs = require("fs").promises;
const path = require("path");
const { getSupabaseService } = require("../utils/supabaseClient");
const { getSupabaseClient } = require('../utils/supabaseClient');

class MetricsCollector {
  constructor(options = {}) {
    this.dataDir = options.dataDir || path.join(__dirname, "../../data");
    this.metricsFile = path.join(this.dataDir, "performance-metrics.json");
    this.metrics = {
      embedding: {
        generationTime: [],
        batchSize: [],
        cacheHits: 0,
        cacheMisses: 0,
        totalGenerated: 0,
      },
      search: {
        responseTime: [],
        semanticSearchTime: [],
        keywordSearchTime: [],
        hybridSearchTime: [],
        resultsCount: [],
      },
      errorPrediction: {
        predictions: [],
        accuracy: [],
        confidenceScores: [],
        falsePositives: 0,
        falseNegatives: 0,
        truePositives: 0,
        trueNegatives: 0,
      },
      errorFixing: {
        fixesApplied: 0,
        successfulFixes: 0,
        failedFixes: 0,
        fixTime: [],
        rollbacks: 0,
      },
      codebaseIndexing: {
        filesIndexed: 0,
        chunksCreated: 0,
        indexingTime: [],
        incrementalUpdates: 0,
      },
      system: {
        throughput: [],
        memoryUsage: [],
        cpuUsage: [],
        errorRate: [],
      },
    };

    this.retentionDays = options.retentionDays || 90; // Keep 90 days of metrics
    this.maxSamples = options.maxSamples || 10000; // Max samples per metric type

    // Initialize Supabase client if available
    try {
      this.supabase = getSupabaseClient({ requireService: true }).serviceRoleKey,
      );
      this.useDatabase = true;
    } catch (err) {
      log.warn(
        "[Metrics Collector] Supabase not available, using file storage",
      );
      this.useDatabase = false;
    }

    // Load existing metrics
    this.loadMetrics().catch((err) => {
      log.warn("[Metrics Collector] Failed to load metrics:", err.message);
    });
  }

  /**
   * Load metrics from storage
   */
  async loadMetrics() {
    try {
      if (this.useDatabase) {
        const { data } = await this.supabase
          .from("performance_metrics")
          .select("*")
          .order("timestamp", { ascending: false })
          .limit(1000);

        if (data) {
          this.processStoredMetrics(data);
        }
      } else {
        await fs.mkdir(this.dataDir, { recursive: true });
        const data = await fs
          .readFile(this.metricsFile, "utf8")
          .catch(() => "{}");
        const stored = JSON.parse(data);
        if (stored.metrics) {
          this.metrics = this.mergeMetrics(this.metrics, stored.metrics);
        }
      }
    } catch (err) {
      console.error("[Metrics Collector] Error loading metrics:", err);
    }
  }

  /**
   * Save metrics to storage
   */
  async saveMetrics() {
    try {
      if (this.useDatabase) {
        // Save to database (implement if table exists)
        // For now, fall back to file
      }

      await fs.mkdir(this.dataDir, { recursive: true });
      await fs.writeFile(
        this.metricsFile,
        JSON.stringify(
          {
            metrics: this.metrics,
            lastUpdated: Date.now(),
          },
          null,
          2,
        ),
        "utf8",
      );
    } catch (err) {
      console.error("[Metrics Collector] Error saving metrics:", err);
    }
  }

  /**
   * Record embedding generation time
   */
  recordEmbeddingGeneration(timeMs, batchSize = 1, fromCache = false) {
    const timestamp = Date.now();

    this.metrics.embedding.generationTime.push({
      time: timeMs,
      batchSize,
      timestamp,
      fromCache,
    });

    if (fromCache) {
      this.metrics.embedding.cacheHits++;
    } else {
      this.metrics.embedding.cacheMisses++;
      this.metrics.embedding.totalGenerated += batchSize;
    }

    // Trim to max samples
    if (this.metrics.embedding.generationTime.length > this.maxSamples) {
      this.metrics.embedding.generationTime =
        this.metrics.embedding.generationTime.slice(-this.maxSamples);
    }

    // Save asynchronously
    this.saveMetrics().catch((err) =>
      console.error("[Metrics] Save error:", err),
    );
  }

  /**
   * Record search performance
   */
  recordSearch(type, timeMs, resultsCount) {
    const timestamp = Date.now();
    const record = {
      time: timeMs,
      resultsCount,
      timestamp,
    };

    this.metrics.search.responseTime.push(record);

    // Record by search type
    switch (type) {
      case "semantic":
        this.metrics.search.semanticSearchTime.push(record);
        break;
      case "keyword":
        this.metrics.search.keywordSearchTime.push(record);
        break;
      case "hybrid":
        this.metrics.search.hybridSearchTime.push(record);
        break;
    }

    this.metrics.search.resultsCount.push(resultsCount);

    // Trim to max samples
    this.trimMetrics("search");

    this.saveMetrics().catch((err) =>
      console.error("[Metrics] Save error:", err),
    );
  }

  /**
   * Record error prediction
   */
  recordErrorPrediction(prediction, actualError = null) {
    const timestamp = Date.now();

    this.metrics.errorPrediction.predictions.push({
      prediction,
      actualError,
      timestamp,
      confidence: prediction.confidence || 0,
    });

    if (prediction.confidence !== undefined) {
      this.metrics.errorPrediction.confidenceScores.push({
        score: prediction.confidence,
        timestamp,
      });
    }

    // If we have actual error, calculate accuracy
    if (actualError) {
      const wasCorrect = this.evaluatePrediction(prediction, actualError);
      this.metrics.errorPrediction.accuracy.push({
        correct: wasCorrect,
        timestamp,
      });

      // Update confusion matrix
      if (
        prediction.severity === "high" ||
        prediction.severity === "critical"
      ) {
        if (actualError.occurred) {
          this.metrics.errorPrediction.truePositives++;
        } else {
          this.metrics.errorPrediction.falsePositives++;
        }
      } else {
        if (actualError.occurred) {
          this.metrics.errorPrediction.falseNegatives++;
        } else {
          this.metrics.errorPrediction.trueNegatives++;
        }
      }
    }

    this.trimMetrics("errorPrediction");
    this.saveMetrics().catch((err) =>
      console.error("[Metrics] Save error:", err),
    );
  }

  /**
   * Record error fix application
   */
  recordErrorFix(fix, success, timeMs = null) {
    const timestamp = Date.now();

    this.metrics.errorFixing.fixesApplied++;

    if (success) {
      this.metrics.errorFixing.successfulFixes++;
    } else {
      this.metrics.errorFixing.failedFixes++;
    }

    if (timeMs !== null) {
      this.metrics.errorFixing.fixTime.push({
        time: timeMs,
        success,
        timestamp,
      });
    }

    this.trimMetrics("errorFixing");
    this.saveMetrics().catch((err) =>
      console.error("[Metrics] Save error:", err),
    );
  }

  /**
   * Record rollback
   */
  recordRollback() {
    this.metrics.errorFixing.rollbacks++;
    this.saveMetrics().catch((err) =>
      console.error("[Metrics] Save error:", err),
    );
  }

  /**
   * Record codebase indexing metrics
   */
  recordIndexing(filesIndexed, chunksCreated, timeMs, incremental = false) {
    const timestamp = Date.now();

    this.metrics.codebaseIndexing.filesIndexed += filesIndexed;
    this.metrics.codebaseIndexing.chunksCreated += chunksCreated;

    this.metrics.codebaseIndexing.indexingTime.push({
      time: timeMs,
      filesIndexed,
      chunksCreated,
      incremental,
      timestamp,
    });

    if (incremental) {
      this.metrics.codebaseIndexing.incrementalUpdates++;
    }

    this.trimMetrics("codebaseIndexing");
    this.saveMetrics().catch((err) =>
      console.error("[Metrics] Save error:", err),
    );
  }

  /**
   * Record system metrics
   */
  recordSystemMetrics(throughput, memoryMB, cpuPercent, errorRate = 0) {
    const timestamp = Date.now();

    this.metrics.system.throughput.push({ value: throughput, timestamp });
    this.metrics.system.memoryUsage.push({ value: memoryMB, timestamp });
    this.metrics.system.cpuUsage.push({ value: cpuPercent, timestamp });
    this.metrics.system.errorRate.push({ value: errorRate, timestamp });

    this.trimMetrics("system");
    this.saveMetrics().catch((err) =>
      console.error("[Metrics] Save error:", err),
    );
  }

  /**
   * Get statistics for a metric category
   */
  getStatistics(category) {
    const categoryMetrics = this.metrics[category];
    if (!categoryMetrics) return null;

    const stats = {};

    // Calculate statistics for time-based metrics
    const timeFields = [
      "generationTime",
      "responseTime",
      "fixTime",
      "indexingTime",
    ];
    for (const field of timeFields) {
      if (categoryMetrics[field] && Array.isArray(categoryMetrics[field])) {
        const times = categoryMetrics[field].map((m) => m.time || m.value || m);
        if (times.length > 0) {
          stats[field] = {
            count: times.length,
            mean: this.mean(times),
            median: this.median(times),
            min: Math.min(...times),
            max: Math.max(...times),
            p95: this.percentile(times, 0.95),
            p99: this.percentile(times, 0.99),
            stdDev: this.standardDeviation(times),
          };
        }
      }
    }

    // Calculate accuracy metrics for error prediction
    if (category === "errorPrediction" && categoryMetrics.accuracy) {
      const accuracy = categoryMetrics.accuracy.map((a) => a.correct);
      if (accuracy.length > 0) {
        const correct = accuracy.filter((a) => a).length;
        stats.accuracy = {
          rate: correct / accuracy.length,
          total: accuracy.length,
          correct,
          incorrect: accuracy.length - correct,
        };
      }

      // Confusion matrix
      const { truePositives, falsePositives, trueNegatives, falseNegatives } =
        categoryMetrics;
      const total =
        truePositives + falsePositives + trueNegatives + falseNegatives;
      if (total > 0) {
        stats.confusionMatrix = {
          truePositives,
          falsePositives,
          trueNegatives,
          falseNegatives,
          precision: truePositives / (truePositives + falsePositives) || 0,
          recall: truePositives / (truePositives + falseNegatives) || 0,
          f1Score: this.calculateF1Score(
            truePositives,
            falsePositives,
            falseNegatives,
          ),
        };
      }
    }

    // Calculate success rate for error fixing
    if (category === "errorFixing") {
      const total = categoryMetrics.fixesApplied;
      if (total > 0) {
        stats.successRate = {
          rate: categoryMetrics.successfulFixes / total,
          total,
          successful: categoryMetrics.successfulFixes,
          failed: categoryMetrics.failedFixes,
          rollbacks: categoryMetrics.rollbacks,
        };
      }
    }

    // Calculate cache hit rate
    if (category === "embedding") {
      const total = categoryMetrics.cacheHits + categoryMetrics.cacheMisses;
      if (total > 0) {
        stats.cacheHitRate = {
          rate: categoryMetrics.cacheHits / total,
          hits: categoryMetrics.cacheHits,
          misses: categoryMetrics.cacheMisses,
          total,
        };
      }
    }

    return stats;
  }

  /**
   * Get all statistics
   */
  getAllStatistics() {
    const stats = {};
    for (const category in this.metrics) {
      stats[category] = this.getStatistics(category);
    }
    return stats;
  }

  /**
   * Get performance improvements (before/after comparison)
   */
  getPerformanceImprovements(baselineDate) {
    const baseline = this.getMetricsBefore(baselineDate);
    const current = this.getAllStatistics();

    const improvements = {};

    for (const category in current) {
      if (!baseline[category]) continue;

      improvements[category] = {};
      const currentStats = current[category];
      const baselineStats = baseline[category];

      // Compare time-based metrics
      for (const field in currentStats) {
        if (
          field.includes("Time") &&
          currentStats[field] &&
          baselineStats[field]
        ) {
          const currentMean = currentStats[field].mean;
          const baselineMean = baselineStats[field].mean;

          if (baselineMean > 0) {
            const improvement =
              ((baselineMean - currentMean) / baselineMean) * 100;
            improvements[category][field] = {
              baseline: baselineMean,
              current: currentMean,
              improvement: improvement,
              improvementPercent: improvement.toFixed(2) + "%",
            };
          }
        }
      }
    }

    return improvements;
  }

  /**
   * Helper: Calculate mean
   */
  mean(values) {
    return values.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Helper: Calculate median
   */
  median(values) {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Helper: Calculate percentile
   */
  percentile(values, p) {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil(sorted.length * p) - 1;
    return sorted[Math.max(0, index)];
  }

  /**
   * Helper: Calculate standard deviation
   */
  standardDeviation(values) {
    const avg = this.mean(values);
    const squareDiffs = values.map((value) => Math.pow(value - avg, 2));
    const avgSquareDiff = this.mean(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }

  /**
   * Helper: Calculate F1 score
   */
  calculateF1Score(tp, fp, fn) {
    const precision = tp / (tp + fp) || 0;
    const recall = tp / (tp + fn) || 0;
    return precision + recall > 0
      ? (2 * precision * recall) / (precision + recall)
      : 0;
  }

  /**
   * Helper: Evaluate prediction accuracy
   */
  evaluatePrediction(prediction, actualError) {
    // Simple evaluation: prediction was correct if error occurred and was predicted
    // or error didn't occur and wasn't predicted
    return (
      (prediction.severity === "high" || prediction.severity === "critical") ===
      actualError.occurred
    );
  }

  /**
   * Helper: Trim metrics to max samples
   */
  trimMetrics(category) {
    const categoryMetrics = this.metrics[category];
    if (!categoryMetrics) return;

    const arrayFields = [
      "generationTime",
      "responseTime",
      "fixTime",
      "indexingTime",
      "predictions",
      "accuracy",
      "confidenceScores",
      "resultsCount",
      "throughput",
      "memoryUsage",
      "cpuUsage",
      "errorRate",
    ];

    for (const field of arrayFields) {
      if (categoryMetrics[field] && Array.isArray(categoryMetrics[field])) {
        if (categoryMetrics[field].length > this.maxSamples) {
          categoryMetrics[field] = categoryMetrics[field].slice(
            -this.maxSamples,
          );
        }
      }
    }
  }

  /**
   * Helper: Get metrics before a date
   */
  getMetricsBefore(date) {
    // Simplified: return current stats as baseline
    // In production, would filter by timestamp
    return this.getAllStatistics();
  }

  /**
   * Helper: Merge metrics
   */
  mergeMetrics(current, stored) {
    const merged = { ...current };
    for (const category in stored) {
      if (merged[category]) {
        for (const field in stored[category]) {
          if (Array.isArray(stored[category][field])) {
            merged[category][field] = [
              ...(merged[category][field] || []),
              ...stored[category][field],
            ];
          } else if (typeof stored[category][field] === "number") {
            merged[category][field] =
              (merged[category][field] || 0) + stored[category][field];
          }
        }
      } else {
        merged[category] = stored[category];
      }
    }
    return merged;
  }

  /**
   * Helper: Process stored metrics from database
   */
  processStoredMetrics(data) {
    // Process database records into metrics format
    // Implementation depends on database schema
  }

  /**
   * Export metrics for patent documentation
   */
  exportForPatent() {
    const stats = this.getAllStatistics();
    const improvements = this.getPerformanceImprovements(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ); // Last 30 days

    return {
      timestamp: Date.now(),
      statistics: stats,
      improvements: improvements,
      summary: {
        totalEmbeddings: this.metrics.embedding.totalGenerated,
        totalSearches: this.metrics.search.responseTime.length,
        totalPredictions: this.metrics.errorPrediction.predictions.length,
        totalFixes: this.metrics.errorFixing.fixesApplied,
        cacheHitRate:
          this.metrics.embedding.cacheHits /
            (this.metrics.embedding.cacheHits +
              this.metrics.embedding.cacheMisses) || 0,
      },
    };
  }
}

module.exports = new MetricsCollector();

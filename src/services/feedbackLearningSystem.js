/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/feedbackLearningSystem.js
 * Last Sync: 2025-12-25T07:02:33.995Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Feedback Learning System
 *
 * Aggregates feedback data, performs statistical analysis,
 * identifies statistically significant patterns, and generates
 * actionable improvement recommendations
 */

const fs = require("fs").promises;
const path = require("path");
const { createLogger } = require("../utils/logger");
const log = createLogger("FeedbackLearningSystem");

class FeedbackLearningSystem {
  constructor(config = {}) {
    this.dataDir =
      config.dataDir || path.join(__dirname, "../../data/ai-feedback");
    this.minSampleSize = config.minSampleSize || 30; // Minimum for statistical significance
    this.confidenceLevel = config.confidenceLevel || 0.95; // 95% confidence
    this.analysisInterval = config.analysisInterval || 3600000; // 1 hour

    this.insights = new Map();
    this.statisticalTests = new Map();

    this.init();
  }

  init() {
    // Ensure data directory exists
    fs.mkdir(this.dataDir, { recursive: true }).catch(console.error);

    // Start periodic analysis
    this.startPeriodicAnalysis();
  }

  /**
   * Start periodic statistical analysis
   */
  startPeriodicAnalysis() {
    // Analyze every hour
    setInterval(() => {
      this.performStatisticalAnalysis().catch(console.error);
    }, this.analysisInterval);

    // Run initial analysis
    this.performStatisticalAnalysis().catch(console.error);
  }

  /**
   * Perform comprehensive statistical analysis
   */
  async performStatisticalAnalysis() {
    console.log("[FeedbackLearningSystem] Starting statistical analysis...");

    // Load all feedback data
    const feedbackData = await this.loadAllFeedbackData();

    if (feedbackData.length < this.minSampleSize) {
      console.log(
        `[FeedbackLearningSystem] Insufficient data: ${feedbackData.length} samples (need ${this.minSampleSize})`,
      );
      return {
        status: "insufficient_data",
        sampleSize: feedbackData.length,
        required: this.minSampleSize,
      };
    }

    // Perform statistical tests
    const analysis = {
      timestamp: Date.now(),
      sampleSize: feedbackData.length,
      confidenceLevel: this.confidenceLevel,
      metrics: this.analyzeMetrics(feedbackData),
      trends: this.analyzeTrends(feedbackData),
      correlations: this.analyzeCorrelations(feedbackData),
      significantFindings: [],
      recommendations: [],
    };

    // Identify statistically significant findings
    analysis.significantFindings = this.identifySignificantFindings(analysis);

    // Generate actionable recommendations
    analysis.recommendations = this.generateActionableRecommendations(analysis);

    // Save analysis
    await this.saveAnalysis(analysis);

    console.log(
      `[FeedbackLearningSystem] Analysis complete: ${analysis.significantFindings.length} significant findings, ${analysis.recommendations.length} recommendations`,
    );

    return analysis;
  }

  /**
   * Load all feedback data from reports and cycles
   */
  async loadAllFeedbackData() {
    const data = [];

    try {
      const files = await fs.readdir(this.dataDir);

      // Load feedback reports
      const reportFiles = files.filter(
        (f) => f.startsWith("feedback-report-") && f.endsWith(".json"),
      );
      for (const file of reportFiles) {
        try {
          const content = await fs.readFile(
            path.join(this.dataDir, file),
            "utf8",
          );
          const report = JSON.parse(content);
          if (report.sessions && Array.isArray(report.sessions)) {
            data.push(...report.sessions);
          }
        } catch (err) {
          console.error(`Error loading report ${file}:`, err.message);
        }
      }

      // Load feedback cycles
      const cycleFiles = files.filter(
        (f) => f.startsWith("ai-feedback-cycle-") && f.endsWith(".json"),
      );
      for (const file of cycleFiles) {
        try {
          const content = await fs.readFile(
            path.join(this.dataDir, file),
            "utf8",
          );
          const cycle = JSON.parse(content);
          if (cycle.bots && Array.isArray(cycle.bots)) {
            data.push(...cycle.bots.map((b) => b.analysis).filter(Boolean));
          }
        } catch (err) {
          console.error(`Error loading cycle ${file}:`, err.message);
        }
      }
    } catch (err) {
      if (err.code !== "ENOENT") {
        console.error("Error loading feedback data:", err);
      }
    }

    return data;
  }

  /**
   * Analyze metrics with statistical tests
   */
  analyzeMetrics(data) {
    const metrics = {
      engagement: this.calculateMetricStats(data, "engagement"),
      difficulty: this.calculateMetricStats(data, "difficulty"),
      narrative: this.calculateMetricStats(data, "narrative"),
      balance: this.calculateMetricStats(data, "balance"),
    };

    return metrics;
  }

  /**
   * Calculate statistical measures for a metric
   */
  calculateMetricStats(data, metricName) {
    const values = data
      .map((d) => d[metricName]?.score)
      .filter((v) => typeof v === "number");

    if (values.length === 0) {
      return { count: 0 };
    }

    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const sorted = [...values].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const variance =
      values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);

    // Calculate confidence interval (95%)
    const zScore = 1.96; // For 95% confidence
    const marginOfError = zScore * (stdDev / Math.sqrt(values.length));
    const confidenceInterval = {
      lower: mean - marginOfError,
      upper: mean + marginOfError,
    };

    // Distribution by level
    const levelDistribution = {};
    data.forEach((d) => {
      const level = d[metricName]?.level;
      if (level) {
        levelDistribution[level] = (levelDistribution[level] || 0) + 1;
      }
    });

    return {
      count: values.length,
      mean: Math.round(mean * 100) / 100,
      median: Math.round(median * 100) / 100,
      stdDev: Math.round(stdDev * 100) / 100,
      min: Math.min(...values),
      max: Math.max(...values),
      confidenceInterval: {
        lower: Math.round(confidenceInterval.lower * 100) / 100,
        upper: Math.round(confidenceInterval.upper * 100) / 100,
      },
      levelDistribution,
    };
  }

  /**
   * Analyze trends over time
   */
  analyzeTrends(data) {
    // Group by time periods (daily)
    const dailyGroups = {};
    data.forEach((d) => {
      if (d.timestamp) {
        const date = new Date(d.timestamp);
        const dayKey = date.toISOString().split("T")[0];
        if (!dailyGroups[dayKey]) {
          dailyGroups[dayKey] = [];
        }
        dailyGroups[dayKey].push(d);
      }
    });

    const trends = {};
    ["engagement", "difficulty", "narrative", "balance"].forEach((metric) => {
      const dailyAverages = Object.entries(dailyGroups)
        .map(([day, sessions]) => {
          const scores = sessions
            .map((s) => s[metric]?.score)
            .filter((s) => typeof s === "number");
          return {
            day,
            average:
              scores.length > 0
                ? scores.reduce((a, b) => a + b, 0) / scores.length
                : null,
            count: scores.length,
          };
        })
        .filter((d) => d.average !== null)
        .sort((a, b) => a.day.localeCompare(b.day));

      if (dailyAverages.length >= 2) {
        // Calculate trend (simple linear regression)
        const n = dailyAverages.length;
        const x = dailyAverages.map((_, i) => i);
        const y = dailyAverages.map((d) => d.average);

        const xMean = x.reduce((a, b) => a + b, 0) / n;
        const yMean = y.reduce((a, b) => a + b, 0) / n;

        const numerator = x.reduce(
          (sum, xi, i) => sum + (xi - xMean) * (y[i] - yMean),
          0,
        );
        const denominator = x.reduce(
          (sum, xi) => sum + Math.pow(xi - xMean, 2),
          0,
        );

        const slope = denominator !== 0 ? numerator / denominator : 0;
        const trendDirection =
          slope > 0.1 ? "improving" : slope < -0.1 ? "declining" : "stable";

        trends[metric] = {
          direction: trendDirection,
          slope: Math.round(slope * 1000) / 1000,
          firstValue: dailyAverages[0].average,
          lastValue: dailyAverages[dailyAverages.length - 1].average,
          change:
            Math.round(
              (dailyAverages[dailyAverages.length - 1].average -
                dailyAverages[0].average) *
                100,
            ) / 100,
          dataPoints: dailyAverages.length,
        };
      }
    });

    return trends;
  }

  /**
   * Analyze correlations between metrics
   */
  analyzeCorrelations(data) {
    const correlations = {};
    const metrics = ["engagement", "difficulty", "narrative", "balance"];

    for (let i = 0; i < metrics.length; i++) {
      for (let j = i + 1; j < metrics.length; j++) {
        const metric1 = metrics[i];
        const metric2 = metrics[j];

        const pairs = data
          .map((d) => ({
            x: d[metric1]?.score,
            y: d[metric2]?.score,
          }))
          .filter((p) => typeof p.x === "number" && typeof p.y === "number");

        if (pairs.length >= this.minSampleSize) {
          const correlation = this.calculateCorrelation(pairs);
          correlations[`${metric1}_${metric2}`] = correlation;
        }
      }
    }

    return correlations;
  }

  /**
   * Calculate Pearson correlation coefficient
   */
  calculateCorrelation(pairs) {
    const n = pairs.length;
    const x = pairs.map((p) => p.x);
    const y = pairs.map((p) => p.y);

    const xMean = x.reduce((a, b) => a + b, 0) / n;
    const yMean = y.reduce((a, b) => a + b, 0) / n;

    const numerator = pairs.reduce(
      (sum, p) => sum + (p.x - xMean) * (p.y - yMean),
      0,
    );

    const xStdDev = Math.sqrt(
      x.reduce((sum, v) => sum + Math.pow(v - xMean, 2), 0) / n,
    );
    const yStdDev = Math.sqrt(
      y.reduce((sum, v) => sum + Math.pow(v - yMean, 2), 0) / n,
    );

    const denominator = n * xStdDev * yStdDev;

    const correlation = denominator !== 0 ? numerator / denominator : 0;

    // Determine strength
    const absCorr = Math.abs(correlation);
    let strength = "weak";
    if (absCorr >= 0.7) strength = "strong";
    else if (absCorr >= 0.4) strength = "moderate";

    return {
      coefficient: Math.round(correlation * 1000) / 1000,
      strength,
      significant: absCorr >= 0.4, // Moderate or strong correlation
      sampleSize: n,
    };
  }

  /**
   * Identify statistically significant findings
   */
  identifySignificantFindings(analysis) {
    const findings = [];

    // Check for metrics below thresholds
    Object.entries(analysis.metrics).forEach(([metric, stats]) => {
      if (stats.count >= this.minSampleSize) {
        // Low engagement
        if (metric === "engagement" && stats.mean < 40) {
          findings.push({
            type: "low_metric",
            metric,
            value: stats.mean,
            threshold: 40,
            severity: stats.mean < 30 ? "critical" : "high",
            confidence: this.confidenceLevel,
            sampleSize: stats.count,
          });
        }

        // High difficulty
        if (metric === "difficulty" && stats.mean > 70) {
          findings.push({
            type: "high_difficulty",
            metric,
            value: stats.mean,
            threshold: 70,
            severity: stats.mean > 80 ? "critical" : "high",
            confidence: this.confidenceLevel,
            sampleSize: stats.count,
          });
        }

        // Poor narrative quality
        if (metric === "narrative" && stats.mean < 30) {
          findings.push({
            type: "poor_narrative",
            metric,
            value: stats.mean,
            threshold: 30,
            severity: "high",
            confidence: this.confidenceLevel,
            sampleSize: stats.count,
          });
        }
      }
    });

    // Check for significant trends
    Object.entries(analysis.trends).forEach(([metric, trend]) => {
      if (trend.dataPoints >= 7 && Math.abs(trend.change) > 5) {
        findings.push({
          type: "significant_trend",
          metric,
          direction: trend.direction,
          change: trend.change,
          severity: Math.abs(trend.change) > 10 ? "high" : "medium",
          confidence: this.confidenceLevel,
          dataPoints: trend.dataPoints,
        });
      }
    });

    // Check for significant correlations
    Object.entries(analysis.correlations).forEach(([pair, corr]) => {
      if (corr.significant) {
        findings.push({
          type: "significant_correlation",
          metrics: pair.split("_"),
          correlation: corr.coefficient,
          strength: corr.strength,
          severity: corr.strength === "strong" ? "high" : "medium",
          confidence: this.confidenceLevel,
          sampleSize: corr.sampleSize,
        });
      }
    });

    return findings;
  }

  /**
   * Generate actionable recommendations based on findings
   */
  generateActionableRecommendations(analysis) {
    const recommendations = [];

    analysis.significantFindings.forEach((finding) => {
      switch (finding.type) {
        case "low_metric":
          if (finding.metric === "engagement") {
            recommendations.push({
              priority: finding.severity,
              category: "engagement",
              issue: `Low engagement (${finding.value.toFixed(1)}/100)`,
              evidence: `${finding.sampleSize} sessions analyzed, ${this.confidenceLevel * 100}% confidence`,
              action:
                "Add more action prompts, improve visual feedback, enhance narrative hooks",
              expectedImpact: "high",
              effort: "medium",
            });
          }
          break;

        case "high_difficulty":
          recommendations.push({
            priority: finding.severity,
            category: "difficulty",
            issue: `Difficulty too high (${finding.value.toFixed(1)}/100)`,
            evidence: `${finding.sampleSize} sessions analyzed, ${this.confidenceLevel * 100}% confidence`,
            action:
              "Reduce base difficulty, add hints system, implement fail-forward mechanics",
            expectedImpact: "high",
            effort: "medium",
          });
          break;

        case "poor_narrative":
          recommendations.push({
            priority: finding.severity,
            category: "narrative",
            issue: `Poor narrative quality (${finding.value.toFixed(1)}/100)`,
            evidence: `${finding.sampleSize} sessions analyzed, ${this.confidenceLevel * 100}% confidence`,
            action:
              "Improve AI GM prompts, increase narrative variety, reduce response times",
            expectedImpact: "high",
            effort: "high",
          });
          break;

        case "significant_trend":
          recommendations.push({
            priority: finding.severity,
            category: finding.metric,
            issue: `${finding.metric} is ${finding.direction} (${finding.change > 0 ? "+" : ""}${finding.change.toFixed(1)} over ${finding.dataPoints} days)`,
            evidence: `Trend analysis with ${this.confidenceLevel * 100}% confidence`,
            action:
              finding.direction === "declining"
                ? `Investigate root cause of ${finding.metric} decline and implement fixes`
                : `Maintain current practices that are improving ${finding.metric}`,
            expectedImpact:
              finding.direction === "declining" ? "high" : "medium",
            effort: finding.direction === "declining" ? "high" : "low",
          });
          break;

        case "significant_correlation":
          recommendations.push({
            priority: finding.severity,
            category: "system_design",
            issue: `Strong correlation between ${finding.metrics[0]} and ${finding.metrics[1]} (${finding.correlation.toFixed(2)})`,
            evidence: `${finding.sampleSize} sessions analyzed, ${finding.strength} correlation`,
            action: `Leverage this relationship: improving ${finding.metrics[0]} may improve ${finding.metrics[1]}`,
            expectedImpact: "medium",
            effort: "low",
          });
          break;
      }
    });

    return recommendations;
  }

  /**
   * Save analysis results
   */
  async saveAnalysis(analysis) {
    const filename = `learning-analysis-${Date.now()}.json`;
    const filepath = path.join(this.dataDir, filename);
    await fs.writeFile(filepath, JSON.stringify(analysis, null, 2));

    // Also save as latest
    const latestPath = path.join(this.dataDir, "latest-learning-analysis.json");
    await fs.writeFile(latestPath, JSON.stringify(analysis, null, 2));

    return filepath;
  }

  /**
   * Get latest analysis
   */
  async getLatestAnalysis() {
    try {
      const latestPath = path.join(
        this.dataDir,
        "latest-learning-analysis.json",
      );
      const content = await fs.readFile(latestPath, "utf8");
      return JSON.parse(content);
    } catch (err) {
      if (err.code === "ENOENT") {
        return null;
      }
      throw err;
    }
  }

  /**
   * Check if we have enough data for statistical significance
   */
  async checkDataSufficiency() {
    const data = await this.loadAllFeedbackData();
    return {
      current: data.length,
      required: this.minSampleSize,
      sufficient: data.length >= this.minSampleSize,
      percentage: Math.min(100, (data.length / this.minSampleSize) * 100),
    };
  }
}

module.exports = FeedbackLearningSystem;

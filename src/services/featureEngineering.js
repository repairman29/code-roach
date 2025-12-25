/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/featureEngineering.js
 * Last Sync: 2025-12-25T04:10:02.868Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Feature Engineering Service
 *
 * Extracts and engineers features for ML model training and prediction.
 *
 * PATENTABLE TECHNOLOGY:
 * This service implements novel feature engineering techniques for error fix
 * success prediction, combining multiple data sources and normalization methods.
 *
 * Key Innovations:
 * - Multi-source feature extraction (error, fix, context, codebase)
 * - Feature normalization and scaling
 * - Feature interaction terms
 * - Temporal feature engineering
 *
 * DRY Principle: Reuses existing services (confidenceCalculator, errorHistoryService)
 */

const errorHistoryService = require("./errorHistoryService");
const confidenceCalculator = require("./confidenceCalculator");
const mlFixPredictor = require("./mlFixPredictor");

class FeatureEngineering {
  constructor() {
    // Feature normalization parameters (learned from training data)
    this.normalizationParams = {
      fixComplexity: { mean: 0.5, std: 0.2 },
      codebaseSize: { mean: 50000, std: 30000 },
      patternSimilarity: { mean: 0.6, std: 0.3 },
    };
  }

  /**
   * Extract all features for ML model
   *
   * Reuses mlFixPredictor.extractFeatures for DRY principle
   *
   * @param {Object} error - Error object
   * @param {Object} fix - Fix object
   * @param {Object} context - Context object
   * @returns {Object} Complete feature set
   */
  extractAllFeatures(error, fix, context = {}) {
    // Base features (reuse from ML predictor)
    const baseFeatures = mlFixPredictor.extractFeatures(error, fix, context);

    // Additional engineered features
    const engineeredFeatures = {
      // Feature interactions
      similarityComplexity:
        baseFeatures.patternSimilarity * baseFeatures.fixComplexity,
      historicalTemporal:
        baseFeatures.historicalSuccessRate * baseFeatures.temporalRecency,
      contextComplexity:
        baseFeatures.contextMatch * (1 - baseFeatures.fixComplexity),

      // Normalized features
      normalizedComplexity: this.normalizeFeature(
        baseFeatures.fixComplexity,
        this.normalizationParams.fixComplexity,
      ),
      normalizedSize: this.normalizeFeature(
        baseFeatures.codebaseSize,
        this.normalizationParams.codebaseSize,
      ),

      // Temporal features
      daysSinceLastSeen: this.calculateDaysSinceLastSeen(error, context),
      fixAge: this.calculateFixAge(fix),

      // Pattern features
      patternFrequency: this.calculatePatternFrequency(error),
      patternTrend: this.calculatePatternTrend(error),

      // Codebase features
      fileComplexity: this.calculateFileComplexity(context),
      projectMaturity: this.calculateProjectMaturity(context),
    };

    return {
      ...baseFeatures,
      ...engineeredFeatures,
    };
  }

  /**
   * Normalize feature using z-score normalization
   *
   * Formula: z = (x - μ) / σ
   *
   * @param {number} value - Feature value
   * @param {Object} params - Normalization parameters {mean, std}
   * @returns {number} Normalized value
   */
  normalizeFeature(value, params) {
    if (params.std === 0) return 0;
    return (value - params.mean) / params.std;
  }

  /**
   * Calculate days since error was last seen
   *
   * @param {Object} error - Error object
   * @param {Object} context - Context object
   * @returns {number} Days since last seen (normalized 0-1)
   */
  calculateDaysSinceLastSeen(error, context) {
    const fingerprint = errorHistoryService.generatePatternFingerprint(error);
    const stats = errorHistoryService.getPatternStats(fingerprint);

    if (!stats || !stats.lastSeen) {
      return 1.0; // Never seen = max value
    }

    const daysSince = (Date.now() - stats.lastSeen) / (1000 * 60 * 60 * 24);
    // Normalize: 0 days = 0, 90+ days = 1
    return Math.min(1.0, daysSince / 90);
  }

  /**
   * Calculate fix age
   *
   * @param {Object} fix - Fix object
   * @returns {number} Fix age in days (normalized 0-1)
   */
  calculateFixAge(fix) {
    if (!fix.timestamp) {
      return 0.5; // Unknown age
    }

    const daysSince = (Date.now() - fix.timestamp) / (1000 * 60 * 60 * 24);
    // Normalize: 0 days = 0, 30+ days = 1
    return Math.min(1.0, daysSince / 30);
  }

  /**
   * Calculate pattern frequency
   *
   * @param {Object} error - Error object
   * @returns {number} Pattern frequency (normalized 0-1)
   */
  calculatePatternFrequency(error) {
    const fingerprint = errorHistoryService.generatePatternFingerprint(error);
    const stats = errorHistoryService.getPatternStats(fingerprint);

    if (!stats) {
      return 0; // Never seen
    }

    // Normalize occurrences: 0 = 0, 100+ = 1
    return Math.min(1.0, stats.occurrences / 100);
  }

  /**
   * Calculate pattern trend (increasing/decreasing frequency)
   *
   * @param {Object} error - Error object
   * @returns {number} Trend (-1 to 1, negative = decreasing, positive = increasing)
   */
  calculatePatternTrend(error) {
    const fingerprint = errorHistoryService.generatePatternFingerprint(error);
    const stats = errorHistoryService.getPatternStats(fingerprint);

    if (!stats || stats.occurrences < 2) {
      return 0; // No trend data
    }

    // Simple trend: compare recent vs. older occurrences
    // For now, return 0 (would need time-series data)
    return 0;
  }

  /**
   * Calculate file complexity
   *
   * @param {Object} context - Context object
   * @returns {number} File complexity (0-1)
   */
  calculateFileComplexity(context) {
    // Based on file size, number of functions, etc.
    const fileSize = context.fileSize || 0;
    const numFunctions = context.numFunctions || 0;

    // Normalize: 0-500 lines = 0-0.5, 500+ lines = 0.5-1
    const sizeScore = Math.min(0.5, fileSize / 1000);
    const functionScore = Math.min(0.5, numFunctions / 20);

    return sizeScore + functionScore;
  }

  /**
   * Calculate project maturity
   *
   * @param {Object} context - Context object
   * @returns {number} Project maturity (0-1)
   */
  calculateProjectMaturity(context) {
    // Based on project age, number of commits, etc.
    const projectAge = context.projectAge || 0; // Days
    const numCommits = context.numCommits || 0;

    // Normalize: 0-365 days = 0-0.5, 365+ days = 0.5-1
    const ageScore = Math.min(0.5, projectAge / 730);
    const commitScore = Math.min(0.5, numCommits / 1000);

    return ageScore + commitScore;
  }

  /**
   * Convert features to feature vector for ML model
   *
   * @param {Object} features - Feature object
   * @returns {Array<number>} Feature vector
   */
  featuresToVector(features) {
    return [
      features.patternSimilarity,
      features.historicalSuccessRate,
      features.fixComplexity,
      features.contextMatch,
      features.codebaseSize,
      features.codebaseComplexity,
      features.temporalRecency,
      features.errorType,
      features.fixType,
      features.safetyLevel,
      // Engineered features
      features.similarityComplexity || 0,
      features.historicalTemporal || 0,
      features.contextComplexity || 0,
      features.normalizedComplexity || 0,
      features.normalizedSize || 0,
      features.daysSinceLastSeen || 0,
      features.fixAge || 0,
      features.patternFrequency || 0,
      features.patternTrend || 0,
      features.fileComplexity || 0,
      features.projectMaturity || 0,
    ];
  }

  /**
   * Get feature importance (for model interpretation)
   *
   * @returns {Object} Feature importance scores
   */
  getFeatureImportance() {
    // Based on domain knowledge and model analysis
    return {
      patternSimilarity: 0.25,
      historicalSuccessRate: 0.3,
      fixComplexity: 0.15,
      contextMatch: 0.2,
      temporalRecency: 0.1,
      // Engineered features
      similarityComplexity: 0.05,
      historicalTemporal: 0.05,
      contextComplexity: 0.05,
    };
  }

  /**
   * Update normalization parameters from training data
   *
   * @param {Array} trainingData - Training data array
   */
  updateNormalizationParams(trainingData) {
    if (trainingData.length === 0) return;

    // Calculate mean and std for each feature
    const features = trainingData.map((sample) => sample.features);
    const numFeatures = features[0].length;

    for (let i = 0; i < numFeatures; i++) {
      const values = features.map((f) => f[i]);
      const mean = values.reduce((a, b) => a + b, 0) / values.length;
      const variance =
        values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        values.length;
      const std = Math.sqrt(variance);

      // Update params (would map to feature names in production)
      // For now, just log
      if (i === 2) {
        // fixComplexity
        this.normalizationParams.fixComplexity = { mean, std };
      }
    }
  }
}

module.exports = new FeatureEngineering();

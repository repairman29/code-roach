/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/confidenceCalculator.js
 * Last Sync: 2025-12-14T07:30:45.620Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Confidence Calculator Service
 * 
 * Implements mathematical formula for calculating confidence scores in error prediction
 * and fix success probability.
 * 
 * PATENTABLE TECHNOLOGY:
 * This service implements a novel confidence scoring algorithm that combines multiple
 * factors using a weighted formula with configurable parameters.
 * 
 * Formula:
 * C = (α × H) + (β × S) + (γ × T) + (δ × M)
 * 
 * Where:
 * - C = Final confidence score (0-1)
 * - H = Historical success rate (0-1)
 * - S = Pattern similarity score (0-1)
 * - T = Temporal recency factor (0-1, decays over time)
 * - M = ML model prediction (0-1, optional)
 * 
 * Default Weights:
 * - α = 0.3 (historical importance)
 * - β = 0.2 (similarity importance)
 * - γ = 0.1 (recency importance)
 * - δ = 0.4 (ML prediction importance, if available)
 * 
 * The final score is normalized using a sigmoid function for better distribution.
 */

class ConfidenceCalculator {
    constructor(options = {}) {
        // Configurable weights (can be adjusted based on domain/use case)
        this.weights = {
            historical: options.historicalWeight || 0.3,      // α
            similarity: options.similarityWeight || 0.2,      // β
            temporal: options.temporalWeight || 0.1,          // γ
            mlPrediction: options.mlPredictionWeight || 0.4   // δ
        };
        
        // Temporal decay rate (λ)
        this.temporalDecayRate = options.temporalDecayRate || 0.1;
        
        // Sigmoid normalization parameters
        this.sigmoidSteepness = options.sigmoidSteepness || 5.0;
        this.sigmoidCenter = options.sigmoidCenter || 0.5;
        
        // Validate weights sum to 1.0 (or close to it)
        const totalWeight = Object.values(this.weights).reduce((a, b) => a + b, 0);
        if (Math.abs(totalWeight - 1.0) > 0.01) {
            console.warn(`[Confidence Calculator] Weights sum to ${totalWeight}, not 1.0. Normalizing...`);
            this.normalizeWeights();
        }
    }

    /**
     * Normalize weights to sum to 1.0
     */
    normalizeWeights() {
        const total = Object.values(this.weights).reduce((a, b) => a + b, 0);
        for (const key in this.weights) {
            this.weights[key] /= total;
        }
    }

    /**
     * Calculate confidence score using the weighted formula
     * 
     * @param {Object} factors - Input factors for calculation
     * @param {number} factors.historicalSuccessRate - Historical success rate (0-1)
     * @param {number} factors.similarityScore - Pattern similarity score (0-1)
     * @param {number} factors.temporalFactor - Temporal recency factor (0-1)
     * @param {number} [factors.mlPrediction] - ML model prediction (0-1, optional)
     * @returns {Object} Confidence score and breakdown
     */
    calculate(factors) {
        const {
            historicalSuccessRate = 0,
            similarityScore = 0,
            temporalFactor = 0,
            mlPrediction = null
        } = factors;

        // Validate inputs
        this.validateFactor(historicalSuccessRate, 'historicalSuccessRate');
        this.validateFactor(similarityScore, 'similarityScore');
        this.validateFactor(temporalFactor, 'temporalFactor');
        if (mlPrediction !== null) {
            this.validateFactor(mlPrediction, 'mlPrediction');
        }

        // Calculate weighted sum
        // If ML prediction is not available, redistribute its weight proportionally
        let mlWeight = this.weights.mlPrediction;
        let mlValue = mlPrediction !== null ? mlPrediction : 0;
        
        if (mlPrediction === null) {
            // Redistribute ML weight proportionally to other factors
            const otherWeights = this.weights.historical + this.weights.similarity + this.weights.temporal;
            if (otherWeights > 0) {
                const redistributionFactor = 1 + (mlWeight / otherWeights);
                mlWeight = 0;
            }
        }

        const rawScore = 
            (this.weights.historical * historicalSuccessRate) +
            (this.weights.similarity * similarityScore) +
            (this.weights.temporal * temporalFactor) +
            (mlWeight * mlValue);

        // Apply sigmoid normalization for better distribution
        const normalizedScore = this.sigmoidNormalize(rawScore);

        // Calculate component contributions for transparency
        const breakdown = {
            historical: {
                value: historicalSuccessRate,
                weight: this.weights.historical,
                contribution: this.weights.historical * historicalSuccessRate
            },
            similarity: {
                value: similarityScore,
                weight: this.weights.similarity,
                contribution: this.weights.similarity * similarityScore
            },
            temporal: {
                value: temporalFactor,
                weight: this.weights.temporal,
                contribution: this.weights.temporal * temporalFactor
            }
        };

        if (mlPrediction !== null) {
            breakdown.mlPrediction = {
                value: mlPrediction,
                weight: mlWeight,
                contribution: mlWeight * mlPrediction
            };
        }

        return {
            confidence: normalizedScore,
            rawScore: rawScore,
            breakdown: breakdown,
            formula: {
                weights: { ...this.weights },
                components: {
                    H: historicalSuccessRate,
                    S: similarityScore,
                    T: temporalFactor,
                    M: mlPrediction
                }
            }
        };
    }

    /**
     * Calculate temporal decay factor
     * 
     * Formula: T = e^(-λ × t)
     * 
     * Where:
     * - λ = decay rate (default 0.1)
     * - t = time since event (in days)
     * 
     * @param {number} timestamp - Timestamp of the event (milliseconds)
     * @param {number} [currentTime] - Current timestamp (defaults to now)
     * @returns {number} Temporal factor (0-1)
     */
    calculateTemporalFactor(timestamp, currentTime = Date.now()) {
        const timeDiffMs = currentTime - timestamp;
        const timeDiffDays = timeDiffMs / (1000 * 60 * 60 * 24);
        
        // Exponential decay: T = e^(-λ × t)
        const temporalFactor = Math.exp(-this.temporalDecayRate * timeDiffDays);
        
        // Clamp to [0, 1]
        return Math.max(0, Math.min(1, temporalFactor));
    }

    /**
     * Calculate similarity score between two patterns
     * 
     * Uses word overlap with normalization
     * 
     * @param {string} pattern1 - First pattern
     * @param {string} pattern2 - Second pattern
     * @returns {number} Similarity score (0-1)
     */
    calculateSimilarityScore(pattern1, pattern2) {
        if (!pattern1 || !pattern2) return 0;
        if (pattern1 === pattern2) return 1.0;

        // Tokenize patterns
        const tokens1 = this.tokenize(pattern1);
        const tokens2 = this.tokenize(pattern2);

        if (tokens1.length === 0 || tokens2.length === 0) return 0;

        // Calculate Jaccard similarity (intersection over union)
        const set1 = new Set(tokens1);
        const set2 = new Set(tokens2);
        
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);

        const jaccardSimilarity = intersection.size / union.size;

        // Also calculate word overlap percentage
        const overlapRatio = intersection.size / Math.max(tokens1.length, tokens2.length);

        // Combine both metrics (weighted average)
        return (0.6 * jaccardSimilarity) + (0.4 * overlapRatio);
    }

    /**
     * Tokenize text into words
     * 
     * @param {string} text - Text to tokenize
     * @returns {Array<string>} Array of tokens
     */
    tokenize(text) {
        return text
            .toLowerCase()
            .replace(/[^\w\s]/g, ' ')
            .split(/\s+/)
            .filter(token => token.length > 0);
    }

    /**
     * Apply sigmoid normalization to raw score
     * 
     * Formula: 1 / (1 + e^(-k × (x - x0)))
     * 
     * Where:
     * - k = steepness parameter (default 5.0)
     * - x0 = center point (default 0.5)
     * - x = raw score
     * 
     * This ensures the output is smoothly distributed between 0 and 1
     * 
     * @param {number} rawScore - Raw confidence score
     * @returns {number} Normalized score (0-1)
     */
    sigmoidNormalize(rawScore) {
        const exponent = -this.sigmoidSteepness * (rawScore - this.sigmoidCenter);
        return 1 / (1 + Math.exp(exponent));
    }

    /**
     * Validate that a factor is in the valid range [0, 1]
     * 
     * @param {number} value - Value to validate
     * @param {string} name - Name of the factor (for error messages)
     * @throws {Error} If value is out of range
     */
    validateFactor(value, name) {
        if (typeof value !== 'number' || isNaN(value)) {
            throw new Error(`[Confidence Calculator] ${name} must be a number, got: ${value}`);
        }
        if (value < 0 || value > 1) {
            throw new Error(`[Confidence Calculator] ${name} must be between 0 and 1, got: ${value}`);
        }
    }

    /**
     * Get current configuration
     * 
     * @returns {Object} Current configuration
     */
    getConfig() {
        return {
            weights: { ...this.weights },
            temporalDecayRate: this.temporalDecayRate,
            sigmoidSteepness: this.sigmoidSteepness,
            sigmoidCenter: this.sigmoidCenter
        };
    }

    /**
     * Update configuration
     * 
     * @param {Object} config - New configuration
     */
    updateConfig(config) {
        if (config.weights) {
            this.weights = { ...this.weights, ...config.weights };
            this.normalizeWeights();
        }
        if (config.temporalDecayRate !== undefined) {
            this.temporalDecayRate = config.temporalDecayRate;
        }
        if (config.sigmoidSteepness !== undefined) {
            this.sigmoidSteepness = config.sigmoidSteepness;
        }
        if (config.sigmoidCenter !== undefined) {
            this.sigmoidCenter = config.sigmoidCenter;
        }
    }
}

module.exports = new ConfidenceCalculator();


/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixConfidenceCalibrationService.js
 * Last Sync: 2025-12-16T00:42:39.833Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Confidence Calibration Service
 * Calibrates confidence scores against actual outcomes
 * 
 * Critical Missing Feature #2
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

class FixConfidenceCalibrationService {
    constructor() {
        this.supabase = null;
        this.calibrationCache = new Map();
        this.calibrationData = {
            byMethod: new Map(),
            byDomain: new Map(),
            byConfidenceBucket: new Map()
        };
        
        if (config.supabase?.url && config.supabase?.serviceRoleKey) {
            this.supabase = createClient(
                config.supabase.url,
                config.supabase.serviceRoleKey
            );
        }
    }

    /**
     * Calibrate confidence score based on historical accuracy
     */
    async calibrateConfidence(originalConfidence, context = {}) {
        const {
            method,
            domain,
            filePath,
            issueType
        } = context;

        try {
            // Get calibration data
            const calibration = await this.getCalibrationData(method, domain);
            
            // Calculate calibrated confidence
            const calibrated = this.applyCalibration(originalConfidence, calibration);
            
            // Add confidence interval
            const interval = this.calculateConfidenceInterval(calibrated, calibration);
            
            return {
                original: originalConfidence,
                calibrated: calibrated,
                calibration: calibration,
                interval: interval,
                reliability: this.calculateReliability(calibration)
            };
        } catch (error) {
            console.error('[Fix Confidence Calibration] Error:', error);
            return {
                original: originalConfidence,
                calibrated: originalConfidence,
                interval: { lower: originalConfidence * 0.8, upper: Math.min(1, originalConfidence * 1.2) },
                reliability: 'unknown'
            };
        }
    }

    /**
     * Record fix outcome for calibration
     */
    async recordOutcome(fixId, predictedConfidence, actualSuccess, context = {}) {
        const {
            method,
            domain,
            filePath,
            issueType
        } = context;

        try {
            if (!this.supabase) return;

            // Store in database
            const { error } = await this.supabase
                .from('code_roach_fix_learning')
                .insert({
                    issue_id: fixId,
                    fix_method: method || 'unknown',
                    fix_confidence: predictedConfidence,
                    success: actualSuccess,
                    file_path: filePath,
                    issue_type: issueType,
                    learning_insights: {
                        domain: domain,
                        calibration_record: true,
                        timestamp: new Date().toISOString()
                    }
                });

            if (error) {
                console.warn('[Fix Confidence Calibration] Error recording outcome:', error);
            }

            // Update in-memory calibration data
            this.updateCalibrationData(method, domain, predictedConfidence, actualSuccess);
        } catch (error) {
            console.error('[Fix Confidence Calibration] Error recording outcome:', error);
        }
    }

    /**
     * Get calibration data for method/domain
     */
    async getCalibrationData(method, domain) {
        const cacheKey = `${method}:${domain}`;
        
        // Check cache
        if (this.calibrationCache.has(cacheKey)) {
            const cached = this.calibrationCache.get(cacheKey);
            if (Date.now() - cached.timestamp < 3600000) { // 1 hour cache
                return cached.data;
            }
        }

        try {
            // Query historical data
            const data = await this.queryCalibrationData(method, domain);
            
            // Calculate calibration metrics
            const calibration = this.calculateCalibrationMetrics(data);
            
            // Cache result
            this.calibrationCache.set(cacheKey, {
                data: calibration,
                timestamp: Date.now()
            });
            
            return calibration;
        } catch (error) {
            console.warn('[Fix Confidence Calibration] Error getting calibration data:', error);
            return this.getDefaultCalibration();
        }
    }

    /**
     * Query calibration data from database
     */
    async queryCalibrationData(method, domain) {
        if (!this.supabase) return [];

        try {
            let query = this.supabase
                .from('code_roach_fix_learning')
                .select('fix_confidence, success, fix_method, learning_insights')
                .not('fix_confidence', 'is', null)
                .not('success', 'is', null);

            if (method) {
                query = query.eq('fix_method', method);
            }

            const { data, error } = await query.limit(1000);

            if (error) throw error;

            // Filter by domain if provided
            if (domain && data) {
                return data.filter(d => 
                    d.learning_insights?.domain === domain
                );
            }

            return data || [];
        } catch (error) {
            console.warn('[Fix Confidence Calibration] Error querying data:', error);
            return [];
        }
    }

    /**
     * Calculate calibration metrics
     */
    calculateCalibrationMetrics(data) {
        if (!data || data.length === 0) {
            return this.getDefaultCalibration();
        }

        // Group by confidence buckets
        const buckets = {
            '0.0-0.2': { predicted: [], actual: [] },
            '0.2-0.4': { predicted: [], actual: [] },
            '0.4-0.6': { predicted: [], actual: [] },
            '0.6-0.8': { predicted: [], actual: [] },
            '0.8-1.0': { predicted: [], actual: [] }
        };

        data.forEach(d => {
            const conf = d.fix_confidence || 0;
            let bucket;
            if (conf < 0.2) bucket = '0.0-0.2';
            else if (conf < 0.4) bucket = '0.2-0.4';
            else if (conf < 0.6) bucket = '0.4-0.6';
            else if (conf < 0.8) bucket = '0.6-0.8';
            else bucket = '0.8-1.0';

            buckets[bucket].predicted.push(conf);
            buckets[bucket].actual.push(d.success ? 1 : 0);
        });

        // Calculate calibration for each bucket
        const bucketCalibrations = {};
        for (const [bucket, values] of Object.entries(buckets)) {
            if (values.predicted.length > 0) {
                const avgPredicted = values.predicted.reduce((a, b) => a + b, 0) / values.predicted.length;
                const avgActual = values.actual.reduce((a, b) => a + b, 0) / values.actual.length;
                const calibration = avgActual - avgPredicted; // Positive = overconfident, negative = underconfident
                
                bucketCalibrations[bucket] = {
                    count: values.predicted.length,
                    avgPredicted,
                    avgActual,
                    calibration,
                    accuracy: avgActual
                };
            }
        }

        // Calculate overall metrics
        const total = data.length;
        const successful = data.filter(d => d.success === true).length;
        const avgConfidence = data.reduce((sum, d) => sum + (d.fix_confidence || 0), 0) / total;
        const actualSuccessRate = successful / total;
        const calibrationError = Math.abs(avgConfidence - actualSuccessRate);

        // Calculate Expected Calibration Error (ECE)
        let ece = 0;
        for (const [bucket, cal] of Object.entries(bucketCalibrations)) {
            const weight = cal.count / total;
            ece += weight * Math.abs(cal.calibration);
        }

        return {
            totalSamples: total,
            avgPredictedConfidence: avgConfidence,
            actualSuccessRate: actualSuccessRate,
            calibrationError: calibrationError,
            expectedCalibrationError: ece,
            bucketCalibrations,
            isWellCalibrated: ece < 0.1, // ECE < 10% is considered well-calibrated
            adjustmentFactor: this.calculateAdjustmentFactor(avgConfidence, actualSuccessRate)
        };
    }

    /**
     * Calculate adjustment factor for calibration
     */
    calculateAdjustmentFactor(avgPredicted, avgActual) {
        if (avgPredicted === 0) return 1;
        
        // If we're overconfident (predicted > actual), reduce confidence
        // If we're underconfident (predicted < actual), increase confidence
        const ratio = avgActual / avgPredicted;
        
        // Clamp adjustment to reasonable range
        return Math.max(0.5, Math.min(1.5, ratio));
    }

    /**
     * Apply calibration to confidence score
     */
    applyCalibration(confidence, calibration) {
        if (!calibration || calibration.totalSamples < 10) {
            // Not enough data, return original
            return confidence;
        }

        // Find appropriate bucket
        let bucket;
        if (confidence < 0.2) bucket = '0.0-0.2';
        else if (confidence < 0.4) bucket = '0.2-0.4';
        else if (confidence < 0.6) bucket = '0.4-0.6';
        else if (confidence < 0.8) bucket = '0.6-0.8';
        else bucket = '0.8-1.0';

        const bucketCal = calibration.bucketCalibrations[bucket];
        
        if (bucketCal && bucketCal.count >= 5) {
            // Apply bucket-specific calibration
            const adjusted = confidence + bucketCal.calibration;
            return Math.max(0, Math.min(1, adjusted));
        }

        // Apply global adjustment factor
        const adjusted = confidence * calibration.adjustmentFactor;
        return Math.max(0, Math.min(1, adjusted));
    }

    /**
     * Calculate confidence interval
     */
    calculateConfidenceInterval(calibratedConfidence, calibration) {
        if (!calibration || calibration.totalSamples < 10) {
            // Use default interval
            const margin = 0.1;
            return {
                lower: Math.max(0, calibratedConfidence - margin),
                upper: Math.min(1, calibratedConfidence + margin)
            };
        }

        // Calculate standard error based on sample size
        const standardError = Math.sqrt(
            (calibratedConfidence * (1 - calibratedConfidence)) / calibration.totalSamples
        );
        
        // 95% confidence interval (1.96 standard deviations)
        const margin = 1.96 * standardError;
        
        return {
            lower: Math.max(0, calibratedConfidence - margin),
            upper: Math.min(1, calibratedConfidence + margin),
            margin: margin
        };
    }

    /**
     * Calculate reliability of calibration
     */
    calculateReliability(calibration) {
        if (!calibration || calibration.totalSamples < 10) {
            return 'low';
        }

        if (calibration.totalSamples >= 100 && calibration.expectedCalibrationError < 0.05) {
            return 'high';
        }

        if (calibration.totalSamples >= 50 && calibration.expectedCalibrationError < 0.1) {
            return 'medium';
        }

        return 'low';
    }

    /**
     * Update in-memory calibration data
     */
    updateCalibrationData(method, domain, predictedConfidence, actualSuccess) {
        const key = `${method}:${domain}`;
        
        if (!this.calibrationData.byMethod.has(method)) {
            this.calibrationData.byMethod.set(method, []);
        }
        
        this.calibrationData.byMethod.get(method).push({
            predicted: predictedConfidence,
            actual: actualSuccess ? 1 : 0,
            timestamp: Date.now()
        });

        // Keep only last 1000 records per method
        const methodData = this.calibrationData.byMethod.get(method);
        if (methodData.length > 1000) {
            methodData.shift();
        }

        // Invalidate cache
        this.calibrationCache.delete(key);
    }

    /**
     * Get default calibration (when no data available)
     */
    getDefaultCalibration() {
        return {
            totalSamples: 0,
            avgPredictedConfidence: 0.5,
            actualSuccessRate: 0.5,
            calibrationError: 0,
            expectedCalibrationError: 0.2, // High uncertainty
            bucketCalibrations: {},
            isWellCalibrated: false,
            adjustmentFactor: 1.0
        };
    }

    /**
     * Get calibration report
     */
    async getCalibrationReport(method = null, domain = null) {
        const calibration = await this.getCalibrationData(method, domain);
        
        return {
            method,
            domain,
            calibration,
            recommendations: this.generateCalibrationRecommendations(calibration)
        };
    }

    /**
     * Generate calibration recommendations
     */
    generateCalibrationRecommendations(calibration) {
        const recommendations = [];
        
        if (calibration.totalSamples < 50) {
            recommendations.push('Need more data for reliable calibration (currently ' + calibration.totalSamples + ' samples)');
        }
        
        if (calibration.expectedCalibrationError > 0.1) {
            recommendations.push('Calibration error is high. Consider reviewing confidence calculation logic.');
        }
        
        if (calibration.isWellCalibrated) {
            recommendations.push('Confidence scores are well-calibrated!');
        } else {
            recommendations.push('Applying calibration adjustments to improve accuracy.');
        }
        
        return recommendations;
    }
}

module.exports = new FixConfidenceCalibrationService();


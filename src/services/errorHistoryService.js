/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/errorHistoryService.js
 * Last Sync: 2025-12-14T07:30:45.613Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Error History Service
 * Tracks error patterns and successful fixes for learning
 */

const fs = require('fs').promises;
const path = require('path');

class ErrorHistoryService {
    constructor(options = {}) {
        this.dataDir = options.dataDir || path.join(__dirname, '../../data');
        this.historyFile = path.join(this.dataDir, 'error-history.json');
        this.patternsFile = path.join(this.dataDir, 'error-patterns.json');
        
        this.history = [];
        this.patterns = new Map();
        
        // Load history on initialization
        this.loadHistory().catch(err => {
            console.warn('[Error History] Failed to load history:', err.message);
        });
    }

    /**
     * Load error history from disk
     */
    async loadHistory() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            
            const historyData = await fs.readFile(this.historyFile, 'utf8').catch(() => '[]');
            this.history = JSON.parse(historyData);
            
            const patternsData = await fs.readFile(this.patternsFile, 'utf8').catch(() => '{}');
            const patternsObj = JSON.parse(patternsData);
            this.patterns = new Map(Object.entries(patternsObj));
            
            console.log(`[Error History] Loaded ${this.history.length} errors, ${this.patterns.size} patterns`);
        } catch (err) {
            console.error('[Error History] Error loading history:', err);
            this.history = [];
            this.patterns = new Map();
        }
    }

    /**
     * Save error history to disk
     */
    async saveHistory() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            
            await fs.writeFile(
                this.historyFile,
                JSON.stringify(this.history, null, 2),
                'utf8'
            );
            
            const patternsObj = Object.fromEntries(this.patterns);
            await fs.writeFile(
                this.patternsFile,
                JSON.stringify(patternsObj, null, 2),
                'utf8'
            );
        } catch (err) {
            console.error('[Error History] Error saving history:', err);
        }
    }

    /**
     * Record an error occurrence
     */
    async recordError(error, fix = null) {
        const record = {
            id: `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            timestamp: Date.now(),
            error: {
                message: error.message,
                type: error.type,
                severity: error.severity || 'low',
                source: error.source,
                file: error.file,
                line: error.line,
                stack: error.stack?.substring(0, 500), // Truncate long stacks
                fingerprint: error.fingerprint
            },
            fix: fix ? {
                code: fix.code,
                type: fix.type,
                safety: fix.safety,
                success: fix.success || false
            } : null,
            context: {
                userAgent: error.userAgent,
                url: error.url,
                gameState: error.gameState ? 'present' : 'absent'
            }
        };

        this.history.push(record);
        
        // Keep only last 10,000 records
        if (this.history.length > 10000) {
            this.history = this.history.slice(-10000);
        }

        // Update patterns
        if (fix && fix.success) {
            this.updatePatterns(error, fix);
        }

        // Save to Supabase if available (dual-write)
        this.saveToSupabase(record).catch(err => {
            console.warn('[Error History] Error saving to Supabase:', err.message);
        });

        // Save asynchronously (don't block)
        this.saveHistory().catch(err => {
            console.error('[Error History] Error saving:', err);
        });

        return record;
    }

    /**
     * Save record to Supabase (dual-write for migration)
     */
    async saveToSupabase(record) {
        try {
            const { createClient } = require('@supabase/supabase-js');
            const config = require('../config');
            
            if (!config.supabase?.url || !config.supabase?.serviceRoleKey) {
                return; // Supabase not configured
            }

            const supabase = createClient(
                config.supabase.url,
                config.supabase.serviceRoleKey
            );

            const insertData = {
                id: record.id,
                created_at: new Date(record.timestamp).toISOString(),
                error_message: record.error.message,
                error_type: record.error.type,
                error_severity: record.error.severity,
                error_source: record.error.source,
                error_file: record.error.file,
                error_line: record.error.line,
                error_stack: record.error.stack,
                error_fingerprint: record.error.fingerprint,
                fix_code: record.fix?.code,
                fix_type: record.fix?.type,
                fix_safety: record.fix?.safety,
                fix_success: record.fix?.success || false,
                context_user_agent: record.context.userAgent,
                context_url: record.context.url,
                context_game_state: record.context.gameState,
                metadata: {
                    original_record: record
                }
            };

            await supabase
                .from('code_roach_issues')
                .upsert(insertData, { onConflict: 'id' });
        } catch (err) {
            // Don't throw - this is a background operation
            console.warn('[Error History] Supabase save failed:', err.message);
        }
    }

    /**
     * Update error patterns based on successful fixes
     */
    updatePatterns(error, fix) {
        const fingerprint = this.generatePatternFingerprint(error);
        
        if (!this.patterns.has(fingerprint)) {
            this.patterns.set(fingerprint, {
                errorPattern: {
                    message: error.message,
                    type: error.type,
                    source: error.source
                },
                fixes: [],
                successCount: 0,
                failureCount: 0,
                firstSeen: Date.now(),
                lastSeen: Date.now()
            });
        }

        const pattern = this.patterns.get(fingerprint);
        pattern.lastSeen = Date.now();
        
        // Add fix to pattern
        pattern.fixes.push({
            code: fix.code,
            type: fix.type,
            safety: fix.safety,
            timestamp: Date.now()
        });

        // Keep only last 10 fixes per pattern
        if (pattern.fixes.length > 10) {
            pattern.fixes = pattern.fixes.slice(-10);
        }

        // Update success/failure counts
        if (fix.success) {
            pattern.successCount++;
        } else {
            pattern.failureCount++;
        }
    }

    /**
     * Generate pattern fingerprint for error grouping
     */
    generatePatternFingerprint(error) {
        // Normalize error message (remove variable names, line numbers, etc.)
        let normalized = error.message
            .replace(/\d+/g, 'N') // Replace numbers
            .replace(/['"]\w+['"]/g, '"PROP"') // Replace quoted strings
            .replace(/\w+:\d+:\d+/g, 'FILE:LINE:COL') // Replace file:line:col
            .toLowerCase();

        // Combine with error type
        return `${error.type || 'Error'}:${normalized.substring(0, 100)}`;
    }

    /**
     * Find similar errors in history
     */
    findSimilarErrors(error, limit = 5) {
        const fingerprint = this.generatePatternFingerprint(error);
        const similar = [];

        // Find errors with similar patterns
        for (const record of this.history) {
            const recordFingerprint = this.generatePatternFingerprint(record.error);
            
            // Simple similarity check (could be improved with fuzzy matching)
            if (this.patternsSimilar(fingerprint, recordFingerprint)) {
                similar.push(record);
                if (similar.length >= limit) break;
            }
        }

        return similar.sort((a, b) => b.timestamp - a.timestamp); // Most recent first
    }

    /**
     * Check if two patterns are similar
     */
    patternsSimilar(pattern1, pattern2) {
        // Exact match
        if (pattern1 === pattern2) return true;

        // Check if one contains the other (for partial matches)
        if (pattern1.includes(pattern2) || pattern2.includes(pattern1)) {
            return true;
        }

        // Check word overlap (simple heuristic)
        const words1 = pattern1.split(/[:\s]+/);
        const words2 = pattern2.split(/[:\s]+/);
        const commonWords = words1.filter(w => words2.includes(w));
        
        // If more than 50% words match, consider similar
        return commonWords.length / Math.max(words1.length, words2.length) > 0.5;
    }

    /**
     * Get best fix for an error pattern
     * Now includes confidence scoring and ML prediction
     */
    getBestFix(error, context = {}) {
        const confidenceCalculator = require('./confidenceCalculator');
        const fingerprint = this.generatePatternFingerprint(error);
        const pattern = this.patterns.get(fingerprint);

        if (!pattern || pattern.fixes.length === 0) {
            return null;
        }

        // Get most recent successful fix
        const successfulFixes = pattern.fixes.filter(f => f.success !== false);
        if (successfulFixes.length > 0) {
            // Use ML prediction to select best fix if available
            let bestFix = successfulFixes[successfulFixes.length - 1];
            
            try {
                const mlFixPredictor = require('./mlFixPredictor');
                if (mlFixPredictor && mlFixPredictor.isTrained) {
                    // Score all fixes and pick best
                    let bestScore = 0;
                    for (const fix of successfulFixes) {
                        const prediction = mlFixPredictor.predictFixSuccess(error, fix, context);
                        if (prediction.probability > bestScore) {
                            bestScore = prediction.probability;
                            bestFix = { ...fix, mlPrediction: prediction };
                        }
                    }
                }
            } catch (err) {
                // Fallback to most recent if ML not available
            }
            
            // Calculate confidence score using mathematical formula
            const stats = this.getPatternStats(fingerprint);
            const historicalSuccessRate = stats ? (stats.successRate / 100) : 0;
            const similarityScore = 1.0; // Exact match
            const temporalFactor = confidenceCalculator.calculateTemporalFactor(bestFix.timestamp);
            
            // Include ML prediction if available
            const mlPrediction = bestFix.mlPrediction ? bestFix.mlPrediction.probability : null;
            
            const confidenceResult = confidenceCalculator.calculate({
                historicalSuccessRate,
                similarityScore,
                temporalFactor,
                mlPrediction
            });
            
            return {
                ...bestFix,
                confidence: confidenceResult.confidence,
                confidenceBreakdown: confidenceResult.breakdown,
                mlPrediction: bestFix.mlPrediction || null
            };
        }

        // Fall back to most recent fix
        const fallbackFix = pattern.fixes[pattern.fixes.length - 1];
        
        // Calculate confidence for fallback (lower since not successful)
        const stats = this.getPatternStats(fingerprint);
        const historicalSuccessRate = stats ? (stats.successRate / 100) : 0;
        const similarityScore = 1.0;
        const temporalFactor = confidenceCalculator.calculateTemporalFactor(fallbackFix.timestamp);
        
        const confidenceResult = confidenceCalculator.calculate({
            historicalSuccessRate: historicalSuccessRate * 0.5, // Penalize for not being successful
            similarityScore,
            temporalFactor
        });
        
        return {
            ...fallbackFix,
            confidence: confidenceResult.confidence,
            confidenceBreakdown: confidenceResult.breakdown
        };
    }

    /**
     * Get pattern statistics
     */
    getPatternStats(fingerprint) {
        const pattern = this.patterns.get(fingerprint);
        if (!pattern) return null;

        return {
            occurrences: pattern.successCount + pattern.failureCount,
            successRate: pattern.successCount / (pattern.successCount + pattern.failureCount) * 100,
            firstSeen: pattern.firstSeen,
            lastSeen: pattern.lastSeen,
            fixCount: pattern.fixes.length
        };
    }

    /**
     * Get all patterns
     */
    getAllPatterns() {
        return Array.from(this.patterns.entries()).map(([fingerprint, pattern]) => ({
            fingerprint,
            ...pattern,
            stats: this.getPatternStats(fingerprint)
        }));
    }

    /**
     * Get error statistics
     */
    getStats() {
        const total = this.history.length;
        const withFixes = this.history.filter(r => r.fix).length;
        const successfulFixes = this.history.filter(r => r.fix && r.fix.success).length;

        return {
            totalErrors: total,
            errorsWithFixes: withFixes,
            successfulFixes,
            successRate: withFixes > 0 ? (successfulFixes / withFixes) * 100 : 0,
            uniquePatterns: this.patterns.size,
            timeRange: {
                first: this.history.length > 0 ? this.history[0].timestamp : null,
                last: this.history.length > 0 ? this.history[this.history.length - 1].timestamp : null
            }
        };
    }
}

module.exports = new ErrorHistoryService();


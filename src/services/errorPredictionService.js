/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/errorPredictionService.js
 * Last Sync: 2025-12-19T23:29:57.588Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Error Prediction Service
 * Predicts and prevents errors before they happen
 */

const errorHistoryService = require('./errorHistoryService');
const astAnalyzer = require('./astAnalyzer');

class ErrorPredictionService {
    constructor() {
        this.predictionRules = new Map();
        this.activePredictions = new Map();
        this.preventionActions = new Map();
        
        this.initializePredictionRules();
    }

    /**
     * Initialize prediction rules based on common error patterns
     */
    initializePredictionRules() {
        // Rule 1: Null reference before property access
        this.predictionRules.set('null-reference', {
            name: 'Null Reference Prediction',
            pattern: /\.\w+\s*[=\(]/g, // Property access patterns
            check: (code, context) => {
                // Check if object is null before property access
                return this.checkNullBeforeAccess(code, context);
            },
            prevent: (context) => {
                return {
                    type: 'null-check',
                    code: `if (${context.object} !== null && ${context.object} !== undefined) { /* safe access */ }`,
                    message: `Potential null reference: ${context.object}.${context.property}`
                };
            }
        });

        // Rule 2: Undefined variable usage
        this.predictionRules.set('undefined-variable', {
            name: 'Undefined Variable Prediction',
            pattern: /\b(\w+)\s*[=\(]/g,
            check: (code, context) => {
                return this.checkVariableDefined(code, context);
            },
            prevent: (context) => {
                return {
                    type: 'variable-init',
                    code: `let ${context.variable} = null; // Auto-initialized by Code Roach`,
                    message: `Variable ${context.variable} may be undefined`
                };
            }
        });

        // Rule 3: Network request without error handling
        this.predictionRules.set('network-error', {
            name: 'Network Error Prediction',
            pattern: /fetch\s*\(|\.get\s*\(|\.post\s*\(/g,
            check: (code, context) => {
                return this.checkNetworkErrorHandling(code, context);
            },
            prevent: (context) => {
                return {
                    type: 'error-handling',
                    code: `.catch(err => { console.error('Network error:', err); /* handle error */ })`,
                    message: 'Network request may fail without error handling'
                };
            }
        });

        // Rule 4: Game state corruption
        this.predictionRules.set('game-state-corruption', {
            name: 'Game State Corruption Prediction',
            pattern: /gameState|game\.state|characterData/g,
            check: (code, context) => {
                return this.checkGameStateIntegrity(code, context);
            },
            prevent: (context) => {
                return {
                    type: 'state-validation',
                    code: `if (!gameState || typeof gameState !== 'object') { /* recover state */ }`,
                    message: 'Game state may be corrupted'
                };
            }
        });

        // Rule 5: Memory leak patterns
        this.predictionRules.set('memory-leak', {
            name: 'Memory Leak Prediction',
            pattern: /setInterval|setTimeout|addEventListener/g,
            check: (code, context) => {
                return this.checkMemoryLeak(code, context);
            },
            prevent: (context) => {
                return {
                    type: 'cleanup',
                    code: `// Remember to clear: clearInterval(${context.timerId})`,
                    message: 'Potential memory leak: timer/event listener not cleaned up'
                };
            }
        });
    }

    /**
     * Analyze code for potential errors
     * Now uses AST-based analysis when available, falls back to regex
     */
    analyzeCode(code, context = {}) {
        // Try AST-based analysis first (more accurate)
        const astPredictions = astAnalyzer.analyzeCode(code, context);
        
        if (astPredictions && astPredictions.length > 0 && !astPredictions[0].type) {
            // AST analysis returned patterns, use them
            return astPredictions.map(pattern => ({
                ruleId: pattern.type,
                ruleName: pattern.type.replace('-', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                type: pattern.type,
                code: pattern.suggestion,
                message: pattern.message,
                severity: pattern.severity,
                confidence: pattern.confidence || this.calculateConfidence(pattern.type, pattern, context),
                location: pattern.location
            }));
        }
        
        // Fallback to regex-based analysis
        const predictions = [];
        
        for (const [ruleId, rule] of this.predictionRules.entries()) {
            try {
                const matches = code.match(rule.pattern);
                if (matches) {
                    const prediction = rule.check(code, { ...context, matches });
                    if (prediction) {
                        const prevention = rule.prevent(prediction);
                        predictions.push({
                            ruleId,
                            ruleName: rule.name,
                            ...prevention,
                            severity: this.calculateSeverity(ruleId, prediction),
                            confidence: this.calculateConfidence(ruleId, prediction, context)
                        });
                    }
                }
            } catch (err) {
                // Skip rules that fail
                console.warn(`[Error Prediction] Rule ${ruleId} failed:`, err.message);
            }
        }

        return predictions;
    }

    /**
     * Check for null before property access
     */
    checkNullBeforeAccess(code, context) {
        // Simple heuristic: if property access without null check
        const propertyAccess = code.match(/(\w+)\.(\w+)/g);
        if (!propertyAccess) return null;

        for (const access of propertyAccess) {
            const match = access.match(/(\w+)\.(\w+)/);
            if (match) {
                const [, object, property] = match;
                // Check if there's a null check before this access
                const beforeAccess = code.substring(0, code.indexOf(access));
                if (!beforeAccess.includes(`${object} !== null`) && 
                    !beforeAccess.includes(`${object} != null`) &&
                    !beforeAccess.includes(`if (${object}`)) {
                    return { object, property, access };
                }
            }
        }

        return null;
    }

    /**
     * Check if variable is defined
     */
    checkVariableDefined(code, context) {
        // This would need more sophisticated analysis
        // For now, return null (would need AST parsing for real implementation)
        return null;
    }

    /**
     * Check network error handling
     */
    checkNetworkErrorHandling(code, context) {
        // Check if fetch/request has .catch() or try-catch
        if (code.includes('fetch(') || code.includes('.get(') || code.includes('.post(')) {
            if (!code.includes('.catch(') && !code.includes('try {')) {
                return { hasErrorHandling: false };
            }
        }
        return null;
    }

    /**
     * Check game state integrity
     */
    checkGameStateIntegrity(code, context) {
        // Check if gameState is validated before use
        if (code.includes('gameState') || code.includes('game.state')) {
            const beforeUse = code.substring(0, code.indexOf('gameState'));
            if (!beforeUse.includes('gameState !== null') && 
                !beforeUse.includes('typeof gameState')) {
                return { needsValidation: true };
            }
        }
        return null;
    }

    /**
     * Check for memory leaks
     */
    checkMemoryLeak(code, context) {
        // Check if setInterval/setTimeout result is stored for cleanup
        if (code.includes('setInterval(') || code.includes('setTimeout(')) {
            // Simple check: if result is assigned to variable, likely to be cleaned up
            const hasAssignment = /const\s+\w+\s*=\s*set(Interval|Timeout)/.test(code);
            if (!hasAssignment) {
                return { needsCleanup: true };
            }
        }
        return null;
    }

    /**
     * Calculate prediction severity
     */
    calculateSeverity(ruleId, prediction) {
        const severityMap = {
            'null-reference': 'high',
            'undefined-variable': 'high',
            'network-error': 'medium',
            'game-state-corruption': 'critical',
            'memory-leak': 'low'
        };
        return severityMap[ruleId] || 'medium';
    }

    /**
     * Calculate prediction confidence
     */
    calculateConfidence(ruleId, prediction, context) {
        // Base confidence on historical error patterns
        const pattern = errorHistoryService.generatePatternFingerprint({
            message: prediction.message || '',
            type: 'Prediction',
            source: context.source || ''
        });

        const stats = errorHistoryService.getPatternStats(pattern);
        if (stats && stats.occurrences > 0) {
            // Higher confidence if this pattern has caused errors before
            return Math.min(0.9, 0.5 + (stats.occurrences / 10) * 0.1);
        }

        // Default confidence based on rule type
        const confidenceMap = {
            'null-reference': 0.7,
            'undefined-variable': 0.6,
            'network-error': 0.8,
            'game-state-corruption': 0.9,
            'memory-leak': 0.5
        };
        return confidenceMap[ruleId] || 0.6;
    }

    /**
     * Predict errors based on current game state
     */
    predictFromGameState(gameState) {
        const predictions = [];

        // Check for common game state issues
        if (!gameState || typeof gameState !== 'object') {
            predictions.push({
                ruleId: 'game-state-corruption',
                type: 'state-validation',
                message: 'Game state is null or invalid',
                severity: 'critical',
                confidence: 0.95,
                prevent: {
                    code: 'recoverGameState()',
                    action: 'recover'
                }
            });
        }

        // Check for low health scenarios that might cause errors
        if (gameState.character && gameState.character.health < 10) {
            predictions.push({
                ruleId: 'low-health',
                type: 'state-warning',
                message: 'Character health is critically low',
                severity: 'medium',
                confidence: 0.7,
                prevent: {
                    code: '// Consider auto-saving or warning user',
                    action: 'warn'
                }
            });
        }

        return predictions;
    }

    /**
     * Monitor performance for error-prone patterns
     */
    monitorPerformance(metrics) {
        const predictions = [];

        // Low FPS might indicate performance issues leading to errors
        if (metrics.fps && metrics.fps < 30) {
            predictions.push({
                ruleId: 'low-fps',
                type: 'performance-warning',
                message: `Low FPS (${metrics.fps}) may cause timeout errors`,
                severity: 'medium',
                confidence: 0.6,
                prevent: {
                    code: '// Consider reducing visual effects or optimizing',
                    action: 'optimize'
                }
            });
        }

        // High memory usage
        if (metrics.memory && metrics.memory > 100 * 1024 * 1024) { // 100MB
            predictions.push({
                ruleId: 'high-memory',
                type: 'memory-warning',
                message: 'High memory usage may cause crashes',
                severity: 'medium',
                confidence: 0.7,
                prevent: {
                    code: '// Consider cleaning up unused resources',
                    action: 'cleanup'
                }
            });
        }

        return predictions;
    }

    /**
     * Get active predictions
     */
    getActivePredictions() {
        return Array.from(this.activePredictions.values());
    }

    /**
     * Clear prediction
     */
    clearPrediction(predictionId) {
        this.activePredictions.delete(predictionId);
    }
}

module.exports = new ErrorPredictionService();


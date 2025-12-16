/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixApplicationService.js
 * Last Sync: 2025-12-16T04:06:34.038Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Application Service
 * Handles safe application of code fixes with rollback capability
 */

const fixSuccessTracker = require('./fixSuccessTracker');
const agentSessionService = require('./agentSessionService');
const expertLearningService = require('./expertLearningService');
const expertUsageTracker = require('./expertUsageTracker');

class FixApplicationService {
    constructor() {
        this.appliedFixes = new Map(); // Track applied fixes for rollback
        this.fixHistory = []; // History of all fix attempts
    }

    /**
     * Categorize fix safety level
     */
    categorizeSafety(fix) {
        if (!fix || !fix.code) {
            return 'risky'; // No code = can't apply safely
        }

        const code = fix.code.toLowerCase();
        const type = fix.type || '';

        // Safe fixes: null checks, variable initialization, simple error handling
        if (type === 'null-check' || 
            type === 'variable-init' ||
            (code.includes('if (') && code.includes('!== null') && code.includes('!== undefined')) ||
            (code.includes('let ') && code.includes('= null')) ||
            (code.includes('const ') && code.includes('= null'))) {
            return 'safe';
        }

        // Medium fixes: error handling, try-catch, function wrapping
        if (type === 'error-handling' ||
            code.includes('try {') ||
            code.includes('catch (') ||
            code.includes('function') && code.includes('return')) {
            return 'medium';
        }

        // Risky: code injection, eval, complex operations
        if (code.includes('eval(') ||
            code.includes('Function(') ||
            code.includes('innerHTML') ||
            code.includes('document.write') ||
            code.length > 500) { // Long code is risky
            return 'risky';
        }

        // Default to medium if unsure
        return 'medium';
    }

    /**
     * Validate fix code for safety
     */
    validateFix(fix) {
        if (!fix || !fix.code) {
            return { valid: false, reason: 'No fix code provided' };
        }

        const code = fix.code;

        // Block dangerous patterns
        const dangerousPatterns = [
            /eval\s*\(/i,
            /Function\s*\(/i,
            /document\.write/i,
            /\.innerHTML\s*=/i,
            /\.outerHTML\s*=/i,
            /<script/i,
            /javascript:/i,
            /on\w+\s*=/i, // Event handlers
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(code)) {
                return { valid: false, reason: `Dangerous pattern detected: ${pattern}` };
            }
        }

        return { valid: true };
    }

    /**
     * Create a rollback point
     */
    createRollbackPoint(error, fix) {
        const rollbackId = `rollback_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        // Store original state if applicable
        const rollback = {
            id: rollbackId,
            errorId: error.id,
            timestamp: Date.now(),
            fix: fix,
            originalState: this.captureState(error, fix)
        };

        return rollback;
    }

    /**
     * Capture current state for rollback
     */
    captureState(error, fix) {
        const state = {
            error: {
                message: error.message,
                type: error.type,
                source: error.source
            }
        };

        // If fix targets a specific variable/function, capture it
        if (fix.type === 'variable-init' && fix.variable) {
            try {
                // This would need to be done client-side
                state.variableName = fix.variable;
            } catch (e) {
                // Can't capture, that's okay
            }
        }

        return state;
    }

    /**
     * Generate fix application instructions
     */
    generateApplicationInstructions(fix, error) {
        const instructions = {
            type: fix.type || 'code-injection',
            code: fix.code,
            method: this.determineApplicationMethod(fix, error),
            target: this.determineTarget(fix, error),
            safety: fix.safety || this.categorizeSafety(fix)
        };

        return instructions;
    }

    /**
     * Determine how to apply the fix
     */
    determineApplicationMethod(fix, error) {
        const type = fix.type || '';
        const code = fix.code || '';

        if (type === 'null-check') {
            return 'function-patch';
        }

        if (type === 'variable-init') {
            return 'variable-injection';
        }

        if (type === 'error-handling') {
            return 'function-wrap';
        }

        if (code.includes('function') || code.includes('=>')) {
            return 'function-patch';
        }

        return 'code-injection';
    }

    /**
     * Determine target for fix application
     */
    determineTarget(fix, error) {
        // Try to extract target from error stack
        if (error.stack) {
            const stackMatch = error.stack.match(/at\s+(\w+)\s*\(/);
            if (stackMatch) {
                return {
                    function: stackMatch[1],
                    file: error.source
                };
            }
        }

        // Use fix metadata if available
        if (fix.target) {
            return fix.target;
        }

        // Default to global scope
        return {
            scope: 'global',
            file: error.source
        };
    }

    /**
     * Record fix application
     */
    async recordFixApplication(error, fix, success, rollbackId, metadata = {}) {
        const record = {
            id: `fix_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            errorId: error.id,
            error: {
                message: error.message,
                type: error.type,
                fingerprint: error.fingerprint
            },
            fix: {
                code: fix.code,
                type: fix.type,
                safety: fix.safety,
                knowledgeId: metadata.knowledgeId // Track if from knowledge base
            },
            success,
            rollbackId,
            timestamp: Date.now(),
            agentType: metadata.agentType || 'unknown'
        };

        this.fixHistory.push(record);
        this.appliedFixes.set(error.id, record);

        // Keep only last 1000 records
        if (this.fixHistory.length > 1000) {
            this.fixHistory.shift();
        }

        // Record to Supabase for learning (Sprint 2)
        try {
            // Update decision outcome if we have session info
            if (metadata.sessionId && metadata.decisionId) {
                await agentSessionService.recordDecision({
                    agentType: metadata.agentType || 'fix-application',
                    sessionId: metadata.sessionId,
                    decisionType: 'fix',
                    outcome: success ? 'success' : 'failure',
                    confidence: fix.confidence || 0.5,
                    metadata: {
                        fixType: fix.type,
                        safety: fix.safety,
                        applied: true
                    }
                });
            }

            // Record successful fix to knowledge base
            if (success && fix.confidence >= 0.7) {
                await fixSuccessTracker.recordSuccessfulFix({
                    fix: fix.code,
                    error: error,
                    filePath: error.source || metadata.filePath,
                    agentType: metadata.agentType || 'fix-application',
                    sessionId: metadata.sessionId,
                    confidence: fix.confidence || 0.8,
                    applied: true
                });
            }

            // Update knowledge base usage if fix came from knowledge base
            if (metadata.knowledgeId) {
                await fixSuccessTracker.recordFixApplication(metadata.knowledgeId, success);
            }

            // Record expert learning outcome if expert was used
            if (fix.expertTypeUsed && fix.projectId) {
                const outcome = success ? 'success' : 'failure';
                await expertLearningService.recordFixOutcome(
                    fix.projectId,
                    fix.expertTypeUsed,
                    {
                        issue: error,
                        fix: fix,
                        outcome: outcome,
                        confidence: fix.confidence,
                        applied: success,
                        reverted: !success
                    }
                ).catch(err => {
                    console.warn('[Fix Application] Failed to record expert learning:', err.message);
                });

                // Track usage outcome
                await expertUsageTracker.trackOutcome(
                    fix.projectId,
                    fix.expertTypeUsed,
                    success
                ).catch(() => {
                    // Silently fail - tracking is non-critical
                });
            }
        } catch (err) {
            console.warn('[FixApplication] Failed to record to Supabase:', err.message);
        }

        return record;
    }

    /**
     * Get fix statistics
     */
    getStats() {
        const total = this.fixHistory.length;
        const successful = this.fixHistory.filter(f => f.success).length;
        const failed = total - successful;

        const bySafety = {
            safe: this.fixHistory.filter(f => f.fix.safety === 'safe').length,
            medium: this.fixHistory.filter(f => f.fix.safety === 'medium').length,
            risky: this.fixHistory.filter(f => f.fix.safety === 'risky').length
        };

        return {
            total,
            successful,
            failed,
            successRate: total > 0 ? (successful / total) * 100 : 0,
            bySafety
        };
    }

    /**
     * Get fix history
     */
    getHistory(limit = 100) {
        return this.fixHistory.slice(-limit).reverse();
    }
}

module.exports = new FixApplicationService();


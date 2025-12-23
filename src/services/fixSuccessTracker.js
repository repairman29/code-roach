/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixSuccessTracker.js
 * Last Sync: 2025-12-19T23:29:57.582Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Success Tracker
 * Tracks successful fixes and adds them to knowledge base
 * Part of Sprint 1: Foundation & Intelligence Activation
 */

const agentKnowledgeService = require('./agentKnowledgeService');
const agentSessionService = require('./agentSessionService');

class FixSuccessTracker {
    /**
     * Record successful fix to knowledge base
     */
    async recordSuccessfulFix(fixData) {
        try {
            const {
                fix,
                error,
                filePath,
                agentType = 'codebase-aware-fix-generator',
                sessionId,
                confidence,
                applied = false
            } = fixData;

            if (!fix || !error || !filePath) {
                console.warn('[FixSuccessTracker] Missing required data');
                return;
            }

            // Extract error type and file extension
            const errorType = error.type || error.category || 'general';
            const fileExtension = filePath.split('.').pop() || 'unknown';

            // Add to knowledge base if confidence is high enough
            if (confidence >= 0.7) {
                const knowledge = await agentKnowledgeService.addKnowledge({
                    type: 'fix',
                    content: typeof fix === 'string' ? fix : fix.code || JSON.stringify(fix),
                    sourceAgent: agentType,
                    confidence: confidence,
                    tags: [errorType, fileExtension, 'fix'],
                    metadata: {
                        errorMessage: error.message || error.description,
                        errorType: errorType,
                        filePath: filePath,
                        applied: applied,
                        timestamp: new Date().toISOString()
                    }
                });

                if (knowledge) {
                    console.log(`[FixSuccessTracker] Added fix to knowledge base: ${knowledge.id}`);
                }
            }

            // Update decision outcome if session exists
            if (sessionId) {
                try {
                    // Note: We'd need to track decision IDs to update them
                    // For now, we record a new success decision
                    await agentSessionService.recordSuccess(agentType, sessionId, {
                        action: 'fix_applied',
                        errorType: errorType,
                        filePath: filePath,
                        confidence: confidence,
                        applied: applied
                    });
                } catch (err) {
                    console.warn('[FixSuccessTracker] Failed to record success:', err.message);
                }
            }

        } catch (err) {
            console.error('[FixSuccessTracker] Error recording successful fix:', err);
        }
    }

    /**
     * Record fix application result
     */
    async recordFixApplication(fixId, success, feedback = null) {
        try {
            if (success && fixId) {
                // Record usage in knowledge base
                await agentKnowledgeService.recordUsage(fixId, success);
            }
        } catch (err) {
            console.error('[FixSuccessTracker] Error recording fix application:', err);
        }
    }
}

module.exports = new FixSuccessTracker();

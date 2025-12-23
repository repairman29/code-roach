/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixLearningSystem.js
 * Last Sync: 2025-12-19T23:29:57.580Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Learning System
 * Sprint 3: Tracks fix success/failure and improves over time
 */

const errorHistoryService = require('./errorHistoryService');
const fs = require('fs').promises;
const path = require('path');

class FixLearningSystem {
    constructor() {
        this.dataDir = path.join(__dirname, '../../data');
        this.learningFile = path.join(this.dataDir, 'fix-learning.json');
        this.patternLibrary = new Map();
        this.fixStats = {
            totalAttempts: 0,
            successful: 0,
            failed: 0,
            byType: {},
            byMethod: {},
            byConfidence: {}
        };

        this.loadLearningData().catch(err => {
            console.warn('[Fix Learning] Failed to load learning data:', err.message);
        });
    }

    /**
     * Record a fix attempt and its outcome
     */
    async recordFixAttempt(fixAttempt) {
        try {
            const {
                issue,
                fix,
                method = 'unknown', // 'pattern', 'llm', 'contextual', 'multi-agent'
                success = false,
                confidence = 0,
                error,
                filePath
            } = fixAttempt;

            // Update statistics
            this.fixStats.totalAttempts++;
            
            if (success) {
                this.fixStats.successful++;
            } else {
                this.fixStats.failed++;
            }

            // Track by issue type
            const issueType = issue?.type || 'unknown';
            if (!this.fixStats.byType[issueType]) {
                this.fixStats.byType[issueType] = { attempts: 0, successful: 0, failed: 0 };
            }
            this.fixStats.byType[issueType].attempts++;
            if (success) {
                this.fixStats.byType[issueType].successful++;
            } else {
                this.fixStats.byType[issueType].failed++;
            }

            // Track by method
            if (!this.fixStats.byMethod[method]) {
                this.fixStats.byMethod[method] = { attempts: 0, successful: 0, failed: 0 };
            }
            this.fixStats.byMethod[method].attempts++;
            if (success) {
                this.fixStats.byMethod[method].successful++;
            } else {
                this.fixStats.byMethod[method].failed++;
            }

            // Track by confidence level
            const confidenceLevel = confidence >= 0.8 ? 'high' : confidence >= 0.5 ? 'medium' : 'low';
            if (!this.fixStats.byConfidence[confidenceLevel]) {
                this.fixStats.byConfidence[confidenceLevel] = { attempts: 0, successful: 0, failed: 0 };
            }
            this.fixStats.byConfidence[confidenceLevel].attempts++;
            if (success) {
                this.fixStats.byConfidence[confidenceLevel].successful++;
            } else {
                this.fixStats.byConfidence[confidenceLevel].failed++;
            }

            // Save learning data periodically (every 10 attempts)
            if (this.fixStats.totalAttempts % 10 === 0) {
                await this.saveLearningData();
            }
        } catch (err) {
            console.warn('[Fix Learning] Error recording fix attempt:', err.message);
        }
    }

    /**
     * Load learning data from disk
     */
    async loadLearningData() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            const data = await fs.readFile(this.learningFile, 'utf8');
            const parsed = JSON.parse(data);
            
            if (parsed.fixStats) {
                this.fixStats = { ...this.fixStats, ...parsed.fixStats };
            }
            
            if (parsed.patternLibrary) {
                this.patternLibrary = new Map(parsed.patternLibrary);
            }
        } catch (err) {
            if (err.code !== 'ENOENT') {
                throw err;
            }
            // File doesn't exist yet, start fresh
        }
    }

    /**
     * Save learning data to disk
     */
    async saveLearningData() {
        try {
            await fs.mkdir(this.dataDir, { recursive: true });
            await fs.writeFile(this.learningFile, JSON.stringify({
                fixStats: this.fixStats,
                patternLibrary: Array.from(this.patternLibrary.entries()),
                lastUpdated: new Date().toISOString()
            }, null, 2));
        } catch (err) {
            console.warn('[Fix Learning] Error saving learning data:', err.message);
        }
    }
}

module.exports = new FixLearningSystem();
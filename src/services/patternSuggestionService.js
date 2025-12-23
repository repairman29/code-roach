/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/patternSuggestionService.js
 * Last Sync: 2025-12-20T22:26:03.328Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Pattern Suggestion Service
 * Sprint 7: Suggests code improvements using knowledge base patterns
 */

const agentKnowledgeService = require('./agentKnowledgeService');
const codebaseSearch = require('./codebaseSearch');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

class PatternSuggestionService {
    constructor() {
        // Only create Supabase client if credentials are available
        if (config.supabase.serviceRoleKey) {
            try {
                this.supabase = createClient(
                    config.supabase.url,
                    config.supabase.serviceRoleKey
                );
            } catch (error) {
                console.warn('[patternSuggestionService] Supabase not configured:', error.message);
                this.supabase = null;
            }
        } else {
            console.warn('[patternSuggestionService] Supabase credentials not configured. Service will be disabled.');
            this.supabase = null;
        }

    /**
     * Analyze code and suggest pattern improvements
     */
    async suggestPatternImprovements(filePath, code) {
        try {
            const suggestions = [];

            // Get all patterns from knowledge base
            const patterns = await agentKnowledgeService.searchKnowledge(
                code.substring(0, 500),
                { knowledgeType: 'pattern', limit: 10, threshold: 0.5 }
            );

            // Check if code matches patterns
            for (const pattern of patterns) {
                const match = this.checkPatternMatch(code, pattern);
                if (!match.matches && match.confidence > 0.6) {
                    suggestions.push({
                        patternId: pattern.id,
                        patternName: pattern.content.substring(0, 100),
                        suggestion: `Consider applying this pattern: ${pattern.content.substring(0, 200)}`,
                        confidence: match.confidence,
                        filePath: filePath,
                        priority: match.confidence > 0.8 ? 'high' : 'medium'
                    });
                }
            }

            // Check for missing common patterns
            const missingPatterns = await this.checkMissingPatterns(code);
            suggestions.push(...missingPatterns);

            return suggestions.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
        } catch (error) {
            console.error('[PatternSuggestionService] Error analyzing code:', error);
            return [];
        }
    }

    /**
     * Check if code matches a pattern
     */
    checkPatternMatch(code, pattern) {
        const patternContent = pattern.content.toLowerCase();
        const codeLower = code.toLowerCase();

        // Simple keyword matching
        const patternKeywords = patternContent.split(/\s+/).filter(w => w.length > 4);
        const matches = patternKeywords.filter(kw => codeLower.includes(kw)).length;
        const matchRatio = patternKeywords.length > 0 ? matches / patternKeywords.length : 0;

        return {
            matches: matchRatio > 0.5,
            confidence: matchRatio
        };
    }

    /**
     * Check for missing common patterns
     */
    async checkMissingPatterns(code) {
        const suggestions = [];

        // Check for error handling pattern
        if (!code.includes('try') && !code.includes('catch')) {
            const errorHandlingPatterns = await agentKnowledgeService.searchKnowledge(
                'error handling try catch pattern',
                { knowledgeType: 'pattern', limit: 1, threshold: 0.7 }
            );

            if (errorHandlingPatterns.length > 0) {
                suggestions.push({
                    patternId: errorHandlingPatterns[0].id,
                    patternName: 'Error Handling Pattern',
                    suggestion: 'Add error handling (try-catch) to this code',
                    confidence: 0.8,
                    priority: 'high'
                });
            }
        }

        // Check for async pattern
        if (code.includes('Promise') && !code.includes('async') && !code.includes('await')) {
            const asyncPatterns = await agentKnowledgeService.searchKnowledge(
                'async await pattern',
                { knowledgeType: 'pattern', limit: 1, threshold: 0.7 }
            );

            if (asyncPatterns.length > 0) {
                suggestions.push({
                    patternId: asyncPatterns[0].id,
                    patternName: 'Async/Await Pattern',
                    suggestion: 'Consider using async/await instead of Promises',
                    confidence: 0.7,
                    priority: 'medium'
                });
            }
        }

        return suggestions;
    }

    /**
     * Get pattern adoption statistics
     */
    async getPatternAdoptionStats() {
        try {
            // Get all patterns
            const { data: allPatterns, error } = await this.supabase
                .from('agent_knowledge_base')
                .select('*')
                .eq('knowledge_type', 'pattern');

            if (error) throw error;

            // Analyze pattern usage
            const stats = {
                totalPatterns: allPatterns.length,
                patternsByUsage: {},
                mostUsedPatterns: [],
                leastUsedPatterns: []
            };

            for (const pattern of allPatterns) {
                const usageCount = pattern.usage_count || 0;
                stats.patternsByUsage[pattern.id] = usageCount;
            }

            // Sort by usage
            const sorted = Object.entries(stats.patternsByUsage)
                .sort((a, b) => b[1] - a[1]);

            stats.mostUsedPatterns = sorted.slice(0, 10);
            stats.leastUsedPatterns = sorted.slice(-10).reverse();

            return stats;
        } catch (error) {
            console.error('[PatternSuggestionService] Error getting stats:', error);
            return null;
        }
    }
}

module.exports = new PatternSuggestionService();

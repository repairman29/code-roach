/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/patternBasedFixTemplates.js
 * Last Sync: 2025-12-19T23:29:57.567Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Pattern-Based Fix Templates
 * Pre-built fix templates based on common patterns from the codebase
 * IP Innovation: Template-Based Fix Generation
 */

const codebaseSearch = require('./codebaseSearch');
const errorHistoryService = require('./errorHistoryService');

class PatternBasedFixTemplates {
    constructor() {
        this.templates = new Map();
        this.loadedTemplates = false;
    }

    /**
     * Get fix template for error type
     */
    async getFixTemplate(error, code, filePath) {
        if (!this.loadedTemplates) {
            await this.loadTemplates();
        }

        const errorType = error.type?.toLowerCase() || '';
        const errorMsg = error.message?.toLowerCase() || '';
        
        // Match error to template
        if (errorMsg.includes('undefined') || errorMsg.includes('is not defined')) {
            return await this.getUndefinedVariableTemplate(error, code, filePath);
        }
        if (errorMsg.includes('null') || errorMsg.includes('cannot read property')) {
            return await this.getNullCheckTemplate(error, code, filePath);
        }
        if (errorMsg.includes('async') || errorMsg.includes('await')) {
            return await this.getAsyncErrorTemplate(error, code, filePath);
        }
        if (errorType === 'security' || errorMsg.includes('injection') || errorMsg.includes('xss')) {
            return await this.getSecurityTemplate(error, code, filePath);
        }
        if (errorType === 'performance' || errorMsg.includes('memory leak')) {
            return await this.getPerformanceTemplate(error, code, filePath);
        }
        
        return null;
    }

    /**
     * Load templates from codebase patterns
     */
    async loadTemplates() {
        // Search for common patterns in codebase
        const patterns = [
            'error handling try catch',
            'null check guard clause',
            'async await error handling',
            'parameterized query SQL',
            'resource cleanup finally'
        ];
        
        for (const pattern of patterns) {
            try {
                const results = await codebaseSearch.semanticSearch(pattern, { limit: 3, threshold: 0.4 });
                if (results.results && results.results.length > 0) {
                    this.templates.set(pattern, results.results);
                }
            } catch (err) {
                // Continue
            }
        }
        
        this.loadedTemplates = true;
    }

    /**
     * Get undefined variable fix template
     */
    async getUndefinedVariableTemplate(error, code, filePath) {
        // Search for null/undefined handling patterns
        const patterns = await codebaseSearch.semanticSearch(
            'null check undefined variable guard clause',
            { limit: 5, threshold: 0.3 }
        );
        
        if (patterns.results && patterns.results.length > 0) {
            return {
                type: 'undefined_variable',
                pattern: patterns.results[0].content,
                examples: patterns.results.slice(0, 3),
                confidence: 0.7
            };
        }
        
        return null;
    }

    /**
     * Get null check template
     */
    async getNullCheckTemplate(error, code, filePath) {
        const patterns = await codebaseSearch.semanticSearch(
            'null check optional chaining guard clause',
            { limit: 5, threshold: 0.3 }
        );
        
        if (patterns.results && patterns.results.length > 0) {
            return {
                type: 'null_check',
                pattern: patterns.results[0].content,
                examples: patterns.results.slice(0, 3),
                confidence: 0.7
            };
        }
        
        return null;
    }

    /**
     * Get async error handling template
     */
    async getAsyncErrorTemplate(error, code, filePath) {
        const patterns = await codebaseSearch.semanticSearch(
            'async await try catch error handling',
            { limit: 5, threshold: 0.3 }
        );
        
        if (patterns.results && patterns.results.length > 0) {
            return {
                type: 'async_error',
                pattern: patterns.results[0].content,
                examples: patterns.results.slice(0, 3),
                confidence: 0.75
            };
        }
        
        return null;
    }

    /**
     * Get security fix template
     */
    async getSecurityTemplate(error, code, filePath) {
        const patterns = await codebaseSearch.semanticSearch(
            'SQL injection XSS sanitize parameterized query',
            { limit: 5, threshold: 0.3 }
        );
        
        if (patterns.results && patterns.results.length > 0) {
            return {
                type: 'security',
                pattern: patterns.results[0].content,
                examples: patterns.results.slice(0, 3),
                confidence: 0.8
            };
        }
        
        return null;
    }

    /**
     * Get performance fix template
     */
    async getPerformanceTemplate(error, code, filePath) {
        const patterns = await codebaseSearch.semanticSearch(
            'resource cleanup finally close connection memory',
            { limit: 5, threshold: 0.3 }
        );
        
        if (patterns.results && patterns.results.length > 0) {
            return {
                type: 'performance',
                pattern: patterns.results[0].content,
                examples: patterns.results.slice(0, 3),
                confidence: 0.75
            };
        }
        
        return null;
    }
}

module.exports = new PatternBasedFixTemplates();


/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/rootCauseAnalysis.js
 * Last Sync: 2025-12-19T23:29:57.587Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Root Cause Analysis Service
 * Traces errors back to architectural decisions and identifies root causes
 */

const codebaseSearch = require('./codebaseSearch');
const errorHistoryService = require('./errorHistoryService');
const llmService = require('./llmService');

class RootCauseAnalysis {
    constructor() {
        this.patternCache = new Map();
        this.cacheTTL = 3600000; // 1 hour
    }

    /**
     * Analyze root cause of error pattern
     */
    async analyzeRootCause(error, context = {}) {
        try {
            // Get similar errors from history
            const similarErrors = await this.findSimilarErrors(error);
            
            // Analyze code patterns
            const codePatterns = await this.analyzeCodePatterns(error, context);
            
            // Trace dependency chains
            const dependencyChain = await this.traceDependencyChain(error, context);
            
            // Identify architectural issues
            const architecturalIssues = await this.identifyArchitecturalIssues(error, codePatterns);
            
            // Generate root cause analysis
            const analysis = await this.generateRootCauseAnalysis({
                error,
                similarErrors,
                codePatterns,
                dependencyChain,
                architecturalIssues,
                context
            });

            return {
                success: true,
                rootCause: analysis.rootCause,
                impact: analysis.impact,
                recommendations: analysis.recommendations,
                affectedFiles: analysis.affectedFiles,
                preventionStrategy: analysis.preventionStrategy,
                confidence: analysis.confidence
            };
        } catch (error) {
            console.error('[Root Cause Analysis] Error:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Find similar errors from history
     */
    async findSimilarErrors(error) {
        const history = errorHistoryService.history || [];
        const errorMessage = error.message || '';
        const errorType = error.type || '';

        // Find errors with similar messages or types
        const similar = history.filter(e => {
            const msg = (e.error?.message || '').toLowerCase();
            const type = (e.error?.type || '').toLowerCase();
            return msg.includes(errorMessage.toLowerCase().substring(0, 20)) ||
                   type === errorType.toLowerCase();
        });

        // Group by pattern
        const patterns = new Map();
        similar.forEach(e => {
            const pattern = this.generatePatternKey(e.error);
            if (!patterns.has(pattern)) {
                patterns.set(pattern, []);
            }
            patterns.get(pattern).push(e);
        });

        return Array.from(patterns.entries()).map(([pattern, errors]) => ({
            pattern,
            count: errors.length,
            errors: errors.slice(0, 5), // Top 5 examples
            firstSeen: Math.min(...errors.map(e => e.timestamp)),
            lastSeen: Math.max(...errors.map(e => e.timestamp))
        }));
    }

    /**
     * Analyze code patterns related to error
     */
    async analyzeCodePatterns(error, context) {
        try {
            // Search codebase for similar patterns
            const searchQuery = this.buildSearchQuery(error, context);
            const results = await codebaseSearch.semanticSearch(searchQuery, { limit: 10 });

            const patterns = {
                errorHandling: [],
                initialization: [],
                nullChecks: [],
                asyncPatterns: [],
                dependencies: []
            };

            // Analyze search results
            for (const result of results.results || []) {
                const fileContext = await codebaseSearch.getFileContext(result.file_path);
                const analysis = this.analyzeFilePatterns(fileContext, error);
                
                if (analysis.errorHandling) patterns.errorHandling.push(analysis.errorHandling);
                if (analysis.initialization) patterns.initialization.push(analysis.initialization);
                if (analysis.nullChecks) patterns.nullChecks.push(analysis.nullChecks);
                if (analysis.asyncPatterns) patterns.asyncPatterns.push(analysis.asyncPatterns);
                if (analysis.dependencies) patterns.dependencies.push(analysis.dependencies);
            }

            return patterns;
        } catch (error) {
            console.warn('[Root Cause Analysis] Error analyzing patterns:', error.message);
            return {};
        }
    }

    /**
     * Trace dependency chain
     */
    async traceDependencyChain(error, context) {
        const chain = {
            direct: [],
            indirect: [],
            circular: []
        };

        // Extract file/module from error
        const sourceFile = error.source || context.file || '';
        if (!sourceFile) return chain;

        try {
            // Search for imports/dependencies
            const fileContext = await codebaseSearch.getFileContext(sourceFile);
            if (fileContext) {
                const imports = this.extractImports(fileContext);
                chain.direct = imports;

                // Trace indirect dependencies
                for (const imp of imports.slice(0, 5)) {
                    try {
                        const depContext = await codebaseSearch.getFileContext(imp);
                        if (depContext) {
                            const depImports = this.extractImports(depContext);
                            chain.indirect.push(...depImports);
                        }
                    } catch (e) {
                        // Ignore
                    }
                }
            }
        } catch (error) {
            console.warn('[Root Cause Analysis] Error tracing dependencies:', error.message);
        }

        return chain;
    }

    /**
     * Identify architectural issues
     */
    async identifyArchitecturalIssues(error, codePatterns) {
        const issues = [];

        // Check for missing error handling patterns
        if (codePatterns.errorHandling && codePatterns.errorHandling.length === 0) {
            issues.push({
                type: 'missing-error-handling',
                severity: 'high',
                description: 'No error handling patterns found in related code',
                recommendation: 'Implement consistent error handling strategy'
            });
        }

        // Check for initialization issues
        if (codePatterns.initialization && codePatterns.initialization.length === 0) {
            issues.push({
                type: 'missing-initialization',
                severity: 'medium',
                description: 'Missing initialization patterns',
                recommendation: 'Implement proper initialization checks'
            });
        }

        // Check for null check patterns
        if (codePatterns.nullChecks && codePatterns.nullChecks.length === 0) {
            issues.push({
                type: 'missing-null-checks',
                severity: 'high',
                description: 'Missing null/undefined checks',
                recommendation: 'Add defensive null checks'
            });
        }

        return issues;
    }

    /**
     * Generate root cause analysis using LLM
     */
    async generateRootCauseAnalysis(data) {
        const prompt = `Analyze the root cause of this error and provide a comprehensive analysis.

Error: ${JSON.stringify(data.error, null, 2)}

Similar Errors Found: ${data.similarErrors.length} patterns, ${data.similarErrors.reduce((sum, p) => 
    sum + p.count, 0)} total occurrences

Code Patterns:
- Error Handling: ${data.codePatterns.errorHandling?.length || 0} instances
- Initialization: ${data.codePatterns.initialization?.length || 0} instances
- Null Checks: ${data.codePatterns.nullChecks?.length || 0} instances

Architectural Issues: ${data.architecturalIssues.length} issues identified

Provide a JSON response with:
1. rootCause: The fundamental reason this error occurs
2. impact: How many places/files are affected
3. recommendations: Array of specific recommendations to fix the root cause
4. affectedFiles: Array of file paths that need changes
5. preventionStrategy: How to prevent this error class in the future
6. confidence: 0-100 confidence score

Response format: JSON only, no markdown.`;

        try {
            const response = await llmService.generateText(prompt, {
                model: 'gpt-4',
                temperature: 0.3,
                maxTokens: 2000
            });

            // Parse JSON response
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const analysis = JSON.parse(jsonMatch[0]);
                
                // Enhance with our analysis
                analysis.affectedFiles = this.identifyAffectedFiles(data);
                analysis.impact = this.calculateImpact(data);
                analysis.confidence = this.calculateConfidence(data, analysis);

                return analysis;
            }
        } catch (error) {
            console.warn('[Root Cause Analysis] LLM analysis failed:', error.message);
        }

        // Fallback to rule-based analysis
        return this.generateFallbackAnalysis(data);
    }

    /**
     * Generate fallback analysis
     */
    generateFallbackAnalysis(data) {
        const similarCount = data.similarErrors.reduce((sum, p) => sum + p.count, 0);
        const rootCause = data.architecturalIssues.length > 0
            ? data.architecturalIssues[0].description
            : 'Pattern-based error requiring systematic fix';

        return {
            rootCause,
            impact: {
                occurrences: similarCount,
                files: this.identifyAffectedFiles(data).length,
                severity: similarCount > 10 ? 'high' : similarCount > 5 ? 'medium' : 'low'
            },
            recommendations: data.architecturalIssues.map(i => ({
                priority: i.severity,
                action: i.recommendation,
                description: i.description
            })),
            affectedFiles: this.identifyAffectedFiles(data),
            preventionStrategy: 'Implement consistent patterns across codebase',
            confidence: Math.min(70, 30 + (similarCount * 5))
        };
    }

    /**
     * Identify affected files
     */
    identifyAffectedFiles(data) {
        const files = new Set();

        // From similar errors
        data.similarErrors.forEach(pattern => {
            pattern.errors.forEach(e => {
                if (e.error?.source) files.add(e.error.source);
            });
        });

        // From code patterns
        Object.values(data.codePatterns).forEach(patterns => {
            patterns.forEach(p => {
                if (p.file) files.add(p.file);
            });
        });

        return Array.from(files);
    }

    /**
     * Calculate impact
     */
    calculateImpact(data) {
        const similarCount = data.similarErrors.reduce((sum, p) => sum + p.count, 0);
        const fileCount = this.identifyAffectedFiles(data).length;

        return {
            occurrences: similarCount,
            files: fileCount,
            severity: similarCount > 10 ? 'high' : similarCount > 5 ? 'medium' : 'low',
            estimatedPreventedErrors: similarCount * 2 // Fixing root cause prevents future occurrences
        };
    }

    /**
     * Calculate confidence score
     */
    calculateConfidence(data, analysis) {
        let confidence = 50; // Base confidence

        // Increase based on similar errors found
        const similarCount = data.similarErrors.reduce((sum, p) => sum + p.count, 0);
        confidence += Math.min(30, similarCount * 3);

        // Increase based on architectural issues
        confidence += data.architecturalIssues.length * 5;

        // Increase based on code patterns found
        const patternCount = Object.values(data.codePatterns).reduce((sum, arr) => sum + (arr?.length || 0), 0);
        confidence += Math.min(20, patternCount * 2);

        return Math.min(95, confidence);
    }

    /**
     * Build search query from error
     */
    buildSearchQuery(error, context) {
        const parts = [];
        
        if (error.message) {
            parts.push(error.message.substring(0, 100));
        }
        
        if (error.type) {
            parts.push(error.type);
        }
        
        if (context.file) {
            parts.push(`file: ${context.file}`);
        }

        return parts.join(' ');
    }

    /**
     * Analyze file patterns
     */
    analyzeFilePatterns(fileContext, error) {
        const analysis = {};
        const content = fileContext.map(c => c.content).join('\n');

        // Check for error handling
        if (content.includes('try') && content.includes('catch')) {
            analysis.errorHandling = { file: fileContext[0]?.file_path, pattern: 'try-catch' };
        }

        // Check for initialization
        if (content.includes('const') || content.includes('let') || content.includes('var')) {
            analysis.initialization = { file: fileContext[0]?.file_path, pattern: 'variable-declaration' };
        }

        // Check for null checks
        if (content.includes('if') && (content.includes('null') || content.includes('undefined'))) {
            analysis.nullChecks = { file: fileContext[0]?.file_path, pattern: 'null-check' };
        }

        // Check for async patterns
        if (content.includes('async') || content.includes('await') || content.includes('Promise')) {
            analysis.asyncPatterns = { file: fileContext[0]?.file_path, pattern: 'async' };
        }

        return analysis;
    }

    /**
     * Extract imports from file context
     */
    extractImports(fileContext) {
        const imports = [];
        const content = fileContext.map(c => c.content).join('\n');

        // Match require statements
        const requireMatches = content.matchAll(/require\(['"](.+?)['"]\)/g);
        for (const match of requireMatches) {
            imports.push(match[1]);
        }

        // Match import statements
        const importMatches = content.matchAll(/import\s+.*?\s+from\s+['"](.+?)['"]/g);
        for (const match of importMatches) {
            imports.push(match[1]);
        }

        return imports;
    }

    /**
     * Generate pattern key
     */
    generatePatternKey(error) {
        const type = error.type || 'unknown';
        const message = (error.message || '').substring(0, 50);
        return `${type}_${message}`;
    }
}

module.exports = new RootCauseAnalysis();


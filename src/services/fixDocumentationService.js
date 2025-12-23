/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixDocumentationService.js
 * Last Sync: 2025-12-19T23:29:57.652Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Documentation Service
 * Captures structured information about fixes to enable learning from failures
 * and prevent repeating the same mistakes.
 */

const agentKnowledgeService = require('./agentKnowledgeService');
const fixLearningSystem = require('./fixLearningSystem');

class FixDocumentationService {
    constructor() {
        this.fixCategories = {
            'syntax-error': 'Syntax or parsing errors',
            'type-error': 'Type mismatches or incorrect types',
            'reference-error': 'Undefined variables or references',
            'logic-error': 'Incorrect business logic',
            'async-error': 'Async/await or promise handling issues',
            'import-error': 'Module import/export problems',
            'api-error': 'API integration issues',
            'database-error': 'Database query or connection issues',
            'security-issue': 'Security vulnerabilities',
            'performance-issue': 'Performance problems',
            'race-condition': 'Concurrency or race conditions',
            'configuration-error': 'Configuration or environment issues',
            'dependency-error': 'Dependency or package issues',
            'other': 'Other issues'
        };
    }

    /**
     * Document a fix with full context
     * This is the main method agents should call after fixing something
     */
    async documentFix(fixData) {
        try {
            const {
                issue,              // The issue that was fixed
                fix,                // The fix that was applied
                filePath,           // File where fix was applied
                originalCode,       // Original code (before fix)
                fixedCode,          // Fixed code (after fix)
                success,            // Whether fix was successful
                error,              // Error if fix failed
                rootCause,          // Why the issue happened
                prevention,         // How to prevent this in the future
                relatedIssues,      // Related issues or patterns
                confidence,         // Confidence in the fix
                method,             // Fix method used
                agent,              // Agent that applied the fix
                gitCommit,          // Git commit hash if available
                timestamp           // When fix was applied
            } = fixData;

            // Determine fix category
            const category = this.categorizeFix(issue, error);
            
            // Build structured documentation
            const documentation = {
                summary: this.generateSummary(issue, fix, success),
                problem: {
                    description: issue?.message || error?.message || 'Unknown issue',
                    type: issue?.type || 'unknown',
                    severity: issue?.severity || 'medium',
                    location: {
                        file: filePath,
                        line: issue?.line || null,
                        column: issue?.column || null
                    }
                },
                rootCause: rootCause || this.inferRootCause(issue, error, originalCode),
                solution: {
                    description: fix?.description || this.describeFix(originalCode, fixedCode),
                    code: {
                        before: originalCode ? this.extractRelevantCode(originalCode, issue) : null,
                        after: fixedCode ? this.extractRelevantCode(fixedCode, issue) : null,
                        diff: this.generateDiff(originalCode, fixedCode, issue)
                    },
                    method: method || 'unknown',
                    confidence: confidence || 0.5
                },
                prevention: prevention || this.generatePreventionTips(issue, rootCause),
                relatedPatterns: relatedIssues || [],
                metadata: {
                    agent: agent || 'unknown',
                    timestamp: timestamp || new Date().toISOString(),
                    gitCommit: gitCommit || null,
                    category: category,
                    success: success !== false, // Default to true if not specified
                    filePath: filePath
                }
            };

            // Store in knowledge base for semantic search
            const knowledgeEntry = await agentKnowledgeService.addKnowledge({
                type: 'fix',
                content: this.buildSearchableContent(documentation),
                sourceAgent: agent || 'fix-documentation-service',
                confidence: confidence || 0.5,
                tags: [
                    category,
                    issue?.type || 'unknown',
                    success ? 'successful' : 'failed',
                    method || 'unknown'
                ],
                metadata: {
                    ...documentation.metadata,
                    problemType: issue?.type,
                    fixMethod: method,
                    success: documentation.metadata.success
                }
            });

            // Also record in fix learning system
            if (fixLearningSystem && typeof fixLearningSystem.recordFixAttempt === 'function') {
                await fixLearningSystem.recordFixAttempt({
                    issue,
                    fix,
                    method: method || 'unknown',
                    success: documentation.metadata.success,
                    confidence: confidence || 0.5,
                    error: error?.message,
                    filePath
                });
            }

            // If fix failed, create a "failure pattern" entry
            if (!success && error) {
                await this.documentFailurePattern(issue, fix, error, filePath, agent);
            }

            return {
                documentation,
                knowledgeId: knowledgeEntry?.id,
                success: true
            };
        } catch (err) {
            console.error('[FixDocumentation] Error documenting fix:', err);
            return {
                success: false,
                error: err.message
            };
        }
    }

    /**
     * Search for similar fixes to learn from
     */
    async findSimilarFixes(query, options = {}) {
        try {
            const {
                limit = 10,
                category = null,
                successOnly = false
            } = options;

            // Build search query
            let searchQuery = query;
            if (category) {
                searchQuery = `${category} ${query}`;
            }
            if (successOnly) {
                searchQuery = `successful fix ${query}`;
            }

            // Search knowledge base
            const results = await agentKnowledgeService.searchKnowledge(searchQuery, {
                knowledgeType: 'fix',
                limit,
                threshold: 0.6
            });

            // Filter and format results
            return results
                .filter(result => {
                    if (successOnly && result.metadata?.success === false) {
                        return false;
                    }
                    if (category && result.metadata?.category !== category) {
                        return false;
                    }
                    return true;
                })
                .map(result => ({
                    id: result.id,
                    summary: result.metadata?.summary || result.content.substring(0, 200),
                    problem: result.metadata?.problem,
                    solution: result.metadata?.solution,
                    success: result.metadata?.success,
                    confidence: result.confidence,
                    successRate: result.success_rate,
                    usageCount: result.usage_count,
                    similarity: result.similarity
                }));
        } catch (err) {
            console.error('[FixDocumentation] Error searching fixes:', err);
            return [];
        }
    }

    /**
     * Get common failure patterns for a category
     */
    async getCommonFailurePatterns(category, limit = 5) {
        try {
            const results = await agentKnowledgeService.searchKnowledge(
                `failed fix ${category} common mistake`,
                {
                    knowledgeType: 'fix',
                    limit: limit * 2, // Get more to filter
                    threshold: 0.5
                }
            );

            // Filter to only failed fixes
            const failures = results
                .filter(r => r.metadata?.success === false)
                .slice(0, limit)
                .map(r => ({
                    problem: r.metadata?.problem,
                    rootCause: r.metadata?.rootCause,
                    prevention: r.metadata?.prevention,
                    frequency: r.usage_count || 0
                }));

            return failures;
        } catch (err) {
            console.error('[FixDocumentation] Error getting failure patterns:', err);
            return [];
        }
    }

    /**
     * Document a failure pattern (when a fix doesn't work)
     */
    async documentFailurePattern(issue, attemptedFix, error, filePath, agent) {
        try {
            const failureDoc = {
                type: 'failure-pattern',
                content: `Failed fix attempt: ${issue?.type || 'unknown'} - ${error?.message || 'Unknown error'}. Attempted fix: ${attemptedFix?.method || 'unknown'}. Location: ${filePath}`,
                sourceAgent: agent || 'fix-documentation-service',
                confidence: 0.8, // High confidence that this is a failure pattern
                tags: [
                    'failure',
                    'anti-pattern',
                    issue?.type || 'unknown',
                    attemptedFix?.method || 'unknown'
                ],
                metadata: {
                    issue: issue?.type,
                    attemptedFix: attemptedFix?.method,
                    error: error?.message,
                    filePath: filePath,
                    timestamp: new Date().toISOString()
                }
            };

            await agentKnowledgeService.addKnowledge(failureDoc);
        } catch (err) {
            console.error('[FixDocumentation] Error documenting failure pattern:', err);
        }
    }

    /**
     * Helper: Categorize fix based on issue and error
     */
    categorizeFix(issue, error) {
        if (issue?.type) {
            const type = issue.type.toLowerCase();
            for (const [category, description] of Object.entries(this.fixCategories)) {
                if (type.includes(category.replace('-', '')) || description.toLowerCase().includes(type)) {
                    return category;
                }
            }
        }

        if (error?.message) {
            const msg = error.message.toLowerCase();
            if (msg.includes('syntax') || msg.includes('parse')) return 'syntax-error';
            if (msg.includes('type') || msg.includes('cannot read')) return 'type-error';
            if (msg.includes('undefined') || msg.includes('is not defined')) return 'reference-error';
            if (msg.includes('async') || msg.includes('promise') || msg.includes('await')) return 'async-error';
            if (msg.includes('import') || msg.includes('require') || msg.includes('module')) return 'import-error';
            if (msg.includes('database') || msg.includes('sql') || msg.includes('query')) return 'database-error';
        }

        return 'other';
    }

    /**
     * Helper: Generate summary
     */
    generateSummary(issue, fix, success) {
        const status = success ? 'Fixed' : 'Failed to fix';
        const issueType = issue?.type || 'issue';
        const method = fix?.method || 'unknown method';
        return `${status} ${issueType} using ${method}`;
    }

    /**
     * Helper: Infer root cause from context
     */
    inferRootCause(issue, error, code) {
        if (error?.message) {
            const msg = error.message.toLowerCase();
            if (msg.includes('undefined')) {
                return 'Variable or function was not defined before use. Possible missing import, typo, or scope issue.';
            }
            if (msg.includes('cannot read property')) {
                return 'Attempted to access property on null/undefined. Missing null check or incorrect object structure.';
            }
            if (msg.includes('async') || msg.includes('await')) {
                return 'Async/await not properly handled. Missing await, incorrect promise handling, or async context issue.';
            }
            if (msg.includes('import') || msg.includes('require')) {
                return 'Module import/export mismatch. Incorrect path, missing export, or circular dependency.';
            }
        }

        if (issue?.type) {
            const type = issue.type.toLowerCase();
            if (type.includes('syntax')) {
                return 'Syntax error in code. Possible typo, missing bracket, or incorrect language syntax.';
            }
            if (type.includes('type')) {
                return 'Type mismatch. Variable or function used with incorrect type.';
            }
        }

        return 'Root cause not determined. Review code changes and error message for details.';
    }

    /**
     * Helper: Describe the fix
     */
    describeFix(originalCode, fixedCode) {
        if (!originalCode || !fixedCode) {
            return 'Code was modified to fix the issue.';
        }

        // Simple heuristic-based description
        if (fixedCode.includes('await') && !originalCode.includes('await')) {
            return 'Added missing await to async operation.';
        }
        if (fixedCode.includes('try') && !originalCode.includes('try')) {
            return 'Added error handling with try-catch.';
        }
        if (fixedCode.includes('if') && !originalCode.includes('if')) {
            return 'Added conditional check to prevent error.';
        }

        return 'Code was modified to resolve the issue.';
    }

    /**
     * Helper: Extract relevant code section
     */
    extractRelevantCode(code, issue) {
        if (!code || !issue) return code;

        const line = issue.line || 0;
        const contextLines = 5; // Show 5 lines before and after

        const lines = code.split('\n');
        const start = Math.max(0, line - contextLines - 1);
        const end = Math.min(lines.length, line + contextLines);

        return lines.slice(start, end).join('\n');
    }

    /**
     * Helper: Generate simple diff
     */
    generateDiff(originalCode, fixedCode, issue) {
        if (!originalCode || !fixedCode) return null;

        // Simple line-by-line diff
        const originalLines = originalCode.split('\n');
        const fixedLines = fixedCode.split('\n');

        if (originalLines.length === fixedLines.length) {
            // Same number of lines, show changed lines
            const changes = [];
            for (let i = 0; i < originalLines.length; i++) {
                if (originalLines[i] !== fixedLines[i]) {
                    changes.push({
                        line: i + 1,
                        before: originalLines[i],
                        after: fixedLines[i]
                    });
                }
            }
            return changes.length > 0 ? changes : null;
        }

        return {
            originalLines: originalLines.length,
            fixedLines: fixedLines.length,
            note: 'Line count changed'
        };
    }

    /**
     * Helper: Generate prevention tips
     */
    generatePreventionTips(issue, rootCause) {
        const tips = [];

        if (rootCause?.includes('undefined')) {
            tips.push('Always check that variables are defined before use');
            tips.push('Use TypeScript or JSDoc for better type checking');
            tips.push('Enable strict mode in JavaScript');
        }

        if (rootCause?.includes('async') || rootCause?.includes('await')) {
            tips.push('Always await async operations');
            tips.push('Use try-catch for async error handling');
            tips.push('Consider using Promise.all for parallel operations');
        }

        if (rootCause?.includes('import')) {
            tips.push('Verify import paths are correct');
            tips.push('Check that exports match imports');
            tips.push('Avoid circular dependencies');
        }

        if (rootCause?.includes('null') || rootCause?.includes('undefined')) {
            tips.push('Add null/undefined checks before property access');
            tips.push('Use optional chaining (?.) when appropriate');
            tips.push('Provide default values where needed');
        }

        if (tips.length === 0) {
            tips.push('Review similar fixes in knowledge base');
            tips.push('Add tests to catch this issue early');
            tips.push('Code review before committing');
        }

        return tips;
    }

    /**
     * Helper: Build searchable content from documentation
     */
    buildSearchableContent(doc) {
        const parts = [
            doc.summary,
            doc.problem.description,
            doc.rootCause,
            doc.solution.description,
            doc.prevention.join(' '),
            doc.metadata.category
        ].filter(Boolean);

        return parts.join('\n\n');
    }
}

module.exports = new FixDocumentationService();


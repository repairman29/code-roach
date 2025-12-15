/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/contextAwareFixGenerator.js
 * Last Sync: 2025-12-14T07:30:45.536Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Context-Aware Fix Generator Service
 * Sprint 2: Uses codebase context to generate better fixes
 */

const llmFixGenerator = require('./llmFixGenerator');
const codebaseSearch = require('./codebaseSearch');
const errorHistoryService = require('./errorHistoryService');
const agentSessionService = require('./agentSessionService');
const fixSuccessTracker = require('./fixSuccessTracker');
const developerMetricsService = require('./developerMetricsService');
const fs = require('fs').promises;
const path = require('path');

class ContextAwareFixGenerator {
    constructor() {
        this.projectConventions = new Map();
        this.fixPatterns = new Map();
    }

    /**
     * Generate a context-aware fix
     */
    async generateContextAwareFix(issue, code, filePath) {
        try {
            // SPRINT 3: Check file risk before generating fix
            let fileRiskScore = 0;
            let isHighRisk = false;
            try {
                if (filePath) {
                    fileRiskScore = await developerMetricsService.calculateFileRisk(filePath);
                    isHighRisk = fileRiskScore > 70;
                    if (isHighRisk) {
                        console.log(`[Context-Aware Fix] ⚠️  HIGH RISK FILE (${fileRiskScore}): 
                            ${filePath} - Extra validation required`);
                    }
                }
            } catch (err) {
                console.warn('[Context-Aware Fix] Failed to calculate file risk:', err.message);
            }

            // 1. Get project conventions
            const conventions = await this.getProjectConventions(filePath);
            
            // 2. Find similar code patterns in codebase
            const similarPatterns = await this.findSimilarPatterns(issue, code, filePath);
            
            // 3. Get existing fixes for similar issues
            const existingFixes = await this.getExistingFixes(issue, filePath);
            
            // 4. Understand code style and structure
            const codeStyle = await this.analyzeCodeStyle(filePath);
            
            // 5. Generate fix with all context (risk checking happens in llmFixGenerator)
            const startTime = Date.now();
            const fix = await llmFixGenerator.generateFix(issue, code, filePath, {
                conventions,
                similarPatterns,
                existingFixes,
                codeStyle,
                contextAware: true
            });
            const duration = Date.now() - startTime;

            // Enhance fix with context
            if (fix.success) {
                fix.contextAware = true;
                fix.conventions = conventions;
                fix.similarPatterns = similarPatterns.length;
            }

            // Record decision for learning (Sprint 1)
            try {
                const sessionId = `context-aware-fix-${Date.now()}`;
                const session = await agentSessionService.getOrCreateSession(
                    'context-aware-fix-generator',
                    sessionId,
                    { filePath, errorType: issue.type || issue.category }
                );

                await agentSessionService.recordDecision({
                    agentType: 'context-aware-fix-generator',
                    sessionId: session.session_id || sessionId,
                    decisionType: 'fix',
                    inputContext: {
                        error: issue.message || issue.description,
                        errorType: issue.type || issue.category,
                        filePath,
                        hasConventions: !!conventions,
                        similarPatternsCount: similarPatterns.length,
                        fileRiskScore: fileRiskScore, // SPRINT 3: Include risk score
                        isHighRisk: isHighRisk // SPRINT 3: Include risk flag
                    },
                    decisionMade: {
                        fix: fix.fixedCode?.substring(0, 200) || fix.code?.substring(0, 200),
                        confidence: fix.confidence,
                        contextAware: true
                    },
                    outcome: 'pending',
                    confidence: fix.confidence || 0.5,
                    timeTakenMs: duration
                });

                // Record successful fix
                if (fix.success && fix.confidence >= 0.7) {
                    fixSuccessTracker.recordSuccessfulFix({
                        fix: fix.fixedCode || fix.code,
                        error: issue,
                        filePath: filePath,
                        agentType: 'context-aware-fix-generator',
                        sessionId: session.session_id || sessionId,
                        confidence: fix.confidence,
                        applied: false
                    }).catch(err => {
                        console.warn('[Context-Aware Fix] Failed to record:', err.message);
                    });
                }
            } catch (err) {
                console.warn('[Context-Aware Fix] Failed to record decision:', err.message);
            }

            return fix;
        } catch (err) {
            console.error('[Context-Aware Fix] Error:', err);
            // Fallback to basic LLM fix
            return await llmFixGenerator.generateFix(issue, code, filePath);
        }
    }

    /**
     * Get project conventions (naming, style, patterns)
     */
    async getProjectConventions(filePath) {
        try {
            const projectRoot = this.getProjectRoot(filePath);
            const conventions = {
                naming: {},
                style: {},
                patterns: []
            };

            // Analyze existing code for conventions
            const jsFiles = await this.findCodeFiles(projectRoot, ['.js', '.ts'], 20);
            
            for (const file of jsFiles.slice(0, 10)) {
                try {
                    const content = await fs.readFile(file, 'utf8');
                    const fileConventions = this.extractConventions(content);
                    
                    // Merge conventions
                    Object.assign(conventions.naming, fileConventions.naming);
                    Object.assign(conventions.style, fileConventions.style);
                    conventions.patterns.push(...fileConventions.patterns);
                } catch (err) {
                    // Skip files that can't be read
                }
            }

            return conventions;
        } catch (err) {
            console.warn('[Context-Aware Fix] Error getting conventions:', err.message);
            return {};
        }
    }

    /**
     * Extract conventions from code
     */
    extractConventions(code) {
        const conventions = {
            naming: {},
            style: {},
            patterns: []
        };

        // Detect naming conventions
        const camelCase = (code.match(/\b[a-z][a-zA-Z0-9]*\b/g) || []).length;
        const snakeCase = (code.match(/\b[a-z]+_[a-z]+\b/g) || []).length;
        const PascalCase = (code.match(/\b[A-Z][a-zA-Z0-9]*\b/g) || []).length;

        if (camelCase > snakeCase && camelCase > PascalCase) {
            conventions.naming.variables = 'camelCase';
        } else if (snakeCase > PascalCase) {
            conventions.naming.variables = 'snake_case';
        } else {
            conventions.naming.variables = 'PascalCase';
        }

        // Detect indentation
        const tabs = (code.match(/^\t+/gm) || []).length;
        const spaces2 = (code.match(/^  [^ ]/gm) || []).length;
        const spaces4 = (code.match(/^    [^ ]/gm) || []).length;

        if (tabs > spaces2 && tabs > spaces4) {
            conventions.style.indent = 'tabs';
        } else if (spaces4 > spaces2) {
            conventions.style.indent = '4 spaces';
        } else {
            conventions.style.indent = '2 spaces';
        }

        // Detect common patterns
        if (code.includes('async/await')) {
            conventions.patterns.push('async-await');
        }
        if (code.includes('try {') && code.includes('catch')) {
            conventions.patterns.push('try-catch');
        }
        if (code.includes('const ') && code.includes('let ')) {
            conventions.patterns.push('const-preferred');
        }

        return conventions;
    }

    /**
     * Find similar code patterns in codebase
     */
    async findSimilarPatterns(issue, code, filePath) {
        try {
            // Search for similar code using semantic search
            const query = `${issue.type} ${issue.message} code pattern example`;
            const results = await codebaseSearch.semanticSearch(query, {
                limit: 5,
                threshold: 0.6
            });

            if (!results || !results.results) {
                return [];
            }

            // Get code snippets from similar files
            const patterns = [];
            for (const result of results.results.slice(0, 5)) {
                try {
                    const fileContext = await codebaseSearch.getFileContext(result.file_path);
                    if (fileContext) {
                        patterns.push({
                            file: result.file_path,
                            code: fileContext.substring(0, 500),
                            similarity: result.score || 0
                        });
                    }
                } catch (err) {
                    // Skip files that can't be read
                }
            }

            return patterns;
        } catch (err) {
            console.warn('[Context-Aware Fix] Error finding patterns:', err.message);
            return [];
        }
    }

    /**
     * Get existing fixes for similar issues
     */
    async getExistingFixes(issue, filePath) {
        try {
            const patterns = await errorHistoryService.getAllPatterns();
            
            // Find patterns with successful fixes
            const similar = patterns
                .filter(p => {
                    const pattern = p.errorPattern;
                    if (!pattern || !p.fixes || p.fixes.length === 0) return false;
                    
                    // Match by type
                    if (pattern.type === issue.type) return true;
                    
                    // Match by message similarity
                    if (pattern.message && issue.message) {
                        const similarity = this.calculateSimilarity(
                            pattern.message.toLowerCase(),
                            issue.message.toLowerCase()
                        );
                        return similarity > 0.5;
                    }
                    
                    return false;
                })
                .filter(p => {
                    // Only successful fixes
                    return p.fixes.some(f => f.success !== false);
                })
                .slice(0, 5);

            return similar.map(p => ({
                pattern: p.errorPattern,
                fix: p.fixes.find(f => f.success !== false),
                successRate: p.stats?.successRate || 0
            }));
        } catch (err) {
            console.warn('[Context-Aware Fix] Error getting existing fixes:', err.message);
            return [];
        }
    }

    /**
     * Analyze code style of the file
     */
    async analyzeCodeStyle(filePath) {
        try {
            const code = await fs.readFile(filePath, 'utf8');
            const lines = code.split('\n');
            
            return {
                lineLength: Math.max(...lines.map(l => l.length)),
                avgLineLength: lines.reduce((sum, l) => sum + l.length, 0) / lines.length,
                usesSemicolons: code.includes(';'),
                usesQuotes: code.includes("'") ? 'single' : 'double',
                indentSize: this.detectIndentSize(code),
                maxDepth: this.calculateMaxDepth(code)
            };
        } catch (err) {
            return {};
        }
    }

    /**
     * Detect indent size
     */
    detectIndentSize(code) {
        const lines = code.split('\n').filter(l => l.trim().length > 0);
        const indents = lines
            .map(l => l.match(/^(\s+)/)?.[1]?.length || 0)
            .filter(i => i > 0);
        
        if (indents.length === 0) return 2;
        
        // Find most common indent size
        const counts = {};
        indents.forEach(i => {
            counts[i] = (counts[i] || 0) + 1;
        });
        
        return parseInt(Object.keys(counts).reduce((a, b) => counts[a] > counts[b] ? a : b));
    }

    /**
     * Calculate max nesting depth
     */
    calculateMaxDepth(code) {
        let depth = 0;
        let maxDepth = 0;
        
        for (const char of code) {
            if (char === '{' || char === '[' || char === '(') {
                depth++;
                maxDepth = Math.max(maxDepth, depth);
            } else if (char === '}' || char === ']' || char === ')') {
                depth--;
            }
        }
        
        return maxDepth;
    }

    /**
     * Find code files in project
     */
    async findCodeFiles(rootDir, extensions, maxFiles = 50) {
        const files = [];
        
        async function walkDir(dir, depth = 0) {
            if (depth > 5 || files.length >= maxFiles) return; // Limit depth and count
            
            try {
                const entries = await fs.readdir(dir, { withFileTypes: true });
                
                for (const entry of entries) {
                    if (entry.isDirectory()) {
                        // Skip node_modules, .git, etc.
                        if (['node_modules', '.git', 'dist', 'build'].includes(entry.name)) {
                            continue;
                        }
                        await walkDir(path.join(dir, entry.name), depth + 1);
                    } else if (entry.isFile()) {
                        const ext = path.extname(entry.name);
                        if (extensions.includes(ext)) {
                            files.push(path.join(dir, entry.name));
                        }
                    }
                }
            } catch (err) {
                // Skip directories that can't be read
            }
        }
        
        await walkDir(rootDir);
        return files;
    }

    /**
     * Get project root directory
     */
    getProjectRoot(filePath) {
        let current = path.dirname(filePath);
        const root = path.parse(filePath).root;
        
        while (current !== root) {
            try {
                // Check for package.json or .git
                if (require('fs').existsSync(path.join(current, 'package.json')) ||
                    require('fs').existsSync(path.join(current, '.git'))) {
                    return current;
                }
            } catch (err) {
                // Continue searching
            }
            current = path.dirname(current);
        }
        
        return path.dirname(filePath);
    }

    /**
     * Calculate string similarity
     */
    calculateSimilarity(str1, str2) {
        const longer = str1.length > str2.length ? str1 : str2;
        const shorter = str1.length > str2.length ? str2 : str1;
        
        if (longer.length === 0) return 1.0;
        
        const distance = this.levenshteinDistance(longer, shorter);
        return (longer.length - distance) / longer.length;
    }

    /**
     * Levenshtein distance
     */
    levenshteinDistance(str1, str2) {
        const matrix = [];
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        return matrix[str2.length][str1.length];
    }
}

module.exports = new ContextAwareFixGenerator();


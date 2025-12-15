/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/codebaseAwareFixGenerator.js
 * Last Sync: 2025-12-14T18:32:20.345Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Codebase-Aware Fix Generator
 * Uses codebase indexing and search to generate fixes that match codebase patterns
 * IP Innovation: Semantic Codebase-Aware Error Fixing
 */

// Ensure environment variables are loaded
require('dotenv').config();

const codebaseSearch = require('./codebaseSearch');
const llmService = require('./llmService');
const patternBasedFixTemplates = require('./patternBasedFixTemplates');
const agentKnowledgeService = require('./agentKnowledgeService');
const agentSessionService = require('./agentSessionService');
const fixSuccessTracker = require('./fixSuccessTracker');
const developerMetricsService = require('./developerMetricsService');

class CodebaseAwareFixGenerator {
    constructor() {
        this.patternCache = new Map();
    }

    /**
     * Generate fix using codebase patterns
     */
    async generateFix(error, code, filePath) {
        // Handle both error objects and issue objects
        const errorObj = error.message ? error : {
            message: error.message || error.description || 'Unknown error',
            type: error.type || error.category || 'error',
            stack: error.stack || error.trace || ''
        };

        console.log(`[Codebase-Aware Fix] Generating fix for: ${errorObj.message}`);

        // SPRINT 3: Check file risk before generating fix
        let fileRiskScore = 0;
        let isHighRisk = false;
        try {
            if (filePath) {
                fileRiskScore = await developerMetricsService.calculateFileRisk(filePath);
                isHighRisk = fileRiskScore > 70;
                if (isHighRisk) {
                    console.log(`[Codebase-Aware Fix] ⚠️  HIGH RISK FILE (${fileRiskScore}): 
                        ${filePath} - Extra validation required`);
                }
            }
        } catch (err) {
            console.warn('[Codebase-Aware Fix] Failed to calculate file risk:', err.message);
        }

        // 0. Check agent knowledge base for learned fixes (NEW!)
        const sessionId = `fix-generator-${Date.now()}`;
        let learnedFixes = [];
        try {
            learnedFixes = await agentKnowledgeService.searchKnowledge(
                `error: ${errorObj.message} fix solution`,
                { knowledgeType: 'fix', limit: 3, threshold: 0.7 }
            );
            if (learnedFixes.length > 0) {
                console.log(`[Codebase-Aware Fix] Found ${learnedFixes.length} learned fixes from knowledge base`);
            }
        } catch (err) {
            console.warn('[Codebase-Aware Fix] Knowledge base search failed:', err.message);
        }

        // 1. Try to get pattern-based template first (fast path)
        const template = await patternBasedFixTemplates.getFixTemplate(errorObj, code, filePath);
        
        // 2. Find similar errors in codebase (with improved search)
        const similarErrors = await this.findSimilarErrors(errorObj, code);
        
        // 3. Find similar code patterns (with improved search)
        const similarCode = await this.findSimilarCode(code, filePath);
        
        // 4. Get codebase context
        const context = await this.getCodebaseContext(filePath);
        
        // 5. Find working examples (with improved intent extraction)
        const intent = await this.extractIntent(errorObj, code);
        const workingExamples = await this.findWorkingExamples(errorObj, code, intent);
        
        // 6. If template found, merge with patterns
        if (template && template.examples) {
            workingExamples.push(...template.examples);
        }
        
        // 5. Generate fix matching codebase patterns
        const startTime = Date.now();
        const fix = await this.generateFixFromPatterns({
            error: errorObj,
            code,
            filePath,
            similarErrors,
            similarCode,
            context,
            workingExamples,
            learnedFixes, // Include learned fixes
            fileRiskScore, // SPRINT 3: Include risk score
            isHighRisk // SPRINT 3: Include risk flag
        });
        const duration = Date.now() - startTime;

        // SPRINT 3: Add risk warnings and extra validation for high-risk files
        if (isHighRisk) {
            fix.riskScore = fileRiskScore;
            fix.riskWarning = `⚠️ HIGH RISK FILE (${fileRiskScore}): This file has a high risk score. Extra validation and testing recommended before applying this fix.`;
            fix.requiresExtraValidation = true;
            fix.requiresTesting = true;
            
            // Lower confidence for high-risk files to encourage review
            if (fix.confidence > 0.8) {
                fix.confidence = Math.max(0.7, fix.confidence - 0.1);
            }
        } else if (fileRiskScore > 0) {
            fix.riskScore = fileRiskScore;
        }

        // 6. Record decision for learning (NEW!)
        try {
            const session = await agentSessionService.getOrCreateSession(
                'codebase-aware-fix-generator',
                sessionId,
                { filePath, errorType: errorObj.type }
            );

            await agentSessionService.recordDecision({
                agentType: 'codebase-aware-fix-generator',
                sessionId: session.session_id || sessionId,
                decisionType: 'fix',
                inputContext: { 
                    error: errorObj.message, 
                    errorType: errorObj.type,
                    filePath,
                    fileExtension: filePath.split('.').pop(),
                    fileRiskScore: fileRiskScore, // SPRINT 3: Include risk score
                    isHighRisk: isHighRisk // SPRINT 3: Include risk flag
                },
                decisionMade: { 
                    fix: fix.code?.substring(0, 200),
                    confidence: fix.confidence,
                    usedLearnedFixes: learnedFixes.length > 0,
                    riskScore: fileRiskScore, // SPRINT 3: Include risk in decision
                    riskWarning: fix.riskWarning // SPRINT 3: Include risk warning
                },
                outcome: 'pending', // Will be updated when fix is applied
                confidence: fix.confidence || 0.5,
                timeTakenMs: duration
            });

            // If fix was successful and we used learned fixes, record usage
            if (learnedFixes.length > 0 && fix.confidence > 0.7) {
                for (const learnedFix of learnedFixes) {
                    await agentKnowledgeService.recordUsage(learnedFix.id, true);
                }
            }

            // Record successful fix to knowledge base for future use
            if (fix.confidence >= 0.7 && fix.code) {
                // Use fixSuccessTracker to record (async, don't block)
                fixSuccessTracker.recordSuccessfulFix({
                    fix: fix.code,
                    error: errorObj,
                    filePath: filePath,
                    agentType: 'codebase-aware-fix-generator',
                    sessionId: session.session_id || sessionId,
                    confidence: fix.confidence,
                    applied: false // Will be updated when actually applied
                }).catch(err => {
                    console.warn('[Codebase-Aware Fix] Failed to record to knowledge base:', err.message);
                });
            }
        } catch (err) {
            console.warn('[Codebase-Aware Fix] Failed to record decision:', err.message);
        }

        return fix;
    }

    /**
     * Find similar errors using semantic search
     */
    async findSimilarErrors(error, code) {
        try {
            // Multiple search strategies for better pattern matching
            const queries = [
                `error: ${error.message} ${error.type}`,
                `${error.type} ${error.message}`,
                `error handling ${error.type}`,
                error.message,
                error.type
            ];
            
            const allResults = [];
            const seen = new Set();
            
            // Try each query with lower threshold for better recall
            for (const query of queries) {
                try {
                    const results = await codebaseSearch.semanticSearch(query, {
                        limit: 5,
                        threshold: 0.3 // Lower threshold for better recall
                    });
                    
                    if (results.results) {
                        for (const result of results.results) {
                            const key = `${result.file_path}:${result.line_start}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                allResults.push(result);
                            }
                        }
                    }
                } catch (err) {
                    // Continue with next query
                }
            }
            
            // Also check error history for successful fixes
            try {
                const errorHistoryService = require('./errorHistoryService');
                const history = errorHistoryService.history || [];
                const similarInHistory = history.filter(e => 
                    e.error && (
                        e.error.type === error.type ||
                        e.error.message?.includes(error.message?.substring(0, 30)) ||
                        error.message?.includes(e.error.message?.substring(0, 30))
                    )
                ).slice(0, 5);
                
                // Convert history entries to search result format
                for (const entry of similarInHistory) {
                    if (entry.fix && entry.fix.success) {
                        allResults.push({
                            content: entry.fix.code || entry.error.message,
                            file_path: entry.error.file || 'history',
                            line_start: entry.error.line || 0,
                            source: 'error_history',
                            fix_applied: true
                        });
                    }
                }
            } catch (err) {
                // Error history not available, continue
            }
            
            return allResults.slice(0, 10); // Return top 10
        } catch (err) {
            console.warn('[Codebase-Aware Fix] Error finding similar errors:', err);
            return [];
        }
    }

    /**
     * Find similar code patterns
     */
    async findSimilarCode(code, filePath) {
        try {
            // Extract key patterns from code for better matching
            const codeSnippet = code.substring(0, 500);
            
            // Try multiple search strategies
            const searchQueries = [
                codeSnippet, // Full snippet
                this.extractCodePattern(codeSnippet), // Extracted pattern
                this.extractFunctionSignature(codeSnippet), // Function signature
            ];
            
            const allResults = [];
            const seen = new Set();
            
            for (const query of searchQueries) {
                if (!query || query.length < 20) continue;
                
                try {
                    const results = await codebaseSearch.semanticSearch(query, {
                        limit: 5,
                        excludeFile: filePath,
                        threshold: 0.3 // Lower threshold for better recall
                    });
                    
                    if (results.results) {
                        for (const result of results.results) {
                            const key = `${result.file_path}:${result.line_start}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                allResults.push(result);
                            }
                        }
                    }
                } catch (err) {
                    // Continue with next query
                }
            }
            
            return allResults.slice(0, 5);
        } catch (err) {
            console.warn('[Codebase-Aware Fix] Error finding similar code:', err);
            return [];
        }
    }
    
    /**
     * Extract code pattern for better matching
     */
    extractCodePattern(code) {
        // Extract function/class definitions, key operations
        const patterns = [];
        
        // Function definitions
        const funcMatches = code.match(/(?:function|const|async\s+function)\s+(\w+)/g);
        if (funcMatches) patterns.push(...funcMatches);
        
        // Key operations (if, try, await, return)
        const keyOps = code.match(/(?:if|try|await|return|throw)\s*\(?/g);
        if (keyOps) patterns.push(...keyOps.slice(0, 3));
        
        return patterns.join(' ');
    }
    
    /**
     * Extract function signature
     */
    extractFunctionSignature(code) {
        const match = code.match(/(?:function|const|async\s+function)\s+(\w+)\s*\([^)]*\)/);
        return match ? match[0] : '';
    }

    /**
     * Get codebase context for file
     */
    async getCodebaseContext(filePath) {
        try {
            const context = await codebaseSearch.getFileContext(filePath);
            return {
                imports: context.imports || [],
                exports: context.exports || [],
                dependencies: context.dependencies || [],
                relatedFiles: context.relatedFiles || []
            };
        } catch (err) {
            console.warn('[Codebase-Aware Fix] Error getting context:', err);
            return {};
        }
    }

    /**
     * Find working examples of similar code
     */
    async findWorkingExamples(error, code, intent = null) {
        try {
            // Use provided intent or extract it
            if (!intent) {
                intent = await this.extractIntent(error, code);
            }
            
            // Multiple search queries for better coverage
            const queries = [
                `working example of ${intent}`,
                `correct implementation of ${intent}`,
                `how to ${intent}`,
                intent,
                `fix for ${error.type}`
            ];
            
            const allResults = [];
            const seen = new Set();
            
            for (const query of queries) {
                try {
                    const results = await codebaseSearch.semanticSearch(query, {
                        limit: 3,
                        threshold: 0.3 // Lower threshold
                    });
                    
                    if (results.results) {
                        for (const result of results.results) {
                            const key = `${result.file_path}:${result.line_start}`;
                            if (!seen.has(key)) {
                                seen.add(key);
                                allResults.push(result);
                            }
                        }
                    }
                } catch (err) {
                    // Continue with next query
                }
            }
            
            return allResults.slice(0, 5);
        } catch (err) {
            console.warn('[Codebase-Aware Fix] Error finding working examples:', err);
            return [];
        }
    }

    /**
     * Extract intent from error and code
     */
    async extractIntent(error, code) {
        // Enhanced intent extraction using multiple strategies
        const errorMsg = error.message?.toLowerCase() || '';
        const errorType = error.type?.toLowerCase() || '';
        const codeLower = code.toLowerCase();
        
        // Pattern-based extraction
        if (errorMsg.includes('undefined') || errorMsg.includes('is not defined')) {
            return 'handling undefined values';
        }
        if (errorMsg.includes('null') || errorMsg.includes('cannot read property')) {
            return 'handling null values';
        }
        if (errorMsg.includes('async') || errorMsg.includes('await') || codeLower.includes('async')) {
            return 'async/await error handling';
        }
        if (errorMsg.includes('import') || errorMsg.includes('require') || errorMsg.includes('module')) {
            return 'module import/export';
        }
        if (errorMsg.includes('sql') || errorMsg.includes('injection')) {
            return 'SQL query safety';
        }
        if (errorMsg.includes('xss') || errorMsg.includes('sanitize')) {
            return 'XSS prevention';
        }
        if (errorMsg.includes('memory') || errorMsg.includes('leak')) {
            return 'resource cleanup';
        }
        if (errorMsg.includes('race') || errorMsg.includes('concurrent')) {
            return 'concurrency control';
        }
        if (errorMsg.includes('timeout') || errorMsg.includes('connection')) {
            return 'connection handling';
        }
        if (errorType === 'security' || errorMsg.includes('vulnerability')) {
            return 'security fix';
        }
        if (errorType === 'performance' || errorMsg.includes('slow') || errorMsg.includes('bottleneck')) {
            return 'performance optimization';
        }
        
        // Try LLM-based extraction for complex cases
        try {
            const llmService = require('./llmService');
            const prompt = `Extract the intent from this error and code. What is the code trying to 
                do and what went wrong?

Error: ${error.message}
Type: ${error.type}
Code: ${code.substring(0, 300)}

Return a short phrase (2-5 words) describing the intent, like "handling undefined values" or "async error handling".`;
            
            const response = await llmService.generateOpenAI(
                'You extract code intent from errors.',
                prompt,
                'gpt-4o-mini'
            );
            
            const intent = (typeof response === 'string') ? response : (response.narrative || '').trim();
            if (intent && intent.length > 5 && intent.length < 50) {
                return intent;
            }
        } catch (err) {
            // Fallback to pattern-based
        }
        
        return 'code pattern fix';
    }

    /**
     * Generate fix from patterns
     */
    async generateFixFromPatterns(options) {
        const {
            error,
            code,
            filePath,
            similarErrors,
            similarCode,
            context,
            workingExamples
        } = options;

        // Build enhanced prompt with better pattern integration
        const hasPatterns = similarErrors.length > 0 || similarCode.length > 0 || workingExamples.length > 0;
        
        let patternSection = '';
        if (hasPatterns) {
            patternSection = `
CODEBASE PATTERNS FOUND (USE THESE AS REFERENCE):

${similarErrors.length > 0 ? `Similar Errors in Codebase (${similarErrors.length} found):
${similarErrors.slice(0, 5).map((e, i) => `${i + 1}. ${e.content?.substring(0, 300) || e.file_path || 'N/A'}${e.fix_applied ? ' [HAS SUCCESSFUL FIX]' : ''}`).join('\n')}
` : ''}

${similarCode.length > 0 ? `Similar Code Patterns (${similarCode.length} found):
${similarCode.slice(0, 5).map((c, i) => `${i + 1}. ${c.content?.substring(0, 300) || c.file_path || 'N/A'}`).join('\n')}
` : ''}

${workingExamples.length > 0 ? `Working Examples (${workingExamples.length} found):
${workingExamples.slice(0, 5).map((e, i) => `${i + 1}. ${e.content?.substring(0, 300) || e.file_path || 'N/A'}`).join('\n')}
` : ''}

IMPORTANT: Study these patterns carefully and apply the same style, structure, and approach in your fix.
`;
        }
        
        const prompt = `You are an expert code fixer that generates fixes matching a specific codebase's patterns and style.

ERROR TO FIX:
Message: ${error.message}
Type: ${error.type}
File: ${filePath}

CURRENT CODE (BROKEN):
${code.substring(0, 1000)}
${patternSection}
CODEBASE CONTEXT:
- Imports: ${context.imports?.join(', ') || 'none'}
- Exports: ${context.exports?.join(', ') || 'none'}
- Dependencies: ${context.dependencies?.length || 0} files

REQUIREMENTS FOR THE FIX:
1. Match the codebase's coding style EXACTLY (use patterns above as reference)
2. Follow the same error handling patterns shown in similar code
3. Use the same import/export style as the codebase
4. Apply the same structure and conventions from working examples
5. Fix the specific error: ${error.message}
6. Make the code production-ready and robust

${hasPatterns ? 'CRITICAL: The patterns above show how this codebase handles similar situations. Your fix MUST follow these patterns.' : ''}

Return ONLY the fixed code, no explanations, no markdown, just the code.`;

        try {
            const systemPrompt = 'You are an expert code fixer that matches codebase patterns perfectly. Always preserve const/let/var declarations and indentation.';
            // Try OpenAI first, fallback to Anthropic if needed
            let response;
            try {
                response = await llmService.generateOpenAI(
                    systemPrompt,
                    prompt,
                    'gpt-4o-mini' // Use default model
                );
            } catch (openaiErr) {
                // Fallback to Anthropic if OpenAI fails
                if (llmService.anthropicApiKey) {
                    try {
                        response = await llmService.generateAnthropic(
                            systemPrompt,
                            prompt,
                            'claude-3-haiku-20240307'
                        );
                    } catch (anthropicErr) {
                        throw new Error(`Both OpenAI and Anthropic failed: ${openaiErr.message}, ${anthropicErr.message}`);
                    }
                } else {
                    throw openaiErr;
                }
            }

            // Extract text from response (format may vary)
            // llmService.generateOpenAI returns { narrative, tokensUsed, cost, ... }
            const fixedCode = (typeof response === 'string') ? response : (response.narrative || response.content || response.text || '');

            return {
                code: fixedCode,
                confidence: this.calculateConfidence(similarErrors, similarCode, workingExamples),
                patternsUsed: {
                    similarErrors: similarErrors.length,
                    similarCode: similarCode.length,
                    workingExamples: workingExamples.length
                },
                method: 'codebase-aware'
            };
        } catch (err) {
            console.error('[Codebase-Aware Fix] LLM generation failed:', err);
            throw err;
        }
    }

    /**
     * Calculate confidence based on patterns found
     */
    calculateConfidence(similarErrors, similarCode, workingExamples) {
        let confidence = 0.5; // Base confidence

        // More similar errors = higher confidence
        if (similarErrors.length > 0) {
            confidence += 0.15;
            // Bonus for errors with successful fixes
            const withFixes = similarErrors.filter(e => e.fix_applied).length;
            if (withFixes > 0) {
                confidence += 0.1 * Math.min(withFixes, 3);
            }
        }
        if (similarErrors.length > 3) {
            confidence += 0.1;
        }
        if (similarErrors.length > 5) {
            confidence += 0.05;
        }

        // More similar code = higher confidence
        if (similarCode.length > 0) {
            confidence += 0.15;
        }
        if (similarCode.length > 2) {
            confidence += 0.1;
        }
        if (similarCode.length > 4) {
            confidence += 0.05;
        }

        // Working examples = higher confidence
        if (workingExamples.length > 0) {
            confidence += 0.15;
        }
        if (workingExamples.length > 2) {
            confidence += 0.1;
        }

        // Bonus for having all three types of patterns
        if (similarErrors.length > 0 && similarCode.length > 0 && workingExamples.length > 0) {
            confidence += 0.1;
        }

        return Math.min(1, confidence);
    }

    /**
     * Find code patterns for generation
     */
    async findPatternsForGeneration(intent, filePath) {
        try {
            const results = await codebaseSearch.semanticSearch(
                `code pattern for ${intent}`,
                {
                    limit: 10,
                    excludeFile: filePath,
                    threshold: 0.7
                }
            );

            // Sort by quality (could use metrics from codebase)
            return results.results || [];
        } catch (err) {
            console.warn('[Codebase-Aware Fix] Error finding patterns:', err);
            return [];
        }
    }

    /**
     * Generate code from codebase patterns
     */
    async generateCodeFromPatterns(intent, filePath, context) {
        const patterns = await this.findPatternsForGeneration(intent, filePath);
        
        if (patterns.length === 0) {
            return null;
        }

        const prompt = `Generate code that matches this codebase's patterns and style.

Intent: ${intent}
File: ${filePath}

Codebase Patterns:
${patterns.slice(0, 5).map(p => `- ${p.content?.substring(0, 300)}`).join('\n\n')}

Context:
${JSON.stringify(context, null, 2)}

Generate code that:
1. Matches the codebase style exactly
2. Follows the patterns shown
3. Uses consistent naming conventions
4. Matches error handling patterns

Return only the code, no explanations.`;

        try {
            const systemPrompt = 'You generate code that perfectly matches codebase patterns.';
            const response = await llmService.generateOpenAI(
                systemPrompt,
                prompt,
                'gpt-4o-mini' // Use default model
            );

            // Extract text from response
            // llmService.generateOpenAI returns { narrative, tokensUsed, cost, ... }
            const generatedCode = (typeof response === 'string') ? response : (response.narrative || 
                response.content || response.text || '');

            return {
                code: generatedCode,
                patternsUsed: patterns.length,
                confidence: Math.min(0.9, 0.5 + (patterns.length * 0.1))
            };
        } catch (err) {
            console.error('[Codebase-Aware Fix] Code generation failed:', err);
            throw err;
        }
    }
}

module.exports = new CodebaseAwareFixGenerator();


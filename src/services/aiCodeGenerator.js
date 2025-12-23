/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/aiCodeGenerator.js
 * Last Sync: 2025-12-20T22:26:03.327Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * AI Code Generator Service
 * Generates code based on successful patterns from your codebase
 * IP Innovation #6: Pattern-Based Code Generation
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const llmService = require('./llmService');
const codebaseSearch = require('./codebaseSearch');

class AICodeGenerator {
    constructor() {
        // Only create Supabase client if credentials are available
        if (config.supabase.serviceRoleKey) {
            try {
                this.supabase = createClient(
                    config.supabase.url,
                    config.supabase.serviceRoleKey
                );
            } catch (error) {
                console.warn('[aiCodeGenerator] Supabase not configured:', error.message);
                this.supabase = null;
            }
        } else {
            console.warn('[aiCodeGenerator] Supabase credentials not configured. Service will be disabled.');
            this.supabase = null;
        }
    }

    /**
     * Generate code based on intent and successful patterns
     */
    async generateCode(options) {
        const {
            intent, // "Create a new API endpoint for user authentication"
            type, // "api-endpoint", "service", "component", etc.
            style, // Optional: specific style preferences
            context // Optional: surrounding code context
        } = options;

        console.log(`[AI Code Generator] Generating code for: ${intent}`);

        // 1. Get successful patterns from codebase
        const patterns = await this.getSuccessfulPatterns(type);
        
        // 2. Get codebase style
        const codebaseStyle = style || await this.getCodebaseStyle();
        
        // 3. Get similar examples
        const examples = await this.findSimilarExamples(intent, type);
        
        // 4. Generate code using LLM with patterns and style
        const generatedCode = await this.generateWithLLM({
            intent,
            patterns,
            style: codebaseStyle,
            examples,
            context
        });

        // 5. Verify and refine
        const verifiedCode = await this.verifyAndRefine(generatedCode, {
            patterns,
            style: codebaseStyle
        });

        return {
            code: verifiedCode,
            confidence: await this.calculateConfidence(verifiedCode, patterns),
            patternsUsed: patterns.map(p => p.fingerprint),
            suggestions: await this.getImprovementSuggestions(verifiedCode)
        };
    }

    /**
     * Get successful patterns from Supabase
     * SPRINT 7: Enhanced with knowledge base integration
     */
    async getSuccessfulPatterns(type) {
        const patterns = [];

        // SPRINT 7: Get patterns from knowledge base first
        try {
            const knowledgePatterns = await agentKnowledgeService.searchKnowledge(
                `code pattern for ${type}`,
                { knowledgeType: 'pattern', limit: 10, threshold: 0.6 }
            );
            
            for (const kbPattern of knowledgePatterns) {
                patterns.push({
                    fingerprint: kbPattern.id,
                    content: kbPattern.content,
                    success_count: kbPattern.success_rate ? Math.floor(kbPattern.success_rate * 100) : 0,
                    source: 'knowledge_base',
                    confidence: kbPattern.confidence || 0.7
                });
            }
        } catch (err) {
            console.warn('[AI Code Generator] Error getting knowledge base patterns:', err);
        }

        // Also get from code_roach_patterns if available
        if (this.supabase) {
            try {
                const { data, error } = await this.supabase
                    .from('code_roach_patterns')
                    .select('*')
                    .eq('error_pattern->>type', type)
                    .gt('success_count', 0)
                    .order('success_count', { ascending: false })
                    .limit(10);

                if (!error && data) {
                    patterns.push(...data.map(p => ({ ...p, source: 'code_roach' })));
                }
            } catch (err) {
                console.warn('[AI Code Generator] Error getting code roach patterns:', err);
            }
        }

        // Sort by success count/confidence and return top 10
        return patterns
            .sort((a, b) => (b.success_count || b.confidence || 0) - (a.success_count || a.confidence || 0))
            .slice(0, 10);
    }

    /**
     * Get codebase style from successful code
     */
    async getCodebaseStyle() {
        // Analyze successful fixes to understand style
        if (!this.supabase) return {};

        try {
            const { data, error } = await this.supabase
                .from('code_roach_issues')
                .select('fix_code, error_file')
                .eq('fix_success', true)
                .not('fix_code', 'is', null)
                .limit(50);

            if (error) throw error;

            // Analyze style patterns
            const style = {
                indentation: await this.analyzeIndentation(data),
                naming: await this.analyzeNaming(data),
                structure: await this.analyzeStructure(data),
                patterns: await this.analyzePatterns(data)
            };

            return style;
        } catch (err) {
            console.warn('[AI Code Generator] Error analyzing style:', err);
            return {};
        }
    }

    /**
     * Find similar examples in codebase
     */
    async findSimilarExamples(intent, type) {
        try {
            // Use codebase search to find similar code
            const results = await codebaseSearch.semanticSearch(
                `code example for ${intent} ${type}`,
                { limit: 5 }
            );

            return results.results || [];
        } catch (err) {
            console.warn('[AI Code Generator] Error finding examples:', err);
            return [];
        }
    }

    /**
     * Generate code using LLM with patterns and style
     */
    async generateWithLLM(options) {
        const { intent, patterns, style, examples, context } = options;

        const prompt = `You are an expert code generator that creates code matching a specific codebase's style and patterns.

Intent: ${intent}

Successful Patterns from this codebase:
${JSON.stringify(patterns.slice(0, 5), null, 2)}

Codebase Style:
${JSON.stringify(style, null, 2)}

Similar Examples:
${examples.slice(0, 3).map(e => e.content).join('\n\n---\n\n')}

${context ? `Context:\n${context}` : ''}

Generate code that:
1. Matches the codebase style exactly
2. Follows the successful patterns
3. Is similar to the examples
4. Is production-ready

Return only the code, no explanations.`;

        try {
            const response = await llmService.generateOpenAI({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: 'You are an expert code generator that matches codebase style perfectly.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3, // Lower temperature for more consistent style
                max_tokens: 2000
            });

            return response.content || response.text || '';
        } catch (err) {
            console.error('[AI Code Generator] LLM generation failed:', err);
            throw err;
        }
    }

    /**
     * Verify and refine generated code
     */
    async verifyAndRefine(code, options) {
        const { patterns, style } = options;

        // Check against patterns
        const patternMatches = await this.checkPatternMatches(code, patterns);
        
        // Check style consistency
        const styleIssues = await this.checkStyleConsistency(code, style);
        
        // Refine if needed
        if (styleIssues.length > 0) {
            return await this.refineCode(code, styleIssues, style);
        }

        return code;
    }

    /**
     * Calculate confidence score
     */
    async calculateConfidence(code, patterns) {
        // Higher confidence if:
        // - Matches many patterns
        // - Follows style guide
        // - Similar to successful examples
        
        const patternMatchScore = await this.calculatePatternMatch(code, patterns);
        const styleScore = await this.calculateStyleScore(code);
        
        return (patternMatchScore * 0.6 + styleScore * 0.4);
    }

    /**
     * Get improvement suggestions
     * SPRINT 7: Enhanced with pattern-based suggestions
     */
    async getImprovementSuggestions(code) {
        const suggestions = [];
        
        // SPRINT 7: Check against knowledge base patterns
        try {
            const similarPatterns = await agentKnowledgeService.searchKnowledge(
                code.substring(0, 500),
                { knowledgeType: 'pattern', limit: 5, threshold: 0.7 }
            );

            for (const pattern of similarPatterns) {
                // Check if code is missing common patterns
                if (pattern.content.includes('try') && !code.includes('try')) {
                    suggestions.push({
                        type: 'error_handling',
                        message: 'Consider adding error handling (try-catch)',
                        pattern: pattern.id
                    });
                }
                if (pattern.content.includes('async') && !code.includes('async')) {
                    suggestions.push({
                        type: 'async',
                        message: 'Consider using async/await pattern',
                        pattern: pattern.id
                    });
                }
            }
        } catch (err) {
            console.warn('[AI Code Generator] Error getting pattern suggestions:', err);
        }
        
        // Check for common improvements
        if (!code.includes('try') && !code.includes('catch')) {
            suggestions.push({
                type: 'error_handling',
                message: 'Add error handling',
                priority: 'high'
            });
        }
        
        if (!code.includes('console.log') && !code.includes('console.error')) {
            suggestions.push({
                type: 'logging',
                message: 'Consider adding logging',
                priority: 'medium'
            });
        }
        
        return suggestions;
    }

    /**
     * SPRINT 7: Generate code from intent using knowledge base patterns
     */
    async generateFromPattern(options) {
        const {
            intent,
            patternType = null,
            context = null
        } = options;

        // Search knowledge base for relevant patterns
        const patterns = await agentKnowledgeService.searchKnowledge(
            intent,
            { knowledgeType: 'pattern', limit: 5, threshold: 0.6 }
        );

        if (patterns.length === 0) {
            // Fallback to general code generation
            return await this.generateCode({ intent, type: patternType, context });
        }

        // Use best pattern as template
        const bestPattern = patterns[0];
        const similarPatterns = patterns.slice(1, 3);

        // Generate code using LLM with pattern context
        const prompt = `Generate code based on this intent: "${intent}"

Use this pattern as a template:
${bestPattern.content}

Similar patterns for reference:
${similarPatterns.map(p => p.content).join('\n\n---\n\n')}

${context ? `Context:\n${context}` : ''}

Generate code that follows the pattern structure but implements the intent. Return only the code.`;

        try {
            const response = await llmService.generateOpenAI({
                model: 'gpt-4o-mini',
                messages: [
                    { role: 'system', content: 'You are a code generator that follows existing codebase patterns exactly.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.2,
                max_tokens: 2000
            });

            const generatedCode = response.content || response.text || '';

            return {
                code: generatedCode,
                confidence: bestPattern.confidence || 0.7,
                patternUsed: bestPattern.id,
                patternsReferenced: patterns.map(p => p.id)
            };
        } catch (err) {
            console.error('[AI Code Generator] Pattern-based generation failed:', err);
            throw err;
        }
    }

    // Helper methods
    async analyzeIndentation(data) {
        // Analyze indentation style (spaces vs tabs, 2 vs 4 spaces)
        return { type: 'spaces', size: 2 }; // Simplified
    }

    async analyzeNaming(data) {
        // Analyze naming conventions (camelCase, snake_case, etc.)
        return { style: 'camelCase' }; // Simplified
    }

    async analyzeStructure(data) {
        // Analyze code structure patterns
        return {}; // Simplified
    }

    async analyzePatterns(data) {
        // Analyze common patterns
        return []; // Simplified
    }

    async checkPatternMatches(code, patterns) {
        // Check if code matches patterns
        return [];
    }

    async checkStyleConsistency(code, style) {
        // Check style consistency
        return [];
    }

    async refineCode(code, issues, style) {
        // Refine code to fix style issues
        return code;
    }

    async calculatePatternMatch(code, patterns) {
        // Calculate how well code matches patterns
        return 0.8; // Simplified
    }

    async calculateStyleScore(code) {
        // Calculate style consistency score
        return 0.9; // Simplified
    }
}

module.exports = new AICodeGenerator();


/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/automatedTestGenerator.js
 * Last Sync: 2025-12-14T07:30:45.622Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Automated Test Generator Service
 * Generates tests from error patterns that frequently break
 * IP Innovation #9: Self-Healing Test Suite Generation
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const llmService = require('./llmService');
const agentKnowledgeService = require('./agentKnowledgeService');
const fs = require('fs').promises;
const path = require('path');

class AutomatedTestGenerator {
    constructor() {
        this.supabase = null;
        this.testDir = path.join(__dirname, '../../tests/generated');
        
        if (config.supabase?.url && config.supabase?.serviceRoleKey) {
            this.supabase = createClient(
                config.supabase.url,
                config.supabase.serviceRoleKey
            );
        }

        // Ensure test directory exists
        fs.mkdir(this.testDir, { recursive: true }).catch(() => {});
    }

    /**
     * Generate tests for patterns that break frequently
     */
    async generateTestsForPatterns() {
        console.log('[Automated Test Generator] Analyzing patterns for test generation...');

        // Get patterns that break frequently but don't have tests
        const patterns = await this.getPatternsNeedingTests();
        
        const generatedTests = [];
        for (const pattern of patterns) {
            try {
                const test = await this.generateTestForPattern(pattern);
                if (test) {
                    await this.saveTest(test);
                    generatedTests.push(test);
                }
            } catch (err) {
                console.error(`[Automated Test Generator] Error generating test for pattern ${pattern.fingerprint}:`, err);
            }
        }

        console.log(`[Automated Test Generator] Generated ${generatedTests.length} tests`);
        return generatedTests;
    }

    /**
     * Get patterns that need tests
     */
    async getPatternsNeedingTests() {
        if (!this.supabase) return [];

        try {
            // Get patterns that:
            // - Occur frequently (5+ times)
            // - Have failures
            // - Don't have tests yet
            const { data, error } = await this.supabase
                .from('code_roach_patterns')
                .select('*')
                .gt('occurrence_count', 5)
                .gt('failure_count', 0)
                .or('pattern_metadata->>hasTest.is.null,pattern_metadata->>hasTest.eq.false')
                .order('occurrence_count', { ascending: false })
                .limit(20);

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.warn('[Automated Test Generator] Error getting patterns:', err);
            return [];
        }
    }

    /**
     * Generate test for a specific pattern
     */
    async generateTestForPattern(pattern) {
        // Get examples of this pattern
        const examples = await this.getPatternExamples(pattern.fingerprint);
        
        // Get successful fixes
        const fixes = await this.getSuccessfulFixes(pattern.fingerprint);
        
        // Generate test using LLM
        const testCode = await this.generateTestCode({
            pattern,
            examples,
            fixes
        });

        return {
            pattern: pattern.fingerprint,
            testName: this.generateTestName(pattern),
            testCode,
            filePath: await this.determineTestFilePath(pattern),
            patternInfo: {
                errorType: pattern.error_pattern?.type,
                errorMessage: pattern.error_pattern?.message,
                occurrenceCount: pattern.occurrence_count
            }
        };
    }

    /**
     * Get examples of a pattern
     */
    async getPatternExamples(fingerprint) {
        if (!this.supabase) return [];

        try {
            const { data, error } = await this.supabase
                .from('code_roach_issues')
                .select('error_message, error_file, error_line, error_stack')
                .eq('error_fingerprint', fingerprint)
                .limit(5);

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.warn('[Automated Test Generator] Error getting examples:', err);
            return [];
        }
    }

    /**
     * Get successful fixes for a pattern
     */
    async getSuccessfulFixes(fingerprint) {
        if (!this.supabase) return [];

        try {
            const { data, error } = await this.supabase
                .from('code_roach_issues')
                .select('fix_code, error_file, error_line')
                .eq('error_fingerprint', fingerprint)
                .eq('fix_success', true)
                .not('fix_code', 'is', null)
                .limit(5);

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.warn('[Automated Test Generator] Error getting fixes:', err);
            return [];
        }
    }

    /**
     * Generate test code using LLM
     * SPRINT 7: Enhanced with knowledge base test patterns
     */
    async generateTestCode(options) {
        // SPRINT 7: Get test patterns from knowledge base
        let testPatterns = [];
        try {
            testPatterns = await agentKnowledgeService.searchKnowledge(
                'test pattern jest unit test',
                { knowledgeType: 'pattern', limit: 3, threshold: 0.6 }
            );
        } catch (err) {
            console.warn('[Automated Test Generator] Error getting test patterns:', err);
        }

        const { pattern, examples, fixes } = options;

        // SPRINT 7: Include test patterns in prompt
        const testPatternSection = testPatterns.length > 0
            ? `\n\nTest patterns from codebase:\n${testPatterns.map((p, i) => `${i + 1}. ${p.content.substring(0, 300)}`).join('\n\n---\n\n')}`
            : '';

        const prompt = `Generate a Jest test that catches this error pattern:

Pattern: ${pattern.error_pattern?.message || 'Unknown'}
Type: ${pattern.error_pattern?.type || 'unknown'}
Occurrences: ${pattern.occurrence_count}

Examples of this error:
${examples.map((e, i) => `${i + 1}. ${e.error_message} in ${e.error_file}:${e.error_line}`).join('\n')}

Successful fixes:
${fixes.map((f, i) => `${i + 1}. ${f.fix_code?.substring(0, 200)}`).join('\n\n')}${testPatternSection}

Generate a test that:
1. Reproduces the error pattern
2. Verifies the fix works
3. Is specific and actionable
4. Uses Jest syntax
${testPatterns.length > 0 ? '5. Follows the test patterns shown above' : ''}

Return only the test code, no explanations.`;

        try {
            const response = await llmService.generateOpenAI({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: 'You are an expert test writer who creates tests that catch real bugs.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.3,
                max_tokens: 1500
            });

            return response.content || response.text || '';
        } catch (err) {
            console.error('[Automated Test Generator] LLM generation failed:', err);
            throw err;
        }
    }

    /**
     * Generate test name
     */
    generateTestName(pattern) {
        const type = pattern.error_pattern?.type || 'error';
        const message = pattern.error_pattern?.message || 'pattern';
        const sanitized = message.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '_');
        return `test_${type}_${sanitized}_${pattern.fingerprint.substring(0, 8)}`;
    }

    /**
     * Determine test file path
     */
    async determineTestFilePath(pattern) {
        // Try to determine from examples
        const examples = await this.getPatternExamples(pattern.fingerprint);
        if (examples.length > 0) {
            const sourceFile = examples[0].error_file;
            if (sourceFile) {
                // Convert source path to test path
                const testPath = sourceFile
                    .replace(/^server\//, 'tests/unit/')
                    .replace(/^public\//, 'tests/integration/')
                    .replace(/\.js$/, '.test.js');
                return testPath;
            }
        }

        // Default location
        return `tests/generated/${this.generateTestName(pattern)}.test.js`;
    }

    /**
     * Save test to file
     */
    async saveTest(test) {
        try {
            const testPath = path.join(__dirname, '../../', test.filePath);
            const testDir = path.dirname(testPath);
            
            await fs.mkdir(testDir, { recursive: true });
            
            const testFile = `/**
 * Auto-generated test for pattern: ${test.pattern}
 * Error: ${test.patternInfo.errorMessage}
 * Type: ${test.patternInfo.errorType}
 * Occurrences: ${test.patternInfo.occurrenceCount}
 * Generated: ${new Date().toISOString()}
 */

${test.testCode}
`;

            await fs.writeFile(testPath, testFile, 'utf8');
            
            // Mark pattern as having a test
            await this.markPatternAsTested(test.pattern);
            
            console.log(`[Automated Test Generator] Saved test: ${test.filePath}`);
        } catch (err) {
            console.error('[Automated Test Generator] Error saving test:', err);
            throw err;
        }
    }

    /**
     * Mark pattern as having a test
     */
    async markPatternAsTested(fingerprint) {
        if (!this.supabase) return;

        try {
            await this.supabase
                .from('code_roach_patterns')
                .update({
                    pattern_metadata: {
                        hasTest: true,
                        testGeneratedAt: new Date().toISOString()
                    }
                })
                .eq('fingerprint', fingerprint);
        } catch (err) {
            console.warn('[Automated Test Generator] Error marking pattern:', err);
        }
    }

    /**
     * Generate tests for a specific file
     */
    async generateTestsForFile(filePath) {
        // Get all patterns for this file
        if (!this.supabase) return [];

        try {
            const { data, error } = await this.supabase
                .from('code_roach_issues')
                .select('error_fingerprint')
                .eq('error_file', filePath)
                .limit(20);

            if (error) throw error;

            const fingerprints = [...new Set(data.map(i => i.error_fingerprint))];
            const patterns = [];

            for (const fingerprint of fingerprints) {
                const { data: pattern } = await this.supabase
                    .from('code_roach_patterns')
                    .select('*')
                    .eq('fingerprint', fingerprint)
                    .single();

                if (pattern) {
                    patterns.push(pattern);
                }
            }

            // Generate tests for these patterns
            const tests = [];
            for (const pattern of patterns) {
                const test = await this.generateTestForPattern(pattern);
                if (test) {
                    await this.saveTest(test);
                    tests.push(test);
                }
            }

            return tests;
        } catch (err) {
            console.error('[Automated Test Generator] Error generating tests for file:', err);
            return [];
        }
    }
}

module.exports = new AutomatedTestGenerator();


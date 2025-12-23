/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/advancedFixGenerator.js
 * Last Sync: 2025-12-19T23:29:57.560Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Advanced Fix Generator Service
 * Sprint 4: Handles complex fixes (refactoring, security, performance, architecture)
 */

const llmFixGenerator = require('./llmFixGenerator');
const contextAwareFixGenerator = require('./contextAwareFixGenerator');
const securityAutoFix = require('./securityAutoFix');
const performanceOptimizer = require('./performanceOptimizer');
const codebaseSearch = require('./codebaseSearch');
const fs = require('fs').promises;
const path = require('path');

class AdvancedFixGenerator {
    constructor() {
        this.refactoringPatterns = new Map();
        this.architecturePatterns = new Map();
    }

    /**
     * Generate advanced fix based on issue type
     */
    async generateAdvancedFix(issue, code, filePath) {
        try {
            switch (issue.type) {
                case 'security':
                    return await this.generateSecurityFix(issue, code, filePath);
                
                case 'performance':
                    return await this.generatePerformanceFix(issue, code, filePath);
                
                case 'refactoring':
                case 'code-smell':
                    return await this.generateRefactoringFix(issue, code, filePath);
                
                case 'architecture':
                case 'design':
                    return await this.generateArchitectureFix(issue, code, filePath);
                
                default:
                    // Fallback to context-aware fix
                    return await contextAwareFixGenerator.generateContextAwareFix(issue, code, filePath);
            }
        } catch (err) {
            console.error('[Advanced Fix] Error:', err);
            return {
                success: false,
                error: err.message,
                confidence: 0
            };
        }
    }

    /**
     * Generate security fix
     */
    async generateSecurityFix(issue, code, filePath) {
        try {
            // Use security auto-fix service
            const vulnerabilities = await securityAutoFix.scanForVulnerabilities(code, filePath);
            const relevantVuln = vulnerabilities.find(v => 
                v.line === issue.line || 
                v.type === issue.type ||
                issue.message.toLowerCase().includes(v.type.toLowerCase())
            );

            if (relevantVuln) {
                const fix = await securityAutoFix.generateFix(relevantVuln, { code, filePath });
                
                if (fix.success) {
                    return {
                        success: true,
                        fixedCode: fix.fixed,
                        explanation: `Fixed ${relevantVuln.type} vulnerability`,
                        confidence: 0.9,
                        safety: 'safe',
                        changes: [`Fixed ${relevantVuln.type} vulnerability`],
                        method: 'security-auto-fix'
                    };
                }
            }

            // Fallback to LLM fix with security context
            return await this.generateSecurityFixWithLLM(issue, code, filePath);
        } catch (err) {
            console.error('[Advanced Fix] Security fix error:', err);
            return { success: false, error: err.message, confidence: 0 };
        }
    }

    /**
     * Generate security fix using LLM
     */
    async generateSecurityFixWithLLM(issue, code, filePath) {
        const prompt = `You are a security expert. Fix this security vulnerability:

ISSUE: ${issue.message}
FILE: ${filePath}
LINE: ${issue.line}

CODE:
\`\`\`javascript
${this.getCodeSnippet(code, issue.line || 1, 10)}
\`\`\`

SECURITY REQUIREMENTS:
1. Fix the vulnerability completely
2. Maintain functionality
3. Follow security best practices
4. Add input validation if needed
5. Sanitize user input
6. Use parameterized queries for SQL
7. Escape output for XSS prevention

Generate a secure fix in JSON format:
{
  "fixedCode": "the fixed code",
  "explanation": "security fix explanation",
  "confidence": 0.0-1.0,
  "safety": "safe",
  "changes": ["list of security improvements"]
}`;

        try {
            const llmService = require('./llmService');
            if (llmService.isAvailable()) {
                const response = await llmService.generateText(prompt, {
                    model: 'gpt-4o-mini',
                    temperature: 0.1,
                    maxTokens: 1500
                });

                const fix = llmFixGenerator.parseFixResponse(response, issue, code);
                if (fix.success) {
                    fix.method = 'security-llm';
                    fix.safety = 'safe';
                }
                return fix;
            }
        } catch (err) {
            console.warn('[Advanced Fix] LLM security fix failed:', err.message);
        }

        return { success: false, error: 'Could not generate security fix', confidence: 0 };
    }

    /**
     * Generate performance fix
     */
    async generatePerformanceFix(issue, code, filePath) {
        try {
            // Use performance optimizer (method is analyzePerformance, not analyzeCode)
            const optimizations = await performanceOptimizer.analyzePerformance(code, filePath);
            const relevantOpt = optimizations.find(o => 
                o.line === issue.line ||
                issue.message.toLowerCase().includes(o.type.toLowerCase())
            );

            if (relevantOpt) {
                const fix = await performanceOptimizer.generateOptimization(relevantOpt, { code, filePath });
                
                if (fix.success) {
                    return {
                        success: true,
                        fixedCode: fix.optimized,
                        explanation: `Optimized ${relevantOpt.type}`,
                        confidence: 0.85,
                        safety: 'safe',
                        changes: [`Optimized ${relevantOpt.type}`],
                        method: 'performance-optimizer'
                    };
                }
            }

            // Fallback to LLM performance fix
            return await this.generatePerformanceFixWithLLM(issue, code, filePath);
        } catch (err) {
            console.error('[Advanced Fix] Performance fix error:', err);
            return { success: false, error: err.message, confidence: 0 };
        }
    }

    /**
     * Generate performance fix using LLM
     */
    async generatePerformanceFixWithLLM(issue, code, filePath) {
        const prompt = `You are a performance optimization expert. Fix this performance issue:

ISSUE: ${issue.message}
FILE: ${filePath}
LINE: ${issue.line}

CODE:
\`\`\`javascript
${this.getCodeSnippet(code, issue.line || 1, 15)}
\`\`\`

PERFORMANCE REQUIREMENTS:
1. Optimize the code for better performance
2. Reduce time complexity if possible
3. Optimize database queries
4. Reduce memory usage
5. Use caching where appropriate
6. Avoid unnecessary computations
7. Use async/await properly
8. Batch operations when possible

Generate an optimized fix in JSON format:
{
  "fixedCode": "the optimized code",
  "explanation": "performance optimization explanation",
  "confidence": 0.0-1.0,
  "safety": "safe|medium",
  "changes": ["list of optimizations"]
}`;

        try {
            const llmService = require('./llmService');
            if (llmService.isAvailable()) {
                const response = await llmService.generateText(prompt, {
                    model: 'gpt-4o-mini',
                    temperature: 0.2,
                    maxTokens: 2000
                });

                const fix = llmFixGenerator.parseFixResponse(response, issue, code);
                if (fix.success) {
                    fix.method = 'performance-llm';
                }
                return fix;
            }
        } catch (err) {
            console.warn('[Advanced Fix] LLM performance fix failed:', err.message);
        }

        return { success: false, error: 'Could not generate performance fix', confidence: 0 };
    }

    /**
     * Generate refactoring fix
     */
    async generateRefactoringFix(issue, code, filePath) {
        try {
            // Check for common refactoring patterns
            const refactoringType = this.detectRefactoringType(issue, code);
            
            switch (refactoringType) {
                case 'extract-function':
                    return await this.extractFunction(issue, code, filePath);
                
                case 'extract-variable':
                    return await this.extractVariable(issue, code, filePath);
                
                case 'simplify-condition':
                    return await this.simplifyCondition(issue, code, filePath);
                
                case 'remove-duplication':
                    return await this.removeDuplication(issue, code, filePath);
                
                default:
                    return await this.generateRefactoringFixWithLLM(issue, code, filePath);
            }
        } catch (err) {
            console.error('[Advanced Fix] Refactoring error:', err);
            return { success: false, error: err.message, confidence: 0 };
        }
    }

    /**
     * Detect refactoring type
     */
    detectRefactoringType(issue, code) {
        const message = (issue.message || '').toLowerCase();
        
        if (message.includes('extract') && message.includes('function')) {
            return 'extract-function';
        }
        if (message.includes('extract') && message.includes('variable')) {
            return 'extract-variable';
        }
        if (message.includes('simplify') || message.includes('complex condition')) {
            return 'simplify-condition';
        }
        if (message.includes('duplicate') || message.includes('repetitive')) {
            return 'remove-duplication';
        }
        
        return 'general';
    }

    /**
     * Extract function refactoring
     */
    async extractFunction(issue, code, filePath) {
        // This would use AST parsing in a real implementation
        // For now, use LLM
        return await this.generateRefactoringFixWithLLM(issue, code, filePath);
    }

    /**
     * Extract variable refactoring
     */
    async extractVariable(issue, code, filePath) {
        return await this.generateRefactoringFixWithLLM(issue, code, filePath);
    }

    /**
     * Simplify condition refactoring
     */
    async simplifyCondition(issue, code, filePath) {
        const lines = code.split('\n');
        const lineIndex = (issue.line || 1) - 1;
        const line = lines[lineIndex] || '';

        // Simple condition simplification
        if (line.includes('&&') || line.includes('||')) {
            // Use LLM for complex simplifications
            return await this.generateRefactoringFixWithLLM(issue, code, filePath);
        }

        return { success: false, error: 'Could not simplify condition', confidence: 0 };
    }

    /**
     * Remove duplication refactoring
     */
    async removeDuplication(issue, code, filePath) {
        // Find similar code patterns
        const similarPatterns = await codebaseSearch.semanticSearch(
            `duplicate code pattern ${issue.message}`,
            { limit: 3, threshold: 0.7 }
        );

        if (similarPatterns && similarPatterns.results && similarPatterns.results.length > 0) {
            // Use LLM to refactor
            return await this.generateRefactoringFixWithLLM(issue, code, filePath, similarPatterns);
        }

        return await this.generateRefactoringFixWithLLM(issue, code, filePath);
    }

    /**
     * Generate refactoring fix using LLM
     */
    async generateRefactoringFixWithLLM(issue, code, filePath, similarPatterns = null) {
        let prompt = `You are a refactoring expert. Refactor this code to improve quality:

ISSUE: ${issue.message}
FILE: ${filePath}
LINE: ${issue.line}

CODE:
\`\`\`javascript
${this.getCodeSnippet(code, issue.line || 1, 20)}
\`\`\`

REFACTORING REQUIREMENTS:
1. Improve code readability
2. Reduce complexity
3. Follow SOLID principles
4. Extract functions/methods when appropriate
5. Remove duplication
6. Simplify conditions
7. Improve naming
8. Maintain functionality

`;

        if (similarPatterns) {
            prompt += `SIMILAR PATTERNS FOUND:
${similarPatterns.results.slice(0, 2).map(r => `- ${r.file_path}`).join('\n')}

`;
        }

        prompt += `Generate refactored code in JSON format:
{
  "fixedCode": "the refactored code",
  "explanation": "refactoring explanation",
  "confidence": 0.0-1.0,
  "safety": "safe|medium",
  "changes": ["list of refactoring changes"]
}`;

        try {
            const llmService = require('./llmService');
            if (llmService.isAvailable()) {
                const response = await llmService.generateText(prompt, {
                    model: 'gpt-4o-mini',
                    temperature: 0.2,
                    maxTokens: 2000
                });

                const fix = llmFixGenerator.parseFixResponse(response, issue, code);
                if (fix.success) {
                    fix.method = 'refactoring-llm';
                }
                return fix;
            }
        } catch (err) {
            console.warn('[Advanced Fix] LLM refactoring failed:', err.message);
        }

        return { success: false, error: 'Could not generate refactoring fix', confidence: 0 };
    }

    /**
     * Generate architecture fix
     */
    async generateArchitectureFix(issue, code, filePath) {
        // Architecture fixes are complex and often require multi-file changes
        // For now, use LLM with architecture context
        return await this.generateArchitectureFixWithLLM(issue, code, filePath);
    }

    /**
     * Generate architecture fix using LLM
     */
    async generateArchitectureFixWithLLM(issue, code, filePath) {
        // Get project structure context
        const projectContext = await this.getProjectContext(filePath);

        const prompt = `You are an architecture expert. Fix this architectural issue:

ISSUE: ${issue.message}
FILE: ${filePath}
LINE: ${issue.line}

CODE:
\`\`\`javascript
${this.getCodeSnippet(code, issue.line || 1, 20)}
\`\`\`

${projectContext ? `PROJECT CONTEXT:\n${projectContext}\n\n` : ''}

ARCHITECTURE REQUIREMENTS:
1. Follow architectural best practices
2. Improve separation of concerns
3. Reduce coupling
4. Increase cohesion
5. Follow design patterns where appropriate
6. Improve dependency management
7. Maintain scalability

Generate an architectural fix in JSON format:
{
  "fixedCode": "the fixed code",
  "explanation": "architectural improvement explanation",
  "confidence": 0.0-1.0,
  "safety": "medium|risky",
  "changes": ["list of architectural changes"],
  "multiFile": false
}`;

        try {
            const llmService = require('./llmService');
            if (llmService.isAvailable()) {
                const response = await llmService.generateText(prompt, {
                    model: 'gpt-4o-mini',
                    temperature: 0.2,
                    maxTokens: 2000
                });

                const fix = llmFixGenerator.parseFixResponse(response, issue, code);
                if (fix.success) {
                    fix.method = 'architecture-llm';
                    fix.safety = 'medium'; // Architecture changes are riskier
                }
                return fix;
            }
        } catch (err) {
            console.warn('[Advanced Fix] LLM architecture fix failed:', err.message);
        }

        return { success: false, error: 'Could not generate architecture fix', confidence: 0 };
    }

    /**
     * Get project context
     */
    async getProjectContext(filePath) {
        try {
            const projectRoot = this.getProjectRoot(filePath);
            const packageJson = path.join(projectRoot, 'package.json');
            
            try {
                const pkg = JSON.parse(await fs.readFile(packageJson, 'utf8'));
                return `Project: ${pkg.name || 'unknown'}\nType: ${pkg.type || 
                    'commonjs'}\nDependencies: ${Object.keys(pkg.dependencies || {}).length}`;
            } catch (err) {
                return null;
            }
        } catch (err) {
            return null;
        }
    }

    /**
     * Get project root
     */
    getProjectRoot(filePath) {
        let current = path.dirname(filePath);
        const root = path.parse(filePath).root;
        
        while (current !== root) {
            try {
                if (require('fs').existsSync(path.join(current, 'package.json')) ||
                    require('fs').existsSync(path.join(current, '.git'))) {
                    return current;
                }
            } catch (err) {
                // Continue
            }
            current = path.dirname(current);
        }
        
        return path.dirname(filePath);
    }

    /**
     * Get code snippet
     */
    getCodeSnippet(code, line, contextLines = 10) {
        const lines = code.split('\n');
        const lineIndex = Math.max(0, line - 1);
        const start = Math.max(0, lineIndex - contextLines);
        const end = Math.min(lines.length, lineIndex + contextLines + 1);
        
        return lines.slice(start, end).join('\n');
    }
}

module.exports = new AdvancedFixGenerator();


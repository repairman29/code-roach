/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/cicdIntegration.js
 * Last Sync: 2025-12-14T07:30:45.670Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * CI/CD Integration Service
 * Integrates Code Roach with CI/CD pipelines for pre-commit hooks, PR analysis, and deployment gates
 */

const codeReviewAssistant = require('./codeReviewAssistant');
const securityAutoFix = require('./securityAutoFix');
const performanceOptimizer = require('./performanceOptimizer');
const codeHealthScoring = require('./codeHealthScoring');
const errorPredictionService = require('./errorPredictionService');

class CICDIntegration {
    constructor() {
        this.hooks = new Map();
    }

    /**
     * Analyze code changes for pre-commit hook
     */
    async analyzePreCommit(changes) {
        const results = {
            passed: true,
            errors: [],
            warnings: [],
            fixes: [],
            score: 100
        };

        for (const change of changes) {
            const { file, code, type } = change;

            // Skip deleted files
            if (type === 'deleted') continue;

            // Review code
            const review = await codeReviewAssistant.reviewCode(code, file, {
                checkStyle: true,
                checkSecurity: true,
                checkPerformance: true,
                checkBestPractices: true
            });

            if (review.success) {
                // Check for critical issues
                const criticalIssues = review.review.issues.filter(i => i.severity === 'critical');
                const highIssues = review.review.issues.filter(i => i.severity === 'high');

                if (criticalIssues.length > 0) {
                    results.passed = false;
                    results.errors.push({
                        file,
                        issues: criticalIssues,
                        message: `${criticalIssues.length} critical issue(s) found`
                    });
                }

                if (highIssues.length > 0) {
                    results.warnings.push({
                        file,
                        issues: highIssues,
                        message: `${highIssues.length} high priority issue(s) found`
                    });
                }

                // Update score
                results.score = Math.min(results.score, review.review.score);
            }

            // Check security vulnerabilities
            const vulnerabilities = await securityAutoFix.scanForVulnerabilities(code, file);
            const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
            if (criticalVulns.length > 0) {
                results.passed = false;
                results.errors.push({
                    file,
                    type: 'security',
                    issues: criticalVulns,
                    message: `${criticalVulns.length} critical security vulnerability(ies) found`
                });
            }

            // Check performance bottlenecks
            const bottlenecks = await performanceOptimizer.analyzePerformance(code, file);
            const highBottlenecks = bottlenecks.filter(b => b.severity === 'high');
            if (highBottlenecks.length > 0) {
                results.warnings.push({
                    file,
                    type: 'performance',
                    issues: highBottlenecks,
                    message: `${highBottlenecks.length} high priority performance issue(s) found`
                });
            }
        }

        return results;
    }

    /**
     * Analyze pull request
     */
    async analyzePullRequest(prData) {
        const { files, title, description, author } = prData;

        const analysis = {
            prId: prData.id || prData.number,
            title,
            author,
            timestamp: Date.now(),
            overallScore: 100,
            files: [],
            summary: {
                totalFiles: files.length,
                issues: 0,
                warnings: 0,
                errors: 0
            },
            recommendations: [],
            canMerge: true,
            blockers: []
        };

        // Analyze each file
        for (const file of files) {
            const fileAnalysis = await this.analyzeFile(file);
            analysis.files.push(fileAnalysis);
            analysis.summary.issues += fileAnalysis.issues.length;
            analysis.summary.warnings += fileAnalysis.warnings.length;
            analysis.summary.errors += fileAnalysis.errors.length;

            // Update overall score
            analysis.overallScore = Math.min(analysis.overallScore, fileAnalysis.score);

            // Check for blockers
            if (fileAnalysis.blockers.length > 0) {
                analysis.canMerge = false;
                analysis.blockers.push(...fileAnalysis.blockers);
            }
        }

        // Generate recommendations
        analysis.recommendations = this.generatePRRecommendations(analysis);

        // Generate summary
        analysis.summaryText = this.generatePRSummary(analysis);

        return analysis;
    }

    /**
     * Analyze a single file in PR
     */
    async analyzeFile(file) {
        const { path, additions, deletions, patch } = file;

        const analysis = {
            path,
            additions,
            deletions,
            score: 100,
            issues: [],
            warnings: [],
            blockers: [],
            healthScore: null
        };

        // Extract code from patch
        const code = this.extractCodeFromPatch(patch);

        if (code) {
            // Get health score
            try {
                const healthScore = await codeHealthScoring.calculateHealthScore(path, code);
                analysis.healthScore = healthScore.overall;
                analysis.score = healthScore.overall;
            } catch (error) {
                // Ignore if file doesn't exist yet
            }

            // Review code
            const review = await codeReviewAssistant.reviewCode(code, path);
            if (review.success) {
                analysis.issues = review.review.issues.filter(i => 
                    i.severity === 'critical' || i.severity === 'high'
                );
                analysis.warnings = review.review.issues.filter(i => 
                    i.severity === 'medium' || i.severity === 'low'
                );
                analysis.score = Math.min(analysis.score, review.review.score);

                // Identify blockers
                const criticalIssues = review.review.issues.filter(i => i.severity === 'critical');
                if (criticalIssues.length > 0) {
                    analysis.blockers.push({
                        type: 'critical-issues',
                        count: criticalIssues.length,
                        message: `${criticalIssues.length} critical issue(s) must be fixed before merge`
                    });
                }
            }

            // Check security
            const vulnerabilities = await securityAutoFix.scanForVulnerabilities(code, path);
            const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical');
            if (criticalVulns.length > 0) {
                analysis.blockers.push({
                    type: 'security',
                    count: criticalVulns.length,
                    message: `${criticalVulns.length} critical security vulnerability(ies) must be fixed`
                });
                analysis.issues.push(...criticalVulns.map(v => ({
                    type: 'security',
                    severity: 'critical',
                    message: `${v.type} vulnerability`,
                    line: v.line
                })));
            }
        }

        return analysis;
    }

    /**
     * Check deployment gate
     */
    async checkDeploymentGate(metrics) {
        const {
            errorRate,
            errorCount,
            recentErrors,
            healthScores
        } = metrics;

        const gate = {
            canDeploy: true,
            reason: '',
            checks: [],
            recommendations: []
        };

        // Check error rate
        if (errorRate > 0.05) { // 5% error rate threshold
            gate.canDeploy = false;
            gate.reason = `Error rate too high: ${(errorRate * 100).toFixed(2)}%`;
            gate.checks.push({
                name: 'Error Rate',
                passed: false,
                value: `${(errorRate * 100).toFixed(2)}%`,
                threshold: '5%'
            });
        } else {
            gate.checks.push({
                name: 'Error Rate',
                passed: true,
                value: `${(errorRate * 100).toFixed(2)}%`
            });
        }

        // Check recent errors
        if (recentErrors && recentErrors.length > 10) {
            gate.canDeploy = false;
            gate.reason = `Too many recent errors: ${recentErrors.length}`;
            gate.checks.push({
                name: 'Recent Errors',
                passed: false,
                value: recentErrors.length,
                threshold: 10
            });
        } else {
            gate.checks.push({
                name: 'Recent Errors',
                passed: true,
                value: recentErrors?.length || 0
            });
        }

        // Check health scores
        if (healthScores && healthScores.length > 0) {
            const avgHealth = healthScores.reduce((sum, s) => sum + s, 0) / healthScores.length;
            if (avgHealth < 60) {
                gate.canDeploy = false;
                gate.reason = `Average code health too low: ${avgHealth.toFixed(1)}`;
                gate.checks.push({
                    name: 'Code Health',
                    passed: false,
                    value: avgHealth.toFixed(1),
                    threshold: 60
                });
            } else {
                gate.checks.push({
                    name: 'Code Health',
                    passed: true,
                    value: avgHealth.toFixed(1)
                });
            }
        }

        // Generate recommendations
        if (!gate.canDeploy) {
            gate.recommendations.push({
                priority: 'high',
                action: 'Fix critical issues before deployment',
                details: gate.reason
            });
        }

        return gate;
    }

    /**
     * Generate automated tests
     */
    async generateTests(code, filePath) {
        const prompt = `Generate unit tests for this code:

Code:
${code.substring(0, 2000)}

File: ${filePath}

Generate comprehensive unit tests covering:
1. Happy path scenarios
2. Error cases
3. Edge cases
4. Boundary conditions

Return only the test code, no explanations.`;

        try {
            const llmService = require('./llmService');
            const tests = await llmService.generateText(prompt, {
                model: 'gpt-4',
                temperature: 0.3,
                maxTokens: 1500
            });

            return {
                success: true,
                tests: tests.trim(),
                filePath: filePath.replace(/\.(js|ts|jsx|tsx)$/, '.test.$1')
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Extract code from git patch
     */
    extractCodeFromPatch(patch) {
        if (!patch) return null;

        // Extract added lines (starting with +)
        const addedLines = patch
            .split('\n')
            .filter(line => line.startsWith('+') && !line.startsWith('+++'))
            .map(line => line.substring(1))
            .join('\n');

        return addedLines || null;
    }

    /**
     * Generate PR recommendations
     */
    generatePRRecommendations(analysis) {
        const recommendations = [];

        if (analysis.summary.errors > 0) {
            recommendations.push({
                priority: 'high',
                title: 'Fix Critical Issues',
                description: `${analysis.summary.errors} critical issue(s) found. Must be fixed before merge.`
            });
        }

        if (analysis.summary.warnings > 0) {
            recommendations.push({
                priority: 'medium',
                title: 'Address Warnings',
                description: `${analysis.summary.warnings} warning(s) found. Consider fixing before merge.`
            });
        }

        if (analysis.overallScore < 70) {
            recommendations.push({
                priority: 'medium',
                title: 'Improve Code Quality',
                description: `Overall code quality score is ${analysis.overallScore}/100. Consider improvements.`
            });
        }

        return recommendations;
    }

    /**
     * Generate PR summary
     */
    generatePRSummary(analysis) {
        let summary = `Code Roach Analysis: `;

        if (analysis.canMerge) {
            summary += `✅ Ready to merge. `;
        } else {
            summary += `❌ Blocked. `;
        }

        summary += `Score: ${analysis.overallScore}/100. `;
        summary += `${analysis.summary.totalFiles} file(s) analyzed. `;
        summary += `${analysis.summary.errors} error(s), ${analysis.summary.warnings} warning(s).`;

        if (analysis.blockers.length > 0) {
            summary += ` Blockers: ${analysis.blockers.map(b => b.message).join(', ')}.`;
        }

        return summary;
    }
}

module.exports = new CICDIntegration();


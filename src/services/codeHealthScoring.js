/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/codeHealthScoring.js
 * Last Sync: 2025-12-19T23:29:57.554Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Predictive Code Health Scoring Service
 * Provides real-time health scores (0-100) for code files and modules
 */

const codebaseSearch = require('./codebaseSearch');
const errorHistoryService = require('./errorHistoryService');
const rootCauseAnalysis = require('./rootCauseAnalysis');
const securityAutoFix = require('./securityAutoFix');
const performanceOptimizer = require('./performanceOptimizer');

class CodeHealthScoring {
    constructor() {
        this.healthCache = new Map();
        this.cacheTTL = 300000; // 5 minutes
        this.scoringWeights = {
            errorRate: 0.30,      // 30% - How often errors occur
            complexity: 0.20,     // 20% - Code complexity
            security: 0.20,       // 20% - Security issues
            performance: 0.15,    // 15% - Performance issues
            maintainability: 0.15 // 15% - Code quality/maintainability
        };
    }

    /**
     * Calculate health score for a file or module
     */
    async calculateHealthScore(filePath, code = null) {
        try {
            // Check cache
            const cacheKey = `health_${filePath}`;
            const cached = this.healthCache.get(cacheKey);
            if (cached && (Date.now() - cached.timestamp) < this.cacheTTL) {
                return cached.score;
            }

            // Get code if not provided
            if (!code) {
                const fileContext = await codebaseSearch.getFileContext(filePath);
                code = fileContext ? fileContext.map(c => c.content).join('\n') : '';
            }

            // Calculate component scores
            const errorScore = await this.calculateErrorScore(filePath);
            const complexityScore = this.calculateComplexityScore(code);
            const securityScore = await this.calculateSecurityScore(code, filePath);
            const performanceScore = await this.calculatePerformanceScore(code, filePath);
            const maintainabilityScore = this.calculateMaintainabilityScore(code);

            // Weighted average
            const healthScore = Math.round(
                errorScore * this.scoringWeights.errorRate +
                complexityScore * this.scoringWeights.complexity +
                securityScore * this.scoringWeights.security +
                performanceScore * this.scoringWeights.performance +
                maintainabilityScore * this.scoringWeights.maintainability
            );

            const score = {
                overall: healthScore,
                components: {
                    errorRate: errorScore,
                    complexity: complexityScore,
                    security: securityScore,
                    performance: performanceScore,
                    maintainability: maintainabilityScore
                },
                grade: this.getGrade(healthScore),
                risk: this.getRiskLevel(healthScore),
                recommendations: await this.generateRecommendations({
                    errorScore,
                    complexityScore,
                    securityScore,
                    performanceScore,
                    maintainabilityScore
                }),
                timestamp: Date.now()
            };

            // Cache result
            this.healthCache.set(cacheKey, {
                score,
                timestamp: Date.now()
            });

            return score;
        } catch (error) {
            console.error('[Code Health Scoring] Error:', error);
            return {
                overall: 50,
                error: error.message,
                grade: 'C',
                risk: 'medium'
            };
        }
    }

    /**
     * Calculate error rate score (0-100)
     */
    async calculateErrorScore(filePath) {
        const history = errorHistoryService.history || [];
        const fileErrors = history.filter(e => 
            e.error?.source === filePath || 
            e.error?.file === filePath ||
            (e.error?.stack && e.error.stack.includes(filePath))
        );

        // More errors = lower score
        const errorCount = fileErrors.length;
        const recentErrors = fileErrors.filter(e => 
            Date.now() - e.timestamp < 7 * 24 * 60 * 60 * 1000 // Last 7 days
        ).length;

        // Score calculation: 100 - (errors * 10), minimum 0
        const score = Math.max(0, 100 - (errorCount * 5) - (recentErrors * 10));
        return Math.min(100, score);
    }

    /**
     * Calculate complexity score (0-100)
     */
    calculateComplexityScore(code) {
        if (!code) return 50;

        let complexity = 0;

        // Cyclomatic complexity indicators
        const ifStatements = (code.match(/\bif\s*\(/g) || []).length;
        const loops = (code.match(/\b(for|while|do)\s*\(/g) || []).length;
        const switchCases = (code.match(/\bswitch\s*\(/g) || []).length;
        const catchBlocks = (code.match(/\bcatch\s*\(/g) || []).length;
        const functionCount = (code.match(/\bfunction\s+\w+|const\s+\w+\s*=\s*(async\s+)?\(/g) || []).length;

        complexity = ifStatements + loops + switchCases + catchBlocks;

        // Normalize by function count
        const avgComplexity = functionCount > 0 ? complexity / functionCount : complexity;

        // Score: lower complexity = higher score
        // 0-5 complexity = 100, 6-10 = 80, 11-15 = 60, 16-20 = 40, 21+ = 20
        let score = 100;
        if (avgComplexity > 20) score = 20;
        else if (avgComplexity > 15) score = 40;
        else if (avgComplexity > 10) score = 60;
        else if (avgComplexity > 5) score = 80;

        return score;
    }

    /**
     * Calculate security score (0-100)
     */
    async calculateSecurityScore(code, filePath) {
        if (!code) return 50;

        try {
            const vulnerabilities = await securityAutoFix.scanForVulnerabilities(code, filePath);
            const criticalVulns = vulnerabilities.filter(v => v.severity === 'critical').length;
            const highVulns = vulnerabilities.filter(v => v.severity === 'high').length;
            const mediumVulns = vulnerabilities.filter(v => v.severity === 'medium').length;

            // Score calculation: 100 - (critical * 30) - (high * 15) - (medium * 5)
            const score = Math.max(0, 100 - (criticalVulns * 30) - (highVulns * 15) - (mediumVulns * 5));
            return Math.min(100, score);
        } catch (error) {
            return 50; // Default if scan fails
        }
    }

    /**
     * Calculate performance score (0-100)
     */
    async calculatePerformanceScore(code, filePath) {
        if (!code) return 50;

        try {
            const bottlenecks = await performanceOptimizer.analyzePerformance(code, filePath);
            const highSeverity = bottlenecks.filter(b => b.severity === 'high').length;
            const mediumSeverity = bottlenecks.filter(b => b.severity === 'medium').length;

            // Score calculation: 100 - (high * 20) - (medium * 10)
            const score = Math.max(0, 100 - (highSeverity * 20) - (mediumSeverity * 10));
            return Math.min(100, score);
        } catch (error) {
            return 50; // Default if analysis fails
        }
    }

    /**
     * Calculate maintainability score (0-100)
     */
    calculateMaintainabilityScore(code) {
        if (!code) return 50;

        let score = 100;

        // Check for code smells
        const longLines = code.split('\n').filter(line => line.length > 120).length;
        const totalLines = code.split('\n').length;
        const longLineRatio = totalLines > 0 ? longLines / totalLines : 0;

        // Deduct for long lines
        score -= longLineRatio * 20;

        // Check for comments
        const commentLines = (code.match(/\/\/|\/\*|\*\//g) || []).length;
        const commentRatio = totalLines > 0 ? commentLines / totalLines : 0;
        score += commentRatio * 10; // Bonus for comments

        // Check for consistent formatting
        const inconsistentIndentation = (code.match(/^\s{1,3}[^\s]|^\s{5,7}[^\s]/gm) || []).length;
        const inconsistentRatio = totalLines > 0 ? inconsistentIndentation / totalLines : 0;
        score -= inconsistentRatio * 15;

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Get grade from score
     */
    getGrade(score) {
        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    }

    /**
     * Get risk level from score
     */
    getRiskLevel(score) {
        if (score >= 80) return 'low';
        if (score >= 60) return 'medium';
        if (score >= 40) return 'high';
        return 'critical';
    }

    /**
     * Generate recommendations based on scores
     */
    async generateRecommendations(scores) {
        const recommendations = [];

        if (scores.errorScore < 70) {
            recommendations.push({
                priority: 'high',
                category: 'errors',
                title: 'High Error Rate',
                description: `Error score is ${scores.errorScore}/100. This file has frequent errors.`,
                action: 'Review error history and fix root causes'
            });
        }

        if (scores.complexityScore < 70) {
            recommendations.push({
                priority: 'medium',
                category: 'complexity',
                title: 'High Complexity',
                description: `Complexity score is ${scores.complexityScore}/100. Code is too complex.`,
                action: 'Refactor to reduce cyclomatic complexity'
            });
        }

        if (scores.securityScore < 80) {
            recommendations.push({
                priority: 'high',
                category: 'security',
                title: 'Security Issues',
                description: `Security score is ${scores.securityScore}/100. Vulnerabilities detected.`,
                action: 'Run security scan and fix vulnerabilities'
            });
        }

        if (scores.performanceScore < 70) {
            recommendations.push({
                priority: 'medium',
                category: 'performance',
                title: 'Performance Issues',
                description: `Performance score is ${scores.performanceScore}/100. Bottlenecks detected.`,
                action: 'Optimize performance bottlenecks'
            });
        }

        if (scores.maintainabilityScore < 70) {
            recommendations.push({
                priority: 'low',
                category: 'maintainability',
                title: 'Maintainability Issues',
                description: `Maintainability score is ${scores.maintainabilityScore}/100.`,
                action: 'Improve code formatting and add comments'
            });
        }

        return recommendations;
    }

    /**
     * Get health scores for multiple files
     */
    async getBulkHealthScores(filePaths) {
        const scores = await Promise.all(
            filePaths.map(async (filePath) => {
                try {
                    const score = await this.calculateHealthScore(filePath);
                    return { filePath, ...score };
                } catch (error) {
                    return {
                        filePath,
                        overall: 50,
                        error: error.message
                    };
                }
            })
        );

        return {
            files: scores,
            average: scores.reduce((sum, s) => sum + (s.overall || 50), 0) / scores.length,
            lowest: scores.sort((a, b) => (a.overall || 50) - (b.overall || 50))[0],
            highest: scores.sort((a, b) => (b.overall || 50) - (a.overall || 50))[0]
        };
    }

    /**
     * Predict which files will have errors
     */
    async predictErrorRisk(filePath) {
        const healthScore = await this.calculateHealthScore(filePath);
        const riskScore = 100 - healthScore.overall;

        return {
            filePath,
            riskScore,
            riskLevel: healthScore.risk,
            probability: `${riskScore}% chance of errors`,
            factors: Object.entries(healthScore.components)
                .filter(([_, score]) => score < 70)
                .map(([category, score]) => ({
                    category,
                    score,
                    impact: 'high'
                }))
        };
    }
}

module.exports = new CodeHealthScoring();


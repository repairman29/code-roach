/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixImpactPredictionService.js
 * Last Sync: 2025-12-20T22:26:03.331Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Impact Prediction Service
 * Predicts downstream effects of fixes to prevent cascade failures
 * 
 * Critical Missing Feature #1
 */

const dependencyAnalysisService = require('./dependencyAnalysisService');
const codebaseSearch = require('./codebaseSearch');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');

class FixImpactPredictionService {
    constructor() {
        // Only create Supabase client if credentials are available
        if (config.supabase.serviceRoleKey) {
            try {
                this.supabase = createClient(
                    config.supabase.url,
                    config.supabase.serviceRoleKey
                );
            } catch (error) {
                console.warn('[fixImpactPredictionService] Supabase not configured:', error.message);
                this.supabase = null;
            }
        } else {
            console.warn('[fixImpactPredictionService] Supabase credentials not configured. Service will be disabled.');
            this.supabase = null;
        }
    }

    /**
     * Predict impact of a fix before applying
     */
    async predictImpact(fix, context = {}) {
        const {
            filePath,
            originalCode,
            fixedCode,
            issue,
            projectId
        } = context;

        try {
            // 1. Analyze direct dependencies
            const dependencies = await this.analyzeDependencies(filePath, originalCode, fixedCode);
            
            // 2. Find files that import/use this file
            const dependentFiles = await this.findDependentFiles(filePath, projectId);
            
            // 3. Analyze code changes
            const codeChanges = this.analyzeCodeChanges(originalCode, fixedCode);
            
            // 4. Check historical impact patterns
            const historicalImpact = await this.getHistoricalImpact(filePath, codeChanges, projectId);
            
            // 5. Predict cascade effects
            const cascadeEffects = await this.predictCascadeEffects(
                filePath,
                dependencies,
                dependentFiles,
                codeChanges
            );
            
            // 6. Calculate risk score
            const riskScore = this.calculateRiskScore({
                dependencies,
                dependentFiles,
                codeChanges,
                historicalImpact,
                cascadeEffects
            });

            // 7. Generate impact report
            const impactReport = {
                filePath,
                riskScore,
                riskLevel: this.getRiskLevel(riskScore),
                affectedFiles: {
                    direct: dependencies.map(d => d.file),
                    indirect: cascadeEffects.map(e => e.file),
                    total: dependencies.length + cascadeEffects.length
                },
                breakingChanges: this.identifyBreakingChanges(codeChanges, dependencies),
                cascadeEffects,
                recommendations: this.generateRecommendations(riskScore, cascadeEffects),
                confidence: this.calculateConfidence(dependencies, historicalImpact)
            };

            return {
                success: true,
                impact: impactReport
            };
        } catch (error) {
            console.error('[Fix Impact Prediction] Error:', error);
            return {
                success: false,
                error: error.message,
                impact: {
                    riskScore: 0.5, // Default to medium risk if prediction fails
                    riskLevel: 'medium',
                    affectedFiles: { total: 0 },
                    recommendations: ['Unable to predict impact. Proceed with caution.']
                }
            };
        }
    }

    /**
     * Analyze dependencies of the file being fixed
     */
    async analyzeDependencies(filePath, originalCode, fixedCode) {
        try {
            // Get imports/exports from both versions
            const originalDeps = this.extractDependencies(originalCode, filePath);
            const fixedDeps = this.extractDependencies(fixedCode, filePath);
            
            // Find changed dependencies
            const changedDeps = this.findChangedDependencies(originalDeps, fixedDeps);
            
            // Get dependency details
            const dependencies = [];
            for (const dep of changedDeps) {
                const depFile = await this.resolveDependency(dep, filePath);
                if (depFile) {
                    dependencies.push({
                        file: depFile,
                        type: dep.type, // 'import', 'export', 'function', 'class'
                        change: dep.change, // 'added', 'removed', 'modified'
                        impact: this.assessDependencyImpact(dep)
                    });
                }
            }
            
            return dependencies;
        } catch (error) {
            console.warn('[Fix Impact Prediction] Error analyzing dependencies:', error);
            return [];
        }
    }

    /**
     * Extract dependencies from code
     */
    extractDependencies(code, filePath) {
        const deps = [];
        const ext = filePath.split('.').pop();
        
        // Extract imports
        const importRegex = /(?:import|require)\s+(?:.*\s+from\s+)?['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(code)) !== null) {
            deps.push({
                type: 'import',
                name: match[1],
                line: code.substring(0, match.index).split('\n').length
            });
        }
        
        // Extract exports
        const exportRegex = /export\s+(?:default\s+)?(?:function|class|const|let|var|interface|type|enum)\s+(\w+)/g;
        while ((match = exportRegex.exec(code)) !== null) {
            deps.push({
                type: 'export',
                name: match[1],
                line: code.substring(0, match.index).split('\n').length
            });
        }
        
        // Extract function/class definitions (potential exports)
        const functionRegex = /(?:function|class|const|let|var)\s+(\w+)\s*[=(]/g;
        while ((match = functionRegex.exec(code)) !== null) {
            deps.push({
                type: 'definition',
                name: match[1],
                line: code.substring(0, match.index).split('\n').length
            });
        }
        
        return deps;
    }

    /**
     * Find changed dependencies between original and fixed code
     */
    findChangedDependencies(originalDeps, fixedDeps) {
        const originalMap = new Map(originalDeps.map(d => [d.name, d]));
        const fixedMap = new Map(fixedDeps.map(d => [d.name, d]));
        
        const changed = [];
        
        // Find removed dependencies
        for (const [name, dep] of originalMap) {
            if (!fixedMap.has(name)) {
                changed.push({ ...dep, change: 'removed' });
            }
        }
        
        // Find added dependencies
        for (const [name, dep] of fixedMap) {
            if (!originalMap.has(name)) {
                changed.push({ ...dep, change: 'added' });
            }
        }
        
        // Find modified dependencies (same name, different type or location)
        for (const [name, originalDep] of originalMap) {
            const fixedDep = fixedMap.get(name);
            if (fixedDep && (originalDep.type !== fixedDep.type || originalDep.line !== fixedDep.line)) {
                changed.push({ ...originalDep, change: 'modified', newType: fixedDep.type });
            }
        }
        
        return changed;
    }

    /**
     * Resolve dependency to actual file path
     */
    async resolveDependency(dep, baseFilePath) {
        try {
            if (dep.type === 'import') {
                // Try to resolve import path
                const path = require('path');
                const baseDir = path.dirname(baseFilePath);
                const resolved = path.resolve(baseDir, dep.name);
                
                // Check if file exists
                const fs = require('fs').promises;
                try {
                    await fs.access(resolved);
                    return resolved;
                } catch {
                    // Try with extensions
                    for (const ext of ['.js', '.ts', '.jsx', '.tsx']) {
                        try {
                            const withExt = resolved + ext;
                            await fs.access(withExt);
                            return withExt;
                        } catch {}
                    }
                }
            }
            
            // For exports/definitions, return base file
            return baseFilePath;
        } catch (error) {
            return null;
        }
    }

    /**
     * Find files that depend on the file being fixed
     */
    async findDependentFiles(filePath, projectId) {
        try {
            // Use codebase search to find files that import this file
            const fileName = require('path').basename(filePath, require('path').extname(filePath));
            const searchQuery = `files that import or require ${fileName}`;
            
            const results = await codebaseSearch.semanticSearch(searchQuery, {
                limit: 50,
                threshold: 0.6
            });
            
            // Filter to actual dependent files
            const dependentFiles = [];
            for (const result of results.results || []) {
                if (result.file_path && result.file_path !== filePath) {
                    dependentFiles.push({
                        file: result.file_path,
                        relevance: result.score,
                        reason: 'imports or uses this file'
                    });
                }
            }
            
            return dependentFiles;
        } catch (error) {
            console.warn('[Fix Impact Prediction] Error finding dependent files:', error);
            return [];
        }
    }

    /**
     * Analyze code changes between original and fixed
     */
    analyzeCodeChanges(originalCode, fixedCode) {
        const changes = {
            linesAdded: 0,
            linesRemoved: 0,
            functionsAdded: 0,
            functionsRemoved: 0,
            functionsModified: 0,
            classesAdded: 0,
            classesRemoved: 0,
            exportsChanged: 0,
            importsChanged: 0,
            breakingChanges: []
        };
        
        // Simple line-based diff
        const originalLines = originalCode.split('\n');
        const fixedLines = fixedCode.split('\n');
        
        // Count function/class changes
        const originalFunctions = (originalCode.match(/(?:function|const|let|var)\s+\w+\s*[=(]/g) || []).length;
        const fixedFunctions = (fixedCode.match(/(?:function|const|let|var)\s+\w+\s*[=(]/g) || []).length;
        
        changes.functionsAdded = Math.max(0, fixedFunctions - originalFunctions);
        changes.functionsRemoved = Math.max(0, originalFunctions - fixedFunctions);
        
        // Count class changes
        const originalClasses = (originalCode.match(/class\s+\w+/g) || []).length;
        const fixedClasses = (fixedCode.match(/class\s+\w+/g) || []).length;
        
        changes.classesAdded = Math.max(0, fixedClasses - originalClasses);
        changes.classesRemoved = Math.max(0, originalClasses - fixedClasses);
        
        // Detect breaking changes
        if (changes.functionsRemoved > 0 || changes.classesRemoved > 0) {
            changes.breakingChanges.push('Functions or classes removed');
        }
        
        const originalExports = (originalCode.match(/export\s+/g) || []).length;
        const fixedExports = (fixedCode.match(/export\s+/g) || []).length;
        if (originalExports !== fixedExports) {
            changes.exportsChanged = Math.abs(originalExports - fixedExports);
            changes.breakingChanges.push('Export signature changed');
        }
        
        return changes;
    }

    /**
     * Get historical impact data
     */
    async getHistoricalImpact(filePath, codeChanges, projectId) {
        if (!this.supabase) return null;
        
        try {
            // Query similar fixes from history
            const { data, error } = await this.supabase
                .from('code_roach_issues')
                .select('*, code_roach_fix_learning(*)')
                .eq('error_file', filePath)
                .not('fix_success', 'is', null)
                .order('created_at', { ascending: false })
                .limit(10);
            
            if (error || !data) return null;
            
            // Analyze historical success/failure rates
            const successful = data.filter(i => i.fix_success === true);
            const failed = data.filter(i => i.fix_success === false);
            
            // Check for cascade failures
            const cascadeFailures = data.filter(i => 
                i.metadata?.cascade_failures && i.metadata.cascade_failures.length > 0
            );
            
            return {
                totalFixes: data.length,
                successRate: successful.length / data.length,
                cascadeFailureRate: cascadeFailures.length / data.length,
                avgAffectedFiles: cascadeFailures.reduce((sum, f) => 
                    sum + (f.metadata?.cascade_failures?.length || 0), 0) / (cascadeFailures.length || 1)
            };
        } catch (error) {
            console.warn('[Fix Impact Prediction] Error getting historical impact:', error);
            return null;
        }
    }

    /**
     * Predict cascade effects
     */
    async predictCascadeEffects(filePath, dependencies, dependentFiles, codeChanges) {
        const cascadeEffects = [];
        
        // For each dependent file, predict impact
        for (const depFile of dependentFiles) {
            const impact = await this.predictFileImpact(depFile.file, codeChanges, filePath);
            if (impact.risk > 0.3) {
                cascadeEffects.push({
                    file: depFile.file,
                    risk: impact.risk,
                    reason: impact.reason,
                    affectedExports: impact.affectedExports,
                    affectedImports: impact.affectedImports
                });
            }
        }
        
        return cascadeEffects;
    }

    /**
     * Predict impact on a specific file
     */
    async predictFileImpact(filePath, codeChanges, sourceFilePath) {
        try {
            const fs = require('fs').promises;
            const fileContent = await fs.readFile(filePath, 'utf8');
            
            // Check if file imports from source
            const sourceName = require('path').basename(sourceFilePath, require('path').extname(sourceFilePath));
            const importsSource = fileContent.includes(sourceName) || 
                                 fileContent.includes(require('path').basename(sourceFilePath));
            
            if (!importsSource) {
                return { risk: 0, reason: 'No direct dependency' };
            }
            
            // Calculate risk based on code changes
            let risk = 0;
            const reasons = [];
            
            if (codeChanges.exportsChanged > 0) {
                risk += 0.4;
                reasons.push('Export signature changed');
            }
            
            if (codeChanges.functionsRemoved > 0) {
                risk += 0.3;
                reasons.push('Functions removed');
            }
            
            if (codeChanges.classesRemoved > 0) {
                risk += 0.5;
                reasons.push('Classes removed');
            }
            
            return {
                risk: Math.min(1, risk),
                reason: reasons.join(', ') || 'Low risk',
                affectedExports: codeChanges.exportsChanged,
                affectedImports: codeChanges.importsChanged
            };
        } catch (error) {
            return { risk: 0.2, reason: 'Unable to analyze file' };
        }
    }

    /**
     * Calculate overall risk score
     */
    calculateRiskScore(factors) {
        const {
            dependencies,
            dependentFiles,
            codeChanges,
            historicalImpact,
            cascadeEffects
        } = factors;
        
        let risk = 0;
        
        // Base risk from code changes
        if (codeChanges.breakingChanges.length > 0) {
            risk += 0.3;
        }
        if (codeChanges.functionsRemoved > 0 || codeChanges.classesRemoved > 0) {
            risk += 0.2;
        }
        
        // Risk from dependencies
        if (dependencies.length > 5) {
            risk += 0.1;
        }
        
        // Risk from dependent files
        if (dependentFiles.length > 10) {
            risk += 0.2;
        }
        
        // Risk from cascade effects
        if (cascadeEffects.length > 0) {
            risk += Math.min(0.3, cascadeEffects.length * 0.05);
        }
        
        // Historical risk
        if (historicalImpact && historicalImpact.cascadeFailureRate > 0.2) {
            risk += 0.2;
        }
        
        return Math.min(1, risk);
    }

    /**
     * Get risk level from score
     */
    getRiskLevel(score) {
        if (score >= 0.7) return 'high';
        if (score >= 0.4) return 'medium';
        return 'low';
    }

    /**
     * Identify breaking changes
     */
    identifyBreakingChanges(codeChanges, dependencies) {
        const breaking = [];
        
        if (codeChanges.functionsRemoved > 0) {
            breaking.push(`${codeChanges.functionsRemoved} function(s) removed`);
        }
        
        if (codeChanges.classesRemoved > 0) {
            breaking.push(`${codeChanges.classesRemoved} class(es) removed`);
        }
        
        if (codeChanges.exportsChanged > 0) {
            breaking.push('Export signature changed');
        }
        
        const removedDeps = dependencies.filter(d => d.change === 'removed');
        if (removedDeps.length > 0) {
            breaking.push(`${removedDeps.length} dependency(ies) removed`);
        }
        
        return breaking;
    }

    /**
     * Generate recommendations based on impact
     */
    generateRecommendations(riskScore, cascadeEffects) {
        const recommendations = [];
        
        if (riskScore >= 0.7) {
            recommendations.push('HIGH RISK: Review all affected files before applying');
            recommendations.push('Consider applying fix in a separate branch first');
            recommendations.push('Run full test suite after applying');
        } else if (riskScore >= 0.4) {
            recommendations.push('MEDIUM RISK: Review dependent files');
            recommendations.push('Run tests for affected modules');
        } else {
            recommendations.push('LOW RISK: Safe to apply, but run basic tests');
        }
        
        if (cascadeEffects.length > 0) {
            recommendations.push(`${cascadeEffects.length} file(s) may be affected - review them`);
        }
        
        return recommendations;
    }

    /**
     * Calculate confidence in prediction
     */
    calculateConfidence(dependencies, historicalImpact) {
        let confidence = 0.5; // Base confidence
        
        // More dependencies analyzed = higher confidence
        if (dependencies.length > 0) {
            confidence += 0.2;
        }
        
        // Historical data available = higher confidence
        if (historicalImpact) {
            confidence += 0.3;
        }
        
        return Math.min(1, confidence);
    }

    /**
     * Assess dependency impact
     */
    assessDependencyImpact(dep) {
        if (dep.change === 'removed') return 'high';
        if (dep.change === 'modified') return 'medium';
        return 'low';
    }
}

module.exports = new FixImpactPredictionService();


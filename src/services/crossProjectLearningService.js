/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/crossProjectLearningService.js
 * Last Sync: 2025-12-15T16:06:58.602Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Cross-Project Learning Service (Enhanced)
 * Learn from multiple repositories to improve suggestions
 * IP Innovation #7: Federated Learning for Code Quality
 * 
 * Critical Missing Feature #4 (Enhanced)
 */

const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const codebaseSearch = require('./codebaseSearch');

class CrossProjectLearningService {
    constructor() {
        this.supabase = null;
        this.learnedPatterns = new Map();
        this.patternCache = new Map();
        this.cacheTTL = 3600000; // 1 hour
        
        if (config.supabase?.url && config.supabase?.serviceRoleKey) {
            this.supabase = createClient(
                config.supabase.url,
                config.supabase.serviceRoleKey
            );
        }
    }

    /**
     * Learn from multiple projects
     */
    async learnFromProjects(projectIds) {
        console.log(`[Cross-Project Learning] Learning from ${projectIds.length} projects...`);

        const allPatterns = [];
        
        for (const projectId of projectIds) {
            try {
                const patterns = await this.getProjectPatterns(projectId);
                allPatterns.push(...patterns);
            } catch (err) {
                console.warn(`[Cross-Project Learning] Error learning from ${projectId}:`, err);
            }
        }

        // Aggregate patterns
        const aggregated = this.aggregatePatterns(allPatterns);
        
        // Apply successful patterns
        await this.applySuccessfulPatterns(aggregated);

        return {
            projectsLearned: projectIds.length,
            patternsLearned: aggregated.length,
            patternsApplied: aggregated.filter(p => p.successRate > 0.8).length
        };
    }

    /**
     * Get patterns from a project
     */
    async getProjectPatterns(projectId) {
        // In a real implementation, this would query patterns from another project's database
        // For now, we'll use a shared patterns table with project_id
        
        if (!this.supabase) return [];

        try {
            const { data, error } = await this.supabase
                .from('code_roach_patterns')
                .select('*')
                .eq('project_id', projectId) // Would need to add project_id column
                .gt('success_count', 0)
                .order('success_count', { ascending: false })
                .limit(50);

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.warn('[Cross-Project Learning] Error getting project patterns:', err);
            return [];
        }
    }

    /**
     * Aggregate patterns from multiple projects
     */
    aggregatePatterns(patterns) {
        const patternMap = new Map();

        patterns.forEach(pattern => {
            const key = pattern.fingerprint || pattern.error_pattern?.type;
            if (!key) return;

            if (!patternMap.has(key)) {
                patternMap.set(key, {
                    fingerprint: key,
                    occurrences: 0,
                    successes: 0,
                    failures: 0,
                    projects: new Set(),
                    bestFix: null
                });
            }

            const aggregated = patternMap.get(key);
            aggregated.occurrences += pattern.occurrence_count || 0;
            aggregated.successes += pattern.success_count || 0;
            aggregated.failures += pattern.failure_count || 0;
            aggregated.projects.add(pattern.project_id);

            // Keep best fix (highest success rate)
            if (pattern.best_fix && (!aggregated.bestFix || 
                (pattern.success_count / pattern.occurrence_count) > 
                (aggregated.bestFix.successRate))) {
                aggregated.bestFix = {
                    ...pattern.best_fix,
                    successRate: pattern.success_count / pattern.occurrence_count
                };
            }
        });

        // Convert to array and calculate success rates
        return Array.from(patternMap.values()).map(p => ({
            ...p,
            projects: Array.from(p.projects),
            successRate: p.occurrences > 0 ? p.successes / p.occurrences : 0
        }));
    }

    /**
     * Apply successful patterns to current project
     */
    async applySuccessfulPatterns(patterns) {
        // Only apply patterns with high success rate across multiple projects
        const successfulPatterns = patterns.filter(p => 
            p.successRate > 0.8 && p.projects.length >= 2
        );

        for (const pattern of successfulPatterns) {
            await this.applyPattern(pattern);
        }
    }

    /**
     * Apply a learned pattern
     */
    async applyPattern(pattern) {
        // Store pattern for use in current project
        if (!this.supabase) return;

        try {
            await this.supabase
                .from('code_roach_patterns')
                .upsert({
                    fingerprint: pattern.fingerprint,
                    error_pattern: pattern.error_pattern || {},
                    best_fix: pattern.bestFix,
                    occurrence_count: pattern.occurrences,
                    success_count: pattern.successes,
                    failure_count: pattern.failures,
                    pattern_metadata: {
                        learnedFromProjects: pattern.projects,
                        crossProjectSuccessRate: pattern.successRate
                    }
                }, { onConflict: 'fingerprint' });
        } catch (err) {
            console.warn('[Cross-Project Learning] Error applying pattern:', err);
        }
    }

    /**
     * Share patterns with other projects (Enhanced)
     */
    async sharePatterns(projectId, patterns) {
        // Share successful patterns with other projects
        // This would be called periodically or on-demand
        
        if (!this.supabase) return;

        try {
            for (const pattern of patterns) {
                // Anonymize pattern data (privacy-preserving)
                const anonymized = this.anonymizePattern(pattern);
                
                await this.supabase
                    .from('code_roach_patterns')
                    .upsert({
                        ...anonymized,
                        project_id: projectId,
                        shared: true,
                        shared_at: new Date().toISOString(),
                        pattern_metadata: {
                            ...(pattern.pattern_metadata || {}),
                            shared: true,
                            anonymized: true
                        }
                    });
            }
        } catch (err) {
            console.error('[Cross-Project Learning] Error sharing patterns:', err);
        }
    }

    /**
     * Find similar fixes from other projects
     */
    async findSimilarFixes(issue, currentProjectId) {
        if (!this.supabase) return [];

        try {
            // Search for similar issues across all projects
            const { data, error } = await this.supabase
                .from('code_roach_issues')
                .select('*, code_roach_patterns(*)')
                .eq('error_type', issue.type || '')
                .eq('error_severity', issue.severity || '')
                .eq('fix_success', true)
                .not('fix_code', 'is', null)
                .order('fix_confidence', { ascending: false })
                .limit(20);

            if (error) throw error;

            // Filter and rank by similarity
            const similar = (data || [])
                .filter(d => {
                    // Exclude current project
                    // Would need project_id column: d.project_id !== currentProjectId
                    return true;
                })
                .map(d => ({
                    issue: d,
                    similarity: this.calculateSimilarity(issue, d),
                    successRate: d.fix_success ? 1 : 0,
                    confidence: d.fix_confidence || 0
                }))
                .filter(s => s.similarity > 0.6)
                .sort((a, b) => b.similarity - a.similarity);

            return similar;
        } catch (err) {
            console.warn('[Cross-Project Learning] Error finding similar fixes:', err);
            return [];
        }
    }

    /**
     * Calculate similarity between issues
     */
    calculateSimilarity(issue1, issue2) {
        let similarity = 0;
        let factors = 0;

        // Error type match
        if (issue1.type === issue2.error_type) {
            similarity += 0.3;
        }
        factors += 0.3;

        // Error severity match
        if (issue1.severity === issue2.error_severity) {
            similarity += 0.2;
        }
        factors += 0.2;

        // Error message similarity (simple)
        if (issue1.message && issue2.error_message) {
            const msg1 = issue1.message.toLowerCase();
            const msg2 = issue2.error_message.toLowerCase();
            const words1 = new Set(msg1.split(/\s+/));
            const words2 = new Set(msg2.split(/\s+/));
            const intersection = new Set([...words1].filter(x => words2.has(x)));
            const union = new Set([...words1, ...words2]);
            const jaccard = intersection.size / union.size;
            similarity += jaccard * 0.5;
        }
        factors += 0.5;

        return factors > 0 ? similarity / factors : 0;
    }

    /**
     * Anonymize pattern for sharing (privacy-preserving)
     */
    anonymizePattern(pattern) {
        const anonymized = { ...pattern };
        
        // Remove project-specific information
        delete anonymized.project_id;
        
        // Anonymize file paths (keep structure, remove specifics)
        if (anonymized.error_pattern?.file) {
            anonymized.error_pattern.file = this.anonymizeFilePath(anonymized.error_pattern.file);
        }
        
        // Remove sensitive code snippets (keep structure)
        if (anonymized.best_fix?.code) {
            anonymized.best_fix.code = this.anonymizeCode(anonymized.best_fix.code);
        }
        
        return anonymized;
    }

    /**
     * Anonymize file path (keep structure, remove specifics)
     */
    anonymizeFilePath(filePath) {
        // Replace specific names with placeholders
        return filePath
            .replace(/\/[^\/]+\//g, '/[project]/')
            .replace(/[a-zA-Z0-9_-]+\.(js|ts|jsx|tsx)/g, '[file].$1');
    }

    /**
     * Anonymize code (keep structure, remove specifics)
     */
    anonymizeCode(code) {
        // Remove variable names, keep structure
        // This is a simplified version - could be more sophisticated
        return code
            .replace(/\b[a-z][a-zA-Z0-9_]*\b/g, 'var')
            .substring(0, 200); // Limit length
    }

    /**
     * Get cross-project fix recommendations
     */
    async getCrossProjectRecommendations(issue, currentProjectId) {
        try {
            const similarFixes = await this.findSimilarFixes(issue, currentProjectId);
            
            if (similarFixes.length === 0) {
                return {
                    recommendations: [],
                    message: 'No similar fixes found in other projects'
                };
            }

            // Aggregate recommendations
            const recommendations = similarFixes.slice(0, 5).map(s => ({
                fix: s.issue.fix_code,
                confidence: s.confidence,
                similarity: s.similarity,
                successRate: s.successRate,
                source: `Learned from ${s.issue.error_file || 'other projects'}`,
                metadata: {
                    usedInProjects: 1, // Would track actual count
                    avgSuccessRate: s.successRate
                }
            }));

            return {
                recommendations,
                totalSimilar: similarFixes.length,
                bestMatch: recommendations[0]
            };
        } catch (error) {
            console.error('[Cross-Project Learning] Error getting recommendations:', error);
            return {
                recommendations: [],
                error: error.message
            };
        }
    }

    /**
     * Learn from all projects (federated learning)
     */
    async federatedLearning(projectIds = null) {
        try {
            if (!this.supabase) return { success: false, error: 'Database not available' };

            // Get all projects or specific ones
            let projectQuery = this.supabase
                .from('code_roach_projects')
                .select('id');

            if (projectIds) {
                projectQuery = projectQuery.in('id', projectIds);
            }

            const { data: projects, error } = await projectQuery;

            if (error) throw error;

            const projectIdsList = (projects || []).map(p => p.id);

            if (projectIdsList.length === 0) {
                return { success: false, error: 'No projects found' };
            }

            // Learn from all projects
            const result = await this.learnFromProjects(projectIdsList);

            return {
                success: true,
                ...result,
                federatedLearning: true
            };
        } catch (error) {
            console.error('[Cross-Project Learning] Error in federated learning:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get pattern marketplace (public patterns)
     */
    async getPatternMarketplace(limit = 50) {
        if (!this.supabase) return [];

        try {
            const { data, error } = await this.supabase
                .from('code_roach_patterns')
                .select('*')
                .eq('shared', true)
                .gt('success_count', 5) // Only successful patterns
                .order('success_count', { ascending: false })
                .limit(limit);

            if (error) throw error;

            // Calculate ratings and metrics
            return (data || []).map(pattern => ({
                ...pattern,
                rating: this.calculatePatternRating(pattern),
                usageCount: pattern.occurrence_count || 0,
                successRate: pattern.occurrence_count > 0 
                    ? (pattern.success_count || 0) / pattern.occurrence_count 
                    : 0
            }));
        } catch (error) {
            console.warn('[Cross-Project Learning] Error getting marketplace:', error);
            return [];
        }
    }

    /**
     * Calculate pattern rating
     */
    calculatePatternRating(pattern) {
        const successRate = pattern.occurrence_count > 0
            ? (pattern.success_count || 0) / pattern.occurrence_count
            : 0;
        
        const usageScore = Math.min(1, (pattern.occurrence_count || 0) / 100);
        
        // Weighted rating
        return (successRate * 0.7) + (usageScore * 0.3);
    }
}

module.exports = new CrossProjectLearningService();


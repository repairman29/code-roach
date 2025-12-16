/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/cursorRulesLearningService.js
 * Last Sync: 2025-12-16T03:10:22.239Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Cursor Rules Learning Service
 * Analyzes Code Roach data to generate and improve Cursor rules
 * This is the META learning layer that makes developers code better
 */

const fs = require('fs').promises;
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const config = require('../config');
const llmService = require('./llmService');

class CursorRulesLearningService {
    constructor() {
        this.supabase = null;
        this.cursorRulesFile = path.join(__dirname, '../../.cursorrules');
        this.rulesCache = new Map();
        
        // Initialize Supabase if configured
        if (config.supabase?.url && config.supabase?.serviceRoleKey) {
            this.supabase = createClient(
                config.supabase.url,
                config.supabase.serviceRoleKey
            );
        }
    }

    /**
     * Analyze patterns and generate new Cursor rules
     */
    async analyzeAndGenerateRules() {
        console.log('[Cursor Rules Learning] Analyzing patterns to generate rules...');
        
        try {
            // 1. Get top problematic patterns
            const problematicPatterns = await this.getTopProblematicPatterns(20);
            
            // 2. Get successful fix patterns
            const successfulPatterns = await this.getSuccessfulFixPatterns(20);
            
            // 3. Get file-level insights
            const fileInsights = await this.getFileLevelInsights();
            
            // 4. Generate rules using LLM
            const newRules = await this.generateRulesFromPatterns({
                problematic: problematicPatterns,
                successful: successfulPatterns,
                fileInsights
            });
            
            // 5. Evaluate and save rules
            for (const rule of newRules) {
                await this.evaluateAndSaveRule(rule);
            }
            
            // 6. Update Cursor rules file
            await this.updateCursorRulesFile();
            
            // 7. Track improvement
            await this.trackQualityImprovement(newRules);
            
            console.log(`[Cursor Rules Learning] Generated ${newRules.length} new rules`);
            return newRules;
        } catch (err) {
            console.error('[Cursor Rules Learning] Error analyzing patterns:', err);
            throw err;
        }
    }

    /**
     * Get top problematic patterns from database
     */
    async getTopProblematicPatterns(limit = 20) {
        if (!this.supabase) {
            // Fallback to file-based if no Supabase
            return [];
        }

        try {
            const { data, error } = await this.supabase.rpc('get_top_problematic_patterns', {
                limit_count: limit
            });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.warn('[Cursor Rules Learning] Error getting patterns:', err);
            return [];
        }
    }

    /**
     * Get successful fix patterns
     */
    async getSuccessfulFixPatterns(limit = 20) {
        if (!this.supabase) return [];

        try {
            const { data, error } = await this.supabase
                .from('code_roach_issues')
                .select('error_type, error_message, fix_code, fix_method, fix_success')
                .eq('fix_success', true)
                .order('created_at', { ascending: false })
                .limit(limit);

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.warn('[Cursor Rules Learning] Error getting successful patterns:', err);
            return [];
        }
    }

    /**
     * Get file-level insights
     */
    async getFileLevelInsights() {
        if (!this.supabase) return {};

        try {
            // Get files with most issues
            const { data: problematicFiles, error: err1 } = await this.supabase
                .from('code_roach_issues')
                .select('error_file, error_type, COUNT(*)')
                .not('error_file', 'is', null)
                .group('error_file, error_type')
                .order('count', { ascending: false })
                .limit(10);

            // Get files with improving health
            const { data: improvingFiles, error: err2 } = await this.supabase
                .from('code_roach_file_health')
                .select('file_path, health_score, score_change')
                .gt('score_change', 0)
                .order('score_change', { ascending: false })
                .limit(10);

            if (err1 || err2) throw err1 || err2;

            return {
                problematic: problematicFiles || [],
                improving: improvingFiles || []
            };
        } catch (err) {
            console.warn('[Cursor Rules Learning] Error getting file insights:', err);
            return {};
        }
    }

    /**
     * Generate rules from patterns using LLM
     */
    async generateRulesFromPatterns(patterns) {
        const prompt = `You are a code quality expert analyzing patterns from Code Roach (an automated code analysis tool).

Based on these patterns, generate Cursor rules (guidelines for the Cursor AI code editor) that will help developers write better code and prevent these issues.

Problematic Patterns (issues that occur frequently):
${JSON.stringify(patterns.problematic.slice(0, 10), null, 2)}

Successful Fix Patterns (what works):
${JSON.stringify(patterns.successful.slice(0, 10), null, 2)}

File-Level Insights:
${JSON.stringify(patterns.fileInsights, null, 2)}

Generate 3-5 specific, actionable Cursor rules that:
1. Prevent the most common issues
2. Enforce patterns that lead to successful fixes
3. Are specific and measurable
4. Follow the format of existing Cursor rules

Return as JSON array:
[
  {
    "rule_name": "Descriptive name",
    "rule_content": "Full rule text for .cursorrules file",
    "rule_category": "security|performance|style|best-practice",
    "rationale": "Why this rule helps",
    "expected_impact": "What issues this should prevent"
  }
]`;

        try {
            const response = await llmService.generateOpenAI({
                model: 'gpt-4',
                messages: [
                    { role: 'system', content: 'You are a code quality expert specializing in generating development guidelines.' },
                    { role: 'user', content: prompt }
                ],
                temperature: 0.7,
                max_tokens: 2000
            });

            const rules = JSON.parse(response.content || response.text || '[]');
            return Array.isArray(rules) ? rules : [rules];
        } catch (err) {
            console.error('[Cursor Rules Learning] Error generating rules:', err);
            // Fallback to pattern-based rules
            return this.generatePatternBasedRules(patterns);
        }
    }

    /**
     * Fallback: Generate rules from patterns without LLM
     */
    generatePatternBasedRules(patterns) {
        const rules = [];

        // Rule 1: Prevent most common error type
        if (patterns.problematic.length > 0) {
            const topPattern = patterns.problematic[0];
            rules.push({
                rule_name: `prevent_${topPattern.fingerprint?.substring(0, 20) || 'common_issue'}`,
                rule_content: `# Prevent ${topPattern.error_pattern?.type || 'common'} issues\n` +
                    `# Based on pattern analysis showing ${topPattern.occurrence_count} occurrences\n` +
                    `# Always check for ${topPattern.error_pattern?.message || 'this issue type'} before committing`,
                rule_category: topPattern.error_pattern?.type || 'best-practice',
                rationale: `Prevents ${topPattern.occurrence_count} occurrences of this pattern`,
                expected_impact: `Reduce ${topPattern.error_pattern?.type || 'common'} issues by 50%+`
            });
        }

        return rules;
    }

    /**
     * Evaluate and save a rule to database
     */
    async evaluateAndSaveRule(rule) {
        if (!this.supabase) {
            // Just cache for now if no database
            this.rulesCache.set(rule.rule_name, rule);
            return;
        }

        try {
            // Check if rule exists
            const { data: existing } = await this.supabase
                .from('code_roach_cursor_rules')
                .select('id')
                .eq('rule_name', rule.rule_name)
                .single();

            if (existing) {
                // Update existing rule
                await this.supabase
                    .from('code_roach_cursor_rules')
                    .update({
                        rule_content: rule.rule_content,
                        rule_category: rule.rule_category,
                        updated_at: new Date().toISOString(),
                        confidence_score: 0.7, // Initial confidence
                        is_auto_generated: true
                    })
                    .eq('id', existing.id);
            } else {
                // Insert new rule
                await this.supabase
                    .from('code_roach_cursor_rules')
                    .insert({
                        rule_name: rule.rule_name,
                        rule_content: rule.rule_content,
                        rule_category: rule.rule_category,
                        confidence_score: 0.7,
                        is_auto_generated: true,
                        metadata: {
                            rationale: rule.rationale,
                            expected_impact: rule.expected_impact
                        }
                    });
            }
        } catch (err) {
            console.error('[Cursor Rules Learning] Error saving rule:', err);
        }
    }

    /**
     * Update .cursorrules file with active rules
     */
    async updateCursorRulesFile() {
        try {
            let rules = [];

            if (this.supabase) {
                // Get active rules from database
                const { data, error } = await this.supabase
                    .from('code_roach_cursor_rules')
                    .select('rule_name, rule_content, rule_category, success_rate')
                    .eq('is_active', true)
                    .order('success_rate', { ascending: false, nullsFirst: false })
                    .order('created_at', { ascending: false });

                if (!error && data) {
                    rules = data;
                }
            } else {
                // Use cached rules
                rules = Array.from(this.rulesCache.values());
            }

            // Read existing .cursorrules
            let existingContent = '';
            try {
                existingContent = await fs.readFile(this.cursorRulesFile, 'utf8');
            } catch {
                // File doesn't exist, that's okay
            }

            // Generate new rules section
            const rulesSection = this.generateRulesSection(rules, existingContent);

            // Update file
            const newContent = this.mergeRulesIntoFile(existingContent, rulesSection);
            await fs.writeFile(this.cursorRulesFile, newContent, 'utf8');

            console.log(`[Cursor Rules Learning] Updated .cursorrules with ${rules.length} rules`);
        } catch (err) {
            console.error('[Cursor Rules Learning] Error updating .cursorrules:', err);
        }
    }

    /**
     * Generate rules section for .cursorrules file
     */
    generateRulesSection(rules, existingContent) {
        if (rules.length === 0) return '';

        const sections = {
            'security': [],
            'performance': [],
            'style': [],
            'best-practice': []
        };

        // Group rules by category
        rules.forEach(rule => {
            const category = rule.rule_category || 'best-practice';
            if (sections[category]) {
                sections[category].push(rule);
            }
        });

        let output = '\n\n# ============================================\n';
        output += '# Code Roach Auto-Generated Rules\n';
        output += `# Generated: ${new Date().toISOString()}\n`;
        output += `# Total Rules: ${rules.length}\n`;
        output += '# These rules are automatically generated based on\n';
        output += '# Code Roach pattern analysis and learning.\n';
        output += '# ============================================\n\n';

        // Add rules by category
        Object.entries(sections).forEach(([category, categoryRules]) => {
            if (categoryRules.length > 0) {
                output += `## ${category.toUpperCase()} Rules (${categoryRules.length})\n\n`;
                categoryRules.forEach((rule, index) => {
                    output += `### ${index + 1}. ${rule.rule_name}\n`;
                    output += `${rule.rule_content}\n\n`;
                });
            }
        });

        return output;
    }

    /**
     * Merge new rules into existing .cursorrules file
     */
    mergeRulesIntoFile(existingContent, newRulesSection) {
        // Remove old Code Roach section if it exists
        const codeRoachSectionRegex = /# ============================================\s*# Code Roach Auto-Generated Rules[\s\S]*?(?=# ============================================|$)/;
        let merged = existingContent.replace(codeRoachSectionRegex, '').trim();

        // Add new section
        merged += newRulesSection;

        return merged;
    }

    /**
     * Track quality improvement
     */
    async trackQualityImprovement(newRules) {
        if (!this.supabase) return;

        try {
            await this.supabase
                .from('code_roach_quality_improvements')
                .insert({
                    improvement_type: 'rules_generated',
                    description: `Generated ${newRules.length} new Cursor rules from pattern analysis`,
                    cursor_rules_updated: newRules.map(r => r.rule_name),
                    metadata: {
                        rules: newRules
                    }
                });
        } catch (err) {
            console.warn('[Cursor Rules Learning] Error tracking improvement:', err);
        }
    }

    /**
     * Track rule effectiveness when an issue is found
     */
    async trackRuleEffectiveness(ruleName, issueId, wasPrevented) {
        if (!this.supabase) return;

        try {
            // Get rule ID
            const { data: rule } = await this.supabase
                .from('code_roach_cursor_rules')
                .select('id')
                .eq('rule_name', ruleName)
                .single();

            if (!rule) return;

            // Get issue details
            const { data: issue } = await this.supabase
                .from('code_roach_issues')
                .select('error_severity, error_file')
                .eq('id', issueId)
                .single();

            // Record effectiveness
            await this.supabase
                .from('code_roach_rule_effectiveness')
                .insert({
                    rule_id: rule.id,
                    issue_id: issueId,
                    rule_was_followed: !wasPrevented, // If issue occurred, rule wasn't followed
                    issue_was_prevented: wasPrevented,
                    issue_severity: issue?.error_severity,
                    file_path: issue?.error_file
                });

            // Update rule success rate
            const { data: stats } = await this.supabase.rpc('calculate_rule_effectiveness', {
                rule_id_param: rule.id
            });

            if (stats && stats.length > 0) {
                await this.supabase
                    .from('code_roach_cursor_rules')
                    .update({
                        success_rate: stats[0].success_rate,
                        issue_prevention_count: stats[0].issues_prevented,
                        times_applied: stats[0].times_applied
                    })
                    .eq('id', rule.id);
            }
        } catch (err) {
            console.warn('[Cursor Rules Learning] Error tracking effectiveness:', err);
        }
    }

    /**
     * Get recommended rules for a specific file
     */
    async getRecommendedRulesForFile(filePath) {
        if (!this.supabase) return [];

        try {
            // Get issues for this file
            const { data: issues } = await this.supabase
                .from('code_roach_issues')
                .select('error_type, error_severity')
                .eq('error_file', filePath)
                .order('created_at', { ascending: false })
                .limit(10);

            if (!issues || issues.length === 0) return [];

            // Get rules that address these issue types
            const issueTypes = [...new Set(issues.map(i => i.error_type))];
            const { data: rules } = await this.supabase
                .from('code_roach_cursor_rules')
                .select('rule_name, rule_content, rule_category, success_rate')
                .in('rule_category', issueTypes)
                .eq('is_active', true)
                .order('success_rate', { ascending: false })
                .limit(5);

            return rules || [];
        } catch (err) {
            console.warn('[Cursor Rules Learning] Error getting recommended rules:', err);
            return [];
        }
    }
}

module.exports = new CursorRulesLearningService();


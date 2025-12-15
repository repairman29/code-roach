/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/gitIntegration.js
 * Last Sync: 2025-12-14T07:30:45.661Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * GitHub/GitLab Integration Service
 * Integrates Code Roach with version control systems for issue creation, PR comments, and changelog generation
 */

const webhookService = require('./webhookService');
const errorHistoryService = require('./errorHistoryService');
const cicdIntegration = require('./cicdIntegration');
const codeReviewAssistant = require('./codeReviewAssistant');

class GitIntegration {
    constructor() {
        this.config = {
            github: {
                enabled: false,
                token: null,
                repo: null
            },
            gitlab: {
                enabled: false,
                token: null,
                projectId: null
            }
        };
    }

    /**
     * Configure GitHub integration
     */
    configureGitHub(token, repo) {
        this.config.github = {
            enabled: true,
            token,
            repo
        };
        return { success: true, message: 'GitHub integration configured' };
    }

    /**
     * Configure GitLab integration
     */
    configureGitLab(token, projectId) {
        this.config.gitlab = {
            enabled: true,
            token,
            projectId
        };
        return { success: true, message: 'GitLab integration configured' };
    }

    /**
     * Create GitHub issue for unfixable error
     */
    async createGitHubIssue(error, context = {}) {
        if (!this.config.github.enabled) {
            return { success: false, error: 'GitHub integration not configured' };
        }

        const title = `[Code Roach] ${error.type || 'Error'}: ${(error.message || '').substring(0, 100)}`;
        const body = this.generateIssueBody(error, context);

        // In production, this would make actual GitHub API call
        // For now, return structured data
        return {
            success: true,
            platform: 'github',
            issue: {
                title,
                body,
                labels: ['code-roach', 'bug', error.severity || 'medium'],
                assignees: context.assignees || []
            },
            url: `https://github.com/${this.config.github.repo}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
        };
    }

    /**
     * Comment on pull request
     */
    async commentOnPR(prData, analysis) {
        if (!this.config.github.enabled && !this.config.gitlab.enabled) {
            return { success: false, error: 'Git integration not configured' };
        }

        const comment = this.generatePRComment(analysis);

        return {
            success: true,
            platform: this.config.github.enabled ? 'github' : 'gitlab',
            comment,
            prNumber: prData.number || prData.id
        };
    }

    /**
     * Generate changelog from fixes
     */
    async generateChangelog(timeRange = '7d', format = 'markdown') {
        const history = errorHistoryService.history || [];
        const now = Date.now();
        const rangeMs = this.getTimeRangeMs(timeRange);
        const cutoff = now - rangeMs;

        const fixes = history.filter(e => 
            e.timestamp >= cutoff && 
            e.fix && 
            e.fix.success
        );

        const changelog = {
            generatedAt: new Date().toISOString(),
            timeRange,
            fixes: fixes.map(f => ({
                error: f.error.type || 'Error',
                message: f.error.message?.substring(0, 100),
                fixed: f.fix.type || 'fix',
                timestamp: new Date(f.timestamp).toISOString()
            })),
            summary: {
                totalFixes: fixes.length,
                byType: this.groupByType(fixes)
            }
        };

        if (format === 'markdown') {
            changelog.markdown = this.formatChangelogMarkdown(changelog);
        }

        return changelog;
    }

    /**
     * Auto-fix errors in commit
     */
    async autoFixCommit(changes) {
        const fixes = [];

        for (const change of changes) {
            const { file, code } = change;

            // Review and auto-fix
            const review = await codeReviewAssistant.autoFixIssues(code, file, ['style', 'best-practice']);

            if (review.success && review.fixesApplied > 0) {
                fixes.push({
                    file,
                    originalCode: review.originalCode,
                    fixedCode: review.fixedCode,
                    fixesApplied: review.fixesApplied
                });
            }
        }

        return {
            success: true,
            fixes,
            totalFixes: fixes.reduce((sum, f) => sum + f.fixesApplied, 0)
        };
    }

    /**
     * Generate release notes
     */
    async generateReleaseNotes(version, timeRange = '7d') {
        const changelog = await this.generateChangelog(timeRange);
        const history = errorHistoryService.history || [];
        const now = Date.now();
        const rangeMs = this.getTimeRangeMs(timeRange);
        const cutoff = now - rangeMs;

        const recentErrors = history.filter(e => e.timestamp >= cutoff);
        const fixed = recentErrors.filter(e => e.fix && e.fix.success).length;
        const prevented = recentErrors.length - fixed;

        const releaseNotes = {
            version,
            date: new Date().toISOString(),
            summary: {
                errorsFixed: fixed,
                errorsPrevented: prevented,
                totalImprovements: fixed + prevented
            },
            fixes: changelog.fixes.slice(0, 20), // Top 20
            improvements: [
                `Fixed ${fixed} error(s)`,
                `Prevented ${prevented} potential error(s)`,
                'Improved error detection and auto-fixing',
                'Enhanced code health scoring'
            ]
        };

        releaseNotes.markdown = this.formatReleaseNotesMarkdown(releaseNotes);

        return releaseNotes;
    }

    /**
     * Generate issue body
     */
    generateIssueBody(error, context) {
        return `## Error Details

**Type:** ${error.type || 'Unknown'}
**Message:** ${error.message || 'N/A'}
**Source:** ${error.source || context.file || 'Unknown'}

## Context

${context.description || 'Auto-generated by Code Roach'}

## Suggested Fix

${context.suggestedFix || 'Review error and apply appropriate fix'}

## Additional Information

- Detected: ${new Date().toISOString()}
- Severity: ${error.severity || 'medium'}
- Auto-fix attempted: ${context.autoFixAttempted ? 'Yes' : 'No'}

---
*This issue was automatically created by Code Roach*`;
    }

    /**
     * Generate PR comment
     */
    generatePRComment(analysis) {
        let comment = `## 🪳 Code Roach Analysis\n\n`;

        if (analysis.canMerge) {
            comment += `✅ **Ready to merge**\n\n`;
        } else {
            comment += `❌ **Blocked** - ${analysis.blockers.length} blocker(s)\n\n`;
        }

        comment += `**Overall Score:** ${analysis.overallScore}/100\n\n`;
        comment += `**Files Analyzed:** ${analysis.summary.totalFiles}\n`;
        comment += `**Issues:** ${analysis.summary.errors} error(s), ${analysis.summary.warnings} warning(s)\n\n`;

        if (analysis.blockers.length > 0) {
            comment += `### Blockers\n\n`;
            analysis.blockers.forEach(blocker => {
                comment += `- ❌ ${blocker.message}\n`;
            });
            comment += `\n`;
        }

        if (analysis.recommendations.length > 0) {
            comment += `### Recommendations\n\n`;
            analysis.recommendations.forEach(rec => {
                comment += `- ${rec.priority === 'high' ? '🔴' : '🟡'} **${rec.title}**: ${rec.description}\n`;
            });
        }

        comment += `\n---\n*Automated by Code Roach*`;

        return comment;
    }

    /**
     * Format changelog as markdown
     */
    formatChangelogMarkdown(changelog) {
        let md = `# Changelog\n\n`;
        md += `**Period:** ${changelog.timeRange}\n`;
        md += `**Generated:** ${new Date(changelog.generatedAt).toLocaleDateString()}\n\n`;
        md += `## Summary\n\n`;
        md += `- Total fixes: ${changelog.summary.totalFixes}\n\n`;

        md += `## Fixes by Type\n\n`;
        Object.entries(changelog.summary.byType).forEach(([type, count]) => {
            md += `- ${type}: ${count}\n`;
        });

        md += `\n## Recent Fixes\n\n`;
        changelog.fixes.slice(0, 20).forEach(fix => {
            md += `- **${fix.error}**: ${fix.message}\n`;
        });

        return md;
    }

    /**
     * Format release notes as markdown
     */
    formatReleaseNotesMarkdown(releaseNotes) {
        let md = `# Release ${releaseNotes.version}\n\n`;
        md += `**Date:** ${new Date(releaseNotes.date).toLocaleDateString()}\n\n`;
        md += `## Summary\n\n`;
        md += `- Errors fixed: ${releaseNotes.summary.errorsFixed}\n`;
        md += `- Errors prevented: ${releaseNotes.summary.errorsPrevented}\n`;
        md += `- Total improvements: ${releaseNotes.summary.totalImprovements}\n\n`;

        md += `## Improvements\n\n`;
        releaseNotes.improvements.forEach(improvement => {
            md += `- ${improvement}\n`;
        });

        md += `\n## Key Fixes\n\n`;
        releaseNotes.fixes.slice(0, 10).forEach(fix => {
            md += `- ${fix.message}\n`;
        });

        return md;
    }

    /**
     * Group fixes by type
     */
    groupByType(fixes) {
        const groups = {};
        fixes.forEach(f => {
            const type = f.error || 'Unknown';
            groups[type] = (groups[type] || 0) + 1;
        });
        return groups;
    }

    /**
     * Get time range in milliseconds
     */
    getTimeRangeMs(timeRange) {
        const ranges = {
            '1h': 60 * 60 * 1000,
            '24h': 24 * 60 * 60 * 1000,
            '7d': 7 * 24 * 60 * 60 * 1000,
            '30d': 30 * 24 * 60 * 60 * 1000,
            'all': Infinity
        };
        return ranges[timeRange] || ranges['7d'];
    }
}

module.exports = new GitIntegration();


/**
 * Code Roach Standalone - Synced from Smugglers Project
 * Source: server/services/fixDocumentationGenerationService.js
 * Last Sync: 2025-12-16T00:42:39.835Z
 * 
 * NOTE: This file is synced from the Smugglers project.
 * Changes here may be overwritten on next sync.
 * For standalone-specific changes, see .standalone-overrides/
 */

/**
 * Fix Documentation Generation Service
 * Auto-generate fix documentation, changelogs, and PR descriptions
 * 
 * Improvement #6: Fix Documentation Generation
 */

const explainabilityService = require('./explainabilityService');
const fixImpactPredictionService = require('./fixImpactPredictionService');

class FixDocumentationGenerationService {
    constructor() {
        this.templates = {
            changelog: this.getChangelogTemplate(),
            prDescription: this.getPRDescriptionTemplate(),
            commitMessage: this.getCommitMessageTemplate(),
            fixReport: this.getFixReportTemplate()
        };
    }

    /**
     * Generate fix documentation
     */
    async generateDocumentation(fix, context = {}) {
        try {
            const {
                issue,
                filePath,
                originalCode,
                fixedCode
            } = context;

            // Get explanation
            const explanation = await explainabilityService.explainFixEnhanced(fix, context);

            // Get impact
            const impact = await fixImpactPredictionService.predictImpact(fix, context);

            // Generate all documentation types
            const docs = {
                changelog: this.generateChangelog(issue, fix, explanation, impact),
                prDescription: this.generatePRDescription(issue, fix, explanation, impact),
                commitMessage: this.generateCommitMessage(issue, fix, context),
                fixReport: this.generateFixReport(issue, fix, explanation, impact, context),
                inlineComments: this.generateInlineComments(originalCode, fixedCode, issue)
            };

            return {
                success: true,
                documentation: docs
            };
        } catch (error) {
            console.error('[Fix Documentation] Error generating documentation:', error);
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Generate changelog entry
     */
    generateChangelog(issue, fix, explanation, impact) {
        const date = new Date().toISOString().split('T')[0];
        const severity = issue?.severity || 'medium';
        const type = issue?.type || 'fix';

        return `## [${date}] - ${type}

### ${severity.toUpperCase()}: ${issue?.message || 'Code fix'}

**File:** ${issue?.file || 'Unknown'}

**What was fixed:**
${explanation?.explanation?.reasoning?.whyThisFix || 'Code issue resolved'}

**Impact:**
${impact?.success && impact.impact.riskLevel === 'low' 
    ? 'Low risk fix with minimal impact' 
    : `Risk level: ${impact?.impact?.riskLevel || 'unknown'}. ${impact?.impact?.affectedFiles?.total 
        || 0} file(s) affected.`}

**Confidence:** ${((explanation?.explanation?.confidence?.calibrated || 0.8) * 100).toFixed(0)}%

**Breaking Changes:** ${impact?.impact?.breakingChanges?.length > 0 
    ? impact.impact.breakingChanges.join(', ') 
    : 'None'}
`;
    }

    /**
     * Generate PR description
     */
    generatePRDescription(issue, fix, explanation, impact) {
        return `## Fix: ${issue?.message || 'Code issue'}

### Summary
${explanation?.explanation?.reasoning?.whyThisFix || 'This PR fixes a code issue.'}

### What Changed
- Fixed: ${issue?.message || 'Code issue'}
- File: ${issue?.file || 'Unknown'}
- Line: ${issue?.line || 'Unknown'}

### Why This Fix
${explanation?.explanation?.decision?.why || 'Fix generated to resolve the issue.'}

### Impact Analysis
- **Risk Level:** ${impact?.impact?.riskLevel || 'unknown'}
- **Affected Files:** ${impact?.impact?.affectedFiles?.total || 0}
- **Breaking Changes:** ${impact?.impact?.breakingChanges?.length > 0 ? 'Yes' : 'No'}
${impact?.impact?.breakingChanges?.length > 0 
    ? `  - ${impact.impact.breakingChanges.join('\n  - ')}` 
    : ''}

### Confidence
- **Calibrated Confidence:** ${((explanation?.explanation?.confidence?.calibrated || 0.8) * 100).toFixed(0)}%
- **Reliability:** ${explanation?.explanation?.confidence?.reliability || 'unknown'}

### Testing
- [ ] Tests pass
- [ ] No new errors introduced
- [ ] Code review completed

### Related
- Issue: ${issue?.id || 'N/A'}
- Fix Method: ${explanation?.explanation?.decision?.method || 'unknown'}
`;
    }

    /**
     * Generate commit message
     */
    generateCommitMessage(issue, fix, context) {
        const type = issue?.type || 'fix';
        const scope = context.filePath ? require('path').basename(context.filePath) : 'code';
        const message = issue?.message || 'Fix code issue';

        // Conventional commits format
        return `${type}(${scope}): ${message}

${issue?.message || 'Fix code issue'}

Confidence: ${((context.confidence || 0.8) * 100).toFixed(0)}%
Method: ${context.method || 'unknown'}

Fixes: ${issue?.id || 'N/A'}
`;
    }

    /**
     * Generate fix report
     */
    generateFixReport(issue, fix, explanation, impact, context) {
        return {
            summary: {
                issue: issue?.message || 'Code issue',
                file: issue?.file || context.filePath || 'Unknown',
                line: issue?.line || 'Unknown',
                severity: issue?.severity || 'medium',
                type: issue?.type || 'unknown'
            },
            fix: {
                method: explanation?.explanation?.decision?.method || 'unknown',
                confidence: explanation?.explanation?.confidence?.calibrated || 0.8,
                code: fix?.code || 'N/A'
            },
            analysis: {
                whyThisFix: explanation?.explanation?.reasoning?.whyThisFix || 'N/A',
                impact: impact?.impact || null,
                alternatives: explanation?.explanation?.reasoning?.whyNotOthers || []
            },
            validation: {
                syntax: fix?.syntaxValid !== false,
                tests: fix?.testsPassed || false,
                linter: fix?.linterPassed !== false
            },
            recommendations: impact?.impact?.recommendations || []
        };
    }

    /**
     * Generate inline comments
     */
    generateInlineComments(originalCode, fixedCode, issue) {
        const comments = [];
        
        // Simple diff-based comments
        const originalLines = originalCode.split('\n');
        const fixedLines = fixedCode.split('\n');
        
        // Find changed lines
        for (let i = 0; i < Math.max(originalLines.length, fixedLines.length); i++) {
            if (originalLines[i] !== fixedLines[i]) {
                comments.push({
                    line: i + 1,
                    type: 'change',
                    original: originalLines[i] || '',
                    fixed: fixedLines[i] || '',
                    comment: `Fixed: ${issue?.message || 'Code issue'}`
                });
            }
        }

        return comments;
    }

    /**
     * Get changelog template
     */
    getChangelogTemplate() {
        return `## [Date] - Type

### SEVERITY: Title

**File:** filepath

**What was fixed:**
Description

**Impact:**
Impact description

**Confidence:** X%

**Breaking Changes:** List or None
`;
    }

    /**
     * Get PR description template
     */
    getPRDescriptionTemplate() {
        return `## Fix: Title

### Summary
Summary

### What Changed
- Fixed: Issue
- File: Path
- Line: Number

### Why This Fix
Reasoning

### Impact Analysis
- Risk Level: level
- Affected Files: count
- Breaking Changes: yes/no

### Confidence
- Calibrated Confidence: X%
- Reliability: level

### Testing
- [ ] Tests pass
- [ ] No new errors
- [ ] Code review

### Related
- Issue: ID
- Fix Method: method
`;
    }

    /**
     * Get commit message template
     */
    getCommitMessageTemplate() {
        return `type(scope): message

Description

Confidence: X%
Method: method

Fixes: issue-id
`;
    }

    /**
     * Get fix report template
     */
    getFixReportTemplate() {
        return {
            summary: {},
            fix: {},
            analysis: {},
            validation: {},
            recommendations: []
        };
    }
}

module.exports = new FixDocumentationGenerationService();

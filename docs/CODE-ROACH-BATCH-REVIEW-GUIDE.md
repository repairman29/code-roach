# Code Roach Batch Review & Learning Guide

## Overview

This guide explains how to review issues in batches and teach Code Roach to automatically fix and batch similar issues in the future.

---

## 🚀 Quick Start

### 1. View Report

```bash
npm run code-roach:review:report
```

### 2. Review Critical Issues

```bash
npm run code-roach:review:critical
```

### 3. Batch Review with Auto-Approval

```bash
npm run code-roach:review:batch
```

### 4. Interactive Review

```bash
npm run code-roach:review:interactive
```

---

## 📊 Batch Review Script

### Basic Usage

```bash
# Show report only
node scripts/batch-review-issues.js report

# Batch review with auto-approval
node scripts/batch-review-issues.js batch --auto-approve

# Batch review with auto-fix
node scripts/batch-review-issues.js batch --auto-approve --auto-fix

# Dry run (preview what would happen)
node scripts/batch-review-issues.js batch --dry-run

# Filter by severity
node scripts/batch-review-issues.js batch --severity critical

# Filter by type
node scripts/batch-review-issues.js batch --type security

# Interactive review
node scripts/batch-review-issues.js interactive
```

### Options

- `--auto-approve`: Automatically approve safe fixes
- `--auto-fix`: Automatically apply approved fixes
- `--dry-run`: Preview actions without making changes
- `--severity <level>`: Filter by severity (critical, high, medium, low)
- `--type <type>`: Filter by type (security, performance, style, best-practice)

---

## 🎓 Teaching Code Roach

### How Learning Works

When you review and fix issues, Code Roach learns:

1. **Fix Patterns**: Successful fixes are added to the knowledge base
2. **Batch Patterns**: Common batch processing patterns are learned
3. **Auto-Fix Rules**: Rules for automatically fixing similar issues
4. **Batch Rules**: Rules for automatically batching similar issues

### Learning Flow

```
Review Issue
    ↓
Apply Fix
    ↓
Record to Knowledge Base
    ↓
Learn Pattern
    ↓
Generate Auto-Fix Rule
    ↓
Code Roach Uses Rule Next Time
```

### Manual Learning

#### 1. Learn from Single Fix

```bash
curl -X POST http://localhost:3000/api/code-roach/learning/fix \
  -H "Content-Type: application/json" \
  -d '{
    "issue": {
      "type": "security",
      "message": "XSS vulnerability detected",
      "severity": "high",
      "file": "server/routes/api.js",
      "line": 123
    },
    "fix": {
      "code": "const sanitized = escapeHtml(userInput);",
      "type": "manual",
      "safety": "safe"
    },
    "filePath": "server/routes/api.js",
    "success": true,
    "confidence": 0.95,
    "method": "manual",
    "notes": "Fixed XSS by escaping user input"
  }'
```

#### 2. Learn from Batch

```bash
curl -X POST http://localhost:3000/api/code-roach/learning/batch \
  -H "Content-Type: application/json" \
  -d '{
    "issues": [...],
    "fixes": [...],
    "patterns": [
      {
        "name": "Auto-approve safe style fixes",
        "description": "Automatically approve style fixes with safety=safe",
        "criteria": {
          "type": "style",
          "hasFix": true,
          "safety": "safe"
        },
        "action": "auto-approve",
        "successRate": 95,
        "examples": [
          "Line length fixes",
          "Indentation fixes"
        ]
      }
    ],
    "metadata": {
      "reviewer": "developer",
      "batchId": "batch-001"
    }
  }'
```

---

## 🔄 Automatic Batching

### Generate Batch Rules

Code Roach can automatically batch similar issues based on learned patterns:

```bash
curl http://localhost:3000/api/code-roach/learning/batch/rules
```

### Auto-Batch Issues

```bash
curl -X POST http://localhost:3000/api/code-roach/learning/batch/auto \
  -H "Content-Type: application/json" \
  -d '{
    "issues": [...]
  }'
```

This will return batches grouped by learned patterns.

---

## 📈 Learning Statistics

### View Learning Stats

```bash
curl http://localhost:3000/api/code-roach/learning/stats
```

Returns:

- Fix learning statistics
- Knowledge base statistics
- Pattern counts
- Success rates

---

## 🎯 Best Practices

### 1. Review by Priority

Always review in this order:

1. **Critical** security issues
2. **High** severity issues
3. **Security** issues (any severity)
4. **Performance** issues
5. **Style/Best-practice** issues

### 2. Batch Similar Issues

Group similar issues together:

- Same type (e.g., all XSS fixes)
- Same file (e.g., all issues in one file)
- Same pattern (e.g., all line length fixes)

### 3. Add Notes

Always add notes when reviewing:

- Why you approved/rejected
- What the fix does
- Any context needed

### 4. Verify Fixes

Before auto-fixing:

- Review the fix code
- Test in a safe environment
- Verify it doesn't break anything

### 5. Learn Patterns

When you see the same issue multiple times:

- Create a batch pattern
- Teach Code Roach the pattern
- Let it auto-fix next time

---

## 🔧 Advanced Usage

### Custom Batch Processing

```javascript
const BatchReviewer = require("./scripts/batch-review-issues");
const batchLearningService = require("./server/services/batchLearningService");

// Get issues
const reviewer = new BatchReviewer();
const issues = await reviewer.getIssuesForReview();

// Prioritize
const prioritized = reviewer.prioritizeIssues(issues);

// Review and fix
for (const issue of prioritized) {
  // Your custom logic
  if (shouldAutoApprove(issue)) {
    await reviewer.reviewIssue(issue, "approve");
    if (issue.fix?.code) {
      await reviewer.applyFixAndLearn(issue, issue.fix.code, issue.error?.file);
    }
  }
}
```

### Create Batch Patterns

```javascript
const batchLearningService = require("./server/services/batchLearningService");

await batchLearningService.learnBatchPattern({
  name: "Auto-fix line length",
  description: "Automatically fix lines exceeding 120 characters",
  criteria: {
    type: "style",
    message: "exceeds 120 characters",
  },
  action: "auto-fix",
  successRate: 98,
  examples: [
    "Split long lines into multiple lines",
    "Extract variables for long expressions",
  ],
});
```

---

## 📝 Example Workflow

### Daily Review Workflow

```bash
# 1. Check what needs review
npm run code-roach:review:report

# 2. Review critical issues first
npm run code-roach:review:critical

# 3. Batch review safe fixes
npm run code-roach:review:batch --severity low --type style

# 4. Check learning stats
curl http://localhost:3000/api/code-roach/learning/stats
```

### Weekly Pattern Learning

```bash
# 1. Review all issues
npm run code-roach:review:interactive

# 2. Identify common patterns
# (Look for repeated issues)

# 3. Create batch patterns
# (Use API or script)

# 4. Verify auto-batching works
curl -X POST http://localhost:3000/api/code-roach/learning/batch/auto \
  -H "Content-Type: application/json" \
  -d '{"issues": [...]}'
```

---

## 🐛 Troubleshooting

### Issues Not Learning

1. Check confidence threshold (default: 0.7)
2. Verify fix was successful
3. Check knowledge base connection
4. Review server logs

### Auto-Batching Not Working

1. Check if patterns exist:

   ```bash
   curl http://localhost:3000/api/code-roach/learning/batch/rules
   ```

2. Verify pattern criteria match issues
3. Check pattern confidence scores

### Fixes Not Applying

1. Verify file permissions
2. Check file paths are correct
3. Review fix code syntax
4. Check server logs for errors

---

## 📚 Related Documentation

- [Code Roach Setup Guide](./CODE-ROACH-SETUP-GUIDE.md)
- [Code Roach Review Queue](./CODE-ROACH-REVIEW-QUEUE.md)
- [Code Roach Learning System](./SPRINT-1-SUMMARY.md)

---

## 🎉 Summary

**Batch Review Process:**

1. Review issues in batches
2. Apply fixes
3. Code Roach learns from fixes
4. Code Roach auto-fixes similar issues next time
5. Code Roach auto-batches similar issues

**Key Commands:**

- `npm run code-roach:review:report` - View report
- `npm run code-roach:review:critical` - Review critical
- `npm run code-roach:review:batch` - Batch review
- `npm run code-roach:review:interactive` - Interactive review

**Learning:**

- Fixes are automatically learned
- Patterns can be manually added
- Auto-batching uses learned patterns
- Statistics track learning progress

---

**Happy reviewing and teaching Code Roach!** 🪳📚

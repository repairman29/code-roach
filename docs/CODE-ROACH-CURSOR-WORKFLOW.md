# Code Roach + Cursor Workflow Guide

## 🚀 Combining CLI and Cursor for Fix & Deploy

This guide shows you how to use Code Roach CLI with Cursor to efficiently identify, fix, and deploy code improvements.

---

## Quick Start Workflow

### 1. Find Issues Needing Review

```bash
# Get issues and open them in Cursor
npm run code-roach issues --review --open --cursor
```

This will:
- ✅ Fetch issues needing review
- ✅ Display them in the terminal
- ✅ Automatically open files in Cursor at the problematic lines
- ✅ Group issues by file for efficient fixing

---

## Complete Workflow Examples

### Workflow 1: Review & Fix Issues

```bash
# Step 1: Get issues and open in Cursor
npm run code-roach issues --review --open --cursor

# Step 2: Fix issues in Cursor (files are already open at the right lines)
# Step 2a: Debug with Chrome DevTools (if needed)
#   - Open DevTools (F12)
#   - Check Console for errors (use 💡 AI insights)
#   - Use Network panel to verify API calls
#   - Use Sources panel for breakpoints if needed

# Step 3: Review and approve fixes
npm run code-roach issues --review <issue-id> --action approve --notes "Fixed in Cursor"
```

### Workflow 2: Auto-Fix & Review

```bash
# Step 1: Get issues, open in Cursor, and see what can be auto-fixed
npm run code-roach issues --review --open --cursor

# Step 2: Review auto-fixes in Cursor
# (Code Roach will show which issues have fixes available)

# Step 3: Apply fixes manually or approve auto-fixes
```

### Workflow 3: Fix & Deploy

```bash
# Step 1: Get issues and open in Cursor
npm run code-roach issues --review --open --cursor

# Step 2: Fix issues in Cursor

# Step 3: Commit and deploy
git add .
git commit -m "Code Roach fixes"
git push

# Step 4: Deploy (your deployment command)
```

---

## CLI Commands for Cursor Integration

### Open Issues in Cursor

```bash
# Open all issues needing review in Cursor
npm run code-roach issues --review --open --cursor

# Or use the short form
npm run code-roach issues --review --cursor

# Open specific severity issues
npm run code-roach issues --severity high --open --cursor

# Open issues from specific file
npm run code-roach issues --all --open --cursor
```

### Open in VS Code (Alternative)

```bash
npm run code-roach issues --review --open --code
```

### Workflow with Deployment

```bash
# Show deployment workflow after opening issues
npm run code-roach issues --review --open --cursor --deploy
```

---

## Advanced Workflows

### Batch Fix Multiple Files

```bash
# 1. Get all issues
npm run code-roach issues --review --open --cursor

# 2. In Cursor, use multi-cursor editing to fix similar issues
# 3. Review each file
# 4. Commit fixes
```

### Priority-Based Fixing

```bash
# 1. Fix critical issues first
npm run code-roach issues --severity critical --open --cursor

# 2. Then high severity
npm run code-roach issues --severity high --open --cursor

# 3. Then medium/low
npm run code-roach issues --review --open --cursor
```

### File-Specific Workflow

```bash
# 1. Get issues for a specific file pattern
npm run code-roach issues --all --open --cursor

# 2. Filter in terminal output, then open specific files
cursor --goto path/to/file.js:42
```

---

## Cursor Integration Features

### What Happens When You Use `--open --cursor`

1. **Fetches Issues**: Gets all issues needing review from the API
2. **Groups by File**: Organizes issues by file for efficient fixing
3. **Opens Files**: Automatically opens each file in Cursor
4. **Navigates to Line**: Jumps to the exact line number where the issue is
5. **Shows Issue Count**: Displays how many issues are in each file

### File Opening Behavior

- Opens up to 10 files at once (to avoid overwhelming)
- Jumps to the first issue's line number in each file
- Shows issue count per file in the terminal
- Handles missing files gracefully

---

## Deployment Integration

### Manual Deployment Workflow

```bash
# 1. Review and fix issues
npm run code-roach issues --review --open --cursor

# 2. Test fixes
npm test

# 3. Commit
git add .
git commit -m "Code Roach fixes: [describe fixes]"

# 4. Push
git push

# 5. Deploy (your deployment command)
# e.g., npm run deploy, vercel --prod, etc.
```

### Automated Deployment (Future)

```bash
# This will be available in future versions
npm run code-roach issues --review --open --cursor --fix --deploy
```

---

## Tips & Best Practices

### 1. Review Before Fixing

Always review issues in Cursor before applying fixes:
```bash
npm run code-roach issues --review --open --cursor
```

### 2. Fix by Priority

Start with critical/high severity issues:
```bash
npm run code-roach issues --severity critical --open --cursor
npm run code-roach issues --severity high --open --cursor
```

### 3. Batch Similar Fixes

Group similar issues and fix them together in Cursor using multi-cursor editing.

### 4. Test After Fixes

Always test after applying fixes:
```bash
npm test
```

### 5. Debug with Browser Debugging Service

When fixing issues, use automated browser debugging:

```javascript
const browserDebuggingService = require('./server/services/browserDebuggingService');

// Debug before fixing
const result = await browserDebuggingService.autoDebugAndDocument('http://localhost:3000', {
    headless: true,
    captureConsole: true,
    captureNetwork: true,
    documentFixes: true
});

// Check for errors
if (result.analysis.totalErrors > 0) {
    console.log('Errors found:', result.analysis.errorCategories);
    // Fix issues based on analysis
}
```

**CLI Alternative**:
```bash
npm run debug:browser http://localhost:3000 --headless --json
```

**API Alternative**:
```bash
curl -X POST http://localhost:3000/api/browser-debug/auto-debug \
  -H "Content-Type: application/json" \
  -d '{"url": "http://localhost:3000", "options": {"documentFixes": true}}'
```

**Full Guide**: See `docs/DEVTOOLS-PROGRAMMATIC-GUIDE.md`

### 6. Commit Meaningfully

Use descriptive commit messages:
```bash
git commit -m "Code Roach: Fix console.log statements and line length issues"
```

### 7. Verify with Automated Debugging Before Committing

Before committing, verify fixes work programmatically:

```javascript
// Automated verification
const result = await browserDebuggingService.autoDebugAndDocument('http://localhost:3000', {
    headless: true,
    captureConsole: true,
    captureNetwork: true
});

if (result.analysis.totalErrors > 0) {
    throw new Error(`Found ${result.analysis.totalErrors} errors - fix before committing`);
}
```

**CLI Alternative**:
```bash
npm run debug:browser http://localhost:3000 --headless --json > debug-report.json
if [ $(cat debug-report.json | jq '.analysis.totalErrors') -gt 0 ]; then
    echo "Errors found, fix before committing"
    exit 1
fi
```

---

## Keyboard Shortcuts in Cursor

While reviewing issues in Cursor:

- `Cmd+P` (Mac) / `Ctrl+P` (Win/Linux): Quick file open
- `Cmd+G` (Mac) / `Ctrl+G` (Win/Linux): Go to line
- `Cmd+Shift+F` (Mac) / `Ctrl+Shift+F` (Win/Linux): Search across files
- `Cmd+\` (Mac) / `Ctrl+\` (Win/Linux): Split editor

---

## Troubleshooting

### Files Not Opening

If files don't open in Cursor:

1. **Check Cursor is installed**: Make sure `cursor` command is available
   ```bash
   which cursor
   ```

2. **Try VS Code instead**:
   ```bash
   npm run code-roach issues --review --open --code
   ```

3. **Open manually**: Use the file paths shown in the terminal output

### Too Many Files Opening

If too many files open at once:

1. Use filters to reduce the number:
   ```bash
   npm run code-roach issues --severity high --open --cursor
   ```

2. Use limit:
   ```bash
   npm run code-roach issues --review --open --cursor --limit 5
   ```

### Editor Command Not Found

If you get "command not found":

1. Install Cursor command-line tools:
   - Open Cursor
   - `Cmd+Shift+P` → "Shell Command: Install 'cursor' command in PATH"

2. Or use full path:
   ```bash
   /Applications/Cursor.app/Contents/Resources/app/bin/cursor --goto file.js:42
   ```

---

## Example Session

```bash
# 1. Get issues and open in Cursor
$ npm run code-roach issues --review --open --cursor

🐛 Code Roach Issues
📋 Fetching issues needing review...

📋 Found 15 issue(s):

1. Issue ID: err_123
   Severity: HIGH | Type: security
   Error: SQL injection vulnerability
   File: server/routes/api.js:42

2. Issue ID: err_124
   Severity: MEDIUM | Type: style
   Error: Line exceeds 120 characters
   File: server/services/userService.js:88

...

🚀 Opening files in cursor...

   ✓ Opened: server/routes/api.js:42 (1 issue(s))
   ✓ Opened: server/services/userService.js:88 (2 issue(s))
   ...

# 2. Fix issues in Cursor (files are now open)

# 3. Review and approve
$ npm run code-roach issues --review err_123 --action approve --notes "Fixed SQL injection"
✅ Issue err_123 marked as approve

# 4. Commit and deploy
$ git add .
$ git commit -m "Code Roach: Fix security and style issues"
$ git push
```

---

## Next Steps

- **Automate the workflow**: Create shell scripts for common workflows
- **Integrate with CI/CD**: Add Code Roach checks to your pipeline
- **Set up auto-deployment**: Configure automatic deployment after fixes

---

**Happy fixing! 🚀**


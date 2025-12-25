# Code Roach Review Queue Guide

## How to Review and Action Issues from Cursor

Code Roach has multiple ways to review and action issues that need human review:

---

## Method 1: VS Code Extension (Recommended for Cursor)

### Access the Review Queue

1. **Open Command Palette** (`Cmd+Shift+P` on Mac, `Ctrl+Shift+P` on Windows/Linux)

2. **Run Command**: Type and select:

   ```
   Code Roach: Show Issues Needing Review
   ```

   Or use the command ID: `codeRoach.showIssues`

3. **Review Panel Opens**: A side panel will show all issues needing review with:
   - Issue details (file, line, message, severity)
   - Suggested fixes (if available)
   - Action buttons: **Approve**, **Reject**, **Defer**

### Actions Available

- **Approve**: Mark the issue as reviewed and approved (fix can be applied)
- **Reject**: Mark the issue as reviewed but rejected (won't auto-fix)
- **Defer**: Mark for later review

### Quick Actions

- Click on file paths to open files directly
- Review fix suggestions inline
- See severity and type badges

---

## Method 2: Command Line Interface (CLI)

### View Issues Needing Review

```bash
npm run code-roach issues --review
```

Or:

```bash
code-roach issues --review
```

### View All Issues with Filters

```bash
# All issues
code-roach issues

# Filter by severity
code-roach issues --severity high

# Filter by status
code-roach issues --status pending

# Filter by safety
code-roach issues --safety risky
```

### Mark Issue as Reviewed

```bash
code-roach issues --review --id <issue-id> --action approve
code-roach issues --review --id <issue-id> --action reject
code-roach issues --review --id <issue-id> --action defer
```

---

## Method 3: Web Dashboard

### Access Dashboard

1. Open browser to: `http://localhost:3000/code-roach-dashboard`

2. Navigate to **"Issues Needing Review"** section

3. Review and action issues directly in the browser

---

## Method 4: API Endpoints

### Get Issues for Review

```bash
curl http://localhost:3000/api/code-roach/issues/review
```

### Mark Issue as Reviewed

```bash
curl -X POST http://localhost:3000/api/code-roach/issues/<issue-id>/review \
  -H "Content-Type: application/json" \
  -d '{"action": "approve", "notes": "Looks good"}'
```

Actions: `approve`, `reject`, `defer`

---

## Keyboard Shortcuts (VS Code Extension)

You can add keyboard shortcuts in VS Code settings:

1. Open Keyboard Shortcuts (`Cmd+K Cmd+S`)
2. Search for `codeRoach.showIssues`
3. Add your preferred shortcut (e.g., `Cmd+Shift+R`)

---

## Workflow Recommendations

### Daily Review Workflow

1. **Morning**: Run `Code Roach: Show Issues Needing Review` in Cursor
2. **Review**: Go through critical/high severity issues first
3. **Action**: Approve safe fixes, reject risky ones, defer complex ones
4. **Monitor**: Check dashboard periodically for new issues

### Integration with Development

1. **Before Committing**: Review any pending issues
2. **After Auto-Fix**: Review what was auto-fixed
3. **Weekly**: Review deferred issues

---

## Issue Status Flow

```
Found by Crawler
    ↓
Auto-Fix Attempted?
    ├─ Yes → Success? → ✅ Auto-Fixed
    │         └─ No → ⚠️ Needs Review
    └─ No → ⚠️ Needs Review
            ↓
    Human Review
            ↓
    ├─ Approve → ✅ Fixed
    ├─ Reject → ❌ Ignored
    └─ Defer → 📋 Later
```

---

## Tips

1. **Prioritize by Severity**: Critical → High → Medium → Low
2. **Review Fixes Carefully**: Even "safe" fixes should be reviewed
3. **Use Notes**: Add notes when approving/rejecting for context
4. **Batch Review**: Review similar issues together
5. **Learn from Patterns**: If you see the same issue repeatedly, consider a broader fix

---

## Troubleshooting

### Extension Command Not Found

1. Reload Cursor window: `Cmd+Shift+P` → "Developer: Reload Window"
2. Check extension is installed and enabled
3. Verify server is running: `http://localhost:3000`

### No Issues Showing

1. Check if crawler has run: `code-roach crawl --status`
2. Verify issues exist: `code-roach issues`
3. Check API: `curl http://localhost:3000/api/code-roach/issues/review`

### Issues Not Updating

1. Refresh the review panel
2. Re-run the command
3. Check server logs for errors

---

## Example: Complete Review Session

```bash
# 1. Check what needs review
code-roach issues --review

# 2. Open in Cursor
# Cmd+Shift+P → "Code Roach: Show Issues Needing Review"

# 3. Review each issue
# - Click file path to open
# - Review suggested fix
# - Click Approve/Reject/Defer

# 4. Verify fixes applied
git status
git diff
```

---

**Need Help?** Check the dashboard at `http://localhost:3000/code-roach-dashboard` for detailed statistics and issue tracking.

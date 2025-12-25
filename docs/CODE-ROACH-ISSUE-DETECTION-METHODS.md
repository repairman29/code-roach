# Code Roach Issue Detection & Logging Methods

## Overview

Code Roach detects and stores issues through multiple methods. All issues are stored in the `code_roach_issues` table via the `issueStorageService`.

## Detection Methods

### 1. **File Watcher** (Real-time)

**Location**: `server/server.js` (lines ~1274-1324)

**How it works**:

- Monitors file changes in real-time
- When a file changes, calls `codebaseCrawler.analyzeFile()`
- Stores issues via `issueStorageService.storeIssues()`

**Code Flow**:

```javascript
// File changes → onFileChange callback
onFileChange: async (filePath) => {
  // Analyze the changed file
  const fileResult = await codebaseCrawler.analyzeFile(absolutePath, {
    autoFix: autoFix,
    projectId: projectId,
    skipUnchanged: false,
  });

  // Store issues if found
  if (fileResult && fileResult.issues && fileResult.issues.length > 0) {
    if (projectId) {
      await issueStorageService.storeIssues(issuesToStore, projectId);
    }
  }
};
```

**Configuration**:

- `CODE_ROACH_WATCH_MODE=true` - Enable file watcher
- `CODE_ROACH_WATCH_AUTO_FIX=true` - Auto-fix issues
- `CODE_ROACH_WATCH_DEBOUNCE_MS=1000` - Debounce delay
- `DEFAULT_PROJECT_ID` - Project ID to associate issues with

**Storage**:

- ✅ Issues stored with `projectId` if set
- ⚠️ Issues NOT stored if `projectId` is missing (only logged to console)

---

### 2. **Manual Crawl** (API Endpoint)

**Location**: `server/routes/codeRoachAPI.js` (POST `/api/code-roach/crawl`)

**How it works**:

- API endpoint accepts crawl request
- Calls `codebaseCrawler.crawlCodebase()`
- Issues stored at end of crawl if `projectId` provided

**Code Flow**:

```javascript
// POST /api/code-roach/crawl
const projectId = req.body.projectId || options.projectId || null;
options.projectId = projectId;

// Start crawl
codebaseCrawler.crawlCodebase(rootDir, options);
```

**Storage**:

- Issues stored in `crawlCodebase()` method (line ~873)
- Only stored if `options.projectId` is provided
- Uses `issueStorageService.storeIssues()` for each file's issues

---

### 3. **Autonomous Mode** (Automated Scans)

**Location**: `server/services/autonomousMode.js`

**How it works**:

- Runs scheduled scans at intervals
- Uses `codebaseCrawler.crawlCodebase()` for full scans
- Uses file watcher for real-time detection
- **FIXED**: Now stores issues directly via `issueStorageService.storeIssues()` when files change

**Code Flow**:

```javascript
// File watcher callback (FIXED - now stores issues)
async handleFileChange(filePath) {
    const fileResult = await codebaseCrawler.analyzeFile(absolutePath, {
        autoFix: this.config.autoApplyFixes,
        projectId: projectId
    });

    // Store issues directly
    if (fileResult && fileResult.issues && fileResult.issues.length > 0) {
        if (projectId) {
            await issueStorageService.storeIssues(issuesToStore, projectId);
        }
    }
}

// Scheduled scan
async runScheduledScan() {
    const result = await codebaseCrawler.crawlCodebase(rootDir, {
        autoFix: this.config.autoApplyFixes,
        projectId: this.config.projectId
    });
    // Issues stored by crawlCodebase() if projectId provided
}
```

**Configuration**:

- `CODE_ROACH_AUTONOMOUS_MODE=true` - Enable autonomous mode
- `CODE_ROACH_AUTONOMOUS_SCAN_INTERVAL=300000` - Scan every 5 minutes
- `DEFAULT_PROJECT_ID` - Project ID for issues

**Storage**:

- ✅ Issues stored directly via `issueStorageService.storeIssues()` when files change (FIXED)
- ✅ Issues stored via `crawlCodebase()` during scheduled scans if `projectId` configured
- ⚠️ Issues NOT stored if `projectId` missing (logged with warning)

---

### 4. **Scheduled Scans** (Cron-based)

**Location**: `server/server.js` (lines ~1350-1370)

**How it works**:

- Uses `node-cron` for scheduled scans
- Runs daily (or configured schedule)
- Calls `codebaseCrawler.crawlCodebase()`

**Code Flow**:

```javascript
cron.schedule(dailySchedule, async () => {
  await codebaseCrawler.crawlCodebase({
    autoFix: process.env.CODE_ROACH_SCHEDULED_AUTO_FIX === "true",
    projectId: process.env.DEFAULT_PROJECT_ID || null,
    rootDir: process.cwd(),
  });
});
```

**Configuration**:

- `CODE_ROACH_SCHEDULED_SCANS=true` - Enable scheduled scans
- `CODE_ROACH_SCHEDULE_DAILY=0 2 * * *` - Cron schedule (2 AM daily)
- `DEFAULT_PROJECT_ID` - Project ID for issues

**Storage**:

- ✅ Issues stored via `crawlCodebase()` if `projectId` configured
- ⚠️ Issues NOT stored if `projectId` missing

---

## Issue Storage Service

**Location**: `server/services/issueStorageService.js`

**Methods**:

- `storeIssue(issue, projectId)` - Store single issue
- `storeIssues(issues, projectId)` - Store multiple issues

**Auto-Resolution**:

- Issues with `type === 'auto-fixed'` are automatically marked as `review_status: 'resolved'`
- Issues with `fixApplied === true` are also marked as resolved

**Database Table**: `code_roach_issues`

---

## Critical Requirement: Project ID

**⚠️ IMPORTANT**: All detection methods require a `projectId` to store issues in the database.

**Without Project ID**:

- Issues are detected and logged to console
- Issues are NOT stored in database
- Dashboard shows crawl stats (issues found) but database has fewer issues

**With Project ID**:

- Issues are detected AND stored in database
- Issues are associated with the project
- Dashboard and issues page show matching counts

**How to Set Project ID**:

1. Set `DEFAULT_PROJECT_ID` in `.env` file
2. Pass `projectId` in API requests
3. Configure in autonomous mode config

---

## Current Issue: Missing Issues

**Problem**: Dashboard shows 55 issues, database has 52 issues.

**Cause**: Some scans ran without `projectId`, so issues were detected but not stored.

**Solution**:

1. ✅ Set `DEFAULT_PROJECT_ID` in `.env`
2. ✅ Restart server
3. 🔄 Run new scan to store missing issues
4. ✅ Dashboard now shows database count (52) instead of crawl stats (55)

---

## Detection Flow Summary

```
┌─────────────────────────────────────────────────────────┐
│                    Issue Detection                        │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        │                 │                 │
        ▼                 ▼                 ▼
   File Watcher    Manual Crawl    Autonomous/Scheduled
        │                 │                 │
        └─────────────────┼─────────────────┘
                          │
                          ▼
              codebaseCrawler.analyzeFile()
              or codebaseCrawler.crawlCodebase()
                          │
                          ▼
              fileResult.issues (array)
                          │
                          ▼
              issueStorageService.storeIssues()
                          │
                          ▼
              Database: code_roach_issues
```

---

## Best Practices

1. **Always Set Project ID**: Configure `DEFAULT_PROJECT_ID` in `.env`
2. **Verify Storage**: Check database after scans to ensure issues are stored
3. **Monitor Logs**: Watch console for "Stored X issue(s)" messages
4. **Check Dashboard**: Verify dashboard count matches database count
5. **Use File Watcher**: Enable for real-time issue detection
6. **Schedule Scans**: Use scheduled scans for comprehensive coverage

---

## Troubleshooting

### Issue: "Issues detected but not stored"

**Check**:

- Is `DEFAULT_PROJECT_ID` set in `.env`?
- Are logs showing "no projectId set"?
- Is project ID valid in database?

**Fix**:

- Set `DEFAULT_PROJECT_ID` in `.env`
- Restart server
- Re-run scan

### Issue: "Dashboard shows different count than database"

**Check**:

- Dashboard uses database count (should match)
- Old dashboard might show crawl stats (outdated)

**Fix**:

- Refresh dashboard
- Verify dashboard code uses `issuesData.total` from API

### Issue: "File watcher not storing issues"

**Check**:

- Is `CODE_ROACH_WATCH_MODE=true`?
- Is `DEFAULT_PROJECT_ID` set?
- Check console logs for errors

**Fix**:

- Verify environment variables
- Check file watcher logs
- Restart server

---

## Related Files

- **Issue Storage**: `server/services/issueStorageService.js`
- **File Watcher**: `server/services/codebaseWatcher.js`
- **Crawler**: `server/services/codebaseCrawler.js`
- **Autonomous Mode**: `server/services/autonomousMode.js`
- **Server Setup**: `server/server.js`
- **API Routes**: `server/routes/codeRoachAPI.js`

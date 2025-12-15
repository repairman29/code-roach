# Code Roach: Active vs Passive Detection

## 🔍 Current Status: **PASSIVE** (Monitoring Only)

Code Roach is currently running in **passive mode** - it's monitoring existing issues but **NOT actively crawling/indexing** to find new issues.

---

## 📊 What's Currently Running

### ✅ Active: Code Roach Alert Service
**Location:** `server/services/codeRoachAlerts.js`

**What it does:**
- ✅ Checks database every minute for critical issues
- ✅ Alerts on issues that are already in the database
- ✅ Monitors `code_roach_issues` table
- ❌ **Does NOT** detect new issues
- ❌ **Does NOT** crawl the codebase
- ❌ **Does NOT** scan files

**Status:** Running automatically when server starts

---

## 🚫 What's NOT Running Automatically

### 1. Codebase Crawler
**Location:** `server/services/codebaseCrawler.js`

**What it can do:**
- ✅ Scan entire codebase
- ✅ Find issues in bulk
- ✅ Auto-fix issues
- ✅ Generate fixes

**Status:** Available but **NOT running automatically**
- Must be triggered manually via API: `POST /api/code-roach/crawl`
- Or via script/CLI

### 2. Codebase Indexer
**Location:** `server/services/codebaseIndexer.js`

**What it can do:**
- ✅ Index codebase for semantic search
- ✅ Create embeddings
- ✅ Enable codebase-aware fixes

**Status:** Available but **NOT running automatically**
- Must be triggered manually
- Used by other services when needed

### 3. Codebase Watcher
**Location:** `server/services/codebaseWatcher.js`

**What it can do:**
- ✅ Watch files for changes
- ✅ Detect new issues on file changes
- ✅ Real-time issue detection

**Status:** Available but **NOT running automatically**

---

## 🎯 How Issues Get Into the Database

Currently, issues are added to the database through:

1. **Manual API calls** - When code is analyzed via API
2. **CLI tools** - When running Code Roach CLI commands
3. **GitHub Actions** - If configured
4. **Manual insertion** - Direct database inserts

**NOT through:**
- ❌ Automatic crawling
- ❌ File watching
- ❌ Scheduled scans

---

## 🚀 How to Enable Active Detection

### Option 1: Start Crawler Manually

**Via API:**
```bash
curl -X POST http://localhost:3000/api/code-roach/crawl \
  -H "Content-Type: application/json" \
  -d '{"autoFix": true, "reviewRequired": false}'
```

**Check status:**
```bash
curl http://localhost:3000/api/code-roach/crawl/status
```

### Option 2: Enable Automatic Crawling

**Add to `server/server.js`:**

```javascript
// After Code Roach alerts start
const codebaseCrawler = require('./services/codebaseCrawler');

// Start crawler on server start (optional)
if (process.env.CODE_ROACH_AUTO_CRAWL === 'true') {
    codebaseCrawler.crawlCodebase(process.cwd(), {
        autoFix: true,
        reviewRequired: false
    }).catch(err => {
        console.error('Crawler error:', err);
    });
}
```

### Option 3: Enable File Watching

**Add to `server/server.js`:**

```javascript
const codebaseWatcher = require('./services/codebaseWatcher');

// Start watcher
codebaseWatcher.start({
    watchDirs: ['server', 'public'],
    onFileChange: async (filePath) => {
        // Analyze file and detect issues
        const issues = await codeReviewAssistant.analyzeFile(filePath);
        // Save to database
    }
});
```

### Option 4: Scheduled Crawling

**Add cron job or scheduled task:**

```javascript
// Run crawler every 6 hours
setInterval(() => {
    codebaseCrawler.crawlCodebase(process.cwd(), {
        autoFix: false, // Review required
        reviewRequired: true
    });
}, 6 * 60 * 60 * 1000);
```

---

## 📈 Comparison

| Feature | Current (Passive) | Active Crawling |
|---------|------------------|-----------------|
| **Issue Detection** | ❌ No | ✅ Yes |
| **Bulk Scanning** | ❌ No | ✅ Yes |
| **Auto-Fixing** | ❌ No | ✅ Yes |
| **File Watching** | ❌ No | ✅ Yes |
| **Database Monitoring** | ✅ Yes | ✅ Yes |
| **Alerts** | ✅ Yes | ✅ Yes |
| **Resource Usage** | Low | High |
| **Setup** | Automatic | Manual |

---

## 💡 Recommendations

### For Development
- **Keep passive** - Lower resource usage
- **Manual crawls** when needed
- **Use CLI** for on-demand analysis

### For Production
- **Enable scheduled crawling** - Daily/weekly scans
- **Enable file watching** - Real-time detection
- **Auto-fix safe issues** - Reduce manual work

### For CI/CD
- **Run crawler on commits** - GitHub Actions
- **Block on critical issues** - Fail builds
- **Report to dashboard** - Track over time

---

## 🔧 Quick Commands

### Check Current Status
```bash
npm run code-roach:status
```

### Start Manual Crawl
```bash
curl -X POST http://localhost:3000/api/code-roach/crawl \
  -H "Content-Type: application/json" \
  -d '{"autoFix": false}'
```

### Check Crawl Status
```bash
curl http://localhost:3000/api/code-roach/crawl/status
```

### View Issues
```bash
curl http://localhost:3000/api/code-roach/issues?limit=10
```

---

## ✅ Summary

**Current State:**
- ✅ Monitoring existing issues (passive)
- ❌ NOT actively finding new issues
- ❌ NOT crawling/indexing automatically

**To Enable Active Detection:**
- Use API endpoint to start crawler
- Or modify server.js to auto-start
- Or set up scheduled tasks

**The infrastructure exists - it just needs to be activated!** 🚀

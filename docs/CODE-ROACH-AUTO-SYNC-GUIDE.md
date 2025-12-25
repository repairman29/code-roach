# Code Roach Auto-Sync Guide

## Automatic Syncing with Timestamps

---

## 🎯 Overview

Code Roach can now automatically sync to the standalone structure with full timestamp tracking. Multiple sync methods are available:

1. **Git Hooks** - Auto-sync on commit
2. **Watch Mode** - Continuous watching and syncing
3. **Manual Sync** - On-demand with timestamps

---

## 🔄 Sync Methods

### 1. Git Post-Commit Hook (Recommended)

**Automatically syncs after each commit** that touches Code Roach files.

**Setup:**

```bash
# Hooks are already installed in .git/hooks/
# They're automatically executable
```

**How it works:**

- After each commit, checks if Code Roach files changed
- If yes, automatically runs sync
- Timestamps the sync in manifest

**Example:**

```bash
git add server/services/codebaseIndexer.js
git commit -m "Improve codebase indexing"
# 🔄 Auto-syncs to standalone automatically!
```

**Status:**

- ✅ Installed: `.git/hooks/post-commit`
- ✅ Active: Runs automatically
- ✅ Timestamped: Every sync is logged

---

### 2. Watch Mode (Continuous)

**Watches for file changes and syncs automatically.**

**Start watching:**

```bash
npm run code-roach:sync-watch
```

**How it works:**

- Watches Code Roach files for changes
- Debounces (waits 2 seconds after last change)
- Auto-syncs when files change
- Logs all sync events with timestamps

**Features:**

- 👀 Watches: services, routes, UI, scripts, docs
- ⏱️ Debounced: Waits 2s after last change
- 📝 Logged: All syncs logged to `.code-roach-sync.log`
- 🔄 Periodic: Also checks every 5 minutes

**Stop watching:**

- Press `Ctrl+C`

**Log file:**

```bash
cat .code-roach-sync.log
```

---

### 3. Manual Sync (On-Demand)

**Sync whenever you want with full timestamps.**

```bash
npm run code-roach:sync-standalone
```

**Output includes:**

- ✅ Files copied/skipped
- 🕐 Last sync timestamp
- 📊 Sync count
- ⏰ ISO timestamp

---

## 📊 Timestamp Tracking

### Manifest File

Every sync updates `.sync-manifest.json`:

```json
{
  "lastSync": "2025-12-14T07:30:48.829Z",
  "lastSyncTimestamp": 1734162648829,
  "lastSyncHuman": "12/14/2025, 12:30:48 AM",
  "syncCount": 42,
  "files": [...],
  "stats": {
    "copied": 62,
    "skipped": 84,
    "errors": 0
  }
}
```

### Simple Timestamp File

Quick check of last sync:

```bash
cat ../code-roach-standalone/.last-sync
```

Output:

```
2025-12-14T07:30:48.829Z
12/14/2025, 12:30:48 AM
```

### Sync Log

Watch mode creates `.code-roach-sync.log`:

```
[2025-12-14T07:30:48.829Z] WATCHER_START
[2025-12-14T07:30:50.123Z] SYNC_START
[2025-12-14T07:30:52.456Z] SYNC_SUCCESS
[2025-12-14T07:31:15.789Z] change: server/services/codebaseIndexer.js
[2025-12-14T07:31:17.890Z] SYNC_START
[2025-12-14T07:31:19.234Z] SYNC_SUCCESS
```

---

## 🎯 Recommended Setup

### For Active Development

**Use Watch Mode:**

```bash
# Terminal 1: Start watcher
npm run code-roach:sync-watch

# Terminal 2: Develop
# Edit Code Roach files - auto-syncs!
```

### For Git Workflow

**Use Git Hooks (already active):**

```bash
# Just commit normally
git commit -m "Code Roach improvements"
# Auto-syncs after commit!
```

### For Scheduled Syncs

**Add to cron (optional):**

```bash
# Sync every hour
0 * * * * cd /path/to/smugglers && npm run code-roach:sync-standalone
```

---

## 📈 Sync Statistics

### Check Last Sync

```bash
# Quick check
cat ../code-roach-standalone/.last-sync

# Detailed info
cat ../code-roach-standalone/.sync-manifest.json | jq '.lastSyncHuman, .syncCount'
```

### View Sync Log

```bash
# Last 20 entries
tail -20 .code-roach-sync.log

# All syncs today
grep "$(date +%Y-%m-%d)" .code-roach-sync.log
```

### Sync History

The manifest tracks:

- Total sync count
- Last sync timestamp (ISO, human-readable, Unix)
- Files synced
- Statistics (copied/skipped/errors)

---

## ⚙️ Configuration

### Git Hooks

**Post-commit hook:** `.git/hooks/post-commit`

- Syncs after commits with Code Roach changes
- Can be disabled by removing execute permission

**Pre-commit hook:** `.git/hooks/pre-commit`

- Currently just checks (doesn't sync)
- Uncomment sync line if you want pre-commit sync

### Watch Mode

**Watched patterns** (in `sync-code-roach-standalone-watch.js`):

```javascript
const WATCH_PATTERNS = [
  "server/services/**/*.js",
  "server/routes/api*.js",
  "public/**/*code-roach*.html",
  "scripts/batch-review-issues.js",
  // ... more patterns
];
```

**Debounce delay:** 2 seconds (configurable)

**Periodic check:** Every 5 minutes

---

## 🚨 Troubleshooting

### Git Hook Not Running

```bash
# Check if executable
ls -la .git/hooks/post-commit

# Make executable
chmod +x .git/hooks/post-commit
```

### Watch Mode Not Detecting Changes

- Check if files match watched patterns
- Verify file system supports watching
- Check `.code-roach-sync.log` for errors

### Sync Failing

- Check standalone directory exists
- Verify file permissions
- Check manifest for error details

---

## 📚 Quick Reference

### Commands

```bash
# Manual sync (with timestamps)
npm run code-roach:sync-standalone

# Watch mode (continuous)
npm run code-roach:sync-watch

# Check last sync
cat ../code-roach-standalone/.last-sync

# View sync log
tail -20 .code-roach-sync.log
```

### Files

- `.sync-manifest.json` - Full sync manifest
- `.last-sync` - Simple timestamp file
- `.code-roach-sync.log` - Watch mode log
- `.git/hooks/post-commit` - Git hook

---

## ✅ Best Practices

1. **Use Git Hooks** - Automatic, no thinking required
2. **Check Timestamps** - Verify syncs are happening
3. **Review Logs** - Monitor sync activity
4. **Watch Mode for Active Dev** - Real-time syncing
5. **Manual Sync for Control** - When you need it

---

**Auto-sync is now active!** 🚀

Every commit with Code Roach changes will automatically sync to standalone with full timestamp tracking.

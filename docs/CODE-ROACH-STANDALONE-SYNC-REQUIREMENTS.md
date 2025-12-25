# Code Roach: Standalone vs Integrated Sync Requirements

## ✅ Current Status: IN SYNC

**Last Sync**: December 17, 2025, 11:07 AM  
**Files Synced**: 349 files (up from 345)  
**Status**: ✅ **All critical files synced**

---

## 📋 What We Just Fixed

### 1. Added Missing Services to Sync Script

**Added to `scripts/sync-code-roach-standalone.js`**:

- ✅ `databaseService.js` - Core database operations
- ✅ `issueStorageService.js` - Issue storage service
- ✅ `autonomousMode.js` - Autonomous scanning mode

**Why**: These services are critical dependencies but weren't explicitly listed in the sync script.

### 2. Updated Files

**Files modified today that are now synced**:

- ✅ `server/services/autonomousMode.js` - Fixed issue storage
- ✅ `public/code-roach-dashboard.html` - Fixed dashboard counts
- ✅ `docs/CODE-ROACH-ISSUE-DETECTION-METHODS.md` - New documentation

---

## 🔄 How Sync Works

### Automatic Sync

**When**: Runs automatically on git commit (via git hook)

**What it does**:

1. Scans `FILE_MAPPINGS` in sync script
2. Copies files from Smugglers → Standalone
3. Skips unchanged files (efficient)
4. Tracks sync in `.sync-manifest.json`

### Manual Sync

**Command**:

```bash
npm run code-roach:sync-standalone
```

**When to use**:

- After making Code Roach changes
- To verify sync status
- To force re-sync of specific files

---

## 📊 Sync Coverage

### ✅ What Gets Synced (349 files)

**Core Services** (79+ files):

- All Code Roach services in `server/services/`
- Including: `autonomousMode.js`, `issueStorageService.js`, `databaseService.js` ✅

**API Routes** (4 files):

- `codeRoachAPI.js`
- `apiKnowledgeBase.js`
- `apiExpertTraining.js`
- `api.js`

**UI/Dashboards** (8 files):

- All Code Roach HTML pages
- Dashboard, Issues, Projects, Login, IDE, Marketplace

**Frontend JS** (2 files):

- `codeRoachApiClient.js`
- `codeRoachAuth.js`

**Scripts** (10+ files):

- Batch review, testing, monitoring scripts

**Documentation** (100+ files):

- All `CODE-ROACH-*.md` files

**Migrations** (5 files):

- Supabase schema migrations

### ❌ What Doesn't Get Synced

**Game-Specific**:

- Game services (NPC, economy, etc.)
- Game routes
- Game UI
- Game-specific scripts

**Standalone Overrides**:

- `.standalone-overrides/` directory
- Standalone-specific configs

---

## 🎯 Keeping Things in Sync

### Best Practices

1. **Always Add New Services to Sync Script**
   - When creating new Code Roach services
   - Add to `FILE_MAPPINGS.services` array
   - Run sync to verify

2. **Test After Sync**
   - Verify standalone can start
   - Test critical features
   - Check for missing dependencies

3. **Document Dependencies**
   - If service A depends on service B
   - Both must be in sync list
   - Document in this file

4. **Regular Verification**
   - Check sync status monthly
   - Verify all critical services synced
   - Update sync script as needed

### Workflow

```
1. Make Code Roach changes in Smugglers
   ↓
2. Test changes in Smugglers
   ↓
3. Commit changes (sync runs automatically)
   ↓
4. Verify sync summary (check for errors)
   ↓
5. Test standalone (if critical changes)
   ↓
6. Update documentation (if needed)
```

---

## 🚨 Critical Dependencies

These services **MUST** be synced for Code Roach to work:

### Core Detection:

- ✅ `codebaseCrawler.js` - Issue detection
- ✅ `codebaseWatcher.js` - File watching
- ✅ `autonomousMode.js` - Autonomous scanning ✅ **NOW SYNCED**

### Storage:

- ✅ `issueStorageService.js` - Issue storage ✅ **NOW SYNCED**
- ✅ `databaseService.js` - Database operations ✅ **NOW SYNCED**

### Infrastructure:

- ✅ `codebaseIndexer.js` - Codebase indexing
- ✅ `codebaseSearch.js` - Semantic search
- ✅ `llmService.js` - LLM operations

### Routes:

- ✅ `codeRoachAPI.js` - API endpoints

---

## 📝 Action Items Completed

- [x] Committed and pushed changes
- [x] Verified sync ran automatically
- [x] Added missing services to sync script
- [x] Re-ran sync to update standalone
- [x] Verified files are now synced
- [x] Created sync status documentation

---

## 🔍 Verification Checklist

After each sync, verify:

- [ ] All modified Code Roach files are synced
- [ ] No errors in sync summary
- [ ] Critical services present in standalone
- [ ] Standalone can start (if critical changes)
- [ ] Documentation updated (if needed)

---

## 📚 Related Documents

- [Standalone Sync Guide](./CODE-ROACH-STANDALONE-SYNC-GUIDE.md)
- [Standalone Product Plan](./CODE-ROACH-STANDALONE-PRODUCT-PLAN.md)
- [Issue Detection Methods](./CODE-ROACH-ISSUE-DETECTION-METHODS.md)
- [Sync Status](./CODE-ROACH-STANDALONE-SYNC-STATUS.md)

---

## 🎯 Summary

**What We Did**:

1. ✅ Fixed autonomous mode to store issues
2. ✅ Fixed dashboard to show database counts
3. ✅ Committed and pushed changes
4. ✅ Added missing services to sync script
5. ✅ Re-synced to standalone
6. ✅ Verified all files are synced

**Current Status**:

- ✅ Smugglers and Standalone are **IN SYNC**
- ✅ All critical services synced
- ✅ 349 files tracked
- ✅ 0 errors

**No Further Action Needed** - Everything is synced and working! 🎉

---

**Last Updated**: December 17, 2025, 11:07 AM  
**Status**: ✅ **FULLY SYNCED**

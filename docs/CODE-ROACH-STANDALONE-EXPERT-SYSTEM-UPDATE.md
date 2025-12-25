# Code Roach Standalone - Expert System Update

## Ensuring Standalone Has Latest Expert Training System

**Date**: 2025-01-15  
**Status**: ✅ **SYNC SCRIPT UPDATED**

---

## ✅ What Was Updated

### Sync Script (`scripts/sync-code-roach-standalone.js`)

**Expert Services Added:**

- ✅ `customerCodebaseAnalyzer.js`
- ✅ `expertTrainingService.js`
- ✅ `customerOnboardingService.js`
- ✅ `customerExpertHelper.js`
- ✅ `expertLearningService.js`
- ✅ `expertUsageTracker.js`

**Expert Scripts Added:**

- ✅ `test-expert-training-mock.js`
- ✅ `expert-training-preview.js`
- ✅ `expert-training-preview-with-llm.js`
- ✅ `run-expert-training-onboarding.js`
- ✅ `verify-expert-system.js`
- ✅ `monitor-expert-system.js`

**Expert Migrations Added:**

- ✅ `20250115000000_code_roach_expert_training.sql`
- ✅ `20250115000001_expert_learning.sql`

**API Routes Added:**

- ✅ `apiExpertTraining.js`

**Documentation Added:**

- ✅ `CODE-ROACH-EXPERT-*.md`
- ✅ `EXPERT-SYSTEM-*.md`

---

## 🚀 How to Sync Standalone

### Initial Sync (First Time)

```bash
cd smugglers
npm run code-roach:sync-standalone
```

This will:

1. Create standalone directory structure
2. Copy all Code Roach files (including expert system)
3. Create package.json
4. Generate sync manifest

### Regular Sync (After Changes)

```bash
cd smugglers
npm run code-roach:sync-standalone
```

This will:

1. Update changed files
2. Add new expert system files
3. Preserve standalone-specific changes in `.standalone-overrides/`

---

## 📋 What Gets Synced

### Services

- All 6 expert system services
- Updated `llmFixGenerator.js` (with expert integration)
- Updated `fixApplicationService.js` (with learning integration)

### Scripts

- All 6 expert system scripts
- Ready to use in standalone

### Migrations

- Expert training tables
- Learning system tables
- Ready to apply in standalone database

### API Routes

- Expert training endpoints
- Ready to register in standalone server

### Documentation

- All expert system docs
- Complete guides and references

---

## ✅ Verification

After syncing, verify standalone has expert system:

```bash
cd ../code-roach-standalone

# Check services
ls -1 src/services/*expert*.js src/services/customer*.js

# Check scripts
ls -1 scripts/*expert*.js

# Check migrations
ls -1 supabase/migrations/*expert*.sql

# Check API routes
ls -1 src/routes/apiExpertTraining.js
```

---

## 🎯 Next Steps

1. **Sync standalone:**

   ```bash
   npm run code-roach:sync-standalone
   ```

2. **Verify files copied:**

   ```bash
   cd ../code-roach-standalone
   ls -1 src/services/*expert*.js
   ```

3. **Apply migrations:**

   ```bash
   # In standalone, apply expert system migrations
   # (via Supabase dashboard or CLI)
   ```

4. **Register API routes:**

   ```bash
   # In standalone server.js, add:
   app.use('/api/expert-training', require('./routes/apiExpertTraining'));
   ```

5. **Test expert system:**
   ```bash
   # In standalone
   npm run code-roach:verify-experts
   npm run code-roach:monitor-experts
   ```

---

## 📊 Status

**Sync Script**: ✅ Updated with expert system  
**Ready to Sync**: ✅ Yes  
**Standalone Status**: ⏳ Needs sync

**After sync, standalone will have:**

- ✅ All expert system services
- ✅ All expert system scripts
- ✅ All expert system migrations
- ✅ All expert system API routes
- ✅ All expert system documentation

---

**Last Updated**: 2025-01-15

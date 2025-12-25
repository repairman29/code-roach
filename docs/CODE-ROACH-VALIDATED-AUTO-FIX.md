# Code Roach: Validated Auto-Fix

## Test & Validate Before Saving/Committing

---

## 🎯 Overview

Code Roach now **automatically fixes issues** with **mandatory test validation** before saving or committing changes.

**Safety First:**

- ✅ Validates syntax before applying
- ✅ Runs tests before saving
- ✅ Creates backups for rollback
- ✅ Pre-commit validation
- ✅ Only applies if tests pass

---

## ✅ What's Enabled

### 1. Validated Fix Application

- ✅ **Syntax validation** - Checks code syntax
- ✅ **Type checking** - Validates TypeScript types
- ✅ **Linter validation** - Runs ESLint
- ✅ **Test execution** - Runs tests before saving
- ✅ **Backup creation** - Creates backups for rollback

### 2. Pre-Commit Validation

- ✅ **Syntax check** - Validates all staged files
- ✅ **Test execution** - Runs test suite
- ✅ **Blocks commit** - If validation fails

### 3. Auto-Fix with Validation

- ✅ **Auto-fixes issues** - When detected
- ✅ **Tests before saving** - Ensures fixes work
- ✅ **Rollback on failure** - Restores backup if tests fail

---

## 🔄 How It Works

### Fix Application Flow

```
1. Code Roach detects issue
   ↓
2. Generates fix
   ↓
3. Creates backup of original file
   ↓
4. Validates fix syntax
   ↓
5. Writes fix to temp file
   ↓
6. Runs tests on fixed code
   ↓
7. If tests pass → Save fix
   ↓
8. If tests fail → Rollback from backup
   ↓
9. Mark for review if can't fix
```

### Pre-Commit Flow

```
1. You stage files for commit
   ↓
2. Pre-commit hook runs
   ↓
3. Checks for Code Roach fixes
   ↓
4. Validates syntax
   ↓
5. Runs test suite
   ↓
6. If all pass → Commit proceeds
   ↓
7. If any fail → Commit blocked
```

---

## ⚙️ Configuration

### Environment Variables

**In `.env`:**

```bash
# Enable auto-fix
CODE_ROACH_AUTO_FIX=true

# Enable validation (default: true)
CODE_ROACH_VALIDATE_FIXES=true
```

### Validation Levels

**Full Validation (Default):**

- Syntax check
- Type checking (TypeScript)
- Linter validation
- Test execution
- Backup & rollback

**Basic Validation:**

```bash
CODE_ROACH_VALIDATE_FIXES=basic
```

- Syntax check only
- No tests
- Still creates backups

**No Validation (Not Recommended):**

```bash
CODE_ROACH_VALIDATE_FIXES=false
```

- Applies fixes without validation
- Use only for trusted fixes

---

## 🧪 Test Requirements

### For Full Validation

**Required:**

- `npm test` command in `package.json`
- Test files for your code
- Jest or other test runner

**Optional:**

- TypeScript compiler (`tsc`)
- ESLint (`eslint`)

### Test File Detection

Code Roach automatically finds test files:

- `file.test.js` - Jest convention
- `file.spec.js` - Jasmine/Mocha convention
- `tests/file.js` - Test directory
- `__tests__/file.js` - Jest convention

---

## 📊 Validation Results

### Success

```
🔍 [Validated Fix] Validating fix for server/services/myService.js...
✅ [Validated Fix] Validation passed for server/services/myService.js
🧪 [Validated Fix] Running tests for server/services/myService.js...
✅ [Validated Fix] Tests passed for server/services/myService.js
✅ [Validated Fix] Fix applied successfully to server/services/myService.js
```

### Failure

```
🔍 [Validated Fix] Validating fix for server/services/myService.js...
❌ [Validated Fix] Validation failed for server/services/myService.js
   Syntax errors: Unexpected token
   Fix not applied, original file preserved
```

---

## 🔒 Safety Features

### 1. Automatic Backups

- All fixes backed up to `.code-roach-backups/`
- Format: `filename.timestamp.backup`
- Automatic rollback on failure

### 2. Test Validation

- Tests must pass before fix is saved
- Blocks commit if tests fail
- Prevents breaking changes

### 3. Pre-Commit Hook

- Validates all staged files
- Runs test suite
- Blocks commit on failure

### 4. Rollback on Failure

- Automatic restore from backup
- Original code preserved
- No data loss

---

## 🚀 Usage

### Automatic (Recommended)

**Just code normally:**

1. Code Roach detects issues
2. Auto-fixes with validation
3. Tests run automatically
4. Fix saved only if tests pass

**On commit:**

1. Pre-commit hook validates
2. Tests run
3. Commit proceeds if all pass

### Manual Validation

**Validate fix before applying:**

```javascript
const validatedFixApplication = require("./server/services/validatedFixApplication");

const result = await validatedFixApplication.validateOnly(
  fix,
  filePath,
  originalCode,
);
if (result.valid) {
  // Fix is safe to apply
}
```

**Apply with validation:**

```javascript
const result = await validatedFixApplication.applyFixWithValidation(
  fix,
  filePath,
  originalCode,
);
if (result.applied) {
  console.log("Fix applied successfully!");
} else {
  console.log("Fix validation failed:", result.errors);
}
```

---

## 📁 Backup Management

### Backup Location

```
.code-roach-backups/
├── myService.js.1734162648829.backup
├── myService.js.1734162751234.backup
└── ...
```

### Manual Restore

```bash
# Find backup
ls -la .code-roach-backups/ | grep myService.js

# Restore
cp .code-roach-backups/myService.js.1734162648829.backup server/services/myService.js
```

### Cleanup Old Backups

```bash
# Remove backups older than 7 days
find .code-roach-backups -name "*.backup" -mtime +7 -delete
```

---

## ⚠️ Troubleshooting

### Tests Not Running

**Check:**

1. Is `npm test` defined in `package.json`?
2. Are test files in expected locations?
3. Is test runner installed?

**Fix:**

```bash
# Install test dependencies
npm install --save-dev jest

# Add test script to package.json
"test": "jest"
```

### Validation Too Strict

**Adjust validation level:**

```bash
# Basic validation only
CODE_ROACH_VALIDATE_FIXES=basic
```

### Pre-Commit Hook Blocking

**Bypass (not recommended):**

```bash
git commit --no-verify
```

**Better: Fix the issues:**

```bash
# Check what's wrong
npm test

# Fix issues
# Then commit normally
```

---

## 📈 Benefits

### Safety

- ✅ No broken code committed
- ✅ Tests must pass
- ✅ Automatic rollback
- ✅ Backup protection

### Quality

- ✅ Higher fix success rate
- ✅ Fewer regressions
- ✅ Better code quality
- ✅ Confidence in fixes

### Developer Experience

- ✅ Automatic validation
- ✅ No manual testing needed
- ✅ Safe auto-fixes
- ✅ Peace of mind

---

## ✅ Summary

**Code Roach now:**

- ✅ Auto-fixes issues
- ✅ Validates before saving
- ✅ Tests before committing
- ✅ Creates backups
- ✅ Rolls back on failure

**You can:**

- ✅ Code with confidence
- ✅ Trust auto-fixes
- ✅ Commit safely
- ✅ Focus on features

---

**Validated auto-fix is active!** 🪳✅

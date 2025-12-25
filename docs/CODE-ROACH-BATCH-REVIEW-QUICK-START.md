# Code Roach Batch Review - Quick Start

## 🚀 Get Started in 3 Steps

### Step 1: View What Needs Review

```bash
npm run code-roach:review:report
```

### Step 2: Review Critical Issues

```bash
npm run code-roach:review:critical
```

### Step 3: Batch Review Safe Fixes

```bash
npm run code-roach:review:batch --auto-approve --auto-fix
```

---

## 📋 Common Commands

| Command                                 | What It Does                         |
| --------------------------------------- | ------------------------------------ |
| `npm run code-roach:review:report`      | Show report of all issues            |
| `npm run code-roach:review:critical`    | Review critical issues interactively |
| `npm run code-roach:review:batch`       | Batch review with auto-approval      |
| `npm run code-roach:review:interactive` | Review issues one by one             |

---

## 🎓 How Learning Works

### Automatic Learning

When you review and approve fixes, Code Roach automatically:

1. ✅ Records the fix to knowledge base
2. ✅ Learns the pattern
3. ✅ Auto-fixes similar issues next time
4. ✅ Auto-batches similar issues

### Manual Learning

```bash
# Learn from a single fix
curl -X POST http://localhost:3000/api/code-roach/learning/fix \
  -H "Content-Type: application/json" \
  -d '{
    "issue": {...},
    "fix": {...},
    "success": true
  }'
```

---

## 🔄 Workflow

```
1. Review Issues → 2. Apply Fixes → 3. Code Roach Learns → 4. Auto-Fixes Next Time
```

---

## 📊 Check Learning Progress

```bash
curl http://localhost:3000/api/code-roach/learning/stats
```

---

## 🎯 Best Practices

1. **Start with critical issues** - Review security and critical bugs first
2. **Batch similar issues** - Group by type/severity for efficiency
3. **Add notes** - Help Code Roach understand context
4. **Verify fixes** - Test before auto-applying
5. **Review patterns** - Check what Code Roach learned

---

## 📚 Full Documentation

See [CODE-ROACH-BATCH-REVIEW-GUIDE.md](./CODE-ROACH-BATCH-REVIEW-GUIDE.md) for complete documentation.

---

**That's it! Start reviewing and teaching Code Roach!** 🪳📚

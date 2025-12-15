# Code Roach Standalone - Quick Start

## 🚀 One-Command Setup

```bash
cd smugglers
npm run code-roach:sync-standalone
```

That's it! Your standalone structure is ready at:
```
../code-roach-standalone/
```

---

## 📁 What Was Created

```
code-roach-standalone/
├── src/
│   ├── services/        # 79 Code Roach services
│   └── routes/          # API routes
├── public/              # Dashboards & UI
├── scripts/             # Utility scripts
├── docs/                # All Code Roach docs
├── cli/                 # CLI tools
├── supabase/            # Database migrations
├── .standalone-overrides/  # Your customizations (safe zone)
├── .sync-manifest.json  # Sync tracking
├── package.json         # Standalone package
└── README.md
```

---

## 🔄 Daily Workflow

### Making Code Roach Changes

1. **Edit in Smugglers:**
   ```bash
   # Edit server/services/codebaseIndexer.js
   ```

2. **Test in Smugglers:**
   ```bash
   npm test
   ```

3. **Sync to Standalone:**
   ```bash
   npm run code-roach:sync-standalone
   ```

4. **Both projects updated!** ✅

### Making Standalone-Only Changes

1. **Add to safe zone:**
   ```bash
   cd ../code-roach-standalone
   mkdir -p .standalone-overrides/src/services
   cp src/services/codebaseIndexer.js .standalone-overrides/src/services/
   # Edit .standalone-overrides/src/services/codebaseIndexer.js
   ```

2. **Changes preserved on sync!** ✅

---

## ⚠️ Important Rules

### ✅ DO:
- Make Code Roach improvements in **Smugglers**
- Sync regularly: `npm run code-roach:sync-standalone`
- Put standalone-only changes in `.standalone-overrides/`
- Test in Smugglers first

### ❌ DON'T:
- Edit synced files directly (they'll be overwritten)
- Break Smugglers integration
- Skip syncing for too long

---

## 📊 Sync Status

Check what's been synced:
```bash
cat ../code-roach-standalone/.sync-manifest.json
```

Last sync shows:
- ✅ Files copied
- ⏭️  Files skipped (unchanged)
- 📁 Total files tracked

---

## 🎯 Next Steps

1. **Review structure:**
   ```bash
   ls -la ../code-roach-standalone/
   ```

2. **Read full guide:**
   - [Standalone Sync Guide](./CODE-ROACH-STANDALONE-SYNC-GUIDE.md)

3. **Start customizing:**
   - Add to `.standalone-overrides/`
   - Develop standalone features

---

## 💡 Pro Tips

- **Sync after every Code Roach change** - Keeps both in sync
- **Use `.standalone-overrides/`** - Safe zone for customizations
- **Document standalone changes** - Create `.standalone-overrides/CHANGES.md`
- **Test in Smugglers first** - Source of truth

---

**Ready to go!** 🚀

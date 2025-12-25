# Code Roach Repository - Quick Start 🚀

**Repository:** https://github.com/repairman29/coderoach  
**Status:** Ready to push

---

## ⚡ One-Command Migration

```bash
cd smugglers
npm run code-roach:push-to-repo
```

That's it! This will:

1. ✅ Sync Code Roach files to standalone structure
2. ✅ Initialize git repository
3. ✅ Push to https://github.com/repairman29/coderoach.git
4. ✅ **NOT touch Smugglers repository**

---

## 🛡️ Safety Guarantees

✅ **Smugglers is safe:**

- No changes to Smugglers git
- No commits to Smugglers repo
- Smugglers code untouched

✅ **Standalone directory:**

- Created in `../code-roach-standalone/`
- Independent git repository
- Can be deleted/recreated safely

---

## 📋 Prerequisites

1. **Repository exists:**
   - ✅ https://github.com/repairman29/coderoach
   - ✅ You have push access

2. **Git configured:**
   ```bash
   git config --global user.name "Your Name"
   git config --global user.email "your.email@example.com"
   ```

---

## 🔄 After Migration

### Update Code Roach in Repo

1. **Make changes in Smugglers:**

   ```bash
   # Edit Code Roach files
   ```

2. **Sync and push:**
   ```bash
   npm run code-roach:sync-standalone
   cd ../code-roach-standalone
   git add -A
   git commit -m "Update Code Roach"
   git push
   ```

---

## 📁 What Gets Pushed

✅ **Included:**

- All Code Roach services
- API routes
- CLI tools
- Database migrations
- Documentation
- Configuration

❌ **Excluded:**

- Smugglers game code
- Game-specific services
- Node modules

---

## 🆘 Troubleshooting

### "Repository not empty"

- Script will ask if you want to continue
- You can pull first or force push

### "Permission denied"

- Check GitHub permissions
- Verify SSH keys or token

### "Sync script not found"

- Make sure you're in `smugglers/` directory

---

## 📚 Full Documentation

See `docs/CODE-ROACH-REPO-MIGRATION.md` for detailed guide.

---

**Ready? Run:** `npm run code-roach:push-to-repo` 🚀

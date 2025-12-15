# Code Roach Repository Migration Guide

**Target Repository:** https://github.com/repairman29/coderoach  
**Status:** Ready to migrate

---

## 🎯 Overview

This guide helps you safely migrate Code Roach to its own standalone repository **without affecting the Smugglers repository**.

---

## ✅ Safe Migration Process

### Step 1: Sync Code Roach Files

First, sync Code Roach files to standalone structure:

```bash
cd smugglers
npm run code-roach:sync-standalone
```

This creates: `../code-roach-standalone/`

### Step 2: Push to New Repository

Push the standalone structure to the new repo:

```bash
npm run code-roach:push-to-repo
# or
./scripts/push-code-roach-to-repo.sh
```

This will:
1. ✅ Sync Code Roach files (if not already done)
2. ✅ Initialize git repository
3. ✅ Configure remote to `https://github.com/repairman29/coderoach.git`
4. ✅ Commit all files
5. ✅ Push to repository

---

## 🛡️ Safety Features

### What's Protected

✅ **Smugglers Repository:**
- Not touched at all
- No changes to Smugglers git
- No commits to Smugglers repo
- Completely safe

✅ **Standalone Directory:**
- Created in separate location (`../code-roach-standalone/`)
- Independent git repository
- Can be deleted/recreated safely

### What Happens

1. **Sync Phase:**
   - Copies Code Roach files to standalone directory
   - Creates proper structure
   - Generates `package.json`, `README.md`

2. **Git Phase:**
   - Initializes git in standalone directory only
   - Configures remote to Code Roach repo
   - Commits and pushes

3. **Result:**
   - Code Roach in its own repo
   - Smugglers untouched
   - Both can evolve independently

---

## 📋 Prerequisites

### 1. GitHub Repository

Make sure the repository exists:
- ✅ https://github.com/repairman29/coderoach
- ✅ Can be empty (preferred for initial push)
- ✅ You have push access

### 2. Local Setup

```bash
# In Smugglers directory
cd smugglers

# Make sure sync script exists
ls scripts/sync-code-roach-standalone.js

# Make sure push script is executable
chmod +x scripts/push-code-roach-to-repo.sh
```

### 3. Git Configuration

Make sure git is configured:
```bash
git config --global user.name "Your Name"
git config --global user.email "your.email@example.com"
```

---

## 🚀 Quick Start

### One-Command Migration

```bash
cd smugglers
npm run code-roach:push-to-repo
```

This does everything automatically!

### Manual Steps

If you prefer manual control:

```bash
# 1. Sync files
npm run code-roach:sync-standalone

# 2. Go to standalone directory
cd ../code-roach-standalone

# 3. Initialize git
git init
git branch -M main

# 4. Add remote
git remote add origin https://github.com/repairman29/coderoach.git

# 5. Commit and push
git add -A
git commit -m "Initial Code Roach standalone migration"
git push -u origin main
```

---

## 🔄 Ongoing Workflow

### After Initial Migration

**To update Code Roach in the repo:**

1. **Make changes in Smugglers:**
   ```bash
   # Edit Code Roach files in smugglers/
   ```

2. **Sync to standalone:**
   ```bash
   npm run code-roach:sync-standalone
   ```

3. **Push to repo:**
   ```bash
   cd ../code-roach-standalone
   git add -A
   git commit -m "Update Code Roach"
   git push
   ```

### Automated Sync (Optional)

Set up a watch script for automatic syncing:

```bash
npm run code-roach:sync-watch
```

This watches for changes and syncs automatically.

---

## 📁 Directory Structure

After migration:

```
code-roach-standalone/          # Standalone repository
├── src/
│   ├── services/               # Code Roach services
│   └── routes/                 # API routes
├── public/                     # UI files
├── scripts/                    # Utility scripts
├── cli/                        # CLI tools
├── supabase/                   # Database migrations
├── docs/                       # Documentation
├── .git/                       # Git repository
├── package.json
└── README.md

smugglers/                      # Original (untouched)
├── server/services/            # Code Roach still here
├── ...
└── .git/                       # Smugglers git (untouched)
```

---

## ⚠️ Important Notes

### Repository Status

- **Initial Push:** Repository should be empty (or you'll need to handle conflicts)
- **Force Push:** Script will ask before force pushing
- **Remote:** Will update if already set to different URL

### What Gets Pushed

✅ **Included:**
- All Code Roach services
- API routes
- CLI tools
- Database migrations
- Documentation
- Configuration files

❌ **Excluded:**
- Smugglers game code
- Game-specific services
- Test files (optional)
- Node modules

---

## 🔍 Verification

### After Migration

1. **Check Repository:**
   - Visit: https://github.com/repairman29/coderoach
   - Verify files are present
   - Check commit history

2. **Check Local:**
   ```bash
   cd ../code-roach-standalone
   git status
   git remote -v
   ```

3. **Test Clone:**
   ```bash
   cd /tmp
   git clone https://github.com/repairman29/coderoach.git test-clone
   cd test-clone
   ls -la
   ```

---

## 🆘 Troubleshooting

### "Repository not empty"

If the repo already has content:
- Script will ask if you want to continue
- You can pull first: `git pull origin main --allow-unrelated-histories`
- Or force push (if you're sure)

### "Permission denied"

Make sure you have push access:
- Check GitHub permissions
- Verify SSH keys or token
- Try: `git remote set-url origin https://YOUR_TOKEN@github.com/repairman29/coderoach.git`

### "Sync script not found"

Make sure you're in the Smugglers directory:
```bash
cd smugglers
pwd  # Should show .../smugglers
```

### "Standalone directory not found"

Run sync first:
```bash
npm run code-roach:sync-standalone
```

---

## 📝 Next Steps After Migration

1. **Set up Railway:**
   ```bash
   cd ../code-roach-standalone
   npm run railway:link-code-roach
   ```

2. **Deploy:**
   ```bash
   npm run deploy:infrastructure
   ```

3. **Set up CI/CD:**
   - Add GitHub Actions
   - Configure auto-deploy

4. **Update Documentation:**
   - Update README.md
   - Add contribution guidelines

---

## ✅ Checklist

Before migration:
- [ ] Repository exists and is accessible
- [ ] You have push access
- [ ] Git is configured
- [ ] Sync script works: `npm run code-roach:sync-standalone`

During migration:
- [ ] Run: `npm run code-roach:push-to-repo`
- [ ] Review what will be pushed
- [ ] Confirm push

After migration:
- [ ] Verify files in GitHub
- [ ] Test clone
- [ ] Set up Railway
- [ ] Deploy infrastructure

---

**Last Updated:** December 2025  
**Status:** Ready to migrate

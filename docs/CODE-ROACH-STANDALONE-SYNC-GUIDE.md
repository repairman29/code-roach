# Code Roach Standalone Sync Guide

## Parallel Development Without Breaking Smugglers

---

## 🎯 Overview

This guide explains how to maintain a **parallel standalone Code Roach structure** while continuing to develop it within the Smugglers game project.

**Key Principles:**

- ✅ Code Roach continues to evolve in Smugglers
- ✅ Standalone version syncs automatically
- ✅ Both can evolve independently
- ✅ No breaking changes to Smugglers
- ✅ Future innovation preserved

---

## 📁 Directory Structure

```
smugglers/                          # Your game project
├── server/services/                # Code Roach services (source)
├── server/routes/                  # Code Roach routes (source)
├── public/                         # Code Roach UI (source)
├── scripts/                        # Code Roach scripts (source)
└── ...

code-roach-standalone/              # Standalone product (synced)
├── src/
│   ├── services/                   # Synced services
│   └── routes/                     # Synced routes
├── public/                         # Synced UI
├── scripts/                        # Synced scripts
├── docs/                           # Synced documentation
├── .standalone-overrides/          # Standalone-specific (not synced)
├── .sync-manifest.json             # Sync tracking
└── README.md
```

---

## 🔄 Syncing Process

### Initial Setup

1. **Run sync script:**

   ```bash
   cd smugglers
   npm run code-roach:sync-standalone
   ```

2. **This will:**
   - Create `../code-roach-standalone/` directory
   - Copy all Code Roach files
   - Create directory structure
   - Generate `package.json` and `README.md`
   - Track sync in `.sync-manifest.json`

### Regular Syncing

**After making Code Roach changes in Smugglers:**

```bash
npm run code-roach:sync-standalone
```

The script will:

- ✅ Copy new/changed files
- ⏭️ Skip unchanged files
- 📝 Track what's been synced
- 🔄 Preserve standalone-specific changes

---

## 🛠️ How It Works

### File Mapping

The sync script maps files from Smugglers to standalone:

| Smugglers Location                   | Standalone Location                |
| ------------------------------------ | ---------------------------------- |
| `server/services/codebaseIndexer.js` | `src/services/codebaseIndexer.js`  |
| `server/routes/api.js`               | `src/routes/api.js`                |
| `public/code-roach-dashboard.html`   | `public/code-roach-dashboard.html` |
| `scripts/batch-review-issues.js`     | `scripts/batch-review-issues.js`   |
| `docs/CODE-ROACH-*.md`               | `docs/CODE-ROACH-*.md`             |

### Transformations

Files are automatically transformed:

- ✅ Header comments added (source tracking)
- ✅ Relative paths adjusted if needed
- ✅ Game-specific code preserved (for now)

### Sync Manifest

`.sync-manifest.json` tracks:

- Last sync timestamp
- All synced files
- File sizes and modification times
- Sync statistics

---

## 🎨 Standalone-Specific Changes

### Protected Directory

**`.standalone-overrides/`** - Files here are **NOT synced**:

```
code-roach-standalone/
├── .standalone-overrides/
│   ├── config.js              # Standalone config
│   ├── package.json           # Standalone dependencies
│   └── custom-features/       # Standalone-only features
```

### Making Standalone Changes

1. **For new features:**
   - Add to `.standalone-overrides/`
   - These won't be overwritten

2. **For modifications:**
   - Copy file to `.standalone-overrides/`
   - Modify there
   - Update imports to use override

3. **For shared improvements:**
   - Make changes in Smugglers
   - Sync to standalone
   - Both benefit

---

## 🔀 Development Workflow

### Scenario 1: Code Roach Improvement in Smugglers

1. **Make changes in Smugglers:**

   ```bash
   # Edit server/services/codebaseIndexer.js
   ```

2. **Test in Smugglers:**

   ```bash
   npm test
   ```

3. **Sync to standalone:**

   ```bash
   npm run code-roach:sync-standalone
   ```

4. **Both projects benefit!** ✅

### Scenario 2: Standalone-Only Feature

1. **Create in standalone:**

   ```bash
   # Create .standalone-overrides/custom-feature.js
   ```

2. **Develop independently:**
   - Won't affect Smugglers
   - Won't be overwritten on sync

3. **If useful, port back:**
   - Copy to Smugglers
   - Both projects benefit

### Scenario 3: Breaking Change Needed

1. **Plan the change:**
   - Document what needs to change
   - Consider impact on both projects

2. **Make change in Smugglers:**
   - Update Code Roach code
   - Test thoroughly

3. **Sync to standalone:**
   - Sync script updates files
   - May need manual adjustments

4. **Update standalone if needed:**
   - Use `.standalone-overrides/` for differences

---

## 📊 What Gets Synced

### ✅ Synced (105+ files)

**Core Services (79 files):**

- Code intelligence (indexing, search, analysis)
- Fix generation (all fix generators)
- Learning systems (knowledge base, learning)
- Analysis & prediction
- AI/ML services
- Infrastructure (caching, monitoring)
- Integrations (Git, CI/CD, Slack)
- Analytics

**Routes:**

- API endpoints (94 Code Roach endpoints)
- Knowledge base routes

**UI/Dashboards:**

- Code quality dashboard
- Knowledge base dashboard
- IDE integration

**Scripts:**

- Batch review
- Super worker integration
- Asset extraction
- Monitoring

**Documentation:**

- All Code Roach docs

**Migrations:**

- Supabase schema migrations

### ❌ NOT Synced

**Game-Specific:**

- Game services (NPC, economy, etc.)
- Game routes
- Game UI
- Game-specific scripts

**Standalone Overrides:**

- `.standalone-overrides/` directory
- Standalone-specific configs

---

## 🚨 Important Notes

### 1. Don't Edit Synced Files Directly

**❌ Bad:**

```bash
# Editing synced file directly
vim code-roach-standalone/src/services/codebaseIndexer.js
# Changes will be lost on next sync!
```

**✅ Good:**

```bash
# Use override directory
cp code-roach-standalone/src/services/codebaseIndexer.js \
   code-roach-standalone/.standalone-overrides/codebaseIndexer.js
# Edit the override version
```

### 2. Keep Smugglers as Source of Truth

- **Smugglers** = Source of truth for Code Roach
- **Standalone** = Synced copy for productization
- Make improvements in Smugglers first
- Sync to standalone

### 3. Track Standalone Changes

Document standalone-specific changes:

```markdown
# .standalone-overrides/CHANGES.md

## Standalone-Specific Modifications

### config.js

- Removed game-specific config
- Added multi-tenant support

### package.json

- Added standalone dependencies
- Removed game dependencies
```

---

## 🔧 Customization

### Adding Files to Sync

Edit `scripts/sync-code-roach-standalone.js`:

```javascript
const FILE_MAPPINGS = {
  services: [
    // Add new service files here
    "newService.js",
  ],
  // ...
};
```

### Excluding Files

Files in `.standalone-overrides/` are never synced.

### Custom Transformations

Modify `transformForStandalone()` in sync script:

```javascript
transformForStandalone(content, filePath) {
    // Add custom transformations
    if (filePath.includes('config.js')) {
        // Remove game-specific config
        content = content.replace(/gameConfig/g, 'standaloneConfig');
    }
    return content;
}
```

---

## 📈 Future Evolution

### Phase 1: Parallel Development (Current)

- ✅ Sync structure in place
- ✅ Both projects evolve
- ✅ No breaking changes

### Phase 2: Standalone Customization

- Standalone-specific features
- Different dependencies
- Custom branding

### Phase 3: Independent Evolution

- Standalone becomes independent
- Shared core library
- Separate versioning

### Phase 4: Product Launch

- Standalone package
- NPM package
- Full productization

---

## 🎯 Benefits

### For Smugglers

- ✅ Code Roach continues to improve
- ✅ No disruption to game development
- ✅ Innovation continues
- ✅ Both projects benefit

### For Standalone

- ✅ Ready for productization
- ✅ Can customize independently
- ✅ Tracked sync process
- ✅ Future-ready structure

### For You

- ✅ No breaking changes
- ✅ Parallel development
- ✅ Future flexibility
- ✅ Innovation preserved

---

## 🚀 Quick Start

1. **Initial sync:**

   ```bash
   cd smugglers
   npm run code-roach:sync-standalone
   ```

2. **Check standalone structure:**

   ```bash
   ls -la ../code-roach-standalone/
   ```

3. **Make Code Roach changes in Smugglers:**

   ```bash
   # Edit Code Roach files
   ```

4. **Sync again:**

   ```bash
   npm run code-roach:sync-standalone
   ```

5. **Develop standalone features:**
   ```bash
   cd ../code-roach-standalone
   # Add to .standalone-overrides/
   ```

---

## 📚 Related Documents

- [Productization Strategy](./CODE-ROACH-PRODUCTIZATION-STRATEGY.md)
- [Complete Absorption Report](./CODE-ROACH-COMPLETE-ABSORPTION-REPORT.md)
- [Standalone Product Plan](./CODE-ROACH-STANDALONE-PRODUCT-PLAN.md)

---

**Ready to sync? Run `npm run code-roach:sync-standalone`!** 🚀

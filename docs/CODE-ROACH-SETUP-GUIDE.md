# Code Roach: Setup Guide for Smugglers Project 🪳

## Overview

This guide shows you how to set up Code Roach with the Smugglers project, including GitHub Actions integration and VS Code/Cursor extension.

---

## 🚀 Quick Setup

### 1. Code Roach is Already Running!

Code Roach is **already integrated and running** in the Smugglers app:

- ✅ Backend services running on `http://localhost:3000`
- ✅ Frontend widget loaded on game pages
- ✅ API endpoints available
- ✅ Real-time error detection and fixing

### 2. How to Use Code Roach

#### Option A: Via Web Interface (Easiest)

1. **Game Health Dashboard**: Navigate to `http://localhost:3000/smugglers-game-health`
2. **IDE Integration Page**: Navigate to `http://localhost:3000/code-roach-ide`
3. **Main Dashboard**: Navigate to `http://localhost:3000/code-roach-dashboard`

#### Option B: Via CLI (For Automation)

```bash
# Initialize (already done)
npm run code-roach init

# Test connection
npm run code-roach test

# Analyze code
npm run code-roach analyze code --file server/routes/api.js

# Get health score
npm run code-roach health --file server/routes/api.js
```

#### Option C: Via VS Code/Cursor Extension

See "VS Code/Cursor Extension" section below.

---

## 🔗 GitHub Actions Integration

### Setup Complete! ✅

The GitHub Actions workflow has been created at:
`.github/workflows/code-roach.yml`

### Next Steps:

1. **Add GitHub Secrets:**
   - Go to your GitHub repository
   - Settings → Secrets and variables → Actions
   - Add these secrets:
     - `CODE_ROACH_URL`: `https://your-production-server.com` (or keep `http://localhost:3000` for local)
     - `CODE_ROACH_API_KEY`: Your API key (if you have one, or leave empty for local)

2. **Push to GitHub:**

   ```bash
   git add .github/workflows/code-roach.yml
   git commit -m "Add Code Roach GitHub Actions integration"
   git push
   ```

3. **What It Does:**
   - Automatically analyzes every PR
   - Comments on PRs with analysis results
   - Blocks merge if critical issues found
   - Stores analysis artifacts

---

## 💻 VS Code / Cursor Extension

### Option 1: Use Web Interface (Recommended for Now)

Since we're in Cursor (which is VS Code-based), you can use the web interface:

1. **Open in Browser:**

   ```
   http://localhost:3000/code-roach-ide
   ```

2. **Features Available:**
   - Test connection to Code Roach server
   - Get health scores for files
   - Ask natural language questions
   - Review code
   - All IDE features in a web interface

### Option 2: Install VS Code Extension (In Development)

**Status:** Extension template is 95% complete. The Code Roach team is working on final API path corrections and testing.

**Current State:**

- ✅ Extension template created at `.vscode-extension/`
- ✅ All 4 commands implemented (Analyze, Health, Auto-Fix, Query)
- ✅ Configuration system ready
- ⚠️ API endpoint paths need correction (see spec below)
- ⏳ Testing and packaging pending

**For the Code Roach Team:**

- 📋 **Full Specification:** See `docs/CODE-ROACH-VSCODE-EXTENSION-SPEC.md`
- 🔧 **Main Task:** Fix API endpoint paths in `.vscode-extension/src/extension.ts`
- 🧪 **Testing:** Complete end-to-end testing of all 4 commands

**Once Complete:**

1. **Build Extension:**

   ```bash
   cd .vscode-extension
   npm install
   npm run compile
   ```

2. **Test in Development:**
   - Open VS Code / Cursor
   - Press F5 to run extension in development mode

3. **Package for Distribution:**

   ```bash
   npm install -g vsce
   vsce package
   ```

4. **Install:**

   ```bash
   code --install-extension code-roach-1.0.0.vsix
   ```

5. **Configure:**
   - Open Settings (Cmd+, or Ctrl+,)
   - Search "Code Roach"
   - Set `codeRoach.serverUrl` to `http://localhost:3000`

6. **Use Commands:**
   - Press Cmd+Shift+P (Mac) or Ctrl+Shift+P (Windows/Linux)
   - Type "Code Roach" to see commands:
     - `Code Roach: Analyze File`
     - `Code Roach: Show Health Score`
     - `Code Roach: Auto-Fix Errors`
     - `Code Roach: Ask Question`

### Option 3: Use CLI in Terminal

You can run Code Roach commands directly in Cursor's terminal:

```bash
# In Cursor's integrated terminal
npm run code-roach health --file server/routes/api.js
npm run code-roach analyze code --file server/routes/api.js
```

---

## 🎯 Recommended Workflow

### For Daily Development:

1. **Code Roach runs automatically** - No action needed!
   - Errors are caught and fixed automatically
   - Health scores are tracked
   - Fixes are applied when safe

2. **Check Health Scores:**

   ```bash
   # Via CLI
   npm run code-roach health --file <file-path>

   # Or via web
   http://localhost:3000/code-roach-ide
   ```

3. **Before Committing:**

   ```bash
   # Analyze changed files
   npm run code-roach analyze code --file <changed-file>
   ```

4. **On Pull Requests:**
   - GitHub Actions automatically analyzes PRs
   - Check PR comments for Code Roach analysis

### For Debugging:

1. **Ask Code Roach:**

   ```bash
   # Via web interface
   http://localhost:3000/code-roach-ide
   # Use "Natural Language Query" section
   ```

2. **View Game Health:**

   ```
   http://localhost:3000/smugglers-game-health
   ```

3. **View Full Dashboard:**
   ```
   http://localhost:3000/code-roach-dashboard
   ```

---

## 📊 What's Already Working

### ✅ Backend Services

- Error detection and analysis
- Auto-fixing
- Health scoring
- Natural language queries
- Code review
- Game-specific analysis

### ✅ Frontend Integration

- Code Roach widget on game pages
- Admin-only visibility
- Real-time error fixing
- Game health dashboard

### ✅ API Endpoints

- All Code Roach APIs available
- Integration management
- Health scores
- Error analysis

### ✅ CLI Tool

- Configuration management
- Code analysis
- Health scoring
- Integration setup

---

## 🔧 Configuration

### Current Configuration (`.code-roach.json`):

```json
{
  "version": "1.0.0",
  "serverUrl": "http://localhost:3000",
  "apiKey": null,
  "integrations": {
    "github": { "enabled": false },
    "gitlab": { "enabled": false },
    "slack": { "enabled": false },
    "teams": { "enabled": false },
    "sentry": { "enabled": false },
    "datadog": { "enabled": false }
  }
}
```

### Update Configuration:

```bash
npm run code-roach config set serverUrl http://localhost:3000
```

---

## 🎮 Game-Specific Features

Code Roach is already protecting the Smugglers game:

- **Game Health Dashboard**: `/smugglers-game-health`
- **Game-specific error detection**
- **Player impact tracking**
- **Save data protection**
- **Performance monitoring**

---

## 🚀 Next Steps

1. **Test the Setup:**

   ```bash
   npm run code-roach test
   ```

2. **Try the Web Interface:**
   - Open: `http://localhost:3000/code-roach-ide`
   - Test connection
   - Get health score for a file
   - Ask a question

3. **Set Up GitHub Secrets** (if using GitHub Actions):
   - Add `CODE_ROACH_URL` and `CODE_ROACH_API_KEY` to GitHub

4. **Use in Development:**
   - Code Roach runs automatically
   - Check health scores before committing
   - Use web interface for queries

---

## 📝 Summary

**Code Roach is already running and protecting your code!**

- ✅ **Backend**: Running on `http://localhost:3000`
- ✅ **Frontend**: Widget on game pages
- ✅ **CLI**: Available via `npm run code-roach`
- ✅ **GitHub Actions**: Workflow created
- ✅ **Web Interface**: Available at `/code-roach-ide`
- ✅ **VS Code Extension**: Template generated (can be developed further)

**You can use Code Roach via:**

1. **Web Interface** (easiest) - `http://localhost:3000/code-roach-ide`
2. **CLI** - `npm run code-roach <command>`
3. **VS Code Extension** - When installed
4. **Automatic** - Already running in background!

---

**Happy coding with Code Roach!** 🪳

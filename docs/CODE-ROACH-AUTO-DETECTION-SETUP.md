# Code Roach: Automatic Detection Setup

## Active Issue Detection During Development

---

## 🎯 Overview

Code Roach now automatically detects issues while you're developing! It runs in **active mode** when in development.

---

## ✅ What's Now Active (Development Mode)

### 1. File Watcher (Real-Time)

- ✅ **Watches** `server/`, `public/`, `scripts/` directories
- ✅ **Detects issues** when files change
- ✅ **Debounced** - Waits 3 seconds after last change
- ✅ **Automatic** - No manual action needed

### 2. Initial Crawl (Optional)

- ✅ **Runs on server start** (if enabled)
- ✅ **Background process** - Doesn't block server
- ✅ **Finds issues** in existing code
- ✅ **Auto-fixes** (if enabled)

### 3. Periodic Crawls (Optional)

- ✅ **Runs every 6 hours** (if enabled)
- ✅ **Comprehensive scan** of codebase
- ✅ **Review required** - Safe for periodic scans

---

## ⚙️ Configuration

### Environment Variables

Add to your `.env` file:

```bash
# Enable automatic detection (default: true in development)
CODE_ROACH_AUTO_DETECT=true

# Enable initial crawl on server start (optional)
CODE_ROACH_AUTO_CRAWL=true

# Enable auto-fixing (optional, be careful!)
CODE_ROACH_AUTO_FIX=false

# Enable periodic crawls (optional)
CODE_ROACH_PERIODIC_CRAWL=false
```

### Default Behavior

**Development Mode (`NODE_ENV=development`):**

- ✅ File watcher: **Enabled**
- ❌ Initial crawl: **Disabled** (set `CODE_ROACH_AUTO_CRAWL=true`)
- ❌ Auto-fix: **Disabled** (set `CODE_ROACH_AUTO_FIX=true`)
- ❌ Periodic crawl: **Disabled** (set `CODE_ROACH_PERIODIC_CRAWL=true`)

**Production Mode:**

- ❌ All automatic detection: **Disabled**
- ✅ Alert service: **Enabled** (monitors existing issues)

---

## 🚀 How It Works

### File Watcher Flow

```
1. You edit a file (e.g., server/services/myService.js)
   ↓
2. File watcher detects change
   ↓
3. Waits 3 seconds (debounce)
   ↓
4. Analyzes file for issues
   ↓
5. Detects issues automatically
   ↓
6. Logs to console: "🔍 Detected X issue(s) in file"
   ↓
7. Issues saved to database
   ↓
8. Appears in dashboard
```

### Initial Crawl Flow

```
1. Server starts
   ↓
2. Waits 5 seconds
   ↓
3. Starts background crawl
   ↓
4. Scans all code files
   ↓
5. Finds issues
   ↓
6. Auto-fixes (if enabled)
   ↓
7. Logs results
```

---

## 📊 What You'll See

### Console Output

**On Server Start:**

```
⚡ Code Roach Lightning Ship: Alert service started
👀 Code Roach: File watcher started (real-time issue detection)
🕷️  Code Roach: Initial crawl scheduled (runs in background)
```

**When File Changes:**

```
[WATCHER] Re-indexing 1 changed file(s)...
🔍 Detected 3 issue(s) in server/services/myService.js
```

**After Initial Crawl:**

```
✅ [Code Roach] Initial crawl complete: 534 issues found, 254 auto-fixed
```

---

## 🎛️ Control Options

### Enable Everything (Aggressive)

```bash
# .env
CODE_ROACH_AUTO_DETECT=true
CODE_ROACH_AUTO_CRAWL=true
CODE_ROACH_AUTO_FIX=true
CODE_ROACH_PERIODIC_CRAWL=true
```

**Result:**

- Real-time file watching
- Initial crawl on start
- Auto-fixes issues
- Periodic crawls every 6 hours

### Conservative (Recommended for Start)

```bash
# .env
CODE_ROACH_AUTO_DETECT=true
CODE_ROACH_AUTO_CRAWL=false
CODE_ROACH_AUTO_FIX=false
CODE_ROACH_PERIODIC_CRAWL=false
```

**Result:**

- Real-time file watching only
- No automatic crawling
- No auto-fixing
- Manual control

### Development-Friendly

```bash
# .env
CODE_ROACH_AUTO_DETECT=true
CODE_ROACH_AUTO_CRAWL=true
CODE_ROACH_AUTO_FIX=false  # Review required
CODE_ROACH_PERIODIC_CRAWL=false
```

**Result:**

- Real-time file watching
- Initial crawl on start
- Issues detected but not auto-fixed
- You review and fix manually

---

## 🔧 Customization

### Change Watched Directories

Edit `server/server.js`:

```javascript
const watcher = new CodebaseWatcher({
  watchPaths: ["server", "public", "scripts", "tests"], // Add more
  debounceMs: 5000, // Increase debounce time
  detectIssues: true,
});
```

### Change Debounce Time

```javascript
debounceMs: 5000, // Wait 5 seconds (default: 3s)
```

### Disable Issue Detection

```javascript
detectIssues: false, // Only re-index, don't detect issues
```

---

## 📈 Performance Impact

### File Watcher

- **CPU:** Low (~1-2% when idle)
- **Memory:** Minimal (~10-20MB)
- **Disk I/O:** Only on file changes
- **Network:** None

### Initial Crawl

- **CPU:** Moderate (during crawl)
- **Memory:** Moderate (~50-100MB)
- **Disk I/O:** High (reading all files)
- **Network:** API calls for embeddings

### Recommendations

- ✅ **File watcher:** Safe to always enable
- ⚠️ **Initial crawl:** Enable if you want comprehensive scan
- ⚠️ **Auto-fix:** Use carefully, review first
- ❌ **Periodic crawl:** Only if needed (resource intensive)

---

## 🚨 Troubleshooting

### Watcher Not Starting

**Check:**

1. Is `NODE_ENV=development`?
2. Is `CODE_ROACH_AUTO_DETECT=true`?
3. Check console for errors

**Fix:**

```bash
export NODE_ENV=development
export CODE_ROACH_AUTO_DETECT=true
npm run dev
```

### Too Many Issues Detected

**Solution:**

- Increase debounce time
- Disable auto-fix
- Review issues before fixing

### Performance Issues

**Solution:**

- Reduce watched directories
- Increase debounce time
- Disable initial crawl
- Disable periodic crawl

---

## ✅ Quick Start

### Minimal Setup (Recommended)

1. **Start server:**

   ```bash
   npm run dev
   ```

2. **File watcher starts automatically** ✅

3. **Edit a file** - Issues detected automatically!

### Full Setup

1. **Add to `.env`:**

   ```bash
   CODE_ROACH_AUTO_DETECT=true
   CODE_ROACH_AUTO_CRAWL=true
   CODE_ROACH_AUTO_FIX=false
   ```

2. **Start server:**

   ```bash
   npm run dev
   ```

3. **Watch the magic happen!** ✨

---

## 📚 Related Docs

- [Active vs Passive Detection](./CODE-ROACH-ACTIVE-VS-PASSIVE.md)
- [Analysis Models](./CODE-ROACH-ANALYSIS-MODELS.md)
- [Setup Guide](./CODE-ROACH-SETUP-GUIDE.md)

---

**Code Roach is now actively watching and detecting issues!** 🪳✨

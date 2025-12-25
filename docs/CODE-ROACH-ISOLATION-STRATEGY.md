# Code Roach: Isolation Strategy

**Purpose:** Ensure Code Roach SaaS development doesn't interfere with Smugglers game development

---

## 🎯 Current Structure

### Code Roach Components (Isolated)

**Services:**

- `server/services/jobQueue.js` - Job queue (optional, fails gracefully)
- `server/services/cacheService.js` - Cache (optional, fails gracefully)
- `server/services/projectService.js` - Project management (optional)
- `server/middleware/auth.js` - Auth middleware (optional)

**Workers:**

- `server/workers/crawlWorker.js` - Background worker (optional)

**Routes:**

- `server/routes/codeRoachAPI.js` - All Code Roach endpoints under `/api/code-roach/*`

**Database:**

- `supabase/migrations/20251213_code_roach_saas.sql` - Separate schema

---

## ✅ Isolation Mechanisms

### 1. Optional Dependencies

All Code Roach services use try/catch and fail gracefully:

```javascript
try {
  jobQueue = require("./services/jobQueue");
  jobQueue.initialize().catch((err) => {
    console.warn("⚠️ Job queue not available");
  });
} catch (err) {
  // Code Roach not available - game continues normally
}
```

### 2. Separate API Routes

All Code Roach endpoints are under `/api/code-roach/*`:

- No conflicts with game routes
- Can be disabled by not registering the router
- Game routes remain untouched

### 3. Separate Database Tables

Code Roach uses its own tables:

- `organizations`, `projects`, `code_roach_*` tables
- No interference with game tables
- Can be in same database or separate

### 4. Environment-Based Activation

Code Roach features only activate if:

- Environment variables are set
- Services initialize successfully
- No errors if missing

---

## 🔧 How to Disable Code Roach

### Option 1: Don't Set Environment Variables

```bash
# Don't set these:
# REDIS_URL=
# SUPABASE_URL= (or use different project)
```

### Option 2: Don't Register Routes

In `server/routes/api.js`, comment out:

```javascript
// Code Roach API routes
// try {
//     const codeRoachAPI = require('./codeRoachAPI');
//     app.use('/api/code-roach', codeRoachAPI);
// } catch (err) { }
```

### Option 3: Feature Flag

Add to `server/config.js`:

```javascript
codeRoach: {
  enabled: process.env.CODE_ROACH_ENABLED !== "false";
}
```

---

## 📁 Recommended Organization

### Current (Good):

```
server/
  services/
    jobQueue.js          # Code Roach
    cacheService.js      # Code Roach
    projectService.js    # Code Roach
    gameStateService.js  # Smugglers
    # ... other game services
  routes/
    codeRoachAPI.js      # Code Roach (isolated)
    api.js               # Game routes
  workers/
    crawlWorker.js       # Code Roach
```

### Alternative (Better Isolation):

```
server/
  code-roach/           # All Code Roach code
    services/
    routes/
    workers/
  services/             # Game services only
  routes/               # Game routes only
```

---

## 🚀 Co-Development Strategy

### Development Workflow

1. **Game Development:**
   - Work in `server/services/`, `server/routes/` (game files)
   - Code Roach services are optional and won't interfere
   - Game functionality unaffected

2. **Code Roach Development:**
   - Work in Code Roach-specific files
   - Test with `CODE_ROACH_ENABLED=true`
   - All changes isolated to Code Roach components

3. **Shared Infrastructure:**
   - Supabase: Can use same database, different tables
   - Redis: Can use same instance, different keys
   - Server: Same Express app, different routes

---

## ✅ Safety Checks

### What Won't Break:

- ✅ Game functionality
- ✅ Game API routes
- ✅ Game database tables
- ✅ Game services
- ✅ Socket.io connections
- ✅ Game state management

### What's Isolated:

- ✅ Code Roach API routes (`/api/code-roach/*`)
- ✅ Code Roach services (optional)
- ✅ Code Roach database tables
- ✅ Code Roach workers (optional)

---

## 🎯 Best Practices

### 1. Use Feature Flags

```javascript
// server/config.js
codeRoach: {
    enabled: process.env.CODE_ROACH_ENABLED === 'true',
    // Only enable if explicitly set
}
```

### 2. Graceful Degradation

All Code Roach code should:

- Try/catch all requires
- Fail silently if not available
- Not block server startup
- Log warnings, not errors

### 3. Separate Testing

- Game tests: `tests/game/*`
- Code Roach tests: `tests/code-roach/*`
- No cross-dependencies

### 4. Environment Separation

```bash
# Game development
NODE_ENV=development
CODE_ROACH_ENABLED=false

# Code Roach development
NODE_ENV=development
CODE_ROACH_ENABLED=true
REDIS_URL=...
SUPABASE_URL=...
```

---

## 📋 Migration Path (If Needed)

If we want even better isolation:

1. **Create `server/code-roach/` directory**
2. **Move Code Roach files:**

   ```bash
   mv server/services/jobQueue.js server/code-roach/services/
   mv server/services/cacheService.js server/code-roach/services/
   mv server/routes/codeRoachAPI.js server/code-roach/routes/
   mv server/workers/crawlWorker.js server/code-roach/workers/
   ```

3. **Update requires:**

   ```javascript
   // server/routes/api.js
   const codeRoachAPI = require("../code-roach/routes/codeRoachAPI");
   ```

4. **Benefits:**
   - Clear separation
   - Easy to disable
   - Easy to extract later

---

## ✅ Current Status

**Isolation Level:** ✅ **Good**

- All Code Roach code is optional
- Fails gracefully if not configured
- Separate API routes
- Separate database tables
- No interference with game

**Recommendation:** Current structure is fine for co-development. We can continue as-is or move to `server/code-roach/` directory for even better organization.

---

## 🎯 Next Steps

1. **Continue co-development** - Current structure works
2. **Optional:** Move to `server/code-roach/` for better organization
3. **Add feature flag** - `CODE_ROACH_ENABLED` environment variable
4. **Document separation** - Keep this doc updated

---

**Status:** ✅ Safe to co-develop  
**Isolation:** ✅ Good  
**Recommendation:** Continue as-is or organize into `server/code-roach/`

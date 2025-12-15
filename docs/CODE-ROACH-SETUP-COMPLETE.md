# Code Roach: Complete Setup Guide

**Final setup steps to get Code Roach fully operational**

---

## ✅ Quick Setup (Automated)

```bash
# Run complete setup
npm run code-roach:setup:complete

# Or use the first-run script
bash scripts/code-roach-first-run.sh
```

---

## 📋 Manual Setup Steps

### 1. Environment Variables

Create/update `.env` file:

```bash
# Required
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Optional (for full functionality)
REDIS_URL=redis://localhost:6379
# OR
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token

GITHUB_TOKEN=ghp_your-token
OPENAI_API_KEY=sk-your-key
```

---

### 2. Install Dependencies

```bash
npm install
```

**Required packages:**
- `bullmq` - Job queue
- `ioredis` - Redis client
- `@octokit/rest` - GitHub API
- `@supabase/supabase-js` - Supabase client
- `commander` - CLI framework

---

### 3. Database Migration

**Option A: Supabase Dashboard**
1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to SQL Editor
4. Copy contents of `supabase/migrations/20251213_code_roach_saas.sql`
5. Paste and run

**Option B: Supabase CLI**
```bash
supabase link --project-ref YOUR_PROJECT_REF
supabase db push
```

**Option C: Manual SQL**
- Open `supabase/migrations/20251213_code_roach_saas.sql`
- Copy SQL
- Run in Supabase SQL Editor

---

### 4. Verify Installation

```bash
# Verify all files and packages
node scripts/code-roach-verify-installation.js

# Complete setup check
npm run code-roach:setup:complete

# Health check
npm run code-roach:health
```

---

### 5. Test Everything

```bash
# Test setup
code-roach-saas test

# Test crawl
code-roach-saas crawl

# Check status
code-roach-saas status
```

---

## ✅ Verification Checklist

- [ ] Environment variables set
- [ ] Dependencies installed
- [ ] Database migration run
- [ ] All services initialize
- [ ] CLI commands work
- [ ] API routes accessible
- [ ] Health check passes

---

## 🚀 First Commands to Try

```bash
# 1. Test setup
code-roach-saas test

# 2. Check configuration
code-roach-saas config --validate

# 3. Run health check
npm run code-roach:health

# 4. Run first crawl
code-roach-saas crawl

# 5. View issues
code-roach-saas issues

# 6. Get statistics
code-roach-saas stats
```

---

## 🎯 Common Issues & Solutions

### Issue: "Redis URL not configured"
**Solution:** Set `REDIS_URL` or `UPSTASH_REDIS_REST_URL` in `.env`
**Impact:** Job queue and cache will use in-memory fallback (works but not persistent)

### Issue: "Database tables not found"
**Solution:** Run database migration (see Step 3)
**Impact:** Issue storage won't work until migration is run

### Issue: "GitHub token not configured"
**Solution:** Set `GITHUB_TOKEN` in `.env` (optional)
**Impact:** GitHub integration features won't work

### Issue: "Supabase connection failed"
**Solution:** Check `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
**Impact:** Database operations won't work

---

## 📊 Setup Status

After running setup, you'll see:

```
✅ Environment variables set
✅ Database connected
✅ Tables exist (or migration needed)
✅ Services initialized
✅ CLI working
✅ API routes registered
```

---

## 🎉 Success!

Once setup is complete, Code Roach is ready to use!

**Next Steps:**
1. Run your first crawl
2. Explore the CLI commands
3. Set up GitHub webhooks (optional)
4. Start building the frontend dashboard

---

**Setup Version:** 1.0.0  
**Last Updated:** December 2025

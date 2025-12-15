# Code Roach Deployment - Ready! 🚀

**Status:** All infrastructure code and scripts are ready  
**Next:** Manual deployment steps (requires interactive Railway CLI)

---

## ✅ What's Ready

### Infrastructure Code
- ✅ `railway.json` - Configured for 99.99% uptime (3-10 replicas)
- ✅ Deployment scripts
- ✅ Health check endpoints
- ✅ Circuit breakers
- ✅ Monitoring service
- ✅ Auto-scaling configuration

### Scripts Available
- ✅ `npm run railway:link` - Link to Railway project
- ✅ `npm run deploy:infrastructure` - Deploy infrastructure
- ✅ `npm run deploy:sync-env` - Sync environment variables
- ✅ `npm run verify:infrastructure` - Verify deployment
- ✅ `npm run setup:monitoring` - Set up monitoring

### Documentation
- ✅ `docs/DEPLOYMENT-GUIDE.md` - Complete deployment guide
- ✅ `docs/DEPLOYMENT-CHECKLIST.md` - Step-by-step checklist

---

## 🚀 Deployment Steps

### Step 1: Link to Railway Project

**Run this command (it will prompt you to select the project):**

```bash
cd /Users/jeffadkins/Smugglers/code-roach-standalone
npm run railway:link
```

**When prompted:**
1. Select workspace: `repairman29's Projects`
2. Select project: Look for project ID `f884c91a-3d81-49c8-a769-354456c1d979`
   - Or look for project name "Code Roach" or similar

**Verify:**
```bash
railway status
```

Should show:
```
Project: [Code Roach project]
Environment: production
```

---

### Step 2: Set Environment Variables

**Option A: Set in Railway Dashboard (Recommended)**

1. Go to: https://railway.com/project/f884c91a-3d81-49c8-a769-354456c1d979
2. Click "Variables" tab
3. Add these variables:

**Required:**
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NODE_ENV=production
PORT=3000
```

**Optional (but recommended):**
```
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
OPENAI_API_KEY=sk-your-key
```

**Option B: Sync from .env (if you have one)**

```bash
npm run deploy:sync-env
```

---

### Step 3: Deploy Infrastructure

**Deploy to Railway:**

```bash
npm run deploy:infrastructure
```

This will:
1. Verify Railway connection
2. Check environment variables
3. Deploy with multi-instance configuration
4. Set up health checks

**Or deploy manually:**

```bash
railway up
```

---

### Step 4: Configure Scaling in Railway Dashboard

1. Go to Railway project dashboard
2. Click "Settings" → "Scaling"
3. Configure:
   - **Min instances:** 3
   - **Max instances:** 10
   - **Auto-scaling:** Enabled
   - **CPU threshold:** 70%
   - **Memory threshold:** 80%

**Note:** The `railway.json` file already has these settings, but verify in dashboard.

---

### Step 5: Verify Deployment

**Check health endpoints:**

```bash
npm run verify:infrastructure
```

**Or manually:**

```bash
# Get your Railway URL
railway domain

# Test health endpoints
curl https://your-app.railway.app/api/health
curl https://your-app.railway.app/api/health/ready
curl https://your-app.railway.app/api/metrics
```

**Expected:**
- `/api/health` - Returns 200 or 503 (degraded is OK if Redis not configured)
- `/api/health/ready` - Returns 200
- `/api/metrics` - Returns metrics JSON

---

### Step 6: Set Up Monitoring (Optional but Recommended)

```bash
npm run setup:monitoring
```

Follow the interactive prompts to set up:
1. UptimeRobot (free - uptime monitoring)
2. Datadog (APM and metrics)
3. Sentry (error tracking)
4. PagerDuty (on-call management)
5. Logtail (log aggregation)

---

## 📊 What You'll Get

### Multi-Instance Deployment
- **3-10 instances** running simultaneously
- **Automatic load balancing** by Railway
- **Health check-based routing** - unhealthy instances removed
- **Zero-downtime deployments**

### Auto-Scaling
- **Scale up** when CPU > 70% or Memory > 80%
- **Scale down** when CPU < 30% and Memory < 50%
- **Cooldown period** prevents thrashing

### Health Monitoring
- **6 health endpoints** for comprehensive monitoring
- **Circuit breakers** protect against cascading failures
- **Metrics collection** for performance tracking
- **Automatic failover** when instances fail

### High Availability
- **99.99% uptime target** (52.56 minutes downtime/year max)
- **Automatic instance replacement** on failure
- **Graceful degradation** when services unavailable
- **Retry logic** with exponential backoff

---

## 🔍 Verification Checklist

After deployment, verify:

- [ ] Railway project linked correctly
- [ ] Environment variables set
- [ ] Deployment successful (check Railway dashboard)
- [ ] Health endpoints responding
- [ ] Scaling configured (3-10 instances)
- [ ] Auto-scaling enabled
- [ ] Monitoring set up (optional)

---

## 🆘 Troubleshooting

### "Failed to link project"

**Solution:**
1. Make sure you're logged in: `railway login`
2. Run link command interactively (not piped)
3. Select the correct project from the list

### "Environment variables missing"

**Solution:**
1. Set variables in Railway dashboard
2. Or create `.env` file and run `npm run deploy:sync-env`

### "Health checks failing"

**Solution:**
1. Check Railway logs: `railway logs`
2. Verify database connection (SUPABASE_URL and key)
3. Check if server is starting correctly

### "Scaling not working"

**Solution:**
1. Verify in Railway dashboard → Settings → Scaling
2. Check that auto-scaling is enabled
3. Verify thresholds match `railway.json`

---

## 📚 Next Steps

After successful deployment:

1. **Set up Redis HA** (optional but recommended)
   - Create Upstash account
   - Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`

2. **Set up Database Read Replicas** (optional)
   - Upgrade to Supabase Pro
   - Create read replicas
   - Set `SUPABASE_READ_REPLICA_1_URL` and `SUPABASE_READ_REPLICA_2_URL`

3. **Set up External Monitoring**
   - Run `npm run setup:monitoring`
   - Configure alerts

4. **Test Auto-Scaling**
   - Generate load
   - Verify instances scale up
   - Verify instances scale down

---

## 🎯 Quick Commands Reference

```bash
# Link to Railway
npm run railway:link

# Check current project
railway status

# Deploy
npm run deploy:infrastructure
# or
railway up

# Sync environment variables
npm run deploy:sync-env

# Verify deployment
npm run verify:infrastructure

# Set up monitoring
npm run setup:monitoring

# View logs
railway logs

# View variables
railway variables
```

---

## ✅ Ready to Deploy!

**All code and scripts are ready. Follow the steps above to deploy!**

**Start with:**
```bash
cd /Users/jeffadkins/Smugglers/code-roach-standalone
npm run railway:link
```

Then continue with the steps above.

---

**Last Updated:** December 2025  
**Status:** ✅ Ready for deployment

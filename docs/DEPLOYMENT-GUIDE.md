# Code Roach Deployment Guide 🚀

**Complete guide for deploying Code Roach with 99.99% uptime infrastructure**

---

## 🎯 Quick Start

### One-Command Deployment

```bash
npm run deploy:infrastructure
```

This will:
1. ✅ Link to Railway project
2. ✅ Sync environment variables
3. ✅ Deploy with multi-instance scaling
4. ✅ Configure health checks

---

## 📋 Prerequisites

### 1. Railway Project

**Project ID:** `f884c91a-3d81-49c8-a769-354456c1d979`  
**URL:** https://railway.com/project/f884c91a-3d81-49c8-a769-354456c1d979

### 2. Environment Variables

Required in Railway:
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NODE_ENV=production`

Optional (for full functionality):
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SENTRY_DSN`
- `OPENAI_API_KEY`

### 3. Railway CLI

```bash
npm install -g @railway/cli
railway login
```

---

## 🚀 Deployment Steps

### Step 1: Link to Railway Project

```bash
npm run railway:link
```

This links to the Code Roach Railway project.

### Step 2: Sync Environment Variables

```bash
npm run deploy:sync-env
```

Syncs variables from `.env` to Railway (if you have a `.env` file).

**Or set manually in Railway dashboard:**
1. Go to Railway project
2. Settings → Variables
3. Add required variables

### Step 3: Deploy Infrastructure

```bash
npm run deploy:infrastructure
```

This will:
- Verify Railway connection
- Check environment variables
- Deploy with multi-instance configuration
- Set up health checks

### Step 4: Verify Deployment

```bash
npm run verify:infrastructure
```

Checks:
- Health endpoints
- Circuit breakers
- Metrics
- Configuration

---

## ⚙️ Configuration

### Railway Configuration (`railway.json`)

Already configured for 99.99% uptime:
- **Min replicas:** 3
- **Max replicas:** 10
- **Health check:** `/api/health/ready`
- **Auto-scaling:** Enabled
- **CPU threshold:** 70%
- **Memory threshold:** 80%

### Scaling in Railway Dashboard

1. Go to Railway project
2. Settings → Scaling
3. Verify:
   - Min instances: 3
   - Max instances: 10
   - Auto-scaling: Enabled

---

## 📊 Monitoring Setup

### Set Up External Monitoring

```bash
npm run setup:monitoring
```

This interactive script helps you set up:
1. UptimeRobot (uptime monitoring)
2. Datadog (APM and metrics)
3. Sentry (error tracking)
4. PagerDuty (on-call management)
5. Logtail (log aggregation)

---

## 🔧 Advanced Configuration

### Redis High Availability

**Option 1: Upstash (Recommended)**
1. Create account at https://upstash.com
2. Create Redis database
3. Set environment variables:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

**Option 2: Redis Cloud**
1. Create account at https://redis.com/cloud
2. Create database
3. Set `REDIS_URL` environment variable

### Database Read Replicas

1. Upgrade to Supabase Pro ($25/month)
2. Create read replicas in Supabase dashboard
3. Set environment variables:
   - `SUPABASE_READ_REPLICA_1_URL`
   - `SUPABASE_READ_REPLICA_2_URL`

Code already supports read replicas with automatic fallback.

---

## 🛡️ Health Checks

### Endpoints

- **Liveness:** `/api/health/live` - Is the server running?
- **Readiness:** `/api/health/ready` - Is the server ready to serve traffic?
- **Health:** `/api/health` - Full health status
- **Metrics:** `/api/metrics` - Application metrics
- **Circuit Breakers:** `/api/health/circuit-breakers` - Circuit breaker states

### Railway Health Checks

Configured in `railway.json`:
- **Path:** `/api/health/ready`
- **Interval:** 30 seconds
- **Timeout:** 10 seconds
- **Unhealthy threshold:** 3 failures
- **Healthy threshold:** 2 successes

---

## 📈 Scaling

### Auto-Scaling Rules

**Scale Up:**
- CPU > 70% for 2 minutes
- Memory > 80% for 2 minutes
- Request rate > threshold

**Scale Down:**
- CPU < 30% for 5 minutes
- Memory < 50% for 5 minutes
- Cooldown: 5 minutes

### Manual Scaling

In Railway dashboard:
1. Go to project
2. Settings → Scaling
3. Adjust min/max instances

---

## 🔍 Troubleshooting

### Deployment Fails

1. **Check Railway logs:**
   ```bash
   railway logs
   ```

2. **Verify environment variables:**
   ```bash
   railway variables
   ```

3. **Check health endpoints:**
   ```bash
   curl https://your-domain.railway.app/api/health
   ```

### Health Checks Failing

1. **Check if server is running:**
   ```bash
   railway logs | grep "Server started"
   ```

2. **Verify health endpoint:**
   ```bash
   curl https://your-domain.railway.app/api/health/ready
   ```

3. **Check database connection:**
   - Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`
   - Test connection in Supabase dashboard

### Scaling Not Working

1. **Check Railway dashboard:**
   - Settings → Scaling
   - Verify auto-scaling is enabled

2. **Check metrics:**
   ```bash
   curl https://your-domain.railway.app/api/metrics
   ```

3. **Verify thresholds:**
   - CPU: 70%
   - Memory: 80%

---

## 📝 Deployment Checklist

Before deployment:
- [ ] Railway project created
- [ ] Railway CLI installed and logged in
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] `railway.json` configured

During deployment:
- [ ] Link to Railway project
- [ ] Sync environment variables
- [ ] Deploy infrastructure
- [ ] Verify deployment

After deployment:
- [ ] Check health endpoints
- [ ] Verify scaling configuration
- [ ] Set up monitoring
- [ ] Test auto-scaling
- [ ] Configure alerts

---

## 🎯 Next Steps

1. **Deploy:**
   ```bash
   npm run deploy:infrastructure
   ```

2. **Verify:**
   ```bash
   npm run verify:infrastructure
   ```

3. **Set up monitoring:**
   ```bash
   npm run setup:monitoring
   ```

4. **Configure scaling in Railway dashboard**

5. **Set up Redis HA** (optional but recommended)

6. **Set up database read replicas** (optional but recommended)

---

## 📚 Additional Resources

- **Infrastructure Setup:** `docs/INFRASTRUCTURE-SETUP-GUIDE.md`
- **Monitoring Setup:** `docs/MONITORING-SETUP-GUIDE.md`
- **Disaster Recovery:** `docs/DISASTER-RECOVERY-PLAN.md`
- **Railway Project:** https://railway.com/project/f884c91a-3d81-49c8-a769-354456c1d979

---

**Last Updated:** December 2025  
**Status:** Ready for deployment

# Code Roach Deployment Checklist ✅

**Complete checklist for deploying Code Roach with 99.99% uptime**

---

## 📋 Pre-Deployment

### Railway Setup
- [ ] Railway account created
- [ ] Railway CLI installed: `npm install -g @railway/cli`
- [ ] Logged into Railway: `railway login`
- [ ] Project created: `f884c91a-3d81-49c8-a769-354456c1d979`

### Environment Variables
- [ ] `SUPABASE_URL` - Supabase project URL
- [ ] `SUPABASE_SERVICE_ROLE_KEY` - Supabase service role key
- [ ] `NODE_ENV=production`
- [ ] `PORT=3000` (optional, defaults to 3000)

### Optional (Recommended)
- [ ] `UPSTASH_REDIS_REST_URL` - Redis for caching/job queue
- [ ] `UPSTASH_REDIS_REST_TOKEN` - Redis token
- [ ] `SENTRY_DSN` - Error tracking
- [ ] `OPENAI_API_KEY` - For AI features

---

## 🚀 Deployment Steps

### Step 1: Link to Railway Project
```bash
npm run railway:link
```
- [ ] Successfully linked to Railway project
- [ ] Verified project ID: `f884c91a-3d81-49c8-a769-354456c1d979`

### Step 2: Set Environment Variables
```bash
# Option A: Sync from .env (if you have one)
npm run deploy:sync-env

# Option B: Set manually in Railway dashboard
# Go to: Railway → Project → Variables
```
- [ ] All required variables set
- [ ] Variables verified in Railway dashboard

### Step 3: Deploy Infrastructure
```bash
npm run deploy:infrastructure
```
- [ ] Deployment initiated
- [ ] Build successful
- [ ] Service running

### Step 4: Verify Deployment
```bash
npm run verify:infrastructure
```
- [ ] Health endpoints responding
- [ ] Circuit breakers healthy
- [ ] Metrics collecting
- [ ] No errors

---

## ⚙️ Post-Deployment Configuration

### Scaling Configuration
- [ ] Go to Railway dashboard → Settings → Scaling
- [ ] Min instances: 3
- [ ] Max instances: 10
- [ ] Auto-scaling: Enabled
- [ ] CPU threshold: 70%
- [ ] Memory threshold: 80%

### Health Checks
- [ ] Health check path: `/api/health/ready`
- [ ] Interval: 30 seconds
- [ ] Timeout: 10 seconds
- [ ] Unhealthy threshold: 3
- [ ] Healthy threshold: 2

### Monitoring Setup
```bash
npm run setup:monitoring
```
- [ ] UptimeRobot configured
- [ ] Datadog/APM configured (optional)
- [ ] Sentry configured (optional)
- [ ] PagerDuty configured (optional)
- [ ] Logtail configured (optional)

---

## 🔧 Advanced Setup (Optional)

### Redis High Availability
- [ ] Upstash account created
- [ ] Redis database created
- [ ] Environment variables set
- [ ] Connection tested

### Database Read Replicas
- [ ] Supabase Pro plan ($25/month)
- [ ] Read replica 1 created
- [ ] Read replica 2 created
- [ ] Environment variables set:
  - `SUPABASE_READ_REPLICA_1_URL`
  - `SUPABASE_READ_REPLICA_2_URL`

### Load Balancer
- [ ] Railway load balancer (automatic)
- [ ] OR Cloudflare load balancer configured
- [ ] Health checks configured
- [ ] Failover tested

---

## ✅ Verification

### Health Checks
- [ ] `/api/health/live` - Returns 200
- [ ] `/api/health/ready` - Returns 200
- [ ] `/api/health` - Returns healthy status
- [ ] `/api/metrics` - Returns metrics
- [ ] `/api/health/circuit-breakers` - All CLOSED

### Performance
- [ ] Response times < 500ms (p95)
- [ ] Error rate < 0.1%
- [ ] CPU usage < 70%
- [ ] Memory usage < 80%

### Scaling
- [ ] Auto-scaling triggers correctly
- [ ] Instances scale up under load
- [ ] Instances scale down when idle
- [ ] No downtime during scaling

---

## 📊 Monitoring

### Metrics to Track
- [ ] Uptime percentage (target: 99.99%)
- [ ] Request rate
- [ ] Error rate
- [ ] Response times (p50, p95, p99)
- [ ] Circuit breaker states
- [ ] Resource usage (CPU, memory)

### Alerts Configured
- [ ] Health check failures
- [ ] High error rate (> 5%)
- [ ] Slow response times (p95 > 1s)
- [ ] Circuit breaker opens
- [ ] High resource usage

---

## 🆘 Troubleshooting

### If Deployment Fails
- [ ] Check Railway logs: `railway logs`
- [ ] Verify environment variables
- [ ] Check build errors
- [ ] Verify `railway.json` configuration

### If Health Checks Fail
- [ ] Check server logs
- [ ] Verify database connection
- [ ] Check Redis connection (if configured)
- [ ] Verify health endpoint paths

### If Scaling Not Working
- [ ] Check Railway dashboard → Scaling settings
- [ ] Verify auto-scaling is enabled
- [ ] Check metrics in Railway dashboard
- [ ] Verify thresholds are correct

---

## 📝 Documentation

- [ ] Deployment guide reviewed
- [ ] Infrastructure setup guide reviewed
- [ ] Monitoring setup guide reviewed
- [ ] Disaster recovery plan reviewed

---

## 🎉 Launch Checklist

- [ ] All pre-deployment items complete
- [ ] Deployment successful
- [ ] Health checks passing
- [ ] Scaling configured
- [ ] Monitoring set up
- [ ] Alerts configured
- [ ] Documentation complete
- [ ] Team notified

---

**Status:** Ready for deployment! 🚀

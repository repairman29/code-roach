# Code Roach: Infrastructure Setup Guide

**Document Version:** 1.0  
**Date:** December 2025  
**Purpose:** Step-by-step guide to set up Code Roach infrastructure

---

## 🎯 Overview

This guide walks through setting up the complete infrastructure for Code Roach SaaS platform, from development to production.

---

## 📋 Prerequisites

- Node.js 18+ installed
- Git installed
- GitHub account
- Supabase account (free tier works)
- Railway/Render account (or AWS/Vercel)
- Domain name (optional for MVP)

---

## 🏗️ Infrastructure Components

### 1. Database: Supabase

#### Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Click "New Project"
3. Fill in:
   - **Name:** `code-roach-production`
   - **Database Password:** (generate strong password)
   - **Region:** Choose closest to users
4. Wait for project creation (~2 minutes)

#### Step 2: Get Connection Details

1. Go to Project Settings → API
2. Copy:
   - **Project URL:** `https://xxxxx.supabase.co`
   - **anon/public key:** `eyJhbGc...`
   - **service_role key:** `eyJhbGc...` (keep secret!)

#### Step 3: Run Database Migrations

```bash
# Install Supabase CLI (if not already installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Run migrations
supabase db push
```

Or manually run SQL from `supabase/migrations/` in Supabase SQL Editor.

---

### 2. Redis: Upstash

#### Step 1: Create Upstash Account

1. Go to [upstash.com](https://upstash.com)
2. Sign up (free tier available)
3. Create new Redis database

#### Step 2: Get Connection Details

1. Click on your database
2. Copy:
   - **UPSTASH_REDIS_REST_URL**
   - **UPSTASH_REDIS_REST_TOKEN**

#### Step 3: Test Connection

```bash
# Install Redis client
npm install ioredis

# Test connection
node -e "
const Redis = require('ioredis');
const redis = new Redis(process.env.UPSTASH_REDIS_REST_URL);
redis.ping().then(() => console.log('✅ Redis connected'));
"
```

---

### 3. Hosting: Railway (Recommended)

#### Step 1: Create Railway Account

1. Go to [railway.app](https://railway.app)
2. Sign up with GitHub
3. Create new project: "Code Roach"

#### Step 2: Connect GitHub Repository

1. Click "New" → "GitHub Repo"
2. Select your repository
3. Railway will auto-detect Node.js

#### Step 3: Configure Environment Variables

In Railway dashboard, add:

```bash
# Server
NODE_ENV=production
PORT=3000

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Redis
REDIS_URL=redis://default:xxxxx@xxxxx.upstash.io:6379

# OpenAI (for LLM fixes)
OPENAI_API_KEY=sk-...

# Auth
JWT_SECRET=your-secret-key-here

# Sentry (error tracking)
SENTRY_DSN=https://xxxxx@sentry.io/xxxxx
```

#### Step 4: Deploy

Railway will auto-deploy on push to main branch.

**Manual deploy:**
```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

---

### 4. Alternative: Vercel (Serverless)

#### Step 1: Create Vercel Account

1. Go to [vercel.com](https://vercel.com)
2. Sign up with GitHub
3. Import your repository

#### Step 2: Configure Project

1. Framework Preset: "Other"
2. Root Directory: `./`
3. Build Command: `npm run build` (or skip)
4. Output Directory: `./`
5. Install Command: `npm install`

#### Step 3: Add Environment Variables

Same as Railway, add in Vercel dashboard.

#### Step 4: Deploy

Vercel auto-deploys on push.

---

### 5. CDN: Cloudflare

#### Step 1: Add Domain to Cloudflare

1. Sign up at [cloudflare.com](https://cloudflare.com)
2. Add your domain
3. Update nameservers at your registrar

#### Step 2: Configure DNS

Add A record pointing to Railway/Vercel IP:
- **Type:** A
- **Name:** @
- **Content:** (Railway/Vercel IP)
- **Proxy:** ✅ (orange cloud)

#### Step 3: Enable Features

- **SSL/TLS:** Full (strict)
- **Auto Minify:** JavaScript, CSS, HTML
- **Brotli:** Enabled
- **Caching:** Standard

---

### 6. Monitoring: Sentry

#### Step 1: Create Sentry Account

1. Go to [sentry.io](https://sentry.io)
2. Create new project: "Code Roach"
3. Select "Node.js" platform

#### Step 2: Install SDK

```bash
npm install @sentry/node @sentry/integrations
```

#### Step 3: Configure

```javascript
// server/server.js
const Sentry = require('@sentry/node');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
});
```

#### Step 4: Add DSN to Environment

Add `SENTRY_DSN` to Railway/Vercel environment variables.

---

### 7. Logging: Logtail

#### Step 1: Create Logtail Account

1. Go to [logtail.com](https://logtail.com)
2. Sign up (free tier: 1GB/month)
3. Create new source: "Code Roach"

#### Step 2: Install SDK

```bash
npm install @logtail/node
```

#### Step 3: Configure

```javascript
// server/services/logger.js
const { Logtail } = require('@logtail/node');

const logtail = new Logtail(process.env.LOGTAIL_TOKEN);

module.exports = {
  info: (message, meta) => logtail.info(message, meta),
  error: (message, meta) => logtail.error(message, meta),
  warn: (message, meta) => logtail.warn(message, meta),
};
```

#### Step 4: Add Token to Environment

Add `LOGTAIL_TOKEN` to Railway/Vercel environment variables.

---

### 8. Uptime Monitoring: UptimeRobot

#### Step 1: Create Account

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Sign up (free tier: 50 monitors)

#### Step 2: Add Monitor

1. Click "Add New Monitor"
2. Configure:
   - **Type:** HTTP(s)
   - **Name:** Code Roach API
   - **URL:** `https://your-domain.com/api/health`
   - **Interval:** 5 minutes
3. Save

---

## 🔧 Local Development Setup

### Step 1: Clone Repository

```bash
git clone https://github.com/yourusername/code-roach.git
cd code-roach
npm install
```

### Step 2: Environment Variables

Create `.env` file:

```bash
# Copy example
cp .env.example .env

# Edit .env
NODE_ENV=development
PORT=3000

# Supabase (use development project)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...

# Redis (local or Upstash)
REDIS_URL=redis://localhost:6379
# OR
REDIS_URL=redis://default:xxxxx@xxxxx.upstash.io:6379

# OpenAI
OPENAI_API_KEY=sk-...

# Sentry (optional for dev)
SENTRY_DSN=
```

### Step 3: Start Local Services

```bash
# Start Redis (if local)
docker run -d -p 6379:6379 redis:alpine

# Start server
npm run dev
```

### Step 4: Verify Setup

```bash
# Health check
curl http://localhost:3000/api/health

# Should return: {"status":"ok"}
```

---

## 🚀 Production Deployment Checklist

### Pre-Deployment

- [ ] All environment variables set
- [ ] Database migrations run
- [ ] SSL certificate configured
- [ ] Domain DNS configured
- [ ] Monitoring set up
- [ ] Error tracking configured
- [ ] Logging configured
- [ ] Backup strategy in place

### Deployment

- [ ] Code pushed to main branch
- [ ] CI/CD pipeline passes
- [ ] Deployed to staging
- [ ] Smoke tests pass
- [ ] Deployed to production
- [ ] Health checks pass
- [ ] Monitoring active

### Post-Deployment

- [ ] Verify API endpoints
- [ ] Check error logs
- [ ] Monitor performance
- [ ] Test critical flows
- [ ] Notify team

---

## 🔐 Security Checklist

### Environment Variables

- [ ] All secrets in environment variables (not code)
- [ ] `.env` in `.gitignore`
- [ ] Production secrets different from dev
- [ ] Secrets rotated regularly

### API Security

- [ ] Rate limiting enabled
- [ ] CORS configured correctly
- [ ] Authentication required
- [ ] Input validation
- [ ] SQL injection prevention (Supabase handles)

### Infrastructure Security

- [ ] HTTPS only
- [ ] Security headers (Helmet)
- [ ] Database access restricted
- [ ] Redis access restricted
- [ ] Regular security updates

---

## 📊 Monitoring Setup

### Application Metrics

```javascript
// server/middleware/metrics.js
const prometheus = require('prom-client');

const httpRequestDuration = new prometheus.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status']
});

// Use in Express
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    httpRequestDuration.observe({
      method: req.method,
      route: req.route?.path || req.path,
      status: res.statusCode
    }, duration);
  });
  next();
});
```

### Health Check Endpoint

```javascript
// server/routes/health.js
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    checks: {
      database: await checkDatabase(),
      redis: await checkRedis(),
      disk: checkDiskSpace()
    }
  };
  
  const isHealthy = Object.values(health.checks).every(c => c === 'ok');
  res.status(isHealthy ? 200 : 503).json(health);
});
```

---

## 🐛 Troubleshooting

### Database Connection Issues

```bash
# Test Supabase connection
node -e "
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY);
supabase.from('code_roach_issues').select('count').then(r => console.log('✅ Connected:', r));
"
```

### Redis Connection Issues

```bash
# Test Redis connection
node -e "
const Redis = require('ioredis');
const redis = new Redis(process.env.REDIS_URL);
redis.ping().then(() => console.log('✅ Redis OK')).catch(e => console.error('❌ Redis Error:', e));
"
```

### Deployment Issues

```bash
# Check Railway logs
railway logs

# Check Vercel logs
vercel logs

# Check application logs
# (via Logtail dashboard or Sentry)
```

---

## 📚 Additional Resources

- [Supabase Docs](https://supabase.com/docs)
- [Railway Docs](https://docs.railway.app)
- [Vercel Docs](https://vercel.com/docs)
- [Upstash Docs](https://docs.upstash.com)
- [Sentry Docs](https://docs.sentry.io)
- [Logtail Docs](https://docs.logtail.com)

---

## ✅ Next Steps

1. **Set up all infrastructure components** (this week)
2. **Configure CI/CD pipeline** (this week)
3. **Deploy to staging** (next week)
4. **Run load tests** (next week)
5. **Deploy to production** (Week 3)

---

**Document Status:** Setup guide complete  
**Questions?** Check troubleshooting section or create an issue

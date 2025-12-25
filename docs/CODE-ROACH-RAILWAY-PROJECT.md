# Code Roach Railway Project

**Project ID:** `f884c91a-3d81-49c8-a769-354456c1d979`  
**URL:** https://railway.com/project/f884c91a-3d81-49c8-a769-354456c1d979

---

## 🎯 Purpose

This Railway project is dedicated to **Code Roach** and the **99.99% uptime infrastructure** deployment.

**Separate from:**

- `lucky-grace` - Existing Smugglers production deployment

---

## 🔗 Link to This Project

### Quick Link

```bash
npm run railway:link-code-roach
# or
./scripts/link-code-roach-project.sh
```

This script will:

1. ✅ Check if already linked
2. ✅ Unlink current project if needed
3. ✅ Link to Code Roach project
4. ✅ Verify the link

### Manual Link

```bash
# Unlink current project (if any)
railway unlink

# Link to Code Roach project
railway link
# Select project: f884c91a-3d81-49c8-a769-354456c1d979
```

---

## ✅ Verify Link

After linking, verify:

```bash
npm run railway:check
```

**Expected output:**

```
✅ Project is NOT 'lucky-grace'
Safe to proceed with deployment.
```

---

## 🚀 Deploy to Code Roach Project

Once linked, deploy the 99.99% uptime infrastructure:

```bash
npm run deploy:infrastructure
```

This will:

1. ✅ Verify project is not "lucky-grace"
2. ✅ Check environment variables
3. ✅ Sync variables to Railway
4. ✅ Deploy infrastructure

---

## 📋 Project Configuration

### Environment Variables

Set these in Railway dashboard or via CLI:

**Required:**

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NODE_ENV=production`

**Optional (for 99.99% uptime):**

- `SUPABASE_READ_REPLICA_1_URL`
- `SUPABASE_READ_REPLICA_2_URL`
- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`
- `SENTRY_DSN`

### Scaling Configuration

Configured in `railway.json`:

- **Min replicas:** 3
- **Max replicas:** 10
- **Health check:** `/api/health/ready`
- **Auto-scaling:** Enabled

---

## 🔍 Check Project Status

```bash
# Check current project
npm run railway:check

# Check deployment status
railway status

# View logs
railway logs
```

---

## ⚠️ Important Notes

1. **Separate from Smugglers:** This project is separate from "lucky-grace"
2. **99.99% Uptime:** Configured for high availability
3. **Multi-instance:** Runs 3+ instances by default
4. **Health Checks:** Configured for automatic failover

---

## 📝 Quick Reference

| Command                           | Purpose                    |
| --------------------------------- | -------------------------- |
| `npm run railway:link-code-roach` | Link to Code Roach project |
| `npm run railway:check`           | Check current project      |
| `npm run deploy:infrastructure`   | Deploy infrastructure      |
| `npm run deploy:sync-env`         | Sync environment variables |
| `npm run verify:infrastructure`   | Verify deployment          |

---

## 🔗 Resources

- **Railway Dashboard:** https://railway.com/project/f884c91a-3d81-49c8-a769-354456c1d979
- **Project Safety Guide:** `docs/RAILWAY-PROJECT-SAFETY.md`
- **Infrastructure Setup:** `docs/INFRASTRUCTURE-SETUP-GUIDE.md`

---

**Last Updated:** December 2025

# Code Roach: Next Steps After Migration

**Migration Status:** ✅ Complete  
**Date:** December 2025

---

## 🎯 Immediate Next Steps

### 1. Test the System

```bash
# Run comprehensive tests
code-roach-saas test

# Check health
npm run code-roach:health

# Verify database connection
code-roach-saas db --status
```

---

### 2. Create Your First Organization & Project

```bash
# Create an organization
code-roach-saas orgs create "My Organization"

# Create a project
code-roach-saas projects create --org <org-id> "My Project" --slug my-project

# List your projects
code-roach-saas projects
```

**Or via API:**

```bash
# Create organization
curl -X POST http://localhost:3000/api/code-roach/organizations \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"name": "My Organization", "slug": "my-org"}'

# Create project
curl -X POST http://localhost:3000/api/code-roach/projects \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"organizationId": "org-id", "name": "My Project", "slug": "my-project"}'
```

---

### 3. Run Your First Crawl

```bash
# Basic crawl
code-roach-saas crawl

# Crawl with auto-fix
code-roach-saas crawl --auto-fix

# Crawl for specific project
code-roach-saas crawl --project <project-id>

# Crawl specific directory
code-roach-saas crawl --dir ./src
```

---

### 4. View Results

```bash
# View all issues
code-roach-saas issues

# View issues for a project
code-roach-saas issues --project <project-id>

# View by severity
code-roach-saas issues --severity critical

# View by status
code-roach-saas issues --status pending

# Export issues
code-roach-saas issues --export json --output issues.json
```

---

### 5. Check Statistics

```bash
# Get overall stats
code-roach-saas stats

# Get stats for a project
code-roach-saas stats --project <project-id>
```

---

## 🚀 Optional Enhancements

### A. Set Up Redis (Recommended for Production)

**Why:** Persistent job queue and caching

```bash
# Add to .env
REDIS_URL=redis://localhost:6379
# OR for Upstash
UPSTASH_REDIS_REST_URL=https://your-redis.upstash.io
UPSTASH_REDIS_REST_TOKEN=your-token
```

**Benefits:**

- Persistent job queue (crawls survive restarts)
- Better caching performance
- Background job processing

---

### B. Set Up GitHub Integration

**Why:** Automatic crawls on push/PR events

```bash
# Add to .env
GITHUB_TOKEN=ghp_your-personal-access-token
GITHUB_WEBHOOK_SECRET=your-webhook-secret
```

**Then configure webhook:**

1. Go to your GitHub repo → Settings → Webhooks
2. Add webhook: `https://your-domain.com/api/github/webhook`
3. Select events: `push`, `pull_request`
4. Set secret: `GITHUB_WEBHOOK_SECRET`

**Benefits:**

- Automatic crawls on code changes
- PR analysis
- Repository file access

---

### C. Set Up Monitoring (Optional)

**Sentry (Error Tracking):**

```bash
# Add to .env
SENTRY_DSN=https://your-sentry-dsn
```

**Logtail (Logging):**

```bash
# Add to .env
LOGTAIL_TOKEN=your-logtail-token
```

---

## 📊 Daily Workflow

### Morning Routine

```bash
# Check system health
npm run code-roach:health

# View new issues
code-roach-saas issues --status pending

# Check queue status
code-roach-saas queue --stats
```

### During Development

```bash
# Run crawl on changed files
code-roach-saas crawl --dir ./src

# Watch for issues
code-roach-saas watch

# Check specific file
code-roach-saas issues --file ./src/myfile.js
```

### Weekly Review

```bash
# Generate report
npm run code-roach:report

# View statistics
code-roach-saas stats

# Export data
code-roach-saas export --format json --output weekly-report.json
```

---

## 🎯 Feature Roadmap

### Phase 1: Core Features (✅ Complete)

- [x] Database schema
- [x] CLI tools
- [x] API endpoints
- [x] Issue storage
- [x] Project management

### Phase 2: Frontend Dashboard (Next)

- [ ] Web dashboard UI
- [ ] Issue management interface
- [ ] Project overview
- [ ] Analytics visualization
- [ ] Fix preview & approval

### Phase 3: Advanced Features

- [ ] Team collaboration
- [ ] Billing integration
- [ ] Email notifications
- [ ] Custom rules/patterns
- [ ] API integrations

---

## 🔧 Troubleshooting

### Issue: "Tables not found"

```bash
# Re-run migration
code-roach-saas db --migrate
```

### Issue: "Redis not configured"

- Optional - system works with in-memory fallback
- Set `REDIS_URL` for production use

### Issue: "GitHub integration not working"

- Check `GITHUB_TOKEN` is set
- Verify webhook is configured
- Check webhook secret matches

---

## 📚 Documentation

- **CLI Guide:** `docs/CODE-ROACH-CLI-GUIDE.md`
- **CLI Examples:** `docs/CODE-ROACH-CLI-EXAMPLES.md`
- **Architecture:** `docs/CODE-ROACH-TECHNICAL-ARCHITECTURE.md`
- **Setup Guide:** `docs/CODE-ROACH-SETUP-COMPLETE.md`

---

## 🎉 You're Ready!

Code Roach is fully set up and ready to use. Start with a test crawl and explore the CLI commands.

**Quick Start:**

```bash
# 1. Test everything
code-roach-saas test

# 2. Run first crawl
code-roach-saas crawl --auto-fix

# 3. View results
code-roach-saas issues

# 4. Check stats
code-roach-saas stats
```

---

**Happy coding! 🪳**

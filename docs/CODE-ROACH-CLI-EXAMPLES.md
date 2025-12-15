# Code Roach CLI: Complete Examples & Use Cases

**All CLI commands with real-world examples**

---

## 🚀 Basic Operations

### Crawl Codebase

```bash
# Basic crawl
code-roach-saas crawl

# Crawl specific directory
code-roach-saas crawl --dir ./src

# Crawl with auto-fix
code-roach-saas crawl --auto-fix

# Crawl using job queue
code-roach-saas crawl --queue

# Crawl for specific project
code-roach-saas crawl --project <project-id>
```

---

### Check Status

```bash
# Crawler status
code-roach-saas status

# Job status
code-roach-saas status --job <job-id>
```

---

## 📊 Viewing & Managing Issues

### List Issues

```bash
# All issues
code-roach-saas issues

# Filter by status
code-roach-saas issues --status pending

# Filter by severity
code-roach-saas issues --severity critical

# Filter by type
code-roach-saas issues --type security

# Filter by file
code-roach-saas issues --file server/api.js

# For specific project
code-roach-saas issues --project <project-id>

# Limit results
code-roach-saas issues --limit 50 --offset 0
```

### Export Issues

```bash
# Export as JSON
code-roach-saas issues --export json --output issues.json

# Export as CSV
code-roach-saas issues --export csv --output issues.csv

# Export filtered issues
code-roach-saas issues --status pending --severity critical --export json --output critical-issues.json
```

---

## 📈 Statistics & Analytics

### Get Statistics

```bash
# Overall statistics
code-roach-saas stats

# For specific project
code-roach-saas stats --project <project-id>

# For organization
code-roach-saas stats --org <org-id>

# Last 7 days
code-roach-saas stats --timeframe 7
```

### Generate Report

```bash
# Generate markdown report
npm run code-roach:report

# For specific project
npm run code-roach:report <project-id>

# Save to file
npm run code-roach:report <project-id> report.md
```

---

## 🔄 Watch Mode

### Watch for Changes

```bash
# Watch current directory
code-roach-saas watch

# Watch specific directory
code-roach-saas watch --dir ./src

# Watch with auto-fix
code-roach-saas watch --auto-fix

# Custom check interval (default: 5000ms)
code-roach-saas watch --interval 10000
```

---

## 📤 Export Data

### Export Issues

```bash
# Export all issues as JSON
code-roach-saas export --type issues --format json --output issues.json

# Export as CSV
code-roach-saas export --type issues --format csv --output issues.csv

# Export for specific project
code-roach-saas export --type issues --project <project-id> --output project-issues.json
```

### Export Patterns

```bash
# Export fix patterns
code-roach-saas export --type patterns --format json --output patterns.json
```

### Export Statistics

```bash
# Export comprehensive stats
code-roach-saas export --type stats --format json --output stats.json
```

---

## ⚙️ Configuration

### Show Configuration

```bash
# Show current config
code-roach-saas config --show
```

### Validate Configuration

```bash
# Validate all settings
code-roach-saas config --validate
```

---

## 🎯 Pattern Management

### List Patterns

```bash
# List all patterns
code-roach-saas patterns --list

# Pattern statistics
code-roach-saas patterns --stats
```

---

## 🧹 Cleanup

### Clean Old Data

```bash
# Clean old jobs
code-roach-saas clean --jobs

# Clear cache
code-roach-saas clean --cache

# Delete resolved issues older than 30 days
code-roach-saas clean --issues 30

# Clean everything
code-roach-saas clean --jobs --cache --issues 30
```

---

## 🔧 Queue Management

### Queue Statistics

```bash
# View queue stats
code-roach-saas queue --stats

# Clean old jobs
code-roach-saas queue --clean
```

---

## 💾 Cache Management

### Cache Operations

```bash
# Cache statistics
code-roach-saas cache --stats

# Clear cache
code-roach-saas cache --clear
```

---

## 🐙 GitHub Operations

### Repository Access

```bash
# Check access
code-roach-saas github --repo https://github.com/owner/repo --access
```

### List Files

```bash
# List all files in repository
code-roach-saas github --repo https://github.com/owner/repo --list-files
```

### Get File Content

```bash
# Get specific file
code-roach-saas github --repo https://github.com/owner/repo --file src/index.js
```

---

## 🗄️ Database Operations

### Database Status

```bash
# Check database connection
code-roach-saas db --status

# Get migration instructions
code-roach-saas db --migrate
```

---

## 🧪 Testing & Health

### Test Setup

```bash
# Comprehensive test
code-roach-saas test

# Or via npm
npm run code-roach:test
```

### Health Check

```bash
# Quick health check
npm run code-roach:health
```

### Benchmark

```bash
# Performance benchmark
npm run code-roach:benchmark
```

---

## 📦 Batch Operations

### Batch Crawl

```bash
# Crawl multiple directories
npm run code-roach:batch crawl ./project1 ./project2 ./project3
```

### Batch Export

```bash
# Export multiple projects
npm run code-roach:batch export <project-id-1> <project-id-2> ./exports
```

---

## 🎯 Real-World Workflows

### Daily Development Workflow

```bash
# 1. Check health
npm run code-roach:health

# 2. Watch for changes (in background)
code-roach-saas watch --auto-fix &

# 3. Check status periodically
code-roach-saas status

# 4. View pending issues
code-roach-saas issues --status pending --severity critical
```

---

### Weekly Review Workflow

```bash
# 1. Generate report
npm run code-roach:report > weekly-report.md

# 2. Export all issues
code-roach-saas export --type issues --format csv --output weekly-issues.csv

# 3. Check statistics
code-roach-saas stats

# 4. Clean old data
code-roach-saas clean --issues 30
```

---

### CI/CD Integration

```bash
# In CI pipeline
code-roach-saas crawl --auto-fix --queue

# Check if any critical issues remain
CRITICAL=$(code-roach-saas issues --severity critical --status pending | jq '. | length')
if [ "$CRITICAL" -gt 0 ]; then
    echo "Critical issues found!"
    exit 1
fi
```

---

### Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Run quick crawl on staged files
code-roach-saas crawl --dir . --auto-fix

# Check for critical issues
code-roach-saas issues --severity critical --status pending
```

---

## 📋 Command Reference

### All Commands

```
code-roach-saas
  crawl          Crawl codebase and fix issues
  status         Get crawl status
  projects       Manage projects
  orgs           Manage organizations
  queue          Queue management
  cache          Cache management
  github         GitHub operations
  db             Database operations
  test           Test Code Roach setup
  issues         Manage and view issues
  stats          Get statistics and analytics
  watch          Watch for file changes and auto-crawl
  export         Export data
  config         Manage configuration
  patterns       Manage fix patterns
  clean          Clean up old data
```

---

## 💡 Tips & Tricks

### Combine Commands

```bash
# Crawl and immediately check status
code-roach-saas crawl --queue && sleep 5 && code-roach-saas status

# Export and generate report
code-roach-saas export --type issues --output issues.json && npm run code-roach:report
```

### Use in Scripts

```bash
#!/bin/bash
# Check for critical issues daily

code-roach-saas issues --severity critical --status pending --export json --output critical.json

if [ -s critical.json ]; then
    # Send notification
    echo "Critical issues found!" | mail -s "Code Roach Alert" admin@example.com
fi
```

### Automation

```bash
# Cron job: Daily crawl
0 2 * * * cd /path/to/project && code-roach-saas crawl --auto-fix

# Cron job: Weekly report
0 9 * * 1 cd /path/to/project && npm run code-roach:report > weekly-report.md
```

---

## 🎯 Advanced Usage

### Custom Filters

```bash
# Complex issue query
code-roach-saas issues \
  --project <project-id> \
  --status pending \
  --severity critical \
  --type security \
  --limit 100 \
  --export json \
  --output critical-security-issues.json
```

### Monitoring

```bash
# Watch mode with logging
code-roach-saas watch --auto-fix 2>&1 | tee crawl.log

# Health check in loop
while true; do
    npm run code-roach:health
    sleep 60
done
```

---

**CLI Version:** 1.0.0  
**Total Commands:** 15+  
**Status:** ✅ Feature Complete

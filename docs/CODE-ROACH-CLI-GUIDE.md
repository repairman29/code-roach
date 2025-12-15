# Code Roach CLI Guide

**Complete command-line interface for Code Roach operations**

---

## 🚀 Quick Start

```bash
# Test setup
npm run code-roach:test

# Run health check
npm run code-roach:health

# Quick setup
npm run code-roach:setup
```

---

## 📋 Available Commands

### `code-roach-saas crawl`

Crawl codebase and fix issues.

```bash
# Basic crawl
code-roach-saas crawl

# With options
code-roach-saas crawl --dir ./src --auto-fix --queue

# For specific project
code-roach-saas crawl --project <project-id>
```

**Options:**
- `-d, --dir <path>` - Root directory (default: current directory)
- `-p, --project <id>` - Project ID
- `-a, --auto-fix` - Auto-fix issues
- `-q, --queue` - Use job queue

---

### `code-roach-saas status`

Get crawl or job status.

```bash
# Crawler status
code-roach-saas status

# Job status
code-roach-saas status --job <job-id>
```

---

### `code-roach-saas projects`

Manage projects.

```bash
# List projects (via API)
code-roach-saas projects --list

# Create project
code-roach-saas projects --create "My Project" --org <org-id> --repo https://github.com/owner/repo
```

---

### `code-roach-saas queue`

Queue management.

```bash
# Queue statistics
code-roach-saas queue --stats

# Clean old jobs
code-roach-saas queue --clean
```

---

### `code-roach-saas cache`

Cache management.

```bash
# Cache statistics
code-roach-saas cache --stats

# Clear cache
code-roach-saas cache --clear
```

---

### `code-roach-saas github`

GitHub operations.

```bash
# Check repository access
code-roach-saas github --repo https://github.com/owner/repo --access

# List repository files
code-roach-saas github --repo https://github.com/owner/repo --list-files

# Get file content
code-roach-saas github --repo https://github.com/owner/repo --file path/to/file.js
```

---

### `code-roach-saas db`

Database operations.

```bash
# Check database status
code-roach-saas db --status

# Migration instructions
code-roach-saas db --migrate
```

---

### `code-roach-saas test`

Test Code Roach setup.

```bash
code-roach-saas test
```

Tests all components and reports status.

---

## 🛠️ Setup Scripts

### `npm run code-roach:test`

Comprehensive setup test.

```bash
npm run code-roach:test
```

Tests:
- Codebase Crawler
- Job Queue
- Cache Service
- Supabase Connection
- Database Tables
- GitHub Integration

---

### `npm run code-roach:health`

Quick health check.

```bash
npm run code-roach:health
```

Returns JSON health status for all services.

---

### `npm run code-roach:benchmark`

Performance benchmarking.

```bash
npm run code-roach:benchmark
```

Benchmarks cache and queue operations.

---

### `npm run code-roach:migrate`

Database migration helper.

```bash
npm run code-roach:migrate
```

Shows migration instructions and file location.

---

### `npm run code-roach:setup`

Quick start setup.

```bash
npm run code-roach:setup
```

Checks environment, installs dependencies, runs tests.

---

## 📊 Examples

### Example 1: First-Time Setup

```bash
# 1. Quick setup
npm run code-roach:setup

# 2. Run migration
npm run code-roach:migrate

# 3. Test setup
npm run code-roach:test

# 4. Run first crawl
code-roach-saas crawl
```

---

### Example 2: Daily Workflow

```bash
# Check health
npm run code-roach:health

# Run crawl
code-roach-saas crawl --auto-fix

# Check status
code-roach-saas status

# View queue stats
code-roach-saas queue --stats
```

---

### Example 3: GitHub Integration

```bash
# Check repository access
code-roach-saas github --repo https://github.com/myorg/myrepo --access

# List files
code-roach-saas github --repo https://github.com/myorg/myrepo --list-files

# Get specific file
code-roach-saas github --repo https://github.com/myorg/myrepo --file src/index.js
```

---

## 🔧 Environment Variables

Required:
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_SERVICE_ROLE_KEY` - Service role key

Optional:
- `REDIS_URL` - Redis connection URL (for queue/cache)
- `GITHUB_TOKEN` - GitHub personal access token
- `GITHUB_WEBHOOK_SECRET` - Webhook secret

---

## 📚 More Information

- [Execution Roadmap](CODE-ROACH-EXECUTION-ROADMAP.md)
- [Infrastructure Setup](CODE-ROACH-INFRASTRUCTURE-SETUP.md)
- [Technical Architecture](CODE-ROACH-TECHNICAL-ARCHITECTURE.md)

---

**CLI Version:** 1.0.0

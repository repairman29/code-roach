# Code Roach: CLI and Third-Party Integrations 🪳🔗

## Overview
Code Roach now includes a powerful CLI tool and comprehensive third-party integrations to make it easy to integrate with any development tool or platform.

---

## 🛠️ Code Roach CLI

### Installation

```bash
# Global installation
npm install -g @code-roach/cli

# Or use npx
npx @code-roach/cli

# Or use locally
npm run code-roach
```

### Quick Start

```bash
# Initialize configuration
code-roach init

# Test connection
code-roach test

# Integrate with GitHub
code-roach integrate github

# Analyze a PR
code-roach analyze pr --pr 123

# Get health score
code-roach health --file server/routes/api.js
```

### Commands

#### `init`
Initialize Code Roach configuration in your project.

```bash
code-roach init
```

Creates `.code-roach.json` configuration file.

#### `config`
Manage configuration values.

```bash
# Get all config
code-roach config get

# Get specific value
code-roach config get serverUrl

# Set value
code-roach config set serverUrl http://localhost:3000
```

#### `integrate`
Integrate with third-party platforms.

**GitHub Actions:**
```bash
code-roach integrate github
```
Creates `.github/workflows/code-roach.yml`

**GitLab CI:**
```bash
code-roach integrate gitlab
```
Adds Code Roach jobs to `.gitlab-ci.yml`

**Slack:**
```bash
code-roach integrate slack
```
Configures Slack webhook integration

**Sentry:**
```bash
code-roach integrate sentry
```
Generates Sentry integration code

#### `analyze`
Analyze code or pull requests.

```bash
# Analyze PR
code-roach analyze pr --pr 123

# Analyze code file
code-roach analyze code --file server/routes/api.js
```

#### `test`
Test connection to Code Roach server.

```bash
code-roach test
```

#### `health`
Get code health scores.

```bash
# Overall health
code-roach health

# Specific file
code-roach health --file server/routes/api.js
```

---

## 🔗 Third-Party Integrations

### CI/CD Platforms

#### GitHub Actions
**Setup:**
```bash
code-roach integrate github
```

**Workflow Features:**
- Automatic PR analysis
- PR comments with analysis
- Merge blocking on critical issues
- Artifact storage

**Required Secrets:**
- `CODE_ROACH_URL`
- `CODE_ROACH_API_KEY`

#### GitLab CI
**Setup:**
```bash
code-roach integrate gitlab
```

**Features:**
- Merge request analysis
- Pipeline integration
- Artifact storage
- Failure on blockers

**Required Variables:**
- `CODE_ROACH_URL`
- `CODE_ROACH_API_KEY`

#### Jenkins
**Setup:**
```bash
code-roach integrate jenkins
```

**Features:**
- Pipeline integration
- Build reporting
- HTML reports
- Artifact storage

#### CircleCI
**Setup:**
```bash
code-roach integrate circleci
```

**Features:**
- PR analysis
- Artifact storage
- Workflow integration

---

### Monitoring Tools

#### Sentry
**Setup:**
```bash
code-roach integrate sentry
```

**Features:**
- Error forwarding to Code Roach
- Auto-fix suggestions
- Root cause analysis
- Dual reporting (Sentry + Code Roach)

#### Datadog
**Setup:**
```bash
code-roach integrate datadog
```

**Features:**
- Error interception
- Performance correlation
- Auto-fix integration

---

### Communication Platforms

#### Slack
**Setup:**
```bash
code-roach integrate slack
```

**Features:**
- Real-time error notifications
- Daily summaries
- Critical alerts
- Team metrics

#### Microsoft Teams
**Setup:**
```bash
code-roach integrate teams
```

**Features:**
- Error notifications
- Daily summaries
- Team metrics

#### Discord
**Setup:**
```bash
code-roach integrate discord
```

**Features:**
- Error notifications
- Fix summaries
- Rich embeds

---

### IDEs

#### VS Code Extension
**Setup:**
```bash
code-roach integrate vscode
```

**Features:**
- Real-time health scores
- Inline code review
- Natural language queries
- One-click fixes
- IntelliSense integration

---

## 📡 API Endpoints

### Integration Management

- `POST /api/code-roach/integrations` - Register integration
- `GET /api/code-roach/integrations` - List integrations
- `GET /api/code-roach/integrations/:id` - Get integration
- `PUT /api/code-roach/integrations/:id` - Update integration
- `DELETE /api/code-roach/integrations/:id` - Delete integration
- `POST /api/code-roach/integrations/:id/test` - Test integration
- `GET /api/code-roach/integrations/stats` - Get statistics
- `GET /api/code-roach/integrations/platforms` - Get available platforms

---

## 🎯 Integration Examples

### GitHub Actions Workflow

```yaml
name: Code Roach Analysis

on:
  pull_request:
    branches: [ main ]

jobs:
  code-roach:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Code Roach
        run: |
          npm install -g @code-roach/cli
          code-roach analyze-pr --pr ${{ github.event.pull_request.number }}
```

### GitLab CI Configuration

```yaml
code_roach_analysis:
  stage: test
  script:
    - npm install -g @code-roach/cli
    - code-roach analyze-pr --platform gitlab
  only:
    - merge_requests
```

### Sentry Integration

```javascript
const Sentry = require('@sentry/node');
const { CodeRoachClient } = require('@code-roach/sdk');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  beforeSend(event, hint) {
    // Send to Code Roach
    codeRoach.analyzeError({
      type: event.exception?.values?.[0]?.type,
      message: event.exception?.values?.[0]?.value
    });
    return event;
  }
});
```

---

## 📊 Integration Statistics

View integration usage and statistics:

```bash
code-roach integrations stats
```

Or via API:
```bash
curl http://localhost:3000/api/code-roach/integrations/stats
```

---

## 🚀 Quick Integration Guide

### 1. Initialize
```bash
code-roach init
```

### 2. Configure
```bash
code-roach config set serverUrl https://your-code-roach-server.com
code-roach config set apiKey your-api-key
```

### 3. Integrate
```bash
# Choose your platform
code-roach integrate github
# or
code-roach integrate gitlab
# or
code-roach integrate slack
```

### 4. Test
```bash
code-roach test
```

---

## 📝 Configuration File

`.code-roach.json`:
```json
{
  "version": "1.0.0",
  "serverUrl": "http://localhost:3000",
  "apiKey": "your-api-key",
  "integrations": {
    "github": { "enabled": true },
    "slack": { "enabled": true }
  }
}
```

---

## 🎉 Supported Platforms

### CI/CD
- ✅ GitHub Actions
- ✅ GitLab CI
- ✅ Jenkins
- ✅ CircleCI
- ⏳ Azure DevOps (coming soon)
- ⏳ Travis CI (coming soon)

### Monitoring
- ✅ Sentry
- ✅ Datadog
- ⏳ New Relic (coming soon)
- ⏳ Rollbar (coming soon)

### Communication
- ✅ Slack
- ✅ Microsoft Teams
- ✅ Discord
- ⏳ Email (coming soon)
- ⏳ PagerDuty (coming soon)

### IDEs
- ✅ VS Code Extension
- ⏳ IntelliJ Plugin (coming soon)
- ⏳ Sublime Text (coming soon)

---

**Code Roach CLI: Making integrations easy!** 🪳🔗


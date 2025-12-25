# Code Roach: Complete Integration Guide 🔗

## Overview

This guide shows you how to integrate Code Roach with any third-party tool or platform.

---

## 🚀 Quick Start

### 1. Install CLI

```bash
npm install -g @code-roach/cli
# or
npm run code-roach
```

### 2. Initialize

```bash
code-roach init
```

### 3. Configure

```bash
code-roach config set serverUrl https://your-server.com
code-roach config set apiKey your-api-key
```

### 4. Integrate

```bash
code-roach integrate <platform>
```

---

## 🔗 CI/CD Integrations

### GitHub Actions

**Setup:**

```bash
code-roach integrate github
```

**What it does:**

- Creates `.github/workflows/code-roach.yml`
- Analyzes PRs automatically
- Comments on PRs with analysis
- Blocks merge on critical issues

**Required Secrets:**

- `CODE_ROACH_URL` - Your Code Roach server URL
- `CODE_ROACH_API_KEY` - Your API key

**Manual Setup:**

1. Go to repository Settings → Secrets → Actions
2. Add `CODE_ROACH_URL` and `CODE_ROACH_API_KEY`
3. Push the workflow file

---

### GitLab CI

**Setup:**

```bash
code-roach integrate gitlab
```

**What it does:**

- Adds Code Roach jobs to `.gitlab-ci.yml`
- Analyzes merge requests
- Stores artifacts
- Fails pipeline on blockers

**Required Variables:**

- `CODE_ROACH_URL`
- `CODE_ROACH_API_KEY`

**Manual Setup:**

1. Go to project Settings → CI/CD → Variables
2. Add `CODE_ROACH_URL` and `CODE_ROACH_API_KEY`
3. Commit `.gitlab-ci.yml`

---

### Jenkins

**Setup:**

```bash
code-roach integrate jenkins
```

**What it does:**

- Creates `Jenkinsfile` with Code Roach pipeline
- Analyzes code on every build
- Generates HTML reports
- Stores artifacts

**Required Credentials:**

- `code-roach-url` (Secret text)
- `code-roach-api-key` (Secret text)

**Manual Setup:**

1. Add credentials in Jenkins
2. Create pipeline job
3. Point to `Jenkinsfile`

---

### CircleCI

**Setup:**

```bash
code-roach integrate circleci
```

**What it does:**

- Creates `.circleci/config.yml`
- Analyzes PRs
- Stores artifacts
- Integrates with workflows

**Required Environment Variables:**

- `CODE_ROACH_URL`
- `CODE_ROACH_API_KEY`

---

## 📊 Monitoring Integrations

### Sentry

**Setup:**

```bash
code-roach integrate sentry
```

**What it does:**

- Creates `code-roach-sentry.js` integration file
- Forwards errors to Code Roach
- Enables auto-fixing
- Dual reporting (Sentry + Code Roach)

**Installation:**

```bash
npm install @sentry/node @code-roach/sdk
```

**Usage:**

```javascript
require("./code-roach-sentry");
```

---

### Datadog

**Setup:**

```bash
code-roach integrate datadog
```

**What it does:**

- Creates `code-roach-datadog.js` integration file
- Intercepts errors before Datadog
- Enables auto-fixing
- Performance correlation

**Installation:**

```bash
npm install dd-trace @code-roach/sdk
```

**Usage:**

```javascript
require("./code-roach-datadog");
```

---

## 💬 Communication Integrations

### Slack

**Setup:**

```bash
code-roach integrate slack
```

**What it does:**

- Configures Slack webhook
- Sends error notifications
- Daily summaries
- Critical alerts

**Manual Setup:**

1. Create Slack webhook URL
2. Run: `code-roach integrate slack`
3. Enter webhook URL when prompted
4. Or configure via API:

```bash
curl -X POST http://localhost:3000/api/code-roach/slack/configure \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://hooks.slack.com/...", "channel": "#code-roach"}'
```

---

### Microsoft Teams

**Setup:**

```bash
code-roach integrate teams
```

**What it does:**

- Configures Teams webhook
- Sends error notifications
- Daily summaries
- Team metrics

**Manual Setup:**

1. Create Teams webhook URL
2. Configure via API:

```bash
curl -X POST http://localhost:3000/api/code-roach/teams/configure \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://outlook.office.com/webhook/..."}'
```

---

### Discord

**Setup:**

```bash
code-roach integrate discord
```

**What it does:**

- Creates Discord integration file
- Sends error notifications
- Fix summaries
- Rich embeds

**Installation:**

```bash
npm install discord.js @code-roach/sdk
```

---

## 💻 IDE Integrations

### VS Code Extension

**Setup:**

```bash
code-roach integrate vscode
```

**What it does:**

- Generates VS Code extension template
- Real-time health scores
- Inline code review
- Natural language queries

**Development:**

```bash
cd .vscode-extension
npm install
# Press F5 in VS Code to run
```

**Features:**

- Health scores in editor
- Inline error fixes
- Code review as you type
- Natural language queries

---

## 🔧 API Integration

### Register Integration

```bash
curl -X POST http://localhost:3000/api/code-roach/integrations \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-github-integration",
    "type": "ci",
    "platform": "github",
    "enabled": true,
    "credentials": {
      "token": "ghp_...",
      "repo": "owner/repo"
    }
  }'
```

### List Integrations

```bash
curl http://localhost:3000/api/code-roach/integrations
```

### Test Integration

```bash
curl -X POST http://localhost:3000/api/code-roach/integrations/my-github-integration/test
```

### Get Statistics

```bash
curl http://localhost:3000/api/code-roach/integrations/stats
```

---

## 📝 Integration Patterns

### Webhook Pattern

For tools that support webhooks:

1. Register webhook in Code Roach:

```bash
curl -X POST http://localhost:3000/api/code-roach/webhooks \
  -H "Content-Type: application/json" \
  -d '{
    "id": "my-webhook",
    "url": "https://your-tool.com/webhook",
    "events": ["error", "fix", "critical"],
    "enabled": true
  }'
```

2. Code Roach will send events to your webhook

### API Pattern

For tools with APIs:

1. Use Code Roach API endpoints
2. Poll or subscribe to events
3. Process in your tool

### SDK Pattern

For custom integrations:

1. Install Code Roach SDK:

```bash
npm install @code-roach/sdk
```

2. Use in your code:

```javascript
const { CodeRoachClient } = require("@code-roach/sdk");

const client = new CodeRoachClient({
  serverUrl: "http://localhost:3000",
  apiKey: "your-api-key",
});

// Analyze error
await client.analyzeError({
  type: "TypeError",
  message: "Cannot read property...",
  stack: "...",
});

// Get health score
const health = await client.getHealthScore("server/routes/api.js");
```

---

## 🎯 Use Cases

### Pre-Commit Hooks

```bash
# In .git/hooks/pre-commit
#!/bin/sh
code-roach analyze code --file $(git diff --cached --name-only)
```

### CI/CD Pipeline

```yaml
# In your CI config
- name: Code Roach Analysis
  run: code-roach analyze-pr --pr $PR_NUMBER
```

### Monitoring Integration

```javascript
// In your error handler
errorTracker.on("error", async (error) => {
  await codeRoach.analyzeError(error);
});
```

### IDE Integration

```javascript
// In VS Code extension
vscode.workspace.onDidSaveTextDocument(async (document) => {
  const health = await codeRoach.getHealthScore(document.fileName);
  vscode.window.showInformationMessage(`Health: ${health.overall}/100`);
});
```

---

## 🔐 Security

### API Keys

- Store in environment variables
- Never commit to repository
- Rotate regularly

### Webhooks

- Use HTTPS
- Verify signatures
- Validate payloads

### Credentials

- Use secrets management
- Encrypt at rest
- Limit access

---

## 📊 Monitoring Integrations

View integration status:

```bash
code-roach integrations list
```

Or via API:

```bash
curl http://localhost:3000/api/code-roach/integrations
```

---

## 🚀 Advanced Integration

### Custom Integration

Create your own integration:

```javascript
const { CodeRoachClient } = require("@code-roach/sdk");

class MyCustomIntegration {
  constructor(config) {
    this.client = new CodeRoachClient(config);
  }

  async onError(error) {
    const analysis = await this.client.analyzeError(error);
    // Process analysis in your tool
  }
}
```

---

## 📚 Resources

- CLI Documentation: `code-roach help`
- API Documentation: `/api/docs`
- Integration Examples: `cli/integrations/`
- Support: https://code-roach.dev/support

---

**Code Roach: Integrate with any tool, any platform!** 🪳🔗

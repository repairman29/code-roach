# 🔌 Integration Guides

Code Roach integrates seamlessly with your development workflow. Choose from popular platforms and tools.

## 🚀 Quick Integrations

### GitHub Actions (Most Popular)

```yaml
name: Code Roach Analysis

on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  code-roach:
    runs-on: ubuntu-latest

    steps:
    - uses: actions/checkout@v3

    - name: Run Code Roach Analysis
      uses: repairman29/code-roach-action@v1
      with:
        api-key: ${{ secrets.CODE_ROACH_API_KEY }}
        fail-on-critical: true
        comment-pr: true
```

### VS Code Extension

1. Install from [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=coderoach.coderoach-vscode)
2. Open Command Palette (`Ctrl+Shift+P`)
3. Run `Code Roach: Login`
4. Enter your API key
5. Start analyzing with `Code Roach: Analyze Current File`

### CLI Integration

```bash
# Install globally
npm install -g code-roach

# Configure
code-roach auth login --api-key YOUR_API_KEY

# Analyze
code-roach analyze

# Fix automatically
code-roach fix --auto
```

## 📋 Supported Platforms

| Platform | Analysis | Auto-Fix | PR Comments | Webhooks |
|----------|----------|----------|-------------|----------|
| GitHub | ✅ | ✅ | ✅ | ✅ |
| GitLab | ✅ | ✅ | ✅ | ✅ |
| Bitbucket | ✅ | ⚠️ | ✅ | ✅ |
| Azure DevOps | ✅ | ⚠️ | ✅ | ⚠️ |
| Jenkins | ✅ | ⚠️ | ⚠️ | ✅ |
| CircleCI | ✅ | ⚠️ | ⚠️ | ✅ |
| Travis CI | ✅ | ⚠️ | ⚠️ | ⚠️ |

## 🛠️ Platform-Specific Guides

### [GitHub Integration](github.md)
- Actions workflows
- App installation
- Branch protection
- Security scanning

### [GitLab Integration](gitlab.md)
- CI/CD pipelines
- Merge request comments
- Project integration
- Compliance scanning

### [Jenkins Integration](jenkins.md)
- Pipeline configuration
- Build triggers
- Test integration
- Reporting

### [Slack Integration](slack.md)
- Notification setup
- Channel configuration
- Custom alerts
- Daily summaries

### [Jira Integration](jira.md)
- Issue creation
- Workflow automation
- Status updates
- Reporting

## 🔧 IDE Extensions

### Visual Studio Code
- Real-time analysis
- Inline suggestions
- Quick fixes
- Project dashboard

### JetBrains IDEs
- IntelliJ IDEA
- WebStorm
- PyCharm
- GoLand

### Vim/Neovim
- Command-line integration
- Buffer analysis
- Quick fix mappings

## ☁️ Cloud Platform Integration

### AWS CodePipeline

```yaml
# buildspec.yml
phases:
  build:
    commands:
      - npm install -g code-roach
      - code-roach analyze --ci --format junit > code-roach-results.xml

reports:
  code-roach:
    files: 'code-roach-results.xml'
    file-format: JUNITXML
```

### Google Cloud Build

```yaml
steps:
- name: 'gcr.io/cloud-builders/npm'
  args: ['install', '-g', 'code-roach']

- name: 'gcr.io/cloud-builders/npm'
  args: ['run', 'code-roach', 'analyze', '--ci']
  env:
    - 'CODE_ROACH_API_KEY=${_CODE_ROACH_API_KEY}'
```

### Azure Pipelines

```yaml
steps:
- task: Npm@1
  inputs:
    command: 'custom'
    customCommand: 'install -g code-roach'

- script: |
    code-roach analyze --ci --format sarif > code-roach-results.sarif
  env:
    CODE_ROACH_API_KEY: $(CODE_ROACH_API_KEY)

- task: PublishSecurityAnalysisLogs@3
  inputs:
    ArtifactName: 'CodeAnalysisLogs'
    ArtifactType: 'Container'
    TargetPath: '$(Build.ArtifactStagingDirectory)'
    SarifFile: 'code-roach-results.sarif'
```

## 🔌 API Integration

### REST API

```javascript
const codeRoach = require('code-roach-sdk');

const client = new codeRoach.Client({
  apiKey: process.env.CODE_ROACH_API_KEY
});

// Analyze code
const analysis = await client.analyze({
  code: 'function insecureSQL() { ... }',
  language: 'javascript'
});

console.log('Issues found:', analysis.issues.length);
```

### Webhooks

```javascript
const express = require('express');
const app = express();

app.post('/webhooks/code-roach', (req, res) => {
  const { event, analysis_id, issues_found } = req.body;

  if (event === 'analysis_completed') {
    // Handle analysis completion
    console.log(`Analysis ${analysis_id} found ${issues_found} issues`);
  }

  res.sendStatus(200);
});
```

## 📊 Custom Integrations

### Build Your Own Integration

```javascript
const CodeRoachAPI = {
  async analyzeCode(code, language) {
    const response = await fetch('https://api.coderoach.dev/analyze', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, language })
    });

    return response.json();
  },

  async applyFixes(code, issues) {
    const response = await fetch('https://api.coderoach.dev/fix', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ code, issues })
    });

    return response.json();
  }
};
```

## 🔐 Security Considerations

### API Key Management

```bash
# Rotate API keys regularly
code-roach auth rotate-key

# Use different keys for different environments
export CODE_ROACH_PROD_KEY=...
export CODE_ROACH_STAGING_KEY=...
```

### Webhook Security

```javascript
const crypto = require('crypto');

function verifyWebhook(payload, signature, secret) {
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
}
```

### Access Control

```json
{
  "access_control": {
    "repositories": ["org/allowed-repo"],
    "ip_whitelist": ["192.168.1.0/24"],
    "require_vpn": true,
    "max_requests_per_hour": 1000
  }
}
```

## 📈 Monitoring Integrations

### Datadog Integration

```yaml
# Send metrics to Datadog
integrations:
  datadog:
    enabled: true
    api_key: ${DATADOG_API_KEY}
    metrics:
      - code_quality_score
      - issues_found
      - fixes_applied
```

### New Relic Integration

```yaml
# Application performance monitoring
integrations:
  new_relic:
    enabled: true
    license_key: ${NEW_RELIC_LICENSE_KEY}
    app_name: 'code-roach-integration'
```

## 🎯 Use Cases

### Startup Development
- Automated code reviews
- Security scanning
- Performance monitoring
- CI/CD integration

### Enterprise Development
- Compliance scanning
- Multi-repository analysis
- Team productivity tracking
- Custom rule enforcement

### Open Source Projects
- Community contribution analysis
- Automated PR reviews
- Code quality badges
- Public dashboards

## ❓ Troubleshooting

### Integration Not Working

```bash
# Test connection
code-roach integrations test github

# Check logs
code-roach logs integrations --tail 50

# Validate configuration
code-roach config validate
```

### Webhook Not Receiving

```bash
# Check webhook URL
curl -X POST https://your-webhook-url.com/test \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'

# Validate webhook secret
code-roach integrations validate-webhook
```

### Permission Issues

```bash
# Check API key permissions
code-roach auth check-permissions

# Verify repository access
code-roach repositories check-access https://github.com/org/repo
```

---

**🔌 Ready to integrate Code Roach?** Start with our [GitHub Actions guide](github.md) or explore our [API documentation](../api.md)!

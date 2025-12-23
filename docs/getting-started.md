# 🚀 Getting Started with Code Roach

Welcome to Code Roach! This guide will help you get up and running with automated code quality analysis and fixing in under 10 minutes.

## Prerequisites

Before you begin, ensure you have:

- **Node.js** 16+ installed
- **Git** installed
- A **GitHub account** (for repository integration)
- At least one **code repository** to analyze

## 🛠️ Installation

### Option 1: NPM (Recommended)

```bash
npm install -g code-roach
```

### Option 2: Docker

```bash
docker pull coderoach/code-roach:latest
```

### Option 3: From Source

```bash
git clone https://github.com/repairman29/code-roach.git
cd code-roach
npm install
npm run build
npm link
```

## 🔑 Authentication

### Get Your API Key

1. Visit [coderoach.dev](https://coderoach.dev)
2. Sign up for a free account
3. Go to Settings → API Keys
4. Create a new API key

### Configure Authentication

```bash
# Set your API key
code-roach auth login --api-key YOUR_API_KEY

# Or set environment variable
export CODE_ROACH_API_KEY=your_api_key_here
```

## 📊 First Analysis

### 1. Initialize Your Project

```bash
cd your-project-directory
code-roach init
```

This creates a `.coderoach` configuration file in your project root.

### 2. Run Your First Analysis

```bash
code-roach analyze
```

You'll see output like:
```
🐛 Code Roach Analysis Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Repository: your-project
Branch: main
Files analyzed: 1,247
Issues found: 23

🔴 Critical: 2
🟡 High: 5
🟠 Medium: 11
🟢 Low: 5

Estimated fix time: 15 minutes
```

### 3. View Detailed Results

```bash
code-roach report
```

This opens a detailed HTML report in your browser showing:
- Code quality metrics
- Specific issues found
- Suggested fixes
- Performance insights

## 🔧 Automatic Fixes

### Apply All Safe Fixes

```bash
code-roach fix --auto
```

### Fix Specific Issues

```bash
# Fix only security issues
code-roach fix --category security

# Fix issues in specific files
code-roach fix src/auth.js src/database.js

# Fix with confirmation prompts
code-roach fix --interactive
```

### Review Changes Before Applying

```bash
# Preview fixes without applying
code-roach fix --preview

# Apply fixes with detailed diff
code-roach fix --diff
```

## 🔄 CI/CD Integration

### GitHub Actions

Create `.github/workflows/code-roach.yml`:

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

    - name: Comment PR with Results
      if: github.event_name == 'pull_request'
      uses: repairman29/code-roach-action@v1
      with:
        api-key: ${{ secrets.CODE_ROACH_API_KEY }}
        comment-pr: true
```

### GitLab CI

Add to your `.gitlab-ci.yml`:

```yaml
code_roach:
  image: node:latest
  stage: test
  script:
    - npm install -g code-roach
    - code-roach analyze --ci
  only:
    - merge_requests
    - main
```

### Jenkins Pipeline

```groovy
pipeline {
    agent any

    stages {
        stage('Code Roach Analysis') {
            steps {
                sh 'npm install -g code-roach'
                sh 'code-roach analyze --ci --format junit > code-roach-results.xml'
                junit 'code-roach-results.xml'
            }
        }
    }
}
```

## 🎯 Configuration

### Basic Configuration

Edit `.coderoach/config.json`:

```json
{
  "version": "1.0.0",
  "project": {
    "name": "my-project",
    "languages": ["javascript", "typescript"],
    "exclude": [
      "node_modules/**",
      "dist/**",
      "build/**",
      "*.min.js"
    ]
  },
  "analysis": {
    "maxFileSize": "1MB",
    "timeout": "300s",
    "parallelJobs": 4
  },
  "rules": {
    "security": "strict",
    "performance": "medium",
    "maintainability": "high"
  }
}
```

### Advanced Configuration

For enterprise deployments, create `.coderoach/advanced.json`:

```json
{
  "customRules": {
    "naming-conventions": "company-standard",
    "documentation-requirements": "strict"
  },
  "integrations": {
    "jira": {
      "enabled": true,
      "project": "PROJ",
      "createIssues": true
    },
    "slack": {
      "enabled": true,
      "webhook": "https://hooks.slack.com/...",
      "channels": ["#code-quality", "#alerts"]
    }
  },
  "notifications": {
    "email": ["team@company.com"],
    "webhook": "https://your-webhook-endpoint"
  }
}
```

## 📱 IDE Integration

### VS Code Extension

1. Install the [Code Roach VS Code Extension](https://marketplace.visualstudio.com/items?itemName=coderoach.coderoach-vscode)
2. Open Command Palette (`Ctrl+Shift+P`)
3. Run `Code Roach: Login`
4. Enter your API key
5. Start analyzing with `Code Roach: Analyze Current File`

### IntelliJ IDEA Plugin

1. Go to Settings → Plugins → Marketplace
2. Search for "Code Roach"
3. Install and restart IDEA
4. Configure your API key in Settings → Tools → Code Roach
5. Right-click files/folders and select "Analyze with Code Roach"

## 🧪 Testing Integration

### Automatic Test Generation

```bash
# Generate tests for new functions
code-roach test generate --functions

# Generate tests for modified code
code-roach test generate --changes

# Review generated tests
code-roach test review
```

### Test Coverage Analysis

```bash
# Analyze test coverage
code-roach coverage analyze

# Suggest missing test cases
code-roach coverage suggest
```

## 📊 Monitoring & Analytics

### Dashboard Access

Visit [dashboard.coderoach.dev](https://dashboard.coderoach.dev) to:

- View code quality trends
- Monitor team productivity
- Track fix success rates
- Analyze performance improvements

### API Access

```javascript
const codeRoach = require('code-roach-sdk');

const dashboard = await codeRoach.dashboard.get({
  repository: 'my-org/my-repo',
  timeframe: '30d'
});

console.log('Code Quality Score:', dashboard.qualityScore);
console.log('Issues Fixed:', dashboard.issuesFixed);
```

## 🔍 Troubleshooting

### Common Issues

**"API Key Invalid"**
```bash
# Re-authenticate
code-roach auth logout
code-roach auth login
```

**"Analysis Timeout"**
```json
// Increase timeout in config
{
  "analysis": {
    "timeout": "600s"
  }
}
```

**"Large Repository Issues"**
```bash
# Analyze specific directories
code-roach analyze src/ lib/

# Exclude large files
code-roach analyze --exclude "large-file.js"
```

### Getting Help

- **Documentation**: [docs.coderoach.dev](https://docs.coderoach.dev)
- **Community Forum**: [community.coderoach.dev](https://community.coderoach.dev)
- **GitHub Issues**: [github.com/repairman29/code-roach/issues](https://github.com/repairman29/code-roach/issues)
- **Email Support**: support@coderoach.dev

## 🎉 What's Next?

Now that you have Code Roach running:

1. **Explore Advanced Features** - Custom rules, integrations
2. **Set Up Team Workflows** - CI/CD, notifications
3. **Monitor Progress** - Dashboard, analytics
4. **Contribute Back** - Report issues, suggest features

**Happy coding with Code Roach! 🐛✨**

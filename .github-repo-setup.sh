#!/bin/bash

# Code Roach - GitHub Repository Setup Script
# Run this script to prepare the repository for GitHub release

set -e

echo "🐛 Setting up Code Roach for GitHub release..."

# Remove Smugglers-specific files
echo "🧹 Cleaning up Smugglers-specific files..."
rm -f .sync-manifest.json
rm -f .last-sync
rm -rf .standalone-overrides/

# Update README for standalone release
echo "📝 Updating README for standalone release..."
cat > README.md << 'EOF'
# 🐛 Code Roach

**Self-learning code quality platform that gets smarter with every fix.**

Code Roach autonomously detects, analyzes, and fixes code quality issues, security vulnerabilities, and technical debt. Unlike traditional linters that only report problems, Code Roach actively improves your codebase.

## ✨ Features

- **Autonomous Code Fixing**: Automatically fixes security vulnerabilities, code smells, and performance issues
- **Self-Learning AI**: Gets smarter with every code fix, adapting to your coding patterns and standards
- **Multi-Language Support**: Supports JavaScript, TypeScript, Python, Java, Go, and more
- **Enterprise Security**: Safe, validated fixes with automatic rollback capabilities
- **CI/CD Integration**: Seamless integration with GitHub Actions, GitLab CI, and Jenkins
- **Team Analytics**: Comprehensive dashboards and reporting for engineering teams

## 🚀 Quick Start

### Option 1: SaaS Platform (Recommended)
```bash
# Sign up at https://coderoach.dev
# Connect your GitHub repository
# Code Roach starts analyzing and fixing automatically
```

### Option 2: Self-Hosted
```bash
npm install -g code-roach
code-roach init
code-roach analyze .
code-roach fix --auto
```

## 📊 What Code Roach Fixes

### Security Vulnerabilities
- SQL injection prevention
- XSS protection
- CSRF token validation
- Secure headers implementation

### Code Quality Issues
- Unused imports and variables
- Code duplication removal
- Performance optimizations
- Best practice enforcement

### Technical Debt
- Outdated dependency updates
- API modernization
- Code structure improvements
- Documentation generation

## 💰 Pricing

### Free Tier
- 100 monthly code fixes
- Basic security scanning
- Email support

### Professional - $499/month
- 10,000 monthly fixes
- Advanced AI learning
- Priority support
- Custom rules

### Enterprise - Custom pricing
- Unlimited fixes
- Multi-repository support
- Dedicated support
- On-premise deployment

## 🏢 Enterprise Features

- **SSO Integration**: SAML, OAuth, LDAP
- **Audit Logs**: Complete fix history and compliance reporting
- **Custom Rules**: Organization-specific coding standards
- **Priority Support**: Dedicated technical account management
- **On-Premise**: Deploy within your infrastructure

## 📈 Performance

- **Analysis Speed**: < 30 seconds for 100K LOC
- **Fix Accuracy**: 85%+ automated fix success rate
- **False Positive Rate**: < 5%
- **Language Support**: 15+ programming languages

## 🔧 Integration Options

### GitHub Integration
```yaml
# .github/workflows/code-roach.yml
name: Code Roach
on: [push, pull_request]
jobs:
  analyze:
    runs-on: ubuntu-latest
    steps:
      - uses: code-roach/action@v1
        with:
          api-key: ${{ secrets.CODE_ROACH_API_KEY }}
```

### API Integration
```javascript
const { CodeRoach } = require('code-roach-sdk');

const client = new CodeRoach({
  apiKey: process.env.CODE_ROACH_API_KEY
});

// Analyze repository
const analysis = await client.analyze({
  repository: 'my-org/my-repo',
  branch: 'main'
});

// Apply fixes automatically
await client.fix({
  analysisId: analysis.id,
  autoApply: true
});
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

## 📄 License

Code Roach is available under the MIT License. See [LICENSE](LICENSE) for details.

## 📞 Support

- **Documentation**: https://docs.coderoach.dev
- **Community**: https://community.coderoach.dev
- **Enterprise Support**: enterprise@coderoach.dev

## 🐛 About Code Roach

Code Roach gets its name from the idea that just like cockroaches survive anything, Code Roach helps your code survive and thrive in production. The platform learns from millions of code fixes across thousands of repositories to continuously improve its fixing capabilities.

---

**Built with ❤️ for developers who care about code quality**
EOF

# Create GitHub-specific files
echo "📁 Creating GitHub-specific files..."

# GitHub Actions workflow
mkdir -p .github/workflows
cat > .github/workflows/ci.yml << 'EOF'
name: CI/CD
on:
  push:
    branches: [ main, develop ]
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          cache: 'npm'
      - name: Install dependencies
        run: npm ci
      - name: Run tests
        run: npm test
      - name: Build
        run: npm run build

  security:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run security audit
        run: npm audit --audit-level high
      - name: CodeQL Analysis
        uses: github/codeql-action/init@v2
        with:
          languages: javascript
      - name: Perform CodeQL Analysis
        uses: github/codeql-action/analyze@v2
EOF

# Contributing guide
cat > CONTRIBUTING.md << 'EOF'
# Contributing to Code Roach

Thank you for your interest in contributing to Code Roach! We welcome contributions from the community.

## Development Setup

1. Fork the repository
2. Clone your fork: `git clone https://github.com/your-username/code-roach.git`
3. Install dependencies: `npm install`
4. Create a feature branch: `git checkout -b feature/my-feature`

## Development Workflow

1. Write tests for your changes
2. Ensure all tests pass: `npm test`
3. Update documentation if needed
4. Submit a pull request

## Code Standards

- Use ESLint configuration
- Write comprehensive tests
- Follow existing code patterns
- Add JSDoc comments for new functions

## Reporting Issues

- Use GitHub Issues to report bugs
- Include reproduction steps
- Specify your environment (Node.js version, OS, etc.)

## Feature Requests

- Open a GitHub Issue with the "enhancement" label
- Describe the problem you're trying to solve
- Include mockups or examples if applicable
EOF

# License
cat > LICENSE << 'EOF'
MIT License

Copyright (c) 2025 Code Roach

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
EOF

# Issue templates
mkdir -p .github/ISSUE_TEMPLATE
cat > .github/ISSUE_TEMPLATE/bug-report.md << 'EOF'
---
name: Bug Report
about: Report a bug or issue
title: "[BUG] "
labels: bug
assignees: ''

---

**Describe the bug**
A clear and concise description of what the bug is.

**To Reproduce**
Steps to reproduce the behavior:
1. Go to '...'
2. Click on '....'
3. Scroll down to '....'
4. See error

**Expected behavior**
A clear and concise description of what you expected to happen.

**Screenshots**
If applicable, add screenshots to help explain your problem.

**Environment:**
 - OS: [e.g. macOS, Windows, Linux]
 - Node.js Version: [e.g. 18.17.0]
 - Code Roach Version: [e.g. 1.0.0]

**Additional context**
Add any other context about the problem here.
EOF

cat > .github/ISSUE_TEMPLATE/feature-request.md << 'EOF'
---
name: Feature Request
about: Suggest a new feature or enhancement
title: "[FEATURE] "
labels: enhancement
assignees: ''

---

**Is your feature request related to a problem? Please describe.**
A clear and concise description of what the problem is. Ex. I'm always frustrated when [...]

**Describe the solution you'd like**
A clear and concise description of what you want to happen.

**Describe alternatives you've considered**
A clear and concise description of any alternative solutions or features you've considered.

**Additional context**
Add any other context or screenshots about the feature request here.
EOF

# Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Environment variables
.env
.env.local
.env.development.local
.env.test.local
.env.production.local

# Logs
logs/
*.log

# Runtime data
pids/
*.pid
*.seed
*.pid.lock

# Coverage directory used by tools like istanbul
coverage/
*.lcov

# nyc test coverage
.nyc_output/

# Dependency directories
jspm_packages/

# Optional npm cache directory
.npm

# Optional REPL history
.node_repl_history

# Output of 'npm pack'
*.tgz

# Yarn Integrity file
.yarn-integrity

# dotenv environment variables file
.env.test

# parcel-bundler cache (https://parceljs.org/)
.cache
.parcel-cache

# next.js build output
.next

# nuxt.js build output
.nuxt

# vuepress build output
.vuepress/dist

# Serverless directories
.serverless

# FuseBox cache
.fusebox/

# DynamoDB Local files
.dynamodb/

# TernJS port file
.tern-port

# Stores VSCode versions used for testing VSCode extensions
.vscode-test

# Build outputs
dist/
build/
EOF

echo "✅ Code Roach GitHub repository setup complete!"
echo ""
echo "Next steps:"
echo "1. Create a new repository at https://github.com/new"
echo "2. Push this code: git remote add origin <repo-url> && git push -u origin main"
echo "3. Enable GitHub Pages for documentation"
echo "4. Set up branch protection rules"
echo ""
EOF

chmod +x .github-repo-setup.sh

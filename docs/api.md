# 🐛 Code Roach API Reference

Complete API documentation for Code Roach's code analysis and fixing platform. All endpoints require authentication via API key.

## 🔑 Authentication

All API requests must include an Authorization header:

```
Authorization: Bearer YOUR_API_KEY
```

Get your API key at [coderoach.dev](https://coderoach.dev)

## 📡 Base URL

```
https://api.coderoach.dev
```

## 🔍 Analysis Endpoints

### POST /analyze

Analyze code for issues and generate fixes.

#### Request Body
```json
{
  "code": "function authenticate(req, res) { ... }",
  "language": "javascript",
  "filename": "auth.js",
  "context": "authentication",
  "rules": {
    "security": "strict",
    "performance": "medium"
  }
}
```

#### Parameters
- `code` (string, required) - Code to analyze
- `language` (string, required) - Programming language
- `filename` (string, optional) - Original filename
- `context` (string, optional) - Code context (auth, api, database, etc.)
- `rules` (object, optional) - Custom analysis rules

#### Response
```json
{
  "analysis_id": "analysis_12345",
  "status": "completed",
  "issues": [
    {
      "id": "sec_001",
      "type": "security",
      "severity": "high",
      "title": "SQL Injection Vulnerability",
      "description": "Direct string interpolation in SQL query",
      "line": 15,
      "column": 25,
      "suggestion": "Use parameterized queries instead",
      "fix_available": true,
      "confidence": 0.95
    }
  ],
  "metrics": {
    "complexity": 8,
    "maintainability": 65,
    "security_score": 75,
    "performance_score": 85
  },
  "fixes": [
    {
      "issue_id": "sec_001",
      "type": "replace",
      "original": "db.query(`SELECT * FROM users WHERE id = ${userId}`)",
      "replacement": "db.query('SELECT * FROM users WHERE id = ?', [userId])",
      "explanation": "Replace template literals with parameterized queries"
    }
  ]
}
```

### POST /analyze/repository

Analyze an entire repository.

#### Request Body
```json
{
  "repository_url": "https://github.com/my-org/my-repo",
  "branch": "main",
  "languages": ["javascript", "typescript"],
  "exclude_patterns": ["node_modules/**", "dist/**"],
  "rules": {
    "security": "strict"
  },
  "webhook_url": "https://my-app.com/webhooks/code-roach"
}
```

#### Response
```json
{
  "analysis_id": "repo_analysis_67890",
  "status": "queued",
  "estimated_duration": "15m",
  "files_to_analyze": 247,
  "webhook_events": ["started", "progress", "completed"]
}
```

### GET /analysis/{analysis_id}

Get analysis results and status.

#### Response
```json
{
  "analysis_id": "analysis_12345",
  "status": "completed",
  "started_at": "2024-01-15T10:00:00Z",
  "completed_at": "2024-01-15T10:02:30Z",
  "duration": "2m 30s",
  "files_analyzed": 15,
  "issues_found": 23,
  "issues_by_severity": {
    "critical": 2,
    "high": 5,
    "medium": 11,
    "low": 5
  },
  "results_url": "https://api.coderoach.dev/analysis/analysis_12345/results"
}
```

## 🔧 Fix Endpoints

### POST /fix

Apply automatic fixes to code.

#### Request Body
```json
{
  "code": "function authenticate(req, res) { ... }",
  "language": "javascript",
  "issues": ["sec_001", "perf_002"],
  "aggressive": false,
  "backup": true
}
```

#### Parameters
- `code` (string, required) - Code to fix
- `language` (string, required) - Programming language
- `issues` (array, optional) - Specific issues to fix
- `aggressive` (boolean, optional) - Apply all available fixes
- `backup` (boolean, optional) - Create backup before fixing

#### Response
```json
{
  "fixed_code": "function authenticate(req, res) {\n  // Fixed code here\n}",
  "changes_applied": 3,
  "backup_created": "backup_20240115_100000.js",
  "validation_passed": true,
  "test_suggestions": [
    "Add unit test for authentication flow",
    "Test edge cases for invalid inputs"
  ]
}
```

### POST /fix/pr

Create a pull request with fixes.

#### Request Body
```json
{
  "repository_url": "https://github.com/my-org/my-repo",
  "branch": "feature/fixes",
  "base_branch": "main",
  "title": "Code Roach: Security and Performance Fixes",
  "description": "Automated fixes for security vulnerabilities and performance issues",
  "issues_to_fix": ["all"],
  "create_draft": false
}
```

#### Response
```json
{
  "pr_url": "https://github.com/my-org/my-repo/pull/123",
  "branch": "code-roach/fixes-20240115",
  "commits": 5,
  "files_changed": 8,
  "status": "opened"
}
```

## 📊 Metrics Endpoints

### GET /metrics/project

Get project health metrics.

#### Query Parameters
- `period` (string, optional) - Time period (7d, 30d, 90d)
- `repository` (string, optional) - Repository URL

#### Response
```json
{
  "period": "30d",
  "metrics": {
    "code_quality_score": 82,
    "security_score": 88,
    "performance_score": 75,
    "maintainability_score": 79,
    "issues_trend": {
      "total": 156,
      "fixed": 142,
      "new": 14
    },
    "languages": {
      "javascript": 65,
      "typescript": 35
    }
  },
  "trends": [
    {
      "date": "2024-01-15",
      "quality_score": 82,
      "issues_fixed": 8
    }
  ]
}
```

### GET /metrics/team

Get team productivity metrics.

#### Response
```json
{
  "team_metrics": {
    "active_developers": 12,
    "code_reviews_completed": 45,
    "average_fix_time": "3.2h",
    "automation_savings": "28.5h",
    "productivity_increase": "+23%",
    "top_contributors": [
      {
        "name": "Alice Johnson",
        "fixes_applied": 23,
        "code_quality_score": 92
      }
    ]
  }
}
```

## 🏗️ Repository Management

### POST /repositories

Register a repository for monitoring.

#### Request Body
```json
{
  "url": "https://github.com/my-org/my-repo",
  "name": "my-project",
  "branch": "main",
  "languages": ["javascript", "typescript"],
  "schedule": "daily",
  "notifications": {
    "email": ["team@company.com"],
    "slack": "https://hooks.slack.com/...",
    "webhook": "https://my-app.com/webhooks"
  }
}
```

#### Response
```json
{
  "repository_id": "repo_12345",
  "status": "registered",
  "next_analysis": "2024-01-16T09:00:00Z",
  "webhook_secret": "whsec_..."
}
```

### GET /repositories/{repository_id}

Get repository status and configuration.

#### Response
```json
{
  "repository_id": "repo_12345",
  "url": "https://github.com/my-org/my-repo",
  "status": "active",
  "last_analysis": "2024-01-15T10:00:00Z",
  "analysis_count": 28,
  "issues_found": 156,
  "issues_fixed": 142,
  "health_score": 84
}
```

## 🎯 Rules Management

### GET /rules

List available analysis rules.

#### Response
```json
{
  "rules": {
    "security": {
      "categories": ["injection", "auth", "crypto", "access"],
      "levels": ["low", "medium", "high", "strict"]
    },
    "performance": {
      "categories": ["loops", "memory", "io", "async"],
      "levels": ["basic", "medium", "advanced"]
    },
    "maintainability": {
      "categories": ["complexity", "duplication", "structure"],
      "levels": ["relaxed", "standard", "strict"]
    }
  }
}
```

### POST /rules/custom

Create custom analysis rules.

#### Request Body
```json
{
  "name": "company-naming-convention",
  "language": "javascript",
  "pattern": "^[a-z][a-zA-Z0-9]*$",
  "message": "Variable names must follow company naming conventions",
  "severity": "medium",
  "category": "style"
}
```

#### Response
```json
{
  "rule_id": "rule_78901",
  "name": "company-naming-convention",
  "status": "active",
  "created_at": "2024-01-15T10:00:00Z"
}
```

## 🔄 Integration Endpoints

### POST /integrations/github

Configure GitHub integration.

#### Request Body
```json
{
  "token": "ghp_your_token",
  "repositories": ["my-org/repo1", "my-org/repo2"],
  "events": ["push", "pull_request"],
  "auto_analysis": true,
  "auto_fix_prs": false
}
```

### POST /integrations/slack

Configure Slack notifications.

#### Request Body
```json
{
  "webhook_url": "https://hooks.slack.com/services/...",
  "channels": {
    "alerts": "#code-quality",
    "reports": "#dev-reports"
  },
  "events": ["analysis_complete", "critical_issue", "weekly_report"]
}
```

## 📝 Webhooks

### Analysis Webhook Payload

```json
{
  "event": "analysis_completed",
  "repository": "https://github.com/my-org/my-repo",
  "analysis_id": "analysis_12345",
  "timestamp": "2024-01-15T10:30:00Z",
  "results": {
    "status": "success",
    "issues_found": 23,
    "issues_fixed": 18,
    "duration": "5m 30s"
  }
}
```

### Supported Events
- `analysis_started` - Analysis begins
- `analysis_completed` - Analysis finishes
- `issue_found` - New issue detected
- `fix_applied` - Fix successfully applied
- `pr_created` - Pull request created
- `webhook_failed` - Webhook delivery failed

## ⚡ Rate Limits

| Plan | Requests/minute | Requests/hour | Requests/day |
|------|-----------------|----------------|---------------|
| Free | 10 | 100 | 1,000 |
| Professional | 100 | 1,000 | 50,000 |
| Enterprise | Custom | Custom | Custom |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

## 📝 Error Handling

All API errors follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed",
    "details": {
      "field": "code",
      "reason": "Code cannot be empty"
    }
  }
}
```

### Common Error Codes

| Code | Description |
|------|-------------|
| `VALIDATION_ERROR` | Invalid request parameters |
| `UNAUTHORIZED` | Invalid or missing API key |
| `FORBIDDEN` | Insufficient permissions |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMITED` | Too many requests |
| `ANALYSIS_FAILED` | Code analysis failed |
| `FIX_FAILED` | Automatic fix failed |

## 🔒 Security

- All requests use HTTPS
- API keys are encrypted and rotated regularly
- Sensitive data is never stored in logs
- Webhook signatures for request verification
- Comprehensive audit logging

## 📞 Support

- **API Status**: [status.coderoach.dev](https://status.coderoach.dev)
- **Documentation**: [docs.coderoach.dev](https://docs.coderoach.dev)
- **Community**: [community.coderoach.dev](https://community.coderoach.dev)
- **Email**: api-support@coderoach.dev

## 📋 Changelog

### v1.0.0 (Current)
- Complete REST API for code analysis
- Automatic fixing capabilities
- Repository management
- Integration endpoints
- Real-time webhooks

---

**🐛 Ready to automate your code quality?** Check our [Getting Started Guide](getting-started.md) and start building better software!

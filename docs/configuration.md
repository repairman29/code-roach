# 🔧 Configuration Guide

Learn how to configure Code Roach for your specific needs, including project settings, analysis options, and integration preferences.

## 📁 Configuration Files

### Project Configuration (.coderoach/config.json)

The main configuration file is created automatically when you run `code-roach init`. Here's the complete structure:

```json
{
  "version": "1.0.0",
  "project": {
    "name": "my-project",
    "description": "My awesome project",
    "languages": ["javascript", "typescript"],
    "main_branch": "main",
    "exclude_patterns": [
      "node_modules/**",
      "dist/**",
      "build/**",
      "*.min.js",
      "coverage/**",
      ".git/**"
    ]
  },
  "analysis": {
    "max_file_size": "2MB",
    "timeout": "300s",
    "parallel_jobs": 4,
    "cache_enabled": true,
    "cache_ttl": "24h"
  },
  "rules": {
    "security": "strict",
    "performance": "medium",
    "maintainability": "high",
    "complexity": {
      "max_lines_per_function": 50,
      "max_cyclomatic_complexity": 10
    }
  },
  "integrations": {
    "github": {
      "enabled": true,
      "auto_pr_comments": true,
      "auto_fix_prs": false
    },
    "slack": {
      "enabled": false,
      "webhook_url": "",
      "channels": ["#code-quality"]
    }
  },
  "reporting": {
    "format": "html",
    "output_dir": "./code-roach-reports",
    "include_metrics": true,
    "include_suggestions": true
  }
}
```

### Environment Variables

Override configuration with environment variables:

```bash
# API Configuration
export CODE_ROACH_API_KEY=your_api_key_here
export CODE_ROACH_BASE_URL=https://api.coderoach.dev

# Analysis Configuration
export CODE_ROACH_MAX_FILE_SIZE=5MB
export CODE_ROACH_TIMEOUT=600s
export CODE_ROACH_PARALLEL_JOBS=8

# Security Configuration
export CODE_ROACH_SECURITY_LEVEL=strict
export CODE_ROACH_ALLOW_API_KEYS=true

# Reporting Configuration
export CODE_ROACH_REPORT_FORMAT=json
export CODE_ROACH_REPORT_DIR=./reports
```

## 🏗️ Project Configuration

### Basic Project Setup

```bash
cd your-project
code-roach init
```

This creates a `.coderoach/config.json` with sensible defaults.

### Advanced Project Configuration

```json
{
  "project": {
    "name": "enterprise-app",
    "type": "web-application",
    "team": "platform-team",
    "business_critical": true,
    "compliance": ["SOC2", "GDPR"],
    "languages": ["typescript", "python", "sql"],
    "frameworks": ["react", "fastapi", "postgresql"],
    "main_branch": "main",
    "release_branches": ["release/*"],
    "exclude_patterns": [
      "node_modules/**",
      "dist/**",
      "build/**",
      "*.min.js",
      "coverage/**",
      "migrations/**",
      "scripts/**"
    ]
  }
}
```

### Language-Specific Configuration

```json
{
  "languages": {
    "javascript": {
      "eslint_config": ".eslintrc.js",
      "test_runner": "jest",
      "package_manager": "npm"
    },
    "typescript": {
      "tsconfig": "tsconfig.json",
      "strict_mode": true,
      "target": "ES2020"
    },
    "python": {
      "requirements_file": "requirements.txt",
      "virtualenv": ".venv",
      "test_framework": "pytest"
    }
  }
}
```

## 🔍 Analysis Configuration

### Performance Tuning

```json
{
  "analysis": {
    "max_file_size": "10MB",
    "timeout": "600s",
    "parallel_jobs": 8,
    "memory_limit": "2GB",
    "cpu_limit": 4,
    "cache_enabled": true,
    "cache_ttl": "48h",
    "incremental_analysis": true
  }
}
```

### Quality Rules Configuration

```json
{
  "rules": {
    "security": "strict",
    "performance": "high",
    "maintainability": "medium",
    "complexity": {
      "max_lines_per_function": 30,
      "max_cyclomatic_complexity": 8,
      "max_parameters_per_function": 4,
      "max_nesting_depth": 3
    },
    "style": {
      "indentation": "spaces",
      "line_length": 120,
      "semicolons": "required"
    }
  }
}
```

### Custom Rules

Create custom rules for your organization:

```json
{
  "custom_rules": {
    "company-naming": {
      "pattern": "^[a-z][a-zA-Z0-9]*$",
      "message": "Variable names must follow company naming conventions"
    },
    "api-versioning": {
      "pattern": "/api/v\\d+/",
      "message": "API endpoints must include version numbers"
    }
  }
}
```

## 🔌 Integration Configuration

### GitHub Integration

```json
{
  "integrations": {
    "github": {
      "enabled": true,
      "token": "${GITHUB_TOKEN}",
      "repositories": ["my-org/my-repo"],
      "auto_pr_comments": true,
      "auto_fix_prs": false,
      "require_reviews": true,
      "branch_protection": {
        "require_code_owner_reviews": true,
        "required_checks": ["code-roach-analysis"]
      }
    }
  }
}
```

### Slack Integration

```json
{
  "integrations": {
    "slack": {
      "enabled": true,
      "webhook_url": "${SLACK_WEBHOOK_URL}",
      "channels": {
        "alerts": "#code-quality-alerts",
        "reports": "#code-quality-reports",
        "success": "#code-quality-success"
      },
      "notifications": {
        "on_analysis_complete": true,
        "on_critical_issues": true,
        "daily_summary": true,
        "weekly_report": true
      }
    }
  }
}
```

### CI/CD Integration

```json
{
  "integrations": {
    "ci_cd": {
      "provider": "github-actions",
      "fail_on_critical": true,
      "fail_on_high": false,
      "comment_pr": true,
      "update_status_checks": true,
      "artifacts": {
        "reports": true,
        "badges": true
      }
    }
  }
}
```

### IDE Integration

```json
{
  "integrations": {
    "ide": {
      "vscode": {
        "enabled": true,
        "real_time_analysis": true,
        "auto_fix_on_save": false,
        "show_inline_suggestions": true
      },
      "jetbrains": {
        "enabled": true,
        "auto_import": true,
        "quick_fixes": true
      }
    }
  }
}
```

## 📊 Reporting Configuration

### HTML Reports

```json
{
  "reporting": {
    "format": "html",
    "output_dir": "./code-roach-reports",
    "include_metrics": true,
    "include_suggestions": true,
    "include_history": true,
    "theme": "dark",
    "custom_css": "./custom-report-styles.css"
  }
}
```

### JSON Reports

```json
{
  "reporting": {
    "format": "json",
    "output_dir": "./reports",
    "pretty_print": true,
    "include_raw_data": false,
    "compress": true
  }
}
```

### Custom Reporting

```json
{
  "reporting": {
    "custom_webhooks": [
      {
        "url": "https://my-reporting-service.com/webhook",
        "events": ["analysis_complete", "issue_found"],
        "headers": {
          "Authorization": "Bearer ${CUSTOM_TOKEN}",
          "X-Source": "code-roach"
        }
      }
    ]
  }
}
```

## 🔐 Security Configuration

### API Security

```json
{
  "security": {
    "api_keys": {
      "rotation_period": "90d",
      "max_keys_per_user": 5,
      "require_mfa": true
    },
    "rate_limiting": {
      "requests_per_minute": 100,
      "burst_limit": 200,
      "backoff_strategy": "exponential"
    },
    "encryption": {
      "data_at_rest": true,
      "data_in_transit": true,
      "key_rotation": "30d"
    }
  }
}
```

### Access Control

```json
{
  "access_control": {
    "teams": {
      "platform-team": {
        "repositories": ["*"],
        "permissions": ["read", "write", "admin"]
      },
      "frontend-team": {
        "repositories": ["frontend/**", "shared/**"],
        "permissions": ["read", "write"]
      }
    },
    "ip_whitelist": ["192.168.1.0/24", "10.0.0.0/8"],
    "require_vpn": true
  }
}
```

## 🚀 Advanced Configuration

### Enterprise Configuration

```json
{
  "enterprise": {
    "multi_tenant": true,
    "audit_logging": true,
    "compliance_mode": "strict",
    "backup_schedule": "daily",
    "disaster_recovery": {
      "enabled": true,
      "regions": ["us-east-1", "eu-west-1"],
      "rto": "4h",
      "rpo": "1h"
    }
  }
}
```

### Custom Analysis Pipelines

```json
{
  "analysis_pipeline": {
    "pre_analysis_hooks": [
      {
        "name": "security-scan",
        "command": "npm run security-scan",
        "fail_on_error": true
      }
    ],
    "post_analysis_hooks": [
      {
        "name": "notify-team",
        "webhook": "https://slack.com/webhook/...",
        "condition": "issues_found"
      }
    ],
    "custom_analyzers": [
      {
        "name": "company-rules",
        "path": "./analyzers/company-rules.js",
        "enabled": true
      }
    ]
  }
}
```

## 🔧 Configuration Validation

Validate your configuration:

```bash
code-roach config validate
```

Test your configuration with a dry run:

```bash
code-roach analyze --dry-run --verbose
```

## 📚 Configuration Examples

### Startup Configuration

```json
{
  "version": "1.0.0",
  "project": {
    "name": "startup-app",
    "languages": ["javascript", "typescript"],
    "exclude_patterns": ["node_modules/**", "dist/**"]
  },
  "analysis": {
    "max_file_size": "1MB",
    "parallel_jobs": 2
  },
  "rules": {
    "security": "high",
    "performance": "medium"
  }
}
```

### Enterprise Configuration

```json
{
  "version": "1.0.0",
  "project": {
    "name": "enterprise-platform",
    "compliance": ["SOC2", "GDPR", "HIPAA"],
    "business_critical": true
  },
  "analysis": {
    "max_file_size": "5MB",
    "parallel_jobs": 16,
    "audit_logging": true
  },
  "rules": {
    "security": "strict",
    "performance": "strict",
    "maintainability": "high"
  },
  "integrations": {
    "github": {"enabled": true},
    "slack": {"enabled": true},
    "jira": {"enabled": true}
  }
}
```

## ❓ Troubleshooting Configuration

### Configuration Not Loading

```bash
# Check configuration file exists
ls -la .coderoach/config.json

# Validate JSON syntax
code-roach config validate

# Check file permissions
ls -l .coderoach/config.json
```

### Analysis Not Respecting Rules

```bash
# Check rule configuration
code-roach config get rules

# Test specific rule
code-roach analyze --rule security src/auth.js

# Clear analysis cache
code-roach cache clear
```

### Integration Not Working

```bash
# Test integration connection
code-roach integrations test github

# Check integration logs
code-roach logs integrations --tail 50

# Validate webhook URLs
code-roach integrations validate
```

---

**🎯 Need help with configuration?** Check our [Troubleshooting Guide](troubleshooting.md) or visit our [Community Forum](https://community.coderoach.dev)!

# 🔧 Troubleshooting Guide

Solve common issues and get Code Roach working smoothly. This guide covers the most frequent problems and their solutions.

## 🚀 Quick Diagnosis

### Health Check

Run a quick health check:

```bash
code-roach doctor
```

This checks:
- API connectivity
- Configuration validity
- File permissions
- Integration status

### Version Information

Check your installation:

```bash
code-roach --version
code-roach info
```

## 🔑 Authentication Issues

### "Invalid API Key"

**Symptoms:**
- `Error: Unauthorized (401)`
- `API key rejected`

**Solutions:**

1. **Check API key format:**
   ```bash
   # Should start with 'cr_' or similar prefix
   echo $CODE_ROACH_API_KEY | head -c 10
   ```

2. **Regenerate API key:**
   ```bash
   # Visit https://coderoach.dev/dashboard
   # Go to Settings → API Keys
   # Create new key and update environment
   ```

3. **Check environment variable:**
   ```bash
   echo $CODE_ROACH_API_KEY
   export CODE_ROACH_API_KEY=your_new_key_here
   ```

### "API Key Expired"

**Symptoms:**
- Was working, now getting auth errors
- Dashboard shows key expiration

**Solution:**
```bash
# Rotate to new key
code-roach auth rotate-key

# Or manually update
export CODE_ROACH_API_KEY=new_key_from_dashboard
```

## 📊 Analysis Issues

### "Analysis Timeout"

**Symptoms:**
- Analysis takes too long
- `Error: Analysis timeout (300s)`

**Solutions:**

1. **Increase timeout:**
   ```bash
   code-roach analyze --timeout 600s
   ```

2. **Reduce file size:**
   ```bash
   code-roach analyze --max-file-size 1MB
   ```

3. **Analyze specific files:**
   ```bash
   code-roach analyze src/ --exclude "node_modules/**"
   ```

4. **Configure in `.coderoach/config.json`:**
   ```json
   {
     "analysis": {
       "timeout": "600s",
       "max_file_size": "2MB",
       "parallel_jobs": 2
     }
   }
   ```

### "No Issues Found" (False Negative)

**Symptoms:**
- Analysis completes but finds nothing
- Expected issues not detected

**Solutions:**

1. **Check file types:**
   ```bash
   # Ensure correct languages are specified
   code-roach analyze --languages javascript,typescript
   ```

2. **Verify rules:**
   ```bash
   code-roach config get rules
   ```

3. **Check exclusions:**
   ```bash
   # Files might be excluded
   code-roach analyze --include node_modules/**
   ```

4. **Test with known bad code:**
   ```javascript
   // This should trigger security warnings
   const query = `SELECT * FROM users WHERE id = ${userId}`;
   ```

### "Too Many Issues" (False Positives)

**Symptoms:**
- Analysis finds too many issues
- Many issues are not relevant

**Solutions:**

1. **Adjust rule severity:**
   ```json
   {
     "rules": {
       "security": "medium",
       "performance": "relaxed"
     }
   }
   ```

2. **Add exclusions:**
   ```json
   {
     "exclude_patterns": [
       "test/**",
       "migrations/**",
       "legacy/**"
     ]
   }
   ```

3. **Custom rules:**
   ```json
   {
     "custom_rules": {
       "ignore_legacy": {
         "pattern": "legacy/**",
         "action": "skip"
       }
     }
   }
   ```

## 🔧 Fix Issues

### "Fix Failed to Apply"

**Symptoms:**
- `Error: Fix application failed`
- Code remains unchanged

**Solutions:**

1. **Check file permissions:**
   ```bash
   ls -la file-to-fix.js
   chmod 644 file-to-fix.js
   ```

2. **Backup original:**
   ```bash
   code-roach fix --backup file.js
   ```

3. **Apply specific fixes:**
   ```bash
   code-roach fix --issues sec_001,perf_002 file.js
   ```

4. **Manual review:**
   ```bash
   code-roach fix --preview file.js
   ```

### "Backup Not Created"

**Symptoms:**
- Fix applied but no backup found

**Solutions:**

1. **Enable backups:**
   ```json
   {
     "fix": {
       "create_backups": true,
       "backup_dir": "./backups"
     }
   }
   ```

2. **Check backup directory:**
   ```bash
   ls -la ./code-roach-backups/
   ```

## 🔌 Integration Issues

### GitHub Integration

#### "Repository Not Found"

```bash
# Check repository access
gh repo view my-org/my-repo

# Verify token permissions
gh auth status
```

#### "Webhook Not Working"

```bash
# Test webhook manually
curl -X POST https://your-webhook-url.com/test \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'

# Check webhook logs
code-roach logs webhooks --tail 20
```

#### "PR Comments Not Appearing"

```json
{
  "integrations": {
    "github": {
      "comment_pr": true,
      "require_write_permissions": true
    }
  }
}
```

### Slack Integration

#### "Messages Not Sending"

```bash
# Test webhook URL
curl -X POST $SLACK_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"text": "Test message"}'

# Check webhook configuration
code-roach config get integrations.slack
```

#### "Wrong Channel"

```json
{
  "integrations": {
    "slack": {
      "channels": {
        "alerts": "#code-quality",
        "reports": "#dev-reports"
      }
    }
  }
}
```

## ⚙️ Configuration Issues

### "Config File Not Found"

**Solutions:**

1. **Initialize config:**
   ```bash
   code-roach init
   ```

2. **Check file location:**
   ```bash
   ls -la .coderoach/config.json
   ```

3. **Validate JSON:**
   ```bash
   cat .coderoach/config.json | jq .
   ```

### "Invalid Configuration"

**Symptoms:**
- `Error: Configuration validation failed`

**Solutions:**

1. **Validate config:**
   ```bash
   code-roach config validate
   ```

2. **Check syntax:**
   ```bash
   python -m json.tool .coderoach/config.json
   ```

3. **Reset to defaults:**
   ```bash
   code-roach config reset
   ```

## 💻 IDE Issues

### VS Code Extension

#### "Extension Not Loading"

1. Reload VS Code: `Ctrl+Shift+P` → "Developer: Reload Window"
2. Check extension logs: View → Output → Code Roach
3. Reinstall extension

#### "Analysis Not Working"

1. Check API key in settings
2. Verify file language detection
3. Check extension permissions

### JetBrains Integration

#### "Plugin Not Responding"

1. Restart IDE
2. Clear IDE cache
3. Reconfigure plugin settings

## 🌐 Network Issues

### "Connection Timeout"

**Solutions:**

1. **Check network:**
   ```bash
   ping api.coderoach.dev
   ```

2. **Proxy configuration:**
   ```bash
   export HTTP_PROXY=http://proxy.company.com:8080
   export HTTPS_PROXY=http://proxy.company.com:8080
   ```

3. **Firewall settings:**
   ```bash
   telnet api.coderoach.dev 443
   ```

### "SSL Certificate Issues"

```bash
# Bypass SSL verification (not recommended for production)
export NODE_TLS_REJECT_UNAUTHORIZED=0

# Update certificates
sudo apt-get update && sudo apt-get install ca-certificates
```

## 📈 Performance Issues

### "Analysis Too Slow"

**Solutions:**

1. **Reduce parallel jobs:**
   ```json
   {
     "analysis": {
       "parallel_jobs": 2
     }
   }
   ```

2. **Increase timeout:**
   ```json
   {
     "analysis": {
       "timeout": "900s"
     }
   }
   ```

3. **Exclude large files:**
   ```json
   {
     "exclude_patterns": [
       "**/*.min.js",
       "**/*.map"
     ]
   }
   ```

### "Memory Usage High"

```json
{
  "analysis": {
    "memory_limit": "1GB",
    "cache_enabled": true
  }
}
```

## 📊 Reporting Issues

### "Reports Not Generating"

**Solutions:**

1. **Check output directory:**
   ```bash
   ls -la ./code-roach-reports/
   mkdir -p ./code-roach-reports
   ```

2. **Set correct permissions:**
   ```bash
   chmod 755 ./code-roach-reports
   ```

3. **Configure report format:**
   ```json
   {
     "reporting": {
       "format": "html",
       "output_dir": "./reports"
     }
   }
   ```

## 🔐 Security Issues

### "Permission Denied"

**Solutions:**

1. **Check API key permissions:**
   ```bash
   code-roach auth check-permissions
   ```

2. **Repository access:**
   ```bash
   code-roach repositories check-access https://github.com/org/repo
   ```

3. **File permissions:**
   ```bash
   ls -la file-to-analyze.js
   chmod 644 file-to-analyze.js
   ```

## 🆘 Getting Help

### Debug Mode

Enable detailed logging:

```bash
code-roach analyze --verbose --debug
export CODE_ROACH_DEBUG=true
```

### Log Files

Check application logs:

```bash
code-roach logs show --tail 100
code-roach logs export ./debug-logs.zip
```

### Community Support

- **Forum:** [community.coderoach.dev](https://community.coderoach.dev)
- **GitHub Issues:** [github.com/repairman29/code-roach/issues](https://github.com/repairman29/code-roach/issues)
- **Stack Overflow:** Tag `code-roach`

### Professional Support

- **Email:** support@coderoach.dev
- **Enterprise:** enterprise@coderoach.dev
- **Phone:** Available for Enterprise customers

## 🚨 Emergency Issues

### "Service Completely Down"

1. Check status page: [status.coderoach.dev](https://status.coderoach.dev)
2. Contact support immediately
3. Use offline mode if available

### "Data Loss"

1. Check backup systems
2. Contact enterprise support
3. Restore from last known good state

## 📋 Common Commands

### Diagnostic Commands

```bash
code-roach doctor              # Health check
code-roach info               # System information
code-roach config validate    # Validate configuration
code-roach auth status        # Check authentication
```

### Debug Commands

```bash
code-roach logs show --tail 50    # Show recent logs
code-roach cache clear           # Clear analysis cache
code-roach test connection       # Test API connectivity
```

### Recovery Commands

```bash
code-roach config reset          # Reset to defaults
code-roach auth logout          # Clear authentication
code-roach cache flush          # Clear all caches
```

---

**🔧 Still having issues?** Our support team is here to help. Check our [Community Forum](https://community.coderoach.dev) or contact [support@coderoach.dev](mailto:support@coderoach.dev) for personalized assistance!

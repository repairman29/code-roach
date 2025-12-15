# Code Roach ML/AI Learning System

## Overview

Code Roach doesn't just find and fix issues - it **learns** and **improves** your development process by:

1. **Analyzing patterns** from issues and fixes
2. **Generating Cursor rules** automatically
3. **Tracking effectiveness** of rules
4. **Updating guidelines** to prevent future issues
5. **Improving code quality** over time

This is the **META learning layer** that makes developers code better, faster.

---

## How It Works

### 1. Pattern Analysis

Code Roach analyzes:
- **Problematic patterns**: Issues that occur frequently
- **Successful fixes**: What works and why
- **File-level insights**: Which files have issues, which improve
- **Developer behavior**: What gets fixed manually vs auto-fixed

### 2. Rule Generation

Using LLM analysis, Code Roach generates:
- **Specific Cursor rules** that prevent common issues
- **Category-based rules** (security, performance, style, best-practice)
- **Evidence-based rules** backed by pattern data

### 3. Effectiveness Tracking

Every time an issue is found:
- **Tracks if rules were followed**
- **Measures if rules prevented issues**
- **Calculates success rates**
- **Updates rule priorities**

### 4. Continuous Improvement

- **Low-performing rules** get updated or removed
- **High-performing rules** get prioritized
- **New patterns** trigger new rules
- **Rules evolve** with your codebase

---

## Database Schema

### Tables

1. **`code_roach_issues`** - All issues found
2. **`code_roach_patterns`** - Error pattern fingerprints
3. **`code_roach_cursor_rules`** - Generated Cursor rules
4. **`code_roach_rule_effectiveness`** - Rule performance tracking
5. **`code_roach_quality_improvements`** - Improvement history
6. **`code_roach_file_health`** - File health over time

See `supabase/migrations/20250113_code_roach_schema.sql` for full schema.

---

## Usage

### Generate Rules from Patterns

```bash
# Analyze patterns and generate new rules
curl -X POST http://localhost:3000/api/code-roach/learning/analyze

# Or use the script
./scripts/code-roach-learn-and-update.sh
```

This will:
1. Analyze top problematic patterns
2. Generate new Cursor rules
3. Update `.cursorrules` file
4. Track the improvement

### Get Recommended Rules for a File

```bash
# Get rules recommended for a specific file
curl "http://localhost:3000/api/code-roach/learning/rules?file=server/routes/api.js"
```

### Track Rule Effectiveness

When an issue is found, Code Roach automatically tracks:
- Was the rule followed?
- Did it prevent the issue?
- What was the severity?

This data feeds back into rule success rates.

---

## Example Workflow

### Day 1: Issues Found
```
- 50 "console.log in production" issues
- 30 "missing error handling" issues
- 20 "SQL injection risk" issues
```

### Day 2: Rules Generated
Code Roach analyzes patterns and generates:

```markdown
## STYLE Rules

### 1. prevent_console_log_production
# Always remove console.log statements before committing
# Based on pattern analysis showing 50 occurrences
# Use proper logging service instead

## BEST-PRACTICE Rules

### 2. require_error_handling
# All async code must have error handling
# Based on 30 occurrences of unhandled promises
# Use try-catch or .catch() for all async operations
```

### Day 3: Rules Applied
Developers code with new rules. Issues drop:
```
- 5 "console.log" issues (90% reduction)
- 8 "missing error handling" issues (73% reduction)
- 2 "SQL injection risk" issues (90% reduction)
```

### Day 4: Rules Updated
Code Roach tracks effectiveness:
- `prevent_console_log_production`: 90% success rate ✅
- `require_error_handling`: 73% success rate ✅
- Rules get prioritized in `.cursorrules`

---

## Analytics Queries

### Most Effective Rules

```sql
SELECT rule_name, success_rate, issue_prevention_count
FROM code_roach_cursor_rules
WHERE is_active = TRUE
ORDER BY success_rate DESC
LIMIT 10;
```

### Issues Prevented by Rules

```sql
SELECT 
  cr.rule_name,
  COUNT(CASE WHEN re.issue_was_prevented THEN 1 END) as prevented,
  COUNT(re.id) as total_applications,
  ROUND(100.0 * COUNT(CASE WHEN re.issue_was_prevented THEN 1 END) / COUNT(re.id), 2) as success_rate
FROM code_roach_cursor_rules cr
LEFT JOIN code_roach_rule_effectiveness re ON cr.id = re.rule_id
GROUP BY cr.id, cr.rule_name
ORDER BY prevented DESC;
```

### Quality Improvement Over Time

```sql
SELECT 
  DATE_TRUNC('week', created_at) as week,
  COUNT(*) as improvements,
  SUM(issues_prevented_count) as issues_prevented,
  AVG(avg_health_score_improvement) as avg_improvement
FROM code_roach_quality_improvements
GROUP BY week
ORDER BY week DESC;
```

---

## Integration Points

### 1. Error Detection
When Code Roach finds an issue:
```javascript
// Check if any rules should have prevented this
const applicableRules = await cursorRulesLearningService.getRecommendedRulesForFile(filePath);
// Track effectiveness
await cursorRulesLearningService.trackRuleEffectiveness(ruleName, issueId, false);
```

### 2. Code Review
During code review:
```javascript
// Get rules for the file being reviewed
const rules = await cursorRulesLearningService.getRecommendedRulesForFile(filePath);
// Show in review UI
```

### 3. Pre-commit Hooks
Before committing:
```javascript
// Check if code follows active rules
// Prevent commit if critical rules violated
```

### 4. Periodic Learning
Schedule daily/weekly:
```bash
# Cron job or scheduled task
0 2 * * * /path/to/scripts/code-roach-learn-and-update.sh
```

---

## Configuration

### Enable Learning

Learning is enabled by default if Supabase is configured. To disable:

```javascript
// In server/config.js
codeRoach: {
  learning: {
    enabled: true,
    autoUpdateRules: true,
    updateInterval: 'daily' // daily, weekly, manual
  }
}
```

### LLM Configuration

Rules are generated using LLM (OpenAI GPT-4 by default). Configure in:

```javascript
// Uses llmService from server/services/llmService.js
// Configure OpenAI API key in .env
OPENAI_API_KEY=your_key_here
```

---

## Metrics & KPIs

### Code Quality Metrics
- **Issue reduction rate**: % decrease in issues over time
- **Rule effectiveness**: % of issues prevented by rules
- **File health improvement**: Average health score increase
- **Auto-fix success rate**: % of issues auto-fixed successfully

### Development Velocity Metrics
- **Time to fix**: Average time from detection to resolution
- **Review time**: Time spent reviewing issues
- **Prevention rate**: Issues prevented vs issues found

### Learning Metrics
- **Rules generated**: Number of rules created
- **Rules active**: Number of active rules
- **Patterns learned**: Unique patterns identified
- **Improvements tracked**: Quality improvements recorded

---

## Future Enhancements

### Phase 1: Current (✅)
- Pattern analysis
- Rule generation
- Effectiveness tracking
- `.cursorrules` updates

### Phase 2: Advanced Learning
- **Predictive rules**: Rules that prevent issues before they occur
- **Context-aware rules**: Rules that adapt to codebase patterns
- **Team-specific rules**: Rules tailored to team preferences
- **A/B testing**: Test rule variations

### Phase 3: Deep Integration
- **IDE integration**: Real-time rule suggestions in Cursor
- **Git hooks**: Automatic rule checking on commit
- **PR analysis**: Rule compliance in pull requests
- **Code generation**: Generate code that follows rules

### Phase 4: Meta-Learning
- **Rule optimization**: Automatically optimize rule content
- **Pattern prediction**: Predict new issue types
- **Cross-project learning**: Learn from multiple projects
- **Community rules**: Share effective rules across teams

---

## Troubleshooting

### Rules Not Generating

1. **Check Supabase connection**:
   ```bash
   curl http://localhost:3000/api/code-roach/learning/rules
   ```

2. **Check LLM configuration**:
   ```bash
   echo $OPENAI_API_KEY
   ```

3. **Check logs**:
   ```bash
   # Look for [Cursor Rules Learning] in server logs
   ```

### Rules Not Updating .cursorrules

1. **Check file permissions**:
   ```bash
   ls -la .cursorrules
   ```

2. **Check service logs**:
   ```bash
   # Look for file write errors
   ```

3. **Manual update**:
   ```bash
   ./scripts/code-roach-learn-and-update.sh
   ```

---

## Best Practices

1. **Review generated rules**: Don't blindly accept all rules
2. **Track effectiveness**: Monitor which rules work
3. **Update regularly**: Run learning analysis weekly
4. **Combine with manual rules**: Mix auto-generated with manual rules
5. **Team feedback**: Get developer input on rule usefulness

---

## Example: Complete Learning Cycle

```bash
# 1. Code Roach finds issues
npm run code-roach crawl

# 2. Issues are stored in Supabase
# (automatic)

# 3. Analyze patterns and generate rules
./scripts/code-roach-learn-and-update.sh

# 4. Rules are added to .cursorrules
# (automatic)

# 5. Developers code with new rules
# (next coding session)

# 6. Code Roach tracks effectiveness
# (automatic when issues found)

# 7. Rules are updated based on performance
# (automatic, or run script again)

# 8. Code quality improves over time
# (measured by metrics)
```

---

**The goal**: Not just fixing issues, but **preventing them** and **improving how we code**.


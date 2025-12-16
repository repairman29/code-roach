# Expert System Monitoring & Self-Learning Guide
## How to Verify and Improve Expert System Performance

**Date**: 2025-01-15  
**Purpose**: Guide for monitoring expert system effectiveness and enabling self-learning

---

## 🎯 Overview

The Expert Training System includes built-in monitoring and self-learning capabilities. This guide shows you how to:
1. Verify experts are being used
2. Monitor expert performance
3. Enable self-learning from fix outcomes
4. Track improvements over time

---

## ✅ Verification

### Quick Verification

```bash
# Verify expert system is working
npm run code-roach:verify-experts
```

This checks:
- ✅ Experts exist in database
- ✅ Expert retrieval works
- ✅ Expert type detection works
- ✅ Context building works
- ✅ Fix generation integration

### What to Look For

**✅ System Working:**
- Experts found in database
- Expert context built successfully
- Integration code present

**⚠️ Issues:**
- No experts found → Run onboarding
- Context building fails → Check database connection
- Integration missing → Verify code updates

---

## 📊 Monitoring

### Monitor Expert Performance

```bash
# Monitor all projects
npm run code-roach:monitor-experts

# Monitor specific project
npm run code-roach:monitor-experts <project-id>
```

### Metrics Tracked

1. **Usage Statistics**
   - How many times each expert is used
   - Last usage timestamp
   - Success/failure counts

2. **Learning Statistics**
   - Total fix outcomes recorded
   - Success rate per expert
   - Learning progress

3. **Quality Scores**
   - Current quality score
   - Quality trends over time
   - Expert effectiveness

---

## 🔄 Self-Learning System

### How It Works

1. **Fix Generation**
   - Expert is used → Usage tracked
   - Expert context included in prompt

2. **Fix Application**
   - Fix applied → Outcome recorded
   - Success/failure tracked per expert

3. **Learning Analysis**
   - After 10+ outcomes → Analyze patterns
   - Low success rate → Trigger expert update
   - Update quality scores

4. **Expert Improvement**
   - Add learned patterns to troubleshooting
   - Update best practices from successes
   - Adjust quality scores

### Automatic Learning Triggers

- **Low Success Rate** (< 60%): Expert updated automatically
- **Recurring Failures**: Patterns added to troubleshooting
- **High Success Patterns**: Added to best practices
- **Quality Score**: Adjusted based on outcomes

---

## 📈 Tracking Fix Outcomes

### Integration Points

**1. Fix Generation** (`llmFixGenerator.js`)
```javascript
// Already integrated! Experts are automatically used when:
const fix = await llmFixGenerator.generateFix(issue, code, filePath, {
    project_id: 'your-project-id' // ← This triggers expert usage
});
```

**2. Fix Application** (`fixApplicationService.js`)
```javascript
// Already integrated! Outcomes are tracked when:
await fixApplicationService.applyFix(fix, issue, filePath);
// Success/failure automatically recorded
```

### Manual Tracking

If you need to manually record outcomes:

```javascript
const expertLearningService = require('./server/services/expertLearningService');

await expertLearningService.recordFixOutcome(
    projectId,
    expertType,
    {
        issue: { type: 'database_error', message: '...' },
        fix: { code: '...', confidence: 0.9 },
        outcome: 'success', // or 'failure', 'partial'
        applied: true,
        reverted: false
    }
);
```

---

## 📊 Learning Statistics

### Get Learning Stats

```javascript
const expertLearningService = require('./server/services/expertLearningService');

// Get stats for all experts
const stats = await expertLearningService.getLearningStats(projectId);

// Get stats for specific expert
const dbStats = await expertLearningService.getLearningStats(projectId, 'database');
```

### Stats Include

- **Total Outcomes**: Number of fixes tracked
- **Success Rate**: Percentage of successful fixes
- **By Expert Type**: Breakdown per expert
- **Trends**: Success rate over time

---

## 🔍 Monitoring Dashboard

### What the Dashboard Shows

1. **Expert Performance**
   - Quality scores
   - Usage counts
   - Success rates
   - Last used timestamps

2. **Learning Progress**
   - Outcomes recorded
   - Learning recommendations
   - Improvement suggestions

3. **Overall Statistics**
   - Total fixes tracked
   - Overall success rate
   - Expert effectiveness

### Example Output

```
📊 Expert System Monitoring Dashboard
======================================================================

📁 Project: 42e78fc7-ba1a-40ee-9cb0-99a07e2ee8a1
----------------------------------------------------------------------

   📚 Experts: 11

   📈 Expert Performance:

   ✅ database:
      Quality Score: 0.9
      Usage Count: 15
      Last Used: 1/15/2025
      Success Rate: ✅ 86.7% (13/15)

   ✅ testing:
      Quality Score: 0.8
      Usage Count: 8
      Last Used: 1/15/2025
      Success Rate: ✅ 75.0% (6/8)

   📊 Overall Statistics:
      Total Fix Outcomes: 45
      Success Rate: 82.2%
      Successes: 37
      Failures: 8

   💡 Learning Recommendations:

      ✅ Excellent success rate: 82.2%
         Experts are performing well!
```

---

## 🚀 Enabling Self-Learning

### Automatic (Already Enabled)

The system automatically:
- ✅ Tracks expert usage
- ✅ Records fix outcomes
- ✅ Analyzes patterns
- ✅ Updates experts when needed

### Manual Triggers

```javascript
// Force expert update based on learning
const expertLearningService = require('./server/services/expertLearningService');

// Analyze and improve specific expert
await expertLearningService.analyzeAndImprove(projectId, 'database');

// Update expert quality score
await expertLearningService.updateExpertQualityScore(projectId, 'database', 0.85);
```

---

## 📋 Database Schema

### Tables Used

1. **`expert_learning_data`**
   - Stores fix outcomes
   - Tracks success/failure per expert
   - Used for learning analysis

2. **`expert_usage_tracking`**
   - Tracks expert usage counts
   - Success/failure statistics
   - Last used timestamps

3. **`customer_expert_guides`**
   - Stores expert guides
   - Quality scores (updated by learning)
   - Updated guides (improved over time)

---

## 🎯 Success Metrics

### Key Metrics to Monitor

1. **Expert Usage**
   - Are experts being used? (usage_count > 0)
   - Which experts are most used?

2. **Success Rate**
   - Overall: Should be > 70%
   - Per expert: Should be > 60%
   - Trending: Improving over time?

3. **Quality Scores**
   - Current: Should be > 0.7
   - Trend: Improving or stable?

4. **Learning Progress**
   - Outcomes recorded: Need 10+ for learning
   - Patterns identified: Common issues found?
   - Experts updated: How many improved?

---

## 🔧 Troubleshooting

### Issue: Experts Not Being Used

**Check:**
1. Is `project_id` passed in fix context?
2. Are experts in database?
3. Is expert type detection working?

**Fix:**
```javascript
// Ensure project_id is in context
const fix = await llmFixGenerator.generateFix(issue, code, filePath, {
    project_id: 'your-project-id' // ← Required!
});
```

### Issue: No Learning Data

**Check:**
1. Are fixes being applied?
2. Is `recordFixOutcome` being called?
3. Is database migration applied?

**Fix:**
- Apply migration: `20250115000001_expert_learning.sql`
- Verify fix application calls learning service

### Issue: Low Success Rate

**Check:**
1. Review failure patterns
2. Check expert quality scores
3. Verify expert context is relevant

**Fix:**
- System will auto-update experts if success rate < 60%
- Or manually trigger: `expertLearningService.analyzeAndImprove()`

---

## 📚 Related Files

- `server/services/expertLearningService.js` - Learning logic
- `server/services/expertUsageTracker.js` - Usage tracking
- `server/services/llmFixGenerator.js` - Expert integration
- `server/services/fixApplicationService.js` - Outcome tracking
- `scripts/verify-expert-system.js` - Verification script
- `scripts/monitor-expert-system.js` - Monitoring dashboard
- `supabase/migrations/20250115000001_expert_learning.sql` - Learning tables

---

## 🎉 Summary

The expert system is **self-learning** and **self-improving**:

1. ✅ **Tracks Usage** - Knows when experts are used
2. ✅ **Records Outcomes** - Learns from success/failure
3. ✅ **Analyzes Patterns** - Identifies common issues
4. ✅ **Updates Experts** - Improves guides automatically
5. ✅ **Monitors Performance** - Tracks effectiveness

**Just use it** - the system learns and improves automatically! 🚀


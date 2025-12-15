# Code Roach Storage & Metadata Analysis

## Current State

### Storage Location
**File-based JSON storage** in `data/` directory:
- `data/error-history.json` - Error records (limited to 10,000)
- `data/error-patterns.json` - Error pattern fingerprints
- `data/fix-learning.json` - Fix learning statistics

### What We're Currently Tracking

#### Error Metadata
```javascript
{
  id: "err_timestamp_random",
  timestamp: 1234567890,
  error: {
    message: "Error message",
    type: "security|performance|style|best-practice",
    severity: "critical|high|medium|low",
    source: "code-review|crawler|runtime",
    file: "path/to/file.js",
    line: 42,
    stack: "stack trace (truncated to 500 chars)",
    fingerprint: "pattern hash"
  },
  fix: {
    code: "fix code snippet",
    type: "pattern|llm|context-aware",
    safety: "safe|medium|risky",
    success: true/false
  },
  context: {
    userAgent: "browser info",
    url: "page URL",
    gameState: "present|absent"
  }
}
```

#### Pattern Metadata
```javascript
{
  fingerprint: "pattern_hash",
  errorPattern: { message, type, source },
  fixes: [{ code, type, safety, timestamp }],
  successCount: 10,
  failureCount: 2,
  firstSeen: timestamp,
  lastSeen: timestamp
}
```

#### Learning Metadata
```javascript
{
  totalAttempts: 1000,
  successful: 850,
  failed: 150,
  byType: { "security": { attempts: 50, successful: 40 } },
  byMethod: { "pattern": { attempts: 500, successful: 450 } },
  byConfidence: { "0.8-0.9": { attempts: 200, successful: 180 } }
}
```

---

## What We're Missing (META Data Opportunities)

### 1. **Time-Based Analytics**
- ❌ Issue frequency over time (hourly/daily/weekly trends)
- ❌ Peak error times
- ❌ Error resolution time
- ❌ Time to fix (from detection to resolution)

### 2. **File-Level Intelligence**
- ❌ File health score history
- ❌ Files with most recurring issues
- ❌ Files that improve/degrade over time
- ❌ File complexity correlation with errors

### 3. **Developer Behavior**
- ❌ Which files developers fix manually vs auto-fix
- ❌ Which issues get approved/rejected/deferred
- ❌ Developer fix preferences
- ❌ Review time per issue

### 4. **Fix Quality Metrics**
- ❌ Fix success rate by file type
- ❌ Fix success rate by code complexity
- ❌ Fix regression rate (issues that come back)
- ❌ Fix impact on code health score

### 5. **Pattern Intelligence**
- ❌ Error co-occurrence (errors that happen together)
- ❌ Error sequences (errors that follow each other)
- ❌ Error clusters (related errors in same area)
- ❌ Error propagation (errors that cause other errors)

### 6. **Business Impact**
- ❌ Errors by feature/component
- ❌ Errors affecting user-facing features
- ❌ Errors affecting game performance
- ❌ Cost of errors (time to fix, impact)

### 7. **Codebase Evolution**
- ❌ Error rate as codebase grows
- ❌ New error types introduced
- ❌ Error types that disappear
- ❌ Code quality trends

---

## Storage Options & Trade-offs

### Option 1: Current (File-based JSON) ✅ Currently Using

**Pros:**
- ✅ Simple, no dependencies
- ✅ Fast reads/writes for small datasets
- ✅ No database setup required
- ✅ Easy to backup (just copy files)
- ✅ Works offline

**Cons:**
- ❌ Limited to 10,000 records (hard limit)
- ❌ No querying capabilities (can't filter, search, aggregate)
- ❌ No real-time updates
- ❌ No concurrent access safety
- ❌ Performance degrades with size
- ❌ No relationships between data
- ❌ Data loss risk (file corruption, disk failure)
- ❌ No historical analysis (data gets truncated)

**Best For:**
- Small projects (< 1,000 issues)
- Development/testing
- Simple use cases

---

### Option 2: Supabase (PostgreSQL) 🎯 Recommended

**Pros:**
- ✅ Unlimited storage
- ✅ Powerful querying (SQL, filters, aggregations)
- ✅ Real-time subscriptions
- ✅ Concurrent access safe
- ✅ Relationships between tables
- ✅ Historical data preserved
- ✅ Built-in analytics capabilities
- ✅ Backup/restore built-in
- ✅ Row Level Security (RLS)
- ✅ Already configured in project
- ✅ Can use pgvector for semantic search

**Cons:**
- ⚠️ Requires database setup
- ⚠️ Slightly more complex
- ⚠️ Potential cost at scale
- ⚠️ Network latency (minimal)

**Best For:**
- Production use
- Large codebases
- Need for analytics
- Team collaboration
- Long-term data retention

---

### Option 3: Hybrid Approach 🔄 Best of Both

**Strategy:**
- **Supabase** for persistent storage, analytics, long-term data
- **File-based** for caching, quick access, offline mode

**Implementation:**
- Write to both (Supabase primary, file cache)
- Read from cache first, fallback to Supabase
- Periodic sync between systems

**Best For:**
- Production with performance needs
- Need for both speed and analytics
- Gradual migration path

---

## Recommended: Migrate to Supabase

### Why Supabase?

1. **Already Configured**: You have Supabase set up in `server/config.js`
2. **Scalability**: Can handle millions of issues
3. **Analytics**: Can run complex queries for insights
4. **Real-time**: Can show live updates in dashboard
5. **Relationships**: Can link issues to files, commits, PRs
6. **Historical Data**: Never lose data (no 10k limit)
7. **Team Features**: Multiple developers can query simultaneously

### Proposed Schema

```sql
-- Issues table
CREATE TABLE code_roach_issues (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Error info
  error_message TEXT NOT NULL,
  error_type TEXT NOT NULL, -- security, performance, style, etc.
  error_severity TEXT NOT NULL, -- critical, high, medium, low
  error_source TEXT, -- code-review, crawler, runtime
  error_file TEXT,
  error_line INTEGER,
  error_stack TEXT,
  error_fingerprint TEXT,
  
  -- Fix info
  fix_code TEXT,
  fix_type TEXT, -- pattern, llm, context-aware
  fix_safety TEXT, -- safe, medium, risky
  fix_success BOOLEAN,
  fix_applied BOOLEAN DEFAULT FALSE,
  fix_confidence DECIMAL(3,2),
  
  -- Context
  context_user_agent TEXT,
  context_url TEXT,
  context_game_state TEXT,
  
  -- Review
  review_status TEXT, -- pending, approved, rejected, deferred
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  
  -- Metadata
  metadata JSONB -- flexible storage for future fields
);

-- Patterns table
CREATE TABLE code_roach_patterns (
  fingerprint TEXT PRIMARY KEY,
  error_pattern JSONB NOT NULL,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  best_fix JSONB,
  pattern_metadata JSONB
);

-- Fix learning table
CREATE TABLE code_roach_fix_learning (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  issue_id TEXT REFERENCES code_roach_issues(id),
  fix_method TEXT NOT NULL,
  fix_confidence DECIMAL(3,2),
  success BOOLEAN NOT NULL,
  error_message TEXT,
  file_path TEXT,
  
  -- Aggregated stats
  stats_by_type JSONB,
  stats_by_method JSONB,
  stats_by_confidence JSONB
);

-- File health history
CREATE TABLE code_roach_file_health (
  id SERIAL PRIMARY KEY,
  file_path TEXT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  health_score INTEGER,
  error_count INTEGER,
  issue_count INTEGER,
  fix_count INTEGER,
  
  -- Scores by category
  error_rate_score INTEGER,
  complexity_score INTEGER,
  security_score INTEGER,
  performance_score INTEGER,
  maintainability_score INTEGER,
  
  metadata JSONB
);

-- Indexes for performance
CREATE INDEX idx_issues_file ON code_roach_issues(error_file);
CREATE INDEX idx_issues_type ON code_roach_issues(error_type);
CREATE INDEX idx_issues_severity ON code_roach_issues(error_severity);
CREATE INDEX idx_issues_status ON code_roach_issues(review_status);
CREATE INDEX idx_issues_created ON code_roach_issues(created_at);
CREATE INDEX idx_issues_fingerprint ON code_roach_issues(error_fingerprint);
CREATE INDEX idx_file_health_path ON code_roach_file_health(file_path);
CREATE INDEX idx_file_health_recorded ON code_roach_file_health(recorded_at);

-- Full-text search
CREATE INDEX idx_issues_message_search ON code_roach_issues USING gin(to_tsvector('english', error_message));
```

### Analytics Queries We Could Run

```sql
-- Most problematic files
SELECT error_file, COUNT(*) as issue_count
FROM code_roach_issues
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY error_file
ORDER BY issue_count DESC
LIMIT 10;

-- Fix success rate by method
SELECT fix_type, 
       COUNT(*) as attempts,
       SUM(CASE WHEN fix_success THEN 1 ELSE 0 END) as successes,
       ROUND(100.0 * SUM(CASE WHEN fix_success THEN 1 ELSE 0 END) / COUNT(*), 2) as success_rate
FROM code_roach_issues
WHERE fix_code IS NOT NULL
GROUP BY fix_type;

-- Error trends over time
SELECT DATE_TRUNC('day', created_at) as day,
       error_type,
       COUNT(*) as count
FROM code_roach_issues
WHERE created_at > NOW() - INTERVAL '90 days'
GROUP BY day, error_type
ORDER BY day DESC;

-- Files with improving health
SELECT fh1.file_path,
       fh1.health_score as old_score,
       fh2.health_score as new_score,
       (fh2.health_score - fh1.health_score) as improvement
FROM code_roach_file_health fh1
JOIN code_roach_file_health fh2 ON fh1.file_path = fh2.file_path
WHERE fh1.recorded_at < fh2.recorded_at
  AND fh2.recorded_at > NOW() - INTERVAL '7 days'
ORDER BY improvement DESC;
```

---

## Migration Plan

### Phase 1: Dual Write (1-2 days)
- Keep file-based storage
- Add Supabase writes in parallel
- No breaking changes

### Phase 2: Dual Read (1 day)
- Read from Supabase, fallback to files
- Verify data consistency

### Phase 3: Migrate Historical Data (1 day)
- Import existing JSON files to Supabase
- Verify all records migrated

### Phase 4: Supabase Only (1 day)
- Remove file-based storage
- Update all services to use Supabase

### Phase 5: Analytics & Dashboards (2-3 days)
- Build analytics queries
- Create dashboards
- Add real-time updates

**Total Time: ~1 week**

---

## Immediate Actions

1. **Create Supabase tables** (30 min)
2. **Add dual-write to errorHistoryService** (2 hours)
3. **Migrate existing data** (1 hour)
4. **Update API endpoints** (2 hours)
5. **Add analytics queries** (4 hours)

---

## Cost Analysis

### File-based (Current)
- **Cost**: $0
- **Limitations**: 10k records, no analytics

### Supabase Free Tier
- **Cost**: $0
- **Limits**: 500MB database, 2GB bandwidth
- **Estimated**: ~100k issues = ~50MB

### Supabase Pro (if needed)
- **Cost**: $25/month
- **Limits**: 8GB database, 50GB bandwidth
- **Estimated**: ~1M issues = ~500MB

**Verdict**: Free tier likely sufficient for most use cases.

---

## Recommendation

**Migrate to Supabase** because:
1. ✅ Already configured
2. ✅ Free tier sufficient
3. ✅ Enables powerful analytics
4. ✅ No data loss
5. ✅ Better for team collaboration
6. ✅ Future-proof

**Start with Phase 1 (dual-write)** to minimize risk and allow gradual migration.


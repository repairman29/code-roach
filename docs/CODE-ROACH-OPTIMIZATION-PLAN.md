# Code Roach Optimization Plan

## Using Supabase & Codebase Index for 10-100x Faster Issue Detection

### Current State

- **Problem**: Crawler scans ALL files recursively (15,588 files found)
- **Time**: Slow - processes files sequentially/in small batches
- **No caching**: Re-analyzes files even if unchanged
- **No prioritization**: Doesn't leverage known patterns/issues

### Available Infrastructure ✅

1. **Codebase Indexer**: 70,000+ code chunks indexed in Supabase with vector embeddings
2. **Codebase Search**: Semantic search service for finding similar code patterns
3. **Supabase Schema**: Tables for issues, patterns, fix learning, file health
4. **File Health Tracking**: `code_roach_file_health` table tracks file scores over time

### Optimization Strategy

#### 1. **Smart File Selection** (10-50x faster)

Instead of scanning all files, use:

**A. Query Supabase for files with known issues:**

```sql
SELECT DISTINCT error_file
FROM code_roach_issues
WHERE review_status = 'pending'
  AND resolved_at IS NULL
```

**B. Query files with low health scores:**

```sql
SELECT file_path
FROM code_roach_file_health
WHERE health_score < 70
ORDER BY recorded_at DESC
LIMIT 1000
```

**C. Use Git to find changed files:**

```bash
git diff --name-only HEAD~1 HEAD
```

**D. Use codebase index to find files matching issue patterns:**

- Semantic search for "error handling", "async/await", "security vulnerabilities"
- Vector similarity search finds files with similar code patterns

#### 2. **Pattern-Based Issue Detection** (5-10x faster)

Instead of analyzing each file from scratch:

**A. Query Supabase for known patterns:**

```sql
SELECT fingerprint, error_pattern, best_fix
FROM code_roach_patterns
WHERE occurrence_count > 5
ORDER BY occurrence_count DESC
```

**B. Match file code against known patterns:**

- Use regex/string matching for pattern fingerprints
- Apply known fixes immediately without LLM calls

#### 3. **Incremental Scanning** (100x faster for unchanged files)

**A. Track file hashes:**

```sql
CREATE TABLE code_roach_file_cache (
  file_path TEXT PRIMARY KEY,
  file_hash TEXT,
  last_scanned TIMESTAMPTZ,
  issue_count INTEGER,
  last_modified TIMESTAMPTZ
);
```

**B. Skip unchanged files:**

- Compare file hash with cached hash
- Only scan if file changed or cache expired

#### 4. **Parallel Processing with Index** (5-10x faster)

**A. Use codebase index to batch similar files:**

- Group files by similarity (vector search)
- Process similar files together (shared patterns)

**B. Prioritize by Supabase health scores:**

- Files with health_score < 50: High priority
- Files with health_score 50-70: Medium priority
- Files with health_score > 70: Low priority (skip or quick scan)

#### 5. **Semantic Issue Detection** (Better accuracy)

**A. Use codebase search to find similar issues:**

```javascript
// Find files with similar code patterns that had issues
const similarFiles = await codebaseSearch.semanticSearch(
  "async function without error handling",
  { fileFilter: "*.js", limit: 50 },
);
```

**B. Apply fixes from similar resolved issues:**

- Query Supabase for resolved issues with similar code
- Reuse successful fixes

### Implementation Plan

#### Phase 1: Quick Wins (1-2 hours)

1. ✅ Add Supabase queries to get files with pending issues
2. ✅ Use git diff to find changed files
3. ✅ Query file health scores for prioritization

#### Phase 2: Pattern Matching (2-4 hours)

1. ✅ Query known patterns from Supabase
2. ✅ Match patterns against file code
3. ✅ Apply known fixes without LLM calls

#### Phase 3: Caching (2-3 hours)

1. ✅ Create file cache table
2. ✅ Track file hashes
3. ✅ Skip unchanged files

#### Phase 4: Semantic Search Integration (3-5 hours)

1. ✅ Use codebase search for issue detection
2. ✅ Find similar resolved issues
3. ✅ Reuse successful fixes

### Expected Performance Improvements

| Optimization         | Speed Improvement      | Implementation Time |
| -------------------- | ---------------------- | ------------------- |
| Smart file selection | 10-50x                 | 1-2 hours           |
| Pattern matching     | 5-10x                  | 2-4 hours           |
| File caching         | 100x (unchanged files) | 2-3 hours           |
| Semantic search      | 2-5x (better accuracy) | 3-5 hours           |
| **Combined**         | **50-500x faster**     | **8-14 hours**      |

### Example: Optimized Crawl Flow

```javascript
async crawlCodebaseOptimized(rootDir, options) {
  // 1. Get files with known issues from Supabase (FAST)
  const filesWithIssues = await supabase
    .from('code_roach_issues')
    .select('error_file')
    .eq('review_status', 'pending')
    .not('resolved_at', 'is', null);

  // 2. Get changed files from git (FAST)
  const changedFiles = await getGitChangedFiles();

  // 3. Get files with low health scores (FAST)
  const lowHealthFiles = await supabase
    .from('code_roach_file_health')
    .select('file_path')
    .lt('health_score', 70)
    .order('recorded_at', { ascending: false })
    .limit(1000);

  // 4. Use semantic search to find files with similar issues (MEDIUM)
  const similarIssueFiles = await codebaseSearch.semanticSearch(
    "common code issues patterns",
    { limit: 200 }
  );

  // 5. Combine and deduplicate (FAST)
  const filesToScan = new Set([
    ...filesWithIssues.map(f => f.error_file),
    ...changedFiles,
    ...lowHealthFiles.map(f => f.file_path),
    ...similarIssueFiles.map(f => f.file_path)
  ]);

  // 6. Check cache for unchanged files (FAST)
  const filesToAnalyze = await filterChangedFiles(Array.from(filesToScan));

  // 7. Query known patterns (FAST)
  const knownPatterns = await supabase
    .from('code_roach_patterns')
    .select('*')
    .gt('occurrence_count', 5);

  // 8. Process files with pattern matching first (FAST)
  for (const file of filesToAnalyze) {
    const issues = await matchPatterns(file, knownPatterns);
    if (issues.length > 0) {
      // Apply known fixes immediately
      await applyKnownFixes(file, issues);
      continue; // Skip full analysis
    }

    // Only do full analysis if no patterns matched
    await this.analyzeFile(file, options);
  }
}
```

### Next Steps

1. **Start with Phase 1** - Quick wins with Supabase queries
2. **Measure improvement** - Compare before/after scan times
3. **Iterate** - Add more optimizations based on results

# Code Roach Testing Guide

## 🧪 How to Test Codebase Integration

### Quick Test

```bash
# Test codebase-aware fixes
node scripts/test-codebase-aware-fixes.js

# Test value and performance
node scripts/test-codebase-integration-value.js
```

---

## 📋 Test Checklist

### 1. Codebase Search Integration ✅

- [ ] Semantic search finds similar errors
- [ ] File context retrieval works
- [ ] Pattern matching finds relevant code

**Test:**

```bash
node scripts/test-codebase-aware-fixes.js
# Look for "✅ Found X similar patterns"
```

---

### 2. Fix Generation ✅

- [ ] Fixes are generated for test cases
- [ ] Confidence scores are reasonable (>0.5)
- [ ] Fixes use codebase patterns

**Test:**

```bash
node scripts/test-codebase-aware-fixes.js
# Check "Tests Passed" and "Patterns Used"
```

---

### 3. API Endpoints ✅

- [ ] `/api/code-roach/fix/codebase-aware` responds
- [ ] `/api/code-roach/generate/codebase-patterns` responds
- [ ] Endpoints return valid fixes

**Test:**

```bash
# Make sure server is running
npm start

# In another terminal
node scripts/test-codebase-aware-fixes.js
# Look for "✅ Endpoint responded"
```

---

### 4. Real Codebase Files ✅

- [ ] Works with actual project files
- [ ] Handles large files
- [ ] Generates contextually appropriate fixes

**Test:**

```bash
node scripts/test-codebase-integration-value.js
# Check "Real File Testing" results
```

---

### 5. Performance ✅

- [ ] Fix generation is fast (<2s average)
- [ ] Can handle multiple requests
- [ ] Doesn't slow down crawler

**Test:**

```bash
node scripts/test-codebase-integration-value.js
# Check "Performance Results"
```

---

## 🎯 Value Metrics

### Success Criteria

**High Value (80%+):**

- ✅ 70%+ tests passing
- ✅ Average confidence > 0.7
- ✅ Patterns being used
- ✅ Performance < 2s

**Good Value (60-80%):**

- ⚠️ 50%+ tests passing
- ⚠️ Average confidence > 0.5
- ⚠️ Some patterns used
- ⚠️ Performance < 5s

**Needs Improvement (<60%):**

- ❌ <50% tests passing
- ❌ Low confidence
- ❌ No patterns used
- ❌ Slow performance

---

## 🔧 Troubleshooting

### No Patterns Found

**Problem:** Tests show "No patterns found"

**Solution:**

```bash
# Index your codebase
npm run codebase:sync

# Or use the watcher
npm run codebase:watch
```

---

### Low Confidence Scores

**Problem:** Fixes have confidence < 0.5

**Solutions:**

1. Index more code: `npm run codebase:sync`
2. Add more error patterns to Supabase
3. Improve error descriptions in test cases

---

### API Endpoints Not Responding

**Problem:** "ERR_CONNECTION_REFUSED"

**Solution:**

```bash
# Start the server
npm start

# Check it's running
curl http://localhost:3000/health
```

---

### Slow Performance

**Problem:** Fix generation takes >5s

**Solutions:**

1. Add caching to codebase search
2. Limit search results (use `limit` option)
3. Use parallel processing for multiple fixes

---

## 📊 Continuous Testing

### Add to CI/CD

```yaml
# .github/workflows/test-code-roach.yml
name: Test Code Roach
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
      - run: npm install
      - run: npm run codebase:sync
      - run: node scripts/test-codebase-aware-fixes.js
      - run: node scripts/test-codebase-integration-value.js
```

---

## 🎯 Manual Testing

### Test 1: Generate Fix for Real Error

```javascript
// In Node.js REPL or test file
const codebaseAwareFixGenerator = require("./server/services/codebaseAwareFixGenerator");

const error = {
  message: "ReferenceError: user is not defined",
  type: "ReferenceError",
};

const code = `
function getUserData(userId) {
    return user.name;
}
`;

const fix = await codebaseAwareFixGenerator.generateFix(
  error,
  code,
  "server/routes/test.js",
);

console.log("Fix:", fix.code);
console.log("Confidence:", fix.confidence);
console.log("Patterns:", fix.patternsUsed);
```

### Test 2: Check Codebase Search

```javascript
const codebaseSearch = require("./server/services/codebaseSearch");

// Search for similar errors
const results = await codebaseSearch.semanticSearch(
  "error handling undefined variable",
  { limit: 5 },
);

console.log("Found:", results.results.length, "patterns");
```

### Test 3: Test API Endpoint

```bash
curl -X POST http://localhost:3000/api/code-roach/fix/codebase-aware \
  -H "Content-Type: application/json" \
  -d '{
    "error": {
      "message": "ReferenceError: user is not defined",
      "type": "ReferenceError"
    },
    "code": "function getUserData(userId) { return user.name; }",
    "filePath": "server/routes/test.js"
  }'
```

---

## 📈 Monitoring

### Dashboard Metrics

Check the Code Roach dashboard for:

- Fix success rate
- Average confidence
- Patterns used
- Performance metrics

**URL:** `http://localhost:3000/code-roach-dashboard`

---

## ✅ Success Indicators

You'll know it's working when:

1. **Tests pass** - 70%+ success rate
2. **Patterns used** - Fixes reference codebase patterns
3. **High confidence** - Average > 0.7
4. **Fast** - <2s average response time
5. **Real fixes** - Works on actual codebase files

---

## 🚀 Next Steps

Once tests pass:

1. **Run crawler** - Let it use codebase-aware fixes
2. **Monitor dashboard** - Track success rates
3. **Review fixes** - Check quality of generated fixes
4. **Iterate** - Improve based on results

---

**Happy Testing! 🧪**

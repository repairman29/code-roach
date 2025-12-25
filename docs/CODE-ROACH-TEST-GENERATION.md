# Code Roach: Enhanced Test Generation

## Auto-Generate Tests for Every Fix

---

## 🎯 Mission

**Make Code Roach the best developer on the planet** by automatically generating comprehensive tests for every fix, ensuring higher confidence, better coverage, and fewer regressions.

---

## ✅ What's New

### 1. **Automatic Test Generation**

- ✅ Generates unit tests for fixes
- ✅ Creates regression tests
- ✅ Adds integration tests
- ✅ Includes edge case coverage

### 2. **Intelligent Test Creation**

- ✅ Analyzes fix changes
- ✅ Uses existing test patterns
- ✅ Learns from codebase
- ✅ Follows project conventions

### 3. **Multiple Test Types**

- ✅ Unit tests - Test individual functions
- ✅ Integration tests - Test module interactions
- ✅ Regression tests - Prevent regressions
- ✅ Edge case tests - Cover edge cases

### 4. **Smart Test Writing**

- ✅ Finds existing test files
- ✅ Follows existing patterns
- ✅ Respects project structure
- ✅ Safe file writing

---

## 🚀 How It Works

### Test Generation Flow

```
1. Fix Applied
   ↓
2. Analyze Fix
   - Identify changes
   - Extract functions
   - Find edge cases
   - Assess risk
   ↓
3. Find Test Patterns
   - Search codebase
   - Find similar tests
   - Learn patterns
   ↓
4. Generate Tests
   - Unit tests
   - Regression tests
   - Edge case tests
   ↓
5. Write Test Files
   - Create test directory
   - Write test code
   - Follow conventions
```

---

## ⚙️ Configuration

### Enable Test Generation

**In `.env`:**

```bash
# Enable test generation (default: true)
CODE_ROACH_GENERATE_TESTS=true

# Test types to generate (comma-separated)
CODE_ROACH_TEST_TYPES=unit,regression

# Include edge cases (default: true)
CODE_ROACH_TEST_EDGE_CASES=true
```

### Test Generation Options

```javascript
const options = {
  testTypes: ["unit", "regression"], // or ['unit', 'integration', 'regression']
  includeEdgeCases: true,
  useExistingPatterns: true,
};
```

---

## 📊 Test Types

### Unit Tests

- Test individual functions
- Isolated testing
- Fast execution
- High coverage

### Integration Tests

- Test module interactions
- System-level testing
- Real-world scenarios
- Comprehensive coverage

### Regression Tests

- Prevent regressions
- Test specific fixes
- Backward compatibility
- Historical validation

---

## 🔍 Fix Analysis

### What Gets Analyzed

1. **Code Changes**
   - Line-by-line diff
   - Modified functions
   - Added/removed code

2. **Function Extraction**
   - Function names
   - Function signatures
   - Function dependencies

3. **Edge Case Detection**
   - Null/undefined handling
   - Async error handling
   - Empty arrays/strings
   - Zero/negative numbers

4. **Risk Assessment**
   - Change volume
   - Core function changes
   - Complexity analysis

---

## 🎯 Test Generation Features

### 1. Pattern Learning

- Finds similar tests in codebase
- Learns from existing patterns
- Follows project conventions
- Maintains consistency

### 2. Edge Case Coverage

- Automatically identifies edge cases
- Generates edge case tests
- Covers null/undefined
- Tests error conditions

### 3. LLM-Powered Generation

- Uses LLM for intelligent generation
- Context-aware test creation
- Follows best practices
- Comprehensive coverage

### 4. Template Fallback

- Template-based generation
- Works without LLM
- Consistent structure
- Reliable output

---

## 📝 API Endpoints

### Generate Tests

```bash
POST /api/test-generation/generate
Content-Type: application/json

{
  "fix": { "method": "pattern", "confidence": 0.9 },
  "filePath": "server/services/myService.js",
  "originalCode": "...",
  "fixedCode": "...",
  "options": {
    "testTypes": ["unit", "regression"],
    "includeEdgeCases": true
  }
}
```

### Write Test File

```bash
POST /api/test-generation/write
Content-Type: application/json

{
  "testFilePath": "tests/unit/myService.test.js",
  "testCode": "describe('myService', () => { ... })",
  "options": {
    "overwrite": false
  }
}
```

### Analyze Fix

```bash
POST /api/test-generation/analyze
Content-Type: application/json

{
  "originalCode": "...",
  "fixedCode": "...",
  "filePath": "server/services/myService.js"
}
```

---

## 🔄 Integration with Continuous Learning

### Automatic Test Generation

Test generation is automatically integrated into the continuous learning cycle:

```
Fix Applied
   ↓
Generate Tests (NEW!)
   ↓
Run Tests
   ↓
Deploy
   ↓
Monitor
   ↓
Learn
```

### Test Results in Learning Cycle

- Test generation success tracked
- Test types generated recorded
- Test confidence calculated
- Results feed into learning

---

## 📈 Benefits

### Quality

- ✅ **Higher confidence** - Tests verify fixes work
- ✅ **Better coverage** - Comprehensive test suite
- ✅ **Fewer regressions** - Regression tests prevent issues
- ✅ **Edge case coverage** - Tests edge cases automatically

### Speed

- ✅ **Faster testing** - Auto-generated tests
- ✅ **Less manual work** - Automated test creation
- ✅ **Consistent patterns** - Follows conventions
- ✅ **Quick feedback** - Immediate test generation

### Reliability

- ✅ **Pattern-based** - Uses existing patterns
- ✅ **LLM-powered** - Intelligent generation
- ✅ **Template fallback** - Reliable output
- ✅ **Safe writing** - Respects existing files

---

## 🎓 Test Patterns

### Unit Test Pattern

```javascript
const myService = require("../myService");

describe("myService", () => {
  test("functionName should work correctly", () => {
    // Test implementation
  });

  test("should handle edge cases", () => {
    // Edge case tests
  });
});
```

### Regression Test Pattern

```javascript
describe("myService Regression Tests", () => {
  test("should not regress after fix", () => {
    // Regression test
  });

  test("should maintain backward compatibility", () => {
    // Compatibility test
  });
});
```

---

## 🚀 Usage

### Automatic (Recommended)

```bash
# Enable in .env
CODE_ROACH_GENERATE_TESTS=true
```

Tests are automatically generated during the continuous learning cycle.

### Manual Generation

```javascript
const testGenerationService = require("./server/services/testGenerationService");

const results = await testGenerationService.generateTests(
  fix,
  filePath,
  originalCode,
  fixedCode,
  {
    testTypes: ["unit", "regression"],
    includeEdgeCases: true,
  },
);

// Write tests to file
for (const test of results.generated) {
  await testGenerationService.writeTestFile(test.file, test.code, {
    overwrite: false,
  });
}
```

---

## 📊 Metrics

### Test Generation Stats

- Tests generated per fix
- Test types distribution
- Test confidence scores
- Test file creation success

### Test Quality Metrics

- Test coverage improvement
- Edge case coverage
- Regression prevention
- Test execution success

---

## ✅ Summary

**Enhanced Test Generation:**

- ✅ Automatic test generation
- ✅ Multiple test types
- ✅ Edge case coverage
- ✅ Pattern learning
- ✅ LLM-powered
- ✅ Template fallback
- ✅ Continuous learning integration

**Result:**

- 🎯 Higher confidence in fixes
- 📈 Better test coverage
- 🛡️ Fewer regressions
- 🚀 Faster development

---

**Code Roach now generates tests for every fix!** 🪳🧪

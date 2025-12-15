# Code Roach IP Innovations - Quick Start

## 🚀 Try These New Capabilities

### 1. Generate Code from Patterns
```bash
curl -X POST http://localhost:3000/api/code-roach/generate-code \
  -H "Content-Type: application/json" \
  -d '{
    "intent": "Create a new API endpoint for user authentication",
    "type": "api-endpoint"
  }'
```

**What it does**: Generates code that matches your codebase style and successful patterns.

---

### 2. Predict Refactoring Needs
```bash
# Check if a file needs refactoring
curl http://localhost:3000/api/code-roach/refactoring/predict/server/routes/api.js

# Get all refactoring recommendations
curl http://localhost:3000/api/code-roach/refactoring/recommendations
```

**What it does**: Predicts which files will need refactoring before they become problems.

---

### 3. Generate Tests from Error Patterns
```bash
# Generate tests for all patterns that break frequently
curl -X POST http://localhost:3000/api/code-roach/tests/generate

# Generate tests for a specific file
curl -X POST http://localhost:3000/api/code-roach/tests/generate \
  -H "Content-Type: application/json" \
  -d '{"filePath": "server/routes/api.js"}'
```

**What it does**: Automatically generates tests that catch patterns that frequently break.

---

### 4. Find Duplicate Code
```bash
curl -X POST http://localhost:3000/api/code-roach/similarity/find \
  -H "Content-Type: application/json" \
  -d '{
    "minSimilarity": 0.8,
    "minOccurrences": 3
  }'
```

**What it does**: Finds duplicate/similar code that can be refactored.

---

### 5. Detect Code Smells
```bash
# Detect smells in specific code
curl -X POST http://localhost:3000/api/code-roach/smells/detect \
  -H "Content-Type: application/json" \
  -d '{
    "code": "function longFunction() { ... }",
    "filePath": "server/routes/api.js"
  }'

# Get all codebase smells
curl http://localhost:3000/api/code-roach/smells/codebase
```

**What it does**: Detects code smells (long methods, magic numbers, deep nesting, etc.).

---

### 6. Learn from Other Projects
```bash
curl -X POST http://localhost:3000/api/code-roach/learning/cross-project \
  -H "Content-Type: application/json" \
  -d '{
    "projectIds": ["project-a", "project-b"]
  }'
```

**What it does**: Learns successful patterns from other projects and applies them.

---

## 🎯 Use Cases

### Use Case 1: Starting a New Feature
```bash
# 1. Generate code that matches your style
curl -X POST http://localhost:3000/api/code-roach/generate-code \
  -d '{"intent": "Create user authentication service"}'

# 2. Check if similar code exists (avoid duplication)
curl -X POST http://localhost:3000/api/code-roach/similarity/find

# 3. Generate tests automatically
curl -X POST http://localhost:3000/api/code-roach/tests/generate
```

### Use Case 2: Code Review
```bash
# 1. Check for code smells
curl -X POST http://localhost:3000/api/code-roach/smells/detect \
  -d '{"code": "...", "filePath": "..."}'

# 2. Predict if refactoring is needed
curl http://localhost:3000/api/code-roach/refactoring/predict/...

# 3. Check for duplicate code
curl -X POST http://localhost:3000/api/code-roach/similarity/find
```

### Use Case 3: Technical Debt Management
```bash
# 1. Get refactoring recommendations
curl http://localhost:3000/api/code-roach/refactoring/recommendations

# 2. Find all code smells
curl http://localhost:3000/api/code-roach/smells/codebase

# 3. Generate tests for problematic patterns
curl -X POST http://localhost:3000/api/code-roach/tests/generate
```

---

## 💡 Pro Tips

1. **Generate code first, then refine**: Use AI code generator to get started, then refine
2. **Predict before you refactor**: Check refactoring predictions before starting work
3. **Tests write themselves**: Let test generator create tests for error-prone patterns
4. **Learn from others**: Use cross-project learning to apply best practices
5. **Find duplicates early**: Use similarity detector before code review

---

**Full IP Guide**: `docs/CODE-ROACH-IP-INNOVATIONS.md`


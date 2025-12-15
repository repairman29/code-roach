# Code Roach VS Code Extension - Development Specification

**Status:** Template Complete, Needs API Path Corrections  
**Target Team:** Code Roach Team  
**Last Updated:** December 13, 2025

---

## 📋 Current Status

### ✅ What's Already Done

1. **Extension Template Created**
   - Location: `.vscode-extension/`
   - Package.json configured with all commands
   - TypeScript setup complete
   - All 4 commands implemented:
     - `codeRoach.analyzeFile` - Analyze code
     - `codeRoach.showHealth` - Show health score
     - `codeRoach.fixErrors` - Auto-fix errors
     - `codeRoach.query` - Natural language query

2. **Backend APIs Ready**
   - All endpoints are live and functional
   - Full API documentation below

3. **Configuration System**
   - VS Code settings integration
   - Server URL configuration
   - API key support

### ⚠️ What Needs Fixing

**Critical Issue:** API endpoint paths in the extension don't match the actual backend endpoints.

**Current (Wrong) Paths in Extension:**
- `/api/code-roach/health-score` ❌
- `/api/code-roach/code-review` ❌
- `/api/code-roach/code-review/autofix` ❌
- `/api/code-roach/nl-query` ❌

**Actual Backend Endpoints:**
- `/api/code-roach/health/:filePath` ✅
- `/api/code-roach/review` ✅
- `/api/code-roach/review/autofix` ✅
- `/api/code-roach/query` ✅

---

## 🔧 Required Fixes

### File: `.vscode-extension/src/extension.ts`

#### Fix 1: Health Score Endpoint (Line 42-44)
**Current:**
```typescript
async getHealthScore(filePath: string): Promise<any> {
    return this.request(`/api/code-roach/health-score?filePath=${encodeURIComponent(filePath)}`);
}
```

**Should be:**
```typescript
async getHealthScore(filePath: string): Promise<any> {
    // Use path parameter instead of query parameter
    return this.request(`/api/code-roach/health/${encodeURIComponent(filePath)}`);
}
```

#### Fix 2: Analyze Code Endpoint (Line 46-51)
**Current:**
```typescript
async analyzeCode(code: string, filePath: string): Promise<any> {
    return this.request('/api/code-roach/code-review', {
        method: 'POST',
        body: JSON.stringify({ code, filePath })
    });
}
```

**Should be:**
```typescript
async analyzeCode(code: string, filePath: string): Promise<any> {
    return this.request('/api/code-roach/review', {
        method: 'POST',
        body: JSON.stringify({ code, filePath })
    });
}
```

#### Fix 3: Auto-Fix Endpoint (Line 53-58)
**Current:**
```typescript
async autoFix(code: string, filePath: string, issueTypes?: string[]): Promise<any> {
    return this.request('/api/code-roach/code-review/autofix', {
        method: 'POST',
        body: JSON.stringify({ code, filePath, issueTypes: issueTypes || [] })
    });
}
```

**Should be:**
```typescript
async autoFix(code: string, filePath: string, issueTypes?: string[]): Promise<any> {
    return this.request('/api/code-roach/review/autofix', {
        method: 'POST',
        body: JSON.stringify({ code, filePath, issueTypes: issueTypes || [] })
    });
}
```

#### Fix 4: Query Endpoint (Line 60-65)
**Current:**
```typescript
async query(question: string): Promise<any> {
    return this.request('/api/code-roach/nl-query', {
        method: 'POST',
        body: JSON.stringify({ query: question })
    });
}
```

**Should be:**
```typescript
async query(question: string): Promise<any> {
    return this.request('/api/code-roach/query', {
        method: 'POST',
        body: JSON.stringify({ query: question })
    });
}
```

---

## 📡 API Endpoint Documentation

### 1. Health Score
**Endpoint:** `GET /api/code-roach/health/:filePath`

**Parameters:**
- `filePath` (path parameter) - File path to analyze

**Response:**
```json
{
  "success": true,
  "score": {
    "overall": 85,
    "grade": "A",
    "components": {
      "errorRate": 90,
      "complexity": 80,
      "security": 85,
      "performance": 85
    }
  }
}
```

**Usage in Extension:**
```typescript
const result = await client.getHealthScore('/path/to/file.js');
// result.score.overall - Overall score (0-100)
// result.score.grade - Letter grade (A-F)
// result.score.components - Component scores
```

---

### 2. Code Review / Analysis
**Endpoint:** `POST /api/code-roach/review`

**Request Body:**
```json
{
  "code": "const x = 1;",
  "filePath": "server/file.js",
  "options": {} // optional
}
```

**Response:**
```json
{
  "success": true,
  "review": {
    "score": 85,
    "issues": [
      {
        "line": 5,
        "severity": "high",
        "message": "Potential security issue",
        "type": "security"
      }
    ],
    "summary": "Code review summary"
  }
}
```

**Usage in Extension:**
```typescript
const analysis = await client.analyzeCode(code, filePath);
// analysis.review.score - Score (0-100)
// analysis.review.issues - Array of issues
// Each issue has: line, severity, message, type
```

---

### 3. Auto-Fix
**Endpoint:** `POST /api/code-roach/review/autofix`

**Request Body:**
```json
{
  "code": "const x = 1;",
  "filePath": "server/file.js",
  "issueTypes": ["security", "performance"] // optional, empty = all
}
```

**Response:**
```json
{
  "success": true,
  "fixedCode": "const x = 1; // Fixed",
  "fixesApplied": 2,
  "fixes": [
    {
      "line": 5,
      "type": "security",
      "description": "Fixed XSS vulnerability"
    }
  ]
}
```

**Usage in Extension:**
```typescript
const fixResult = await client.autoFix(code, filePath, ['security']);
// fixResult.fixedCode - Fixed code string
// fixResult.fixesApplied - Number of fixes
// fixResult.fixes - Array of fix details
```

---

### 4. Natural Language Query
**Endpoint:** `POST /api/code-roach/query`

**Request Body:**
```json
{
  "query": "Explain this error: Cannot read property x of undefined",
  "context": {} // optional
}
```

**Response:**
```json
{
  "success": true,
  "response": {
    "title": "Error Explanation",
    "answer": "This error occurs when...",
    "code": "// Example fix\nif (obj && obj.x) { ... }"
  }
}
```

**Usage in Extension:**
```typescript
const result = await client.query("How do I fix this error?");
// result.response.title - Response title
// result.response.answer - Text answer
// result.response.code - Optional code example
```

---

## 🧪 Testing Checklist

After making the fixes, test each command:

### 1. Test Health Score
- [ ] Open a file in VS Code
- [ ] Run command: `Code Roach: Show Health Score`
- [ ] Verify webview panel opens with score
- [ ] Verify score displays correctly (0-100)
- [ ] Verify component scores display

### 2. Test Code Analysis
- [ ] Open a file with issues
- [ ] Run command: `Code Roach: Analyze File`
- [ ] Verify diagnostics appear in Problems panel
- [ ] Verify notification shows issue count
- [ ] Verify issues are color-coded by severity

### 3. Test Auto-Fix
- [ ] Open a file with fixable issues
- [ ] Run command: `Code Roach: Auto-Fix Errors`
- [ ] Select fix type from quick pick
- [ ] Verify code is updated in editor
- [ ] Verify notification shows fixes applied

### 4. Test Natural Language Query
- [ ] Run command: `Code Roach: Ask Question`
- [ ] Enter a question
- [ ] Verify webview panel opens with answer
- [ ] Verify answer is formatted correctly
- [ ] Verify code examples display if provided

### 5. Test Configuration
- [ ] Open VS Code Settings
- [ ] Search for "Code Roach"
- [ ] Verify `codeRoach.serverUrl` setting exists
- [ ] Verify `codeRoach.apiKey` setting exists
- [ ] Change server URL and verify it's used

---

## 📦 Building & Packaging

### Development Mode
```bash
cd .vscode-extension
npm install
npm run compile
# Press F5 in VS Code to run extension in development mode
```

### Package for Distribution
```bash
cd .vscode-extension
npm install -g vsce  # VS Code Extension Manager
vsce package
# Creates: code-roach-1.0.0.vsix
```

### Install Locally
```bash
code --install-extension code-roach-1.0.0.vsix
```

---

## 🎯 Additional Enhancements (Optional)

### Nice-to-Have Features

1. **Status Bar Integration**
   - Show health score in status bar
   - Click to open health panel

2. **Code Actions**
   - Quick fix suggestions inline
   - Lightbulb icon for auto-fixes

3. **Tree View**
   - Show all files with health scores
   - Filter by score threshold

4. **Settings UI**
   - Visual settings editor
   - Test connection button

5. **Error Reporting**
   - Better error messages
   - Retry logic for failed requests

---

## 📝 Response Format Expectations

### Health Score Response
The extension expects:
```typescript
{
  success: boolean;
  score: {
    overall: number;        // 0-100
    grade: string;          // "A", "B", "C", etc.
    components: {
      errorRate: number;    // 0-100
      complexity: number;   // 0-100
      security: number;     // 0-100
      performance: number;  // 0-100
    }
  }
}
```

### Review Response
The extension expects:
```typescript
{
  success: boolean;
  review: {
    score: number;          // 0-100
    issues: Array<{
      line: number;         // 1-based line number
      severity: string;     // "critical", "high", "medium", "low"
      message: string;
      type?: string;        // "security", "performance", etc.
    }>;
    summary?: string;
  }
}
```

### Auto-Fix Response
The extension expects:
```typescript
{
  success: boolean;
  fixedCode: string;        // Complete fixed code
  fixesApplied: number;
  fixes?: Array<{
    line: number;
    type: string;
    description: string;
  }>;
}
```

### Query Response
The extension expects:
```typescript
{
  success: boolean;
  response: {
    title?: string;
    answer: string;         // Main answer text
    code?: string;          // Optional code example
  }
}
```

---

## 🔗 Related Files

- **Extension Code:** `.vscode-extension/src/extension.ts`
- **Package Config:** `.vscode-extension/package.json`
- **TypeScript Config:** `.vscode-extension/tsconfig.json`
- **Backend API:** `server/routes/api.js` (lines 2212-2309)
- **Setup Guide:** `docs/CODE-ROACH-SETUP-GUIDE.md`

---

## ✅ Completion Criteria

The extension is complete when:

1. ✅ All 4 API endpoint paths are corrected
2. ✅ All 4 commands work end-to-end
3. ✅ Error handling works correctly
4. ✅ Configuration is respected
5. ✅ All tests pass
6. ✅ Extension can be packaged and installed
7. ✅ Documentation is updated

---

## 📞 Support

If you encounter issues:

1. Check the backend API is running: `http://localhost:3000`
2. Test endpoints directly with curl/Postman
3. Check VS Code Developer Console for errors (Help → Toggle Developer Tools)
4. Verify configuration in VS Code Settings

---

**Ready to build!** 🚀

The extension template is 95% complete - just needs the API path corrections and testing.


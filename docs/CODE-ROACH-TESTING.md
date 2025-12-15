# Code Roach Testing Guide

## Quick Start

The enhanced error analysis endpoint is ready to test! However, **the server needs to be restarted** to pick up the CSRF middleware changes.

## Testing the Enhanced Endpoint

### 1. Restart the Server

```bash
# Stop the current server (Ctrl+C or kill the process)
# Then restart:
npm start
# or
node server/server.js
```

### 2. Run the Test Script

```bash
node scripts/test-code-roach-enhancement.js
```

### 3. Manual Testing with curl

```bash
curl -X POST http://localhost:3000/api/error-analysis \
  -H "Content-Type: application/json" \
  -d '{
    "error": {
      "message": "Cannot read property \"x\" of undefined",
      "type": "TypeError",
      "source": "public/js/game.js",
      "stack": "TypeError: Cannot read property \"x\" of undefined\n    at Game.update (game.js:123:45)"
    },
    "context": {
      "serverUrl": "http://localhost:3000"
    },
    "fingerprint": "test_123"
  }'
```

### 4. Expected Response

```json
{
  "success": true,
  "fix": {
    "success": true,
    "suggestion": "Add null check for property 'x'...",
    "code": "if (obj !== null && obj !== undefined && obj.x !== undefined) { /* original code */ }",
    "type": "null-check",
    "safety": "safe",
    "confidence": 0.8,
    "applied": true,
    "fromLLM": true,
    "fromCodebase": false
  }
}
```

## What the Enhanced Endpoint Does

1. **Searches Codebase**: Uses semantic search to find similar errors and fixes
2. **Uses LLM**: Generates intelligent fix code using OpenAI/Anthropic
3. **Pattern Matching**: Falls back to pattern matching if LLM unavailable
4. **Safety Categorization**: Categorizes fixes as safe/medium/risky
5. **Returns Executable Code**: Provides actual JavaScript code to fix the error

## Troubleshooting

### CSRF Token Error
- **Solution**: Restart the server after the middleware change
- The `/api/error-analysis` endpoint is now excluded from CSRF protection

### LLM Not Available
- The endpoint will fall back to pattern matching
- Check that `OPENAI_API_KEY` or `ANTHROPIC_API_KEY` is set
- Check `llmService.isAvailable()` returns true

### Codebase Search Not Working
- Check that codebase index is built: `npm run codebase:sync`
- Check that `codebaseSearch` service is initialized
- The endpoint will still work with basic pattern matching

## Next Steps

Once testing passes, we'll implement Sprint 1: Real Auto-Fixing
- Apply fixes automatically (not just return them)
- Safety system with rollback
- Fix preview/approval UI


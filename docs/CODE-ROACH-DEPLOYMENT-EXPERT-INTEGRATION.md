# Code Roach Deployment Expert Integration

## Adding Railway/Deployment Expertise to Expert Training System

**Date**: 2025-01-15  
**Status**: ✅ Integrated

---

## 🎯 Overview

Code Roach now automatically detects deployment platforms (Railway, Vercel, Netlify, Heroku, etc.) and generates deployment-specific expert guides for each customer. This enables Code Roach agents to be experts on the customer's deployment platform.

---

## ✅ What Was Added

### 1. Deployment Platform Detection

**File**: `server/services/customerCodebaseAnalyzer.js`

**New Method**: `detectDeploymentPlatforms()`

**Detects:**

- **Railway**: `railway.json`, `nixpacks.toml`, `@railway/cli`, Railway scripts
- **Vercel**: `vercel.json`, `.vercel`, `vercel` CLI
- **Netlify**: `netlify.toml`, `.netlify`, `netlify-cli`
- **Heroku**: `Procfile`, `app.json`
- **Render**: `render.yaml`
- **Fly.io**: `fly.toml`
- **Docker**: `Dockerfile`, `docker-compose.yml`
- **CI/CD**: GitHub Actions, GitLab CI workflows

**Detection Methods:**

1. Configuration files (railway.json, vercel.json, etc.)
2. Package.json dependencies (@railway/cli, vercel, etc.)
3. Package.json scripts (deploy commands)
4. CI/CD workflow files (GitHub Actions, etc.)

---

### 2. Deployment Expert Generation

**File**: `server/services/expertTrainingService.js`

**Updated Method**: `determineExpertTypes()`

**New Logic:**

```javascript
// Deployment expert (if deployment platforms detected)
if (analysis.tech_stack?.deployment_platforms?.length > 0) {
  // Generate platform-specific deployment experts
  analysis.tech_stack.deployment_platforms.forEach((platform) => {
    const platformKey = platform.toLowerCase().replace(/[^a-z0-9]/g, "-");
    expertTypes.push(`deployment-${platformKey}`);
  });
}
```

**Expert Types Generated:**

- `deployment-railway` - Railway deployment expertise
- `deployment-vercel` - Vercel deployment expertise
- `deployment-netlify` - Netlify deployment expertise
- `deployment-heroku` - Heroku deployment expertise
- `deployment-render` - Render deployment expertise
- `deployment-fly-io` - Fly.io deployment expertise
- `deployment-docker` - Docker deployment expertise

---

## 📊 How It Works

### Detection Flow

1. **Codebase Analysis**

   ```
   Customer Codebase → detectDeploymentPlatforms() → ['Railway', 'Vercel']
   ```

2. **Expert Type Determination**

   ```
   deployment_platforms: ['Railway'] → expertTypes: ['deployment-railway']
   ```

3. **Expert Generation**

   ```
   'deployment-railway' → Generate Railway expert guide
   ```

4. **Expert Storage**
   ```
   Expert guide stored in database → Available for fix generation
   ```

---

## 🔧 Integration Points

### Codebase Analyzer

**Updated**: `analyzeTechStack()`

- Now includes `deployment_platforms` in tech stack analysis
- Detects deployment platforms from files, dependencies, scripts, CI/CD

### Expert Training Service

**Updated**: `determineExpertTypes()`

- Generates deployment experts when platforms detected
- Creates platform-specific expert types (e.g., `deployment-railway`)

### Expert Guide Generation

**Expert Templates**: When generating deployment experts, the system uses:

- Railway expertise guide (if Railway detected)
- Platform-specific patterns and best practices
- Customer-specific deployment configurations

---

## 📋 Example: Railway Detection

### Detection Triggers

**Files:**

- `railway.json` - Railway configuration
- `nixpacks.toml` - Nixpacks build configuration
- Any file with "railway" in name

**Dependencies:**

- `@railway/cli` in package.json

**Scripts:**

- `"deploy": "railway up"` in package.json scripts
- `"deploy:railway": "railway up"` in package.json scripts

**CI/CD:**

- GitHub Actions workflows with Railway commands
- GitLab CI with Railway deployment

### Expert Generated

When Railway is detected:

- Expert type: `deployment-railway`
- Guide includes: Railway CLI commands, deployment patterns, logging, monitoring
- Based on: `docs/RAILWAY-EXPERTISE-GUIDE.md`

---

## 🚀 Usage

### Automatic Detection

The system automatically detects deployment platforms during onboarding:

```javascript
// During customer onboarding
const analysis = await customerCodebaseAnalyzer.analyzeCodebase(
  projectId,
  codebasePath,
);

// Analysis includes:
analysis.tech_stack.deployment_platforms = ["Railway", "Vercel"];

// Experts generated:
// - deployment-railway
// - deployment-vercel
```

### Expert Usage in Fix Generation

When generating fixes, deployment experts are automatically used:

```javascript
// Fix generation with deployment context
const fix = await llmFixGenerator.generateFix(issue, code, filePath, {
  project_id: projectId, // ← Deployment experts included automatically
});

// Fix includes deployment-specific patterns:
// - Railway deployment best practices
// - Railway CLI commands
// - Railway logging patterns
// - Railway environment variables
```

---

## 📚 Expert Guide Sources

### Railway Expert

**Source**: `docs/RAILWAY-EXPERTISE-GUIDE.md`

- Comprehensive Railway deployment guide
- CLI commands and usage
- Logging and monitoring
- Best practices

**Quick Reference**: `docs/RAILWAY-QUICK-REFERENCE.md`

- Common commands
- Log filtering
- Configuration examples

**Helper Service**: `server/services/railwayHelper.js`

- Programmatic Railway operations
- Log retrieval
- Deployment management

### Other Platforms

For other platforms (Vercel, Netlify, etc.), the system will:

1. Use general deployment patterns
2. Include platform-specific configurations found in codebase
3. Reference platform documentation
4. Generate platform-specific best practices

---

## 🔍 Verification

### Check Detection

```bash
# Run codebase analysis
npm run code-roach:preview-experts

# Check for deployment platforms in analysis output
# Look for: deployment_platforms: ['Railway', ...]
```

### Check Expert Generation

```bash
# Run onboarding
npm run code-roach:onboard

# Verify experts generated
npm run code-roach:verify-experts

# Check for deployment experts
# Look for: deployment-railway, deployment-vercel, etc.
```

### Check Expert Usage

```javascript
// In fix generation, deployment experts are automatically included
// when project_id is provided and deployment platforms are detected
```

---

## 📊 Current Status

**Detection**: ✅ Implemented  
**Expert Generation**: ✅ Implemented  
**Integration**: ✅ Complete  
**Railway Expert Guide**: ✅ Available  
**Other Platform Guides**: ⏳ Can be added as needed

---

## 🎯 Benefits

1. **Platform-Specific Fixes**: Fixes respect deployment platform patterns
2. **Deployment Best Practices**: Experts include platform best practices
3. **CLI Commands**: Experts include platform CLI commands
4. **Configuration Patterns**: Experts include platform configuration patterns
5. **Logging Patterns**: Experts include platform logging patterns

---

## 🔮 Future Enhancements

### Additional Platform Guides

- Vercel expertise guide
- Netlify expertise guide
- Heroku expertise guide
- Render expertise guide
- Fly.io expertise guide

### Enhanced Detection

- Detect deployment patterns from code
- Detect deployment configurations from environment variables
- Detect deployment from infrastructure as code (Terraform, etc.)

---

**Integration Complete**: Deployment expertise is now part of Code Roach expert training system!

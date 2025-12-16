# Code Roach Expert Training Integration Guide
## How to Use Customer-Specific Expert Training in Code Roach

**Date**: 2025-01-15  
**Purpose**: Guide for integrating customer expert training into Code Roach workflows

---

## 🎯 Overview

The Expert Training System automatically generates customer-specific expert guides during onboarding, making Code Roach's AI agents experts on each customer's tech stack, patterns, and architecture.

---

## 🚀 Quick Start

### 1. Start Onboarding

When a customer connects their repository:

```javascript
const customerOnboardingService = require('./server/services/customerOnboardingService');

// Start onboarding
const result = await customerOnboardingService.startOnboarding(
    projectId,
    repositoryUrl,
    { /* options */ }
);

console.log(`Generated ${result.experts_generated} experts`);
```

### 2. Check Status

```javascript
const status = await customerOnboardingService.getOnboardingStatus(projectId);
console.log(`Status: ${status.status}, Quality: ${status.quality_score}`);
```

### 3. Use Customer Experts

```javascript
// In Code Roach services, use customer-specific experts
const { data: experts } = await supabase
    .from('customer_expert_guides')
    .select('*')
    .eq('project_id', projectId);

// Use expert guides in fix generation
const expertContext = experts.find(e => e.expert_type === 'database');
// Include expert context in LLM prompts
```

---

## 📋 Integration Points

### 1. Codebase Crawler Integration

Update `codebaseCrawler.js` to use customer experts:

```javascript
const { data: experts } = await supabase
    .from('customer_expert_guides')
    .select('*')
    .eq('project_id', projectId);

// Include expert context when analyzing code
const expertContext = this.buildExpertContext(experts);
const analysis = await this.analyzeFile(filePath, expertContext);
```

### 2. Fix Generator Integration

Update `llmFixGenerator.js` to use customer patterns:

```javascript
async generateFix(issue, projectId) {
    // Get customer experts
    const experts = await this.getCustomerExperts(projectId);
    
    // Build prompt with customer-specific patterns
    const prompt = this.buildFixPrompt(issue, experts);
    
    // Generate fix using customer patterns
    return await llmService.generateText({ prompt });
}
```

### 3. Codebase-Aware Fix Generator

Update `codebaseAwareFixGenerator.js`:

```javascript
async generateContextAwareFix(issue, projectId) {
    // Get customer expert guides
    const expertGuides = await this.getExpertGuides(projectId);
    
    // Use customer's architecture patterns
    const architecture = expertGuides.find(e => e.expert_type === 'architecture');
    
    // Generate fix respecting customer's patterns
    return await this.generateFix(issue, architecture);
}
```

---

## 🔧 API Endpoints

### Start Onboarding
```bash
POST /api/expert-training/onboard
{
  "project_id": "uuid",
  "repository_url": "https://github.com/user/repo",
  "options": {}
}
```

### Get Status
```bash
GET /api/expert-training/status/:projectId
```

### Retry Onboarding
```bash
POST /api/expert-training/retry/:projectId
{
  "repository_url": "https://github.com/user/repo"
}
```

### Update Experts
```bash
POST /api/expert-training/update/:projectId
{
  "repository_url": "https://github.com/user/repo"
}
```

### Get Experts
```bash
GET /api/expert-training/experts/:projectId?expert_type=database
```

### Get Analysis
```bash
GET /api/expert-training/analysis/:projectId
```

---

## 📊 Database Schema

### Tables

1. **`customer_codebase_analysis`** - Stores codebase analysis
2. **`customer_expert_guides`** - Stores generated expert guides
3. **`expert_training_status`** - Tracks training progress

### Querying Experts

```javascript
// Get all experts for a project
const { data: experts } = await supabase
    .from('customer_expert_guides')
    .select('*')
    .eq('project_id', projectId);

// Get specific expert type
const { data: dbExpert } = await supabase
    .from('customer_expert_guides')
    .select('*')
    .eq('project_id', projectId)
    .eq('expert_type', 'database')
    .single();

// Get expert guide content
const guide = dbExpert.guide_content;
const quickRef = dbExpert.quick_reference;
const helperCode = dbExpert.helper_service_code;
```

---

## 🎨 Usage Patterns

### Pattern 1: Fix Generation with Customer Experts

```javascript
async function generateFixWithCustomerExpert(issue, projectId) {
    // 1. Get customer experts
    const experts = await getCustomerExperts(projectId);
    
    // 2. Find relevant expert
    const relevantExpert = findRelevantExpert(issue, experts);
    
    // 3. Build prompt with expert context
    const prompt = `
        Customer Expert Guide Context:
        ${JSON.stringify(relevantExpert.guide_content, null, 2)}
        
        Issue to Fix:
        ${JSON.stringify(issue, null, 2)}
        
        Generate a fix following the customer's patterns...
    `;
    
    // 4. Generate fix
    return await llmService.generateText({ prompt });
}
```

### Pattern 2: Code Analysis with Customer Patterns

```javascript
async function analyzeCodeWithCustomerPatterns(filePath, projectId) {
    // 1. Get customer architecture expert
    const archExpert = await getExpert(projectId, 'architecture');
    
    // 2. Analyze code against customer patterns
    const code = await fs.readFile(filePath, 'utf8');
    const violations = checkPatternViolations(code, archExpert.guide_content);
    
    // 3. Generate suggestions based on customer patterns
    return violations.map(v => ({
        ...v,
        suggestion: generateSuggestion(v, archExpert.guide_content)
    }));
}
```

### Pattern 3: Helper Service Usage

```javascript
// Customer experts include generated helper services
const expert = await getExpert(projectId, 'database');

// Load helper service dynamically
const helperServicePath = path.join(
    __dirname,
    '../generated-helpers',
    `${projectId}-${expert.expert_type}Helper.js`
);

// Write helper service code
await fs.writeFile(helperServicePath, expert.helper_service_code);

// Use helper service
const helper = require(helperServicePath);
await helper.validateSchema('users', ['id', 'email']);
```

---

## 🔄 Workflow Integration

### Onboarding Workflow

1. **Customer connects repository** → Trigger onboarding
2. **Analyze codebase** → Detect tech stack, patterns
3. **Generate experts** → Create customer-specific guides
4. **Train agents** → Code Roach uses customer experts
5. **Validate** → Check expert quality

### Continuous Learning

1. **Codebase changes** → Re-analyze periodically
2. **Update experts** → Regenerate if patterns change
3. **Learn from fixes** → Improve expert guides based on success

### Fix Generation Workflow

1. **Issue detected** → Get customer experts
2. **Find relevant expert** → Match expert type to issue
3. **Generate fix** → Use customer patterns
4. **Apply fix** → Respect customer architecture
5. **Learn** → Update experts based on fix success

---

## 📈 Best Practices

### 1. Always Use Customer Experts

```javascript
// ✅ Good: Use customer experts
const experts = await getCustomerExperts(projectId);
const fix = await generateFix(issue, experts);

// ❌ Bad: Use generic patterns
const fix = await generateFix(issue);
```

### 2. Cache Expert Lookups

```javascript
// Cache experts per project
const expertCache = new Map();

async function getCachedExperts(projectId) {
    if (!expertCache.has(projectId)) {
        const experts = await getCustomerExperts(projectId);
        expertCache.set(projectId, experts);
    }
    return expertCache.get(projectId);
}
```

### 3. Fallback to Generic Patterns

```javascript
async function getExpertOrFallback(projectId, expertType) {
    const expert = await getExpert(projectId, expertType);
    if (!expert || expert.quality_score < 0.5) {
        return getGenericExpert(expertType);
    }
    return expert;
}
```

### 4. Validate Expert Quality

```javascript
async function useExpertIfValid(projectId, expertType) {
    const expert = await getExpert(projectId, expertType);
    if (expert.quality_score >= 0.7) {
        return expert;
    }
    console.warn(`Expert ${expertType} quality too low: ${expert.quality_score}`);
    return null;
}
```

---

## 🐛 Troubleshooting

### Issue: Experts Not Generated

**Check**:
1. Onboarding status: `GET /api/expert-training/status/:projectId`
2. Analysis completed: `GET /api/expert-training/analysis/:projectId`
3. Error logs: Check `expert_training_status.error_message`

**Fix**:
```javascript
// Retry onboarding
await customerOnboardingService.retryOnboarding(projectId, repositoryUrl);
```

### Issue: Low Quality Experts

**Check**:
```javascript
const { data: experts } = await supabase
    .from('customer_expert_guides')
    .select('quality_score, expert_type')
    .eq('project_id', projectId)
    .lt('quality_score', 0.7);
```

**Fix**:
```javascript
// Re-generate experts
await customerOnboardingService.updateExperts(projectId, repositoryUrl);
```

### Issue: Experts Not Used in Fixes

**Check**: Verify Code Roach services are using customer experts

**Fix**: Update services to query and use `customer_expert_guides`

---

## 📚 Related Documentation

- `docs/CODE-ROACH-EXPERT-TRAINING-SYSTEM.md` - System architecture
- `docs/5-EXPERT-COMPLETE-SUMMARY.md` - Reference expert packages
- `server/services/customerCodebaseAnalyzer.js` - Codebase analysis
- `server/services/expertTrainingService.js` - Expert generation
- `server/services/customerOnboardingService.js` - Onboarding orchestration

---

## 🎯 Next Steps

1. **Integrate into Codebase Crawler** - Use experts when analyzing code
2. **Integrate into Fix Generators** - Use customer patterns in fixes
3. **Add Continuous Learning** - Update experts as codebase evolves
4. **Add Quality Monitoring** - Track expert effectiveness
5. **Add UI Integration** - Show expert status in dashboard


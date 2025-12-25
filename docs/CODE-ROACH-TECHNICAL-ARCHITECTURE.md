# Code Roach: Technical Architecture

**Document Version:** 1.0  
**Date:** December 2025  
**Purpose:** Detailed technical architecture for Code Roach SaaS platform

---

## 🏗️ System Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Client Layer                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐   │
│  │   Web    │  │   CLI    │  │   IDE    │  │   API    │   │
│  │  App     │  │  Tool    │  │ Extension│  │ Clients  │   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └────┬─────┘   │
└───────┼─────────────┼─────────────┼─────────────┼──────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                        │
        ┌───────────────▼───────────────┐
        │      API Gateway / CDN        │
        │      (Cloudflare/Vercel)      │
        └───────────────┬───────────────┘
                        │
        ┌───────────────▼───────────────┐
        │      Application Layer         │
        │  ┌─────────────────────────┐  │
        │  │   Express.js API        │  │
        │  │   - REST API            │  │
        │  │   - WebSocket (future)  │  │
        │  └───────────┬─────────────┘  │
        └──────────────┼────────────────┘
                       │
        ┌──────────────▼────────────────┐
        │      Service Layer             │
        │  ┌──────────────────────────┐ │
        │  │  Codebase Crawler        │ │
        │  │  Fix Generator           │ │
        │  │  Fix Application         │ │
        │  │  Pattern Evolution       │ │
        │  │  Analytics               │ │
        │  └───────────┬──────────────┘ │
        └──────────────┼────────────────┘
                       │
        ┌──────────────▼────────────────┐
        │      Background Workers        │
        │  ┌──────────────────────────┐ │
        │  │  Job Queue (BullMQ)      │ │
        │  │  - Crawl Jobs            │ │
        │  │  - Fix Jobs              │ │
        │  │  - Analysis Jobs         │ │
        │  └───────────┬──────────────┘ │
        └──────────────┼────────────────┘
                       │
        ┌──────────────▼────────────────┐
        │      Data Layer                │
        │  ┌──────────┐  ┌──────────┐  │
        │  │ Supabase │  │  Redis   │  │
        │  │ (Postgres)│ │  (Cache) │  │
        │  └──────────┘  └──────────┘  │
        └───────────────────────────────┘
                       │
        ┌──────────────▼────────────────┐
        │      External Services         │
        │  ┌──────────┐  ┌──────────┐  │
        │  │  OpenAI  │  │  GitHub  │  │
        │  │  /Anthropic│ │  API    │  │
        │  └──────────┘  └──────────┘  │
        └───────────────────────────────┘
```

---

## 📦 Component Architecture

### 1. API Layer (`server/routes/api.js`)

**Responsibilities:**

- REST API endpoints
- Authentication/authorization
- Request validation
- Rate limiting
- Response formatting

**Key Endpoints:**

```javascript
// Code Roach API
POST / api / code - roach / crawl; // Trigger codebase crawl
GET / api / code - roach / status; // Get crawl status
GET / api / code - roach / issues; // Get issues
POST / api / code - roach / fix; // Apply fix
GET / api / code - roach / analytics; // Get analytics

// Developer Metrics
GET / api / code - roach / developer / stats;
GET / api / code - roach / developer / team;
GET / api / code - roach / developer / recommendations;

// Notifications
POST / api / code - roach / notifications / send;
```

**Technology:**

- Express.js
- Express-rate-limit (rate limiting)
- Helmet (security headers)
- CORS middleware

---

### 2. Service Layer

#### 2.1 Codebase Crawler (`server/services/codebaseCrawler.js`)

**Responsibilities:**

- Scan codebases
- Detect issues
- Generate fixes
- Apply fixes
- Track statistics

**Key Methods:**

```javascript
async crawlCodebase(rootDir, options)
async analyzeFile(filePath, options)
async generateFix(issue, code, filePath)
async applyFix(fix, filePath)
```

**Dependencies:**

- `codebaseSearch` - Semantic search
- `llmService` - AI fix generation
- `patternEvolutionService` - Pattern learning
- `issuePrioritizationService` - Issue prioritization
- `notificationService` - Notifications

---

#### 2.2 Fix Generation (`server/services/codebaseCrawlerFixHelpers.js`)

**Responsibilities:**

- Generate fixes using multiple strategies
- Pattern matching
- LLM-powered fixes
- Fix reuse
- Multi-step fixes

**Key Methods:**

```javascript
async generateFix(issue, code, filePath, patternFix, insights)
async tryCodebaseAwareFix(issue, code, filePath)
async tryContextAwareFix(issue, code, filePath)
async tryLLMFix(issue, code, filePath)
```

**Dependencies:**

- `multiStepFixGenerator` - Complex fixes
- `codebaseSearch` - Similar code search
- `llmService` - AI generation

---

#### 2.3 Fix Application (`server/services/codebaseCrawlerFixApplication.js`)

**Responsibilities:**

- Validate fixes
- Apply fixes safely
- Rollback on failure
- Track outcomes
- Learn from results

**Key Methods:**

```javascript
async applyFixWithValidation(fix, filePath, originalCode)
async applyFixWithLearning(issue, fix, filePath)
async recordSuccessfulFix(issue, fix, filePath)
async recordFailedFix(issue, fix, error, filePath)
```

**Dependencies:**

- `enhancedFixValidation` - Validation
- `fixConfidenceScoring` - Confidence calculation
- `patternEvolutionService` - Learning

---

### 3. Background Workers

#### 3.1 Job Queue System

**Technology:** BullMQ + Redis

**Queue Structure:**

```javascript
// Queues
- codebase-crawl      // Crawl jobs
- fix-application     // Fix jobs
- analysis           // Analysis jobs
- notifications      // Notification jobs

// Job Priorities
- critical: 10       // Security issues
- high: 5            // High priority issues
- normal: 1          // Normal issues
- low: 0             // Low priority
```

**Worker Implementation:**

```javascript
// server/workers/crawlWorker.js
const { Worker } = require("bullmq");
const codebaseCrawler = require("../services/codebaseCrawler");

const worker = new Worker(
  "codebase-crawl",
  async (job) => {
    const { rootDir, options, userId } = job.data;

    // Set user context
    codebaseCrawler.setUserContext(userId);

    // Run crawl
    const result = await codebaseCrawler.crawlCodebase(rootDir, options);

    return result;
  },
  {
    connection: redisConnection,
    concurrency: 5, // Process 5 jobs concurrently
    limiter: {
      max: 10, // Max 10 jobs
      duration: 60000, // Per minute
    },
  },
);
```

---

### 4. Data Layer

#### 4.1 Database Schema (Supabase/PostgreSQL)

**Core Tables:**

```sql
-- Users (Supabase Auth handles this)
-- Organizations
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'starter',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Projects
CREATE TABLE projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  organization_id UUID REFERENCES organizations(id),
  name TEXT NOT NULL,
  repository_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Issues
CREATE TABLE code_roach_issues (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  file_path TEXT NOT NULL,
  line INTEGER,
  error_type TEXT NOT NULL,
  error_message TEXT,
  error_severity TEXT,
  review_status TEXT DEFAULT 'pending',
  fix_applied TEXT,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Patterns
CREATE TABLE code_roach_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fingerprint TEXT UNIQUE NOT NULL,
  error_pattern JSONB,
  best_fix TEXT,
  occurrence_count INTEGER DEFAULT 0,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  confidence DECIMAL(3,2) DEFAULT 0.5,
  deprecated BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- File Health
CREATE TABLE code_roach_file_health (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  file_path TEXT NOT NULL,
  health_score INTEGER,
  issue_count INTEGER DEFAULT 0,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics
CREATE TABLE code_roach_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id),
  metric_type TEXT NOT NULL,
  metric_value JSONB,
  recorded_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

#### 4.2 Redis Cache Structure

**Cache Keys:**

```javascript
// File hash cache
file:hash:{projectId}:{filePath} = SHA256 hash
TTL: 24 hours

// Pattern cache
pattern:{fingerprint} = pattern object
TTL: 1 hour

// Issue cache
issue:{issueId} = issue object
TTL: 1 hour

// User session
session:{userId} = session data
TTL: 30 minutes

// Rate limiting
rate:limit:{userId}:{endpoint} = count
TTL: 1 minute
```

---

### 5. External Integrations

#### 5.1 GitHub Integration

**Webhook Events:**

- `push` - Trigger crawl on code changes
- `pull_request` - Analyze PR for issues
- `repository` - Setup new project

**API Usage:**

- Get repository contents
- Create pull requests (for fixes)
- Get commit history
- Check repository permissions

**Implementation:**

```javascript
// server/services/gitHubIntegration.js
const { Octokit } = require("@octokit/rest");

class GitHubIntegration {
  constructor(token) {
    this.octokit = new Octokit({ auth: token });
  }

  async getRepositoryContents(owner, repo, path) {
    const { data } = await this.octokit.repos.getContent({
      owner,
      repo,
      path,
    });
    return data;
  }

  async createPullRequest(owner, repo, title, body, head, base) {
    const { data } = await this.octokit.pulls.create({
      owner,
      repo,
      title,
      body,
      head,
      base,
    });
    return data;
  }
}
```

---

#### 5.2 LLM Integration

**Providers:**

- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Google (Gemini)

**Usage:**

- Fix generation
- Code analysis
- Pattern extraction
- Issue explanation

**Implementation:**

```javascript
// server/services/llmService.js
class LLMService {
  async generateFix(issue, code, context) {
    const prompt = this.buildFixPrompt(issue, code, context);
    const response = await this.openai.chat.completions.create({
      model: "gpt-4",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });
    return this.parseFixResponse(response);
  }
}
```

**Cost Optimization:**

- Cache common fixes
- Use cheaper models for simple fixes
- Batch requests
- Fine-tune models

---

## 🔄 Data Flow

### Crawl Flow

```
1. User triggers crawl via API
   ↓
2. API creates crawl job in queue
   ↓
3. Worker picks up job
   ↓
4. Crawler scans codebase
   ↓
5. For each file:
   a. Check cache (skip if unchanged)
   b. Analyze file for issues
   c. Generate fixes
   d. Apply fixes (if auto-apply enabled)
   e. Record results
   ↓
6. Update project statistics
   ↓
7. Send notifications
   ↓
8. Return results to user
```

### Fix Application Flow

```
1. Issue detected
   ↓
2. Generate fix (pattern/LLM/reuse)
   ↓
3. Validate fix (syntax/AST/tests)
   ↓
4. Calculate confidence score
   ↓
5. If confidence > threshold:
   a. Apply fix
   b. Verify fix
   c. Record success
   d. Learn from outcome
   ↓
6. If confidence < threshold:
   a. Add to review queue
   b. Notify user
   c. Wait for approval
```

---

## 🔐 Security Architecture

### Authentication & Authorization

**Authentication:**

- Supabase Auth (JWT tokens)
- OAuth providers (GitHub, Google)
- API keys for programmatic access

**Authorization:**

- Role-based access control (RBAC)
- Project-level permissions
- Organization-level permissions

**Implementation:**

```javascript
// server/middleware/auth.js
async function authenticate(req, res, next) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  const { data: user, error } = await supabase.auth.getUser(token);
  if (error) return res.status(401).json({ error: "Unauthorized" });

  req.user = user;
  next();
}

async function authorizeProject(req, res, next) {
  const { projectId } = req.params;
  const userId = req.user.id;

  const hasAccess = await checkProjectAccess(userId, projectId);
  if (!hasAccess) return res.status(403).json({ error: "Forbidden" });

  next();
}
```

---

### Data Security

**Encryption:**

- Data at rest: Supabase encryption
- Data in transit: TLS/HTTPS
- Secrets: Environment variables, encrypted storage

**Access Control:**

- Row-level security (RLS) in Supabase
- API rate limiting
- IP whitelisting (enterprise)

**Audit Logging:**

- All API requests logged
- Fix applications tracked
- User actions recorded

---

## 📊 Monitoring & Observability

### Metrics

**Application Metrics:**

- Request rate
- Response time
- Error rate
- Fix success rate
- Queue depth

**Business Metrics:**

- Active users
- Projects scanned
- Issues found
- Fixes applied
- User satisfaction (NPS)

**Infrastructure Metrics:**

- CPU usage
- Memory usage
- Database connections
- Redis memory
- API rate limits

---

### Logging

**Log Levels:**

- ERROR: Errors requiring attention
- WARN: Warnings, non-critical issues
- INFO: Important events
- DEBUG: Detailed debugging info

**Log Aggregation:**

- Structured logging (JSON)
- Centralized log storage (Logtail)
- Log retention: 30 days

**Example:**

```javascript
logger.info("Crawl started", {
  userId: user.id,
  projectId: project.id,
  fileCount: files.length,
});

logger.error("Fix application failed", {
  issueId: issue.id,
  error: error.message,
  stack: error.stack,
});
```

---

### Alerting

**Alert Conditions:**

- Error rate > 5%
- Response time > 5s
- Queue depth > 100
- Database connections > 80%
- Uptime < 99%

**Alert Channels:**

- Email
- Slack
- PagerDuty (critical)

---

## 🚀 Deployment Architecture

### Environment Strategy

**Environments:**

1. **Development** - Local development
2. **Staging** - Pre-production testing
3. **Production** - Live environment

**Configuration:**

- Environment variables for each environment
- Separate Supabase projects
- Separate Redis instances
- Feature flags for gradual rollout

---

### Deployment Process

**CI/CD Pipeline:**

```
1. Code pushed to GitHub
   ↓
2. GitHub Actions triggered
   ↓
3. Run tests (unit, integration, e2e)
   ↓
4. Build application
   ↓
5. Deploy to staging
   ↓
6. Run smoke tests
   ↓
7. Manual approval (production)
   ↓
8. Deploy to production
   ↓
9. Run health checks
   ↓
10. Monitor for issues
```

**Rollback Strategy:**

- Keep previous version available
- Database migrations reversible
- Feature flags for quick disable
- Automated rollback on health check failure

---

## 📈 Scaling Strategy

### Horizontal Scaling

**API Servers:**

- Stateless design
- Load balancer (Cloudflare/Railway)
- Auto-scaling based on CPU/memory

**Workers:**

- Multiple worker instances
- Queue-based distribution
- Auto-scaling based on queue depth

**Database:**

- Connection pooling
- Read replicas (future)
- Query optimization

---

### Vertical Scaling

**When to scale up:**

- CPU consistently > 70%
- Memory consistently > 80%
- Database connections maxed

**Scaling targets:**

- API: 2-4 CPU, 4-8GB RAM
- Workers: 4-8 CPU, 8-16GB RAM
- Database: Managed by Supabase

---

## 🔄 Disaster Recovery

### Backup Strategy

**Database:**

- Supabase automated backups (daily)
- Point-in-time recovery
- Retention: 30 days

**Code:**

- Git repository (GitHub)
- Multiple remotes (backup)

**Configuration:**

- Environment variables in secure storage
- Infrastructure as code (GitHub)

---

### Recovery Procedures

**Database Failure:**

1. Restore from backup
2. Replay transaction logs
3. Verify data integrity
4. Resume operations

**Application Failure:**

1. Rollback to previous version
2. Investigate root cause
3. Fix and redeploy
4. Monitor for stability

**Data Loss:**

1. Restore from backup
2. Replay events (if event sourcing)
3. Notify affected users
4. Implement prevention measures

---

## 🎯 Performance Optimization

### Caching Strategy

**Multi-Layer Caching:**

1. **CDN** - Static assets, API responses
2. **Redis** - Application cache
3. **In-Memory** - Hot data

**Cache Invalidation:**

- Time-based (TTL)
- Event-based (on updates)
- Manual (admin action)

---

### Database Optimization

**Indexes:**

```sql
CREATE INDEX idx_issues_project_status ON code_roach_issues(project_id, review_status);
CREATE INDEX idx_issues_severity ON code_roach_issues(error_severity);
CREATE INDEX idx_patterns_fingerprint ON code_roach_patterns(fingerprint);
CREATE INDEX idx_file_health_project ON code_roach_file_health(project_id, recorded_at);
```

**Query Optimization:**

- Use prepared statements
- Limit result sets
- Pagination
- Avoid N+1 queries

---

## 📋 Next Steps

1. **Review architecture** with team
2. **Set up infrastructure** (Week 1)
3. **Implement core services** (Week 2-4)
4. **Set up monitoring** (Week 2)
5. **Deploy to staging** (Week 4)
6. **Load testing** (Week 5)
7. **Deploy to production** (Week 6)

---

**Document Status:** Technical blueprint complete  
**Next Review:** After infrastructure setup

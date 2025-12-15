-- Code Roach Database Schema
-- Stores issues, fixes, patterns, and learning data for continuous improvement

-- =============================================
-- Issues Table
-- =============================================
CREATE TABLE IF NOT EXISTS code_roach_issues (
  id TEXT PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Error info
  error_message TEXT NOT NULL,
  error_type TEXT NOT NULL, -- security, performance, style, best-practice, etc.
  error_severity TEXT NOT NULL, -- critical, high, medium, low
  error_source TEXT, -- code-review, crawler, runtime
  error_file TEXT,
  error_line INTEGER,
  error_stack TEXT,
  error_fingerprint TEXT,
  
  -- Fix info
  fix_code TEXT,
  fix_type TEXT, -- pattern, llm, context-aware, advanced
  fix_safety TEXT, -- safe, medium, risky
  fix_success BOOLEAN,
  fix_applied BOOLEAN DEFAULT FALSE,
  fix_confidence DECIMAL(3,2),
  fix_method TEXT, -- specific method used
  
  -- Context
  context_user_agent TEXT,
  context_url TEXT,
  context_game_state TEXT,
  context_code_snippet TEXT, -- surrounding code
  
  -- Review
  review_status TEXT DEFAULT 'pending', -- pending, approved, rejected, deferred
  review_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT,
  
  -- Resolution
  resolved_at TIMESTAMPTZ,
  resolution_time_seconds INTEGER, -- time from creation to resolution
  
  -- Metadata
  metadata JSONB DEFAULT '{}'::jsonb -- flexible storage for future fields
);

-- =============================================
-- Patterns Table
-- =============================================
CREATE TABLE IF NOT EXISTS code_roach_patterns (
  fingerprint TEXT PRIMARY KEY,
  error_pattern JSONB NOT NULL,
  first_seen TIMESTAMPTZ DEFAULT NOW(),
  last_seen TIMESTAMPTZ DEFAULT NOW(),
  occurrence_count INTEGER DEFAULT 1,
  success_count INTEGER DEFAULT 0,
  failure_count INTEGER DEFAULT 0,
  best_fix JSONB,
  pattern_metadata JSONB DEFAULT '{}'::jsonb,
  
  -- Learning metrics
  avg_resolution_time_seconds INTEGER,
  most_common_file_patterns TEXT[],
  most_effective_fix_method TEXT
);

-- =============================================
-- Fix Learning Table
-- =============================================
CREATE TABLE IF NOT EXISTS code_roach_fix_learning (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  issue_id TEXT REFERENCES code_roach_issues(id),
  fix_method TEXT NOT NULL,
  fix_confidence DECIMAL(3,2),
  success BOOLEAN NOT NULL,
  error_message TEXT,
  file_path TEXT,
  issue_type TEXT,
  
  -- Learning data
  learning_insights JSONB DEFAULT '{}'::jsonb
);

-- =============================================
-- File Health History
-- =============================================
CREATE TABLE IF NOT EXISTS code_roach_file_health (
  id SERIAL PRIMARY KEY,
  file_path TEXT NOT NULL,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  
  health_score INTEGER,
  error_count INTEGER,
  issue_count INTEGER,
  fix_count INTEGER,
  auto_fix_count INTEGER,
  
  -- Scores by category
  error_rate_score INTEGER,
  complexity_score INTEGER,
  security_score INTEGER,
  performance_score INTEGER,
  maintainability_score INTEGER,
  
  -- Trends
  score_change INTEGER, -- change from previous recording
  improvement_rate DECIMAL(5,2), -- percentage improvement
  
  metadata JSONB DEFAULT '{}'::jsonb
);

-- =============================================
-- Cursor Rules Learning
-- =============================================
CREATE TABLE IF NOT EXISTS code_roach_cursor_rules (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  rule_name TEXT NOT NULL UNIQUE,
  rule_content TEXT NOT NULL,
  rule_category TEXT, -- style, security, performance, best-practice
  
  -- Learning metrics
  times_applied INTEGER DEFAULT 0,
  success_rate DECIMAL(5,2), -- how often following this rule prevents issues
  issue_prevention_count INTEGER DEFAULT 0,
  
  -- Source
  generated_from_patterns TEXT[], -- pattern fingerprints that led to this rule
  confidence_score DECIMAL(3,2),
  
  -- Status
  is_active BOOLEAN DEFAULT TRUE,
  is_auto_generated BOOLEAN DEFAULT FALSE,
  
  metadata JSONB DEFAULT '{}'::jsonb
);

-- =============================================
-- Rule Effectiveness Tracking
-- =============================================
CREATE TABLE IF NOT EXISTS code_roach_rule_effectiveness (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  rule_id INTEGER REFERENCES code_roach_cursor_rules(id),
  issue_id TEXT REFERENCES code_roach_issues(id),
  
  -- Effectiveness metrics
  rule_was_followed BOOLEAN,
  issue_was_prevented BOOLEAN,
  issue_severity TEXT,
  
  -- Context
  file_path TEXT,
  code_context TEXT,
  
  metadata JSONB DEFAULT '{}'::jsonb
);

-- =============================================
-- Code Quality Improvements
-- =============================================
CREATE TABLE IF NOT EXISTS code_roach_quality_improvements (
  id SERIAL PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  improvement_type TEXT NOT NULL, -- rule_added, rule_updated, pattern_learned, etc.
  description TEXT,
  
  -- Impact metrics
  issues_prevented_count INTEGER DEFAULT 0,
  files_improved_count INTEGER DEFAULT 0,
  avg_health_score_improvement DECIMAL(5,2),
  
  -- Source
  triggered_by_patterns TEXT[],
  triggered_by_issues TEXT[],
  
  -- Result
  cursor_rules_updated TEXT[],
  recommendations_generated TEXT[],
  
  metadata JSONB DEFAULT '{}'::jsonb
);

-- =============================================
-- Indexes for Performance
-- =============================================

-- Issues indexes
CREATE INDEX IF NOT EXISTS idx_issues_file ON code_roach_issues(error_file);
CREATE INDEX IF NOT EXISTS idx_issues_type ON code_roach_issues(error_type);
CREATE INDEX IF NOT EXISTS idx_issues_severity ON code_roach_issues(error_severity);
CREATE INDEX IF NOT EXISTS idx_issues_status ON code_roach_issues(review_status);
CREATE INDEX IF NOT EXISTS idx_issues_created ON code_roach_issues(created_at);
CREATE INDEX IF NOT EXISTS idx_issues_fingerprint ON code_roach_issues(error_fingerprint);
CREATE INDEX IF NOT EXISTS idx_issues_resolved ON code_roach_issues(resolved_at) WHERE resolved_at IS NOT NULL;

-- Patterns indexes
CREATE INDEX IF NOT EXISTS idx_patterns_last_seen ON code_roach_patterns(last_seen);
CREATE INDEX IF NOT EXISTS idx_patterns_occurrence ON code_roach_patterns(occurrence_count DESC);

-- File health indexes
CREATE INDEX IF NOT EXISTS idx_file_health_path ON code_roach_file_health(file_path);
CREATE INDEX IF NOT EXISTS idx_file_health_recorded ON code_roach_file_health(recorded_at);
CREATE INDEX IF NOT EXISTS idx_file_health_score ON code_roach_file_health(health_score);

-- Cursor rules indexes
CREATE INDEX IF NOT EXISTS idx_cursor_rules_active ON code_roach_cursor_rules(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_cursor_rules_category ON code_roach_cursor_rules(rule_category);
CREATE INDEX IF NOT EXISTS idx_cursor_rules_success_rate ON code_roach_cursor_rules(success_rate DESC);

-- Full-text search
CREATE INDEX IF NOT EXISTS idx_issues_message_search ON code_roach_issues USING gin(to_tsvector('english', error_message));
CREATE INDEX IF NOT EXISTS idx_cursor_rules_content_search ON code_roach_cursor_rules USING gin(to_tsvector('english', rule_content));

-- =============================================
-- Functions for Analytics
-- =============================================

-- Function to calculate rule effectiveness
CREATE OR REPLACE FUNCTION calculate_rule_effectiveness(rule_id_param INTEGER)
RETURNS TABLE (
  rule_id INTEGER,
  times_applied BIGINT,
  issues_prevented BIGINT,
  success_rate DECIMAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cr.id,
    COUNT(re.id) as times_applied,
    COUNT(CASE WHEN re.issue_was_prevented THEN 1 END) as issues_prevented,
    CASE 
      WHEN COUNT(re.id) > 0 
      THEN ROUND(100.0 * COUNT(CASE WHEN re.issue_was_prevented THEN 1 END) / COUNT(re.id), 2)
      ELSE 0
    END as success_rate
  FROM code_roach_cursor_rules cr
  LEFT JOIN code_roach_rule_effectiveness re ON cr.id = re.rule_id
  WHERE cr.id = rule_id_param
  GROUP BY cr.id;
END;
$$ LANGUAGE plpgsql;

-- Function to get top problematic patterns
CREATE OR REPLACE FUNCTION get_top_problematic_patterns(limit_count INTEGER DEFAULT 10)
RETURNS TABLE (
  fingerprint TEXT,
  occurrence_count INTEGER,
  success_rate DECIMAL,
  avg_resolution_time INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    cp.fingerprint,
    cp.occurrence_count,
    CASE 
      WHEN (cp.success_count + cp.failure_count) > 0
      THEN ROUND(100.0 * cp.success_count / (cp.success_count + cp.failure_count), 2)
      ELSE 0
    END as success_rate,
    cp.avg_resolution_time_seconds
  FROM code_roach_patterns cp
  ORDER BY cp.occurrence_count DESC, cp.failure_count DESC
  LIMIT limit_count;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Code Roach Expertise Tracking
-- Tracks Code Roach's expertise levels across different domains
-- =============================================
CREATE TABLE IF NOT EXISTS code_roach_expertise (
    id BIGSERIAL PRIMARY KEY,
    domain TEXT NOT NULL UNIQUE,
    level DECIMAL(3, 2) NOT NULL DEFAULT 0.0, -- 0.0 to 5.0
    experience INTEGER NOT NULL DEFAULT 0, -- Number of fixes attempted
    success_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.0, -- 0.0 to 1.0
    last_updated TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for expertise table
CREATE INDEX IF NOT EXISTS idx_code_roach_expertise_domain ON code_roach_expertise(domain);
CREATE INDEX IF NOT EXISTS idx_code_roach_expertise_level ON code_roach_expertise(level DESC);
CREATE INDEX IF NOT EXISTS idx_code_roach_expertise_experience ON code_roach_expertise(experience DESC);

-- RLS policies for expertise table
ALTER TABLE code_roach_expertise ENABLE ROW LEVEL SECURITY;

-- Allow service role full access
CREATE POLICY "Service role can manage expertise"
    ON code_roach_expertise
    FOR ALL
    USING (true)
    WITH CHECK (true);

-- Insert initial expertise domains
INSERT INTO code_roach_expertise (domain, level, experience, success_rate)
VALUES
    ('syntax-fixes', 0.0, 0, 0.0),
    ('error-handling', 0.0, 0, 0.0),
    ('security', 0.0, 0, 0.0),
    ('performance', 0.0, 0, 0.0),
    ('code-style', 0.0, 0, 0.0),
    ('architecture', 0.0, 0, 0.0),
    ('testing', 0.0, 0, 0.0),
    ('refactoring', 0.0, 0, 0.0),
    ('async-patterns', 0.0, 0, 0.0),
    ('database-queries', 0.0, 0, 0.0),
    ('api-design', 0.0, 0, 0.0),
    ('frontend-patterns', 0.0, 0, 0.0),
    ('backend-patterns', 0.0, 0, 0.0)
ON CONFLICT (domain) DO NOTHING;


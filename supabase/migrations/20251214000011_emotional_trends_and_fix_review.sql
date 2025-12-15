-- Emotional Trends & Fix Review Queue
-- Player emotional trend analysis and collaborative fix review

-- =============================================
-- Emotional Trends Function
-- =============================================

-- Function to get emotional trends (enhances existing player_emotional_state table)
CREATE OR REPLACE FUNCTION get_emotional_trends(
    user_id_param UUID,
    days INTEGER DEFAULT 7
)
RETURNS TABLE (
    date DATE,
    frustration_level INTEGER,
    excitement_level INTEGER,
    confidence_level INTEGER,
    sample_count BIGINT
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        DATE_TRUNC('day', updated_at)::DATE as date,
        AVG(frustration_level)::INTEGER,
        AVG(excitement_level)::INTEGER,
        AVG(confidence_level)::INTEGER,
        COUNT(*)::BIGINT as sample_count
    FROM player_emotional_state
    WHERE user_id = user_id_param
    AND updated_at > NOW() - (days || ' days')::INTERVAL
    GROUP BY DATE_TRUNC('day', updated_at)::DATE
    ORDER BY date;
END;
$$;

-- =============================================
-- Fix Review Queue
-- =============================================
CREATE TABLE IF NOT EXISTS fix_review_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    issue_id TEXT REFERENCES code_roach_issues(id) ON DELETE CASCADE,
    fix_proposed JSONB,
    proposed_by TEXT, -- agent name or developer id
    proposed_by_type TEXT DEFAULT 'agent', -- 'agent' or 'developer'
    review_status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'deferred'
    reviewed_by TEXT,
    reviewed_at TIMESTAMPTZ,
    review_notes TEXT,
    priority INTEGER DEFAULT 5, -- 1-10, higher = more urgent
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_fix_review_status ON fix_review_queue(review_status);
CREATE INDEX IF NOT EXISTS idx_fix_review_priority ON fix_review_queue(priority DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fix_review_proposed_by ON fix_review_queue(proposed_by);
CREATE INDEX IF NOT EXISTS idx_fix_review_created ON fix_review_queue(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fix_review_metadata ON fix_review_queue USING GIN(metadata);

-- =============================================
-- RLS Policies
-- =============================================
ALTER TABLE fix_review_queue ENABLE ROW LEVEL SECURITY;

-- Service role has full access (server-side only)
CREATE POLICY "Service role full access to fix_review_queue"
  ON fix_review_queue FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Deny all access for anon and authenticated (server-side only)
-- Note: In production, you might want to allow authenticated developers to view/review
CREATE POLICY "Deny all access to fix_review_queue"
  ON fix_review_queue FOR ALL
  TO anon, authenticated
  USING (false)
  WITH CHECK (false);

-- =============================================
-- Functions
-- =============================================

-- Function to get pending reviews
CREATE OR REPLACE FUNCTION get_pending_reviews(
    p_limit INTEGER DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    issue_id TEXT,
    fix_proposed JSONB,
    proposed_by TEXT,
    priority INTEGER,
    created_at TIMESTAMPTZ,
    issue_severity TEXT,
    issue_type TEXT
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        frq.id,
        frq.issue_id,
        frq.fix_proposed,
        frq.proposed_by,
        frq.priority,
        frq.created_at,
        cri.error_severity,
        cri.error_type
    FROM fix_review_queue frq
    LEFT JOIN code_roach_issues cri ON frq.issue_id = cri.id
    WHERE frq.review_status = 'pending'
    ORDER BY frq.priority DESC, frq.created_at ASC
    LIMIT p_limit;
END;
$$;

-- Function to approve fix
CREATE OR REPLACE FUNCTION approve_fix(
    p_review_id UUID,
    p_reviewed_by TEXT,
    p_review_notes TEXT DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE fix_review_queue
    SET 
        review_status = 'approved',
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW(),
        review_notes = p_review_notes,
        updated_at = NOW()
    WHERE id = p_review_id;
    
    -- Update the issue status
    UPDATE code_roach_issues
    SET 
        review_status = 'approved',
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW()
    WHERE id = (SELECT issue_id FROM fix_review_queue WHERE id = p_review_id);
END;
$$;

-- Function to reject fix
CREATE OR REPLACE FUNCTION reject_fix(
    p_review_id UUID,
    p_reviewed_by TEXT,
    p_review_notes TEXT
)
RETURNS void
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    UPDATE fix_review_queue
    SET 
        review_status = 'rejected',
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW(),
        review_notes = p_review_notes,
        updated_at = NOW()
    WHERE id = p_review_id;
    
    -- Update the issue status
    UPDATE code_roach_issues
    SET 
        review_status = 'rejected',
        reviewed_by = p_reviewed_by,
        reviewed_at = NOW(),
        review_notes = p_review_notes
    WHERE id = (SELECT issue_id FROM fix_review_queue WHERE id = p_review_id);
END;
$$;

-- =============================================
-- Triggers
-- =============================================

-- Update updated_at timestamp
CREATE TRIGGER update_fix_review_updated_at
    BEFORE UPDATE ON fix_review_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- Comments
-- =============================================

COMMENT ON FUNCTION get_emotional_trends IS 'Returns emotional state trends for a player to help AI GM adapt difficulty.';
COMMENT ON TABLE fix_review_queue IS 'Queue for reviewing and approving agent-proposed fixes. Enables human oversight.';
COMMENT ON FUNCTION get_pending_reviews IS 'Returns pending fix reviews ordered by priority.';
COMMENT ON FUNCTION approve_fix IS 'Approves a fix and updates related issue status.';
COMMENT ON FUNCTION reject_fix IS 'Rejects a fix with review notes and updates issue status.';

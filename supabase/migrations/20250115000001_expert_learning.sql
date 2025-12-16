-- Expert Learning System
-- Migration: 20250115000001_expert_learning.sql
-- Description: Tables for tracking expert usage and learning from fix outcomes

-- Expert Learning Data
CREATE TABLE IF NOT EXISTS expert_learning_data (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    expert_type TEXT NOT NULL,
    issue_type TEXT,
    issue_message TEXT,
    fix_code TEXT,
    outcome TEXT, -- 'success', 'failure', 'partial'
    confidence DECIMAL(3,2),
    user_feedback TEXT,
    applied BOOLEAN DEFAULT FALSE,
    reverted BOOLEAN DEFAULT FALSE,
    recorded_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expert Usage Tracking
CREATE TABLE IF NOT EXISTS expert_usage_tracking (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    expert_type TEXT NOT NULL,
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    success_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id, expert_type)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_expert_learning_data_project_id 
    ON expert_learning_data(project_id);

CREATE INDEX IF NOT EXISTS idx_expert_learning_data_expert_type 
    ON expert_learning_data(expert_type);

CREATE INDEX IF NOT EXISTS idx_expert_learning_data_outcome 
    ON expert_learning_data(outcome);

CREATE INDEX IF NOT EXISTS idx_expert_learning_data_recorded_at 
    ON expert_learning_data(recorded_at);

CREATE INDEX IF NOT EXISTS idx_expert_usage_tracking_project_id 
    ON expert_usage_tracking(project_id);

-- RLS policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'expert_learning_data'
    ) THEN
        ALTER TABLE expert_learning_data ENABLE ROW LEVEL SECURITY;
        ALTER TABLE expert_usage_tracking ENABLE ROW LEVEL SECURITY;

        CREATE POLICY "Users can view own organization's learning data"
            ON expert_learning_data FOR SELECT
            USING (
                project_id IN (
                    SELECT id FROM projects 
                    WHERE organization_id IN (
                        SELECT organization_id FROM organization_members 
                        WHERE user_id = auth.uid()
                    )
                )
            );

        CREATE POLICY "Users can view own organization's usage tracking"
            ON expert_usage_tracking FOR SELECT
            USING (
                project_id IN (
                    SELECT id FROM projects 
                    WHERE organization_id IN (
                        SELECT organization_id FROM organization_members 
                        WHERE user_id = auth.uid()
                    )
                )
            );
    END IF;
END $$;

COMMENT ON TABLE expert_learning_data IS 'Tracks fix outcomes for expert learning and improvement';
COMMENT ON TABLE expert_usage_tracking IS 'Tracks expert usage statistics';


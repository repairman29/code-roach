-- Code Roach Expert Training System
-- Migration: 20250115000000_code_roach_expert_training.sql
-- Description: Tables for customer-specific expert training system

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Customer Codebase Analysis
CREATE TABLE IF NOT EXISTS customer_codebase_analysis (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    analysis_data JSONB NOT NULL, -- Full analysis results
    tech_stack JSONB, -- Detected technologies
    architecture_patterns JSONB, -- Architecture patterns found
    code_organization JSONB, -- File/folder structure
    testing_patterns JSONB, -- Testing frameworks/patterns
    security_practices JSONB, -- Security patterns found
    dependencies JSONB, -- Dependencies analysis
    code_style JSONB, -- Code style analysis
    analyzed_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id)
);

-- Customer Expert Guides
CREATE TABLE IF NOT EXISTS customer_expert_guides (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    expert_type TEXT NOT NULL, -- 'database', 'testing', 'security', 'framework-react', etc.
    guide_content JSONB NOT NULL, -- Full expert guide
    quick_reference JSONB, -- Quick reference guide
    helper_service_code TEXT, -- Generated helper service code
    integration_guide JSONB, -- Integration patterns
    generated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    quality_score DECIMAL(3,2), -- 0.00-1.00
    UNIQUE(project_id, expert_type)
);

-- Expert Training Status
CREATE TABLE IF NOT EXISTS expert_training_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    training_status TEXT DEFAULT 'pending', -- pending, in_progress, completed, failed
    experts_generated INTEGER DEFAULT 0,
    experts_total INTEGER DEFAULT 0,
    quality_score DECIMAL(3,2),
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    error_message TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(project_id)
);

-- Add onboarding columns to projects table if they don't exist
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects' 
        AND column_name = 'onboarding_completed'
    ) THEN
        ALTER TABLE projects ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'projects' 
        AND column_name = 'onboarding_completed_at'
    ) THEN
        ALTER TABLE projects ADD COLUMN onboarding_completed_at TIMESTAMPTZ;
    END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_customer_codebase_analysis_project_id 
    ON customer_codebase_analysis(project_id);

CREATE INDEX IF NOT EXISTS idx_customer_expert_guides_project_id 
    ON customer_expert_guides(project_id);

CREATE INDEX IF NOT EXISTS idx_customer_expert_guides_expert_type 
    ON customer_expert_guides(expert_type);

CREATE INDEX IF NOT EXISTS idx_expert_training_status_project_id 
    ON expert_training_status(project_id);

CREATE INDEX IF NOT EXISTS idx_expert_training_status_status 
    ON expert_training_status(training_status);

-- Create RLS policies (if RLS is enabled)
DO $$
BEGIN
    -- Enable RLS if not already enabled
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename = 'customer_codebase_analysis'
    ) THEN
        ALTER TABLE customer_codebase_analysis ENABLE ROW LEVEL SECURITY;
        ALTER TABLE customer_expert_guides ENABLE ROW LEVEL SECURITY;
        ALTER TABLE expert_training_status ENABLE ROW LEVEL SECURITY;

        -- Policies for customer_codebase_analysis
        CREATE POLICY "Users can view own organization's analysis"
            ON customer_codebase_analysis FOR SELECT
            USING (
                project_id IN (
                    SELECT id FROM projects 
                    WHERE organization_id IN (
                        SELECT organization_id FROM organization_members 
                        WHERE user_id = auth.uid()
                    )
                )
            );

        -- Policies for customer_expert_guides
        CREATE POLICY "Users can view own organization's expert guides"
            ON customer_expert_guides FOR SELECT
            USING (
                project_id IN (
                    SELECT id FROM projects 
                    WHERE organization_id IN (
                        SELECT organization_id FROM organization_members 
                        WHERE user_id = auth.uid()
                    )
                )
            );

        -- Policies for expert_training_status
        CREATE POLICY "Users can view own organization's training status"
            ON expert_training_status FOR SELECT
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

-- Add comments for documentation
COMMENT ON TABLE customer_codebase_analysis IS 'Stores codebase analysis results for customer projects';
COMMENT ON TABLE customer_expert_guides IS 'Stores customer-specific expert guides generated during onboarding';
COMMENT ON TABLE expert_training_status IS 'Tracks the status of expert training for each project';

COMMENT ON COLUMN customer_codebase_analysis.analysis_data IS 'Complete analysis results including all detected patterns';
COMMENT ON COLUMN customer_expert_guides.guide_content IS 'Full expert guide in structured format';
COMMENT ON COLUMN customer_expert_guides.quality_score IS 'Quality score from 0.00 to 1.00 based on guide completeness';


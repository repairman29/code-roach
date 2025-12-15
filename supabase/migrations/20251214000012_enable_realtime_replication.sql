-- Enable Realtime Replication
-- Enables Supabase Realtime for specified tables via PostgreSQL publications

-- =============================================
-- Enable Realtime Publication
-- =============================================

-- Create publication if it doesn't exist (using DO block since IF NOT EXISTS not supported)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
        CREATE PUBLICATION supabase_realtime;
        RAISE NOTICE 'Created supabase_realtime publication';
    ELSE
        RAISE NOTICE 'supabase_realtime publication already exists';
    END IF;
END $$;

-- =============================================
-- Set Replica Identity (Required for UPDATE/DELETE)
-- =============================================

-- Set replica identity to FULL for proper UPDATE/DELETE replication
ALTER TABLE code_roach_issues REPLICA IDENTITY FULL;
ALTER TABLE fix_review_queue REPLICA IDENTITY FULL;
ALTER TABLE game_sessions REPLICA IDENTITY FULL;
ALTER TABLE player_actions REPLICA IDENTITY FULL;

-- =============================================
-- Add Tables to Realtime Publication
-- =============================================

-- Code Quality Feed
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'code_roach_issues'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE code_roach_issues;
        RAISE NOTICE 'Added code_roach_issues to publication';
    END IF;
END $$;

-- Fix Review Queue
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'fix_review_queue'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE fix_review_queue;
        RAISE NOTICE 'Added fix_review_queue to publication';
    END IF;
END $$;

-- Game State (Real-time sync)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'game_sessions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE game_sessions;
        RAISE NOTICE 'Added game_sessions to publication';
    END IF;
END $$;

-- Player Actions (Optional - for analytics)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables 
        WHERE pubname = 'supabase_realtime' AND tablename = 'player_actions'
    ) THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE player_actions;
        RAISE NOTICE 'Added player_actions to publication';
    END IF;
END $$;

-- =============================================
-- Verify Realtime is Enabled
-- =============================================

-- Check publication exists
DO $$
DECLARE
    pub_exists BOOLEAN;
    table_count INTEGER;
BEGIN
    -- Check if publication exists
    SELECT EXISTS (
        SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime'
    ) INTO pub_exists;
    
    IF pub_exists THEN
        -- Count tables in publication
        SELECT COUNT(*) INTO table_count
        FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime';
        
        RAISE NOTICE '✅ Realtime publication exists with % tables', table_count;
    ELSE
        RAISE WARNING '⚠️  Realtime publication not found';
    END IF;
END $$;

-- =============================================
-- Comments
-- =============================================

COMMENT ON PUBLICATION supabase_realtime IS 'Supabase Realtime publication for live updates on code quality, game state, and reviews';

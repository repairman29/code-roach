# Code Roach - Database Migration Guide

**Last Updated:** December 15, 2025

---

## 📋 New Services Migration

The new services migration (`20251215000000_new_services_schema.sql`) adds support for all 12 new Code Roach services.

### **What It Adds:**

1. **Fix Monitoring Table** - Tracks applied fixes in real-time
2. **Fix Pipelines Table** - Stores orchestration pipeline data
3. **Pattern Ratings Table** - Marketplace pattern ratings
4. **Team Preferences Table** - Team-specific preferences
5. **Quality Metrics History Table** - Historical quality metrics
6. **Additional Columns** - Adds `project_id`, `shared`, `shared_at` to patterns table

---

## 🚀 Running the Migration

### **Method 1: Via CLI (Recommended)**

```bash
# Run new services migration
code-roach-saas db --migrate new-services

# Or run all migrations
code-roach-saas db --migrate
```

**Requirements:**
- `SUPABASE_DB_PASSWORD` set in `.env`
- Get password from: Supabase Dashboard → Settings → Database → Connection string

### **Method 2: Via Script**

```bash
# Set database password first
export SUPABASE_DB_PASSWORD=your_password

# Run migration
node scripts/run-migration-via-config.js
```

### **Method 3: Via Supabase Dashboard (Manual)**

1. Go to: https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** in the left sidebar
4. Click **"New query"**
5. Copy the SQL from: `supabase/migrations/20251215000000_new_services_schema.sql`
6. Paste into the editor
7. Click **"Run"** (or press Cmd/Ctrl + Enter)

### **Method 4: Via Supabase CLI**

```bash
# If project is linked
supabase db push

# Or with connection string
supabase db push --db-url "postgresql://postgres:[password]@[host]:5432/postgres"
```

---

## ✅ Verification

After running the migration, verify tables were created:

```sql
-- Check new tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'code_roach_fix_monitoring',
    'code_roach_fix_pipelines',
    'code_roach_pattern_ratings',
    'code_roach_team_preferences',
    'code_roach_quality_metrics_history'
)
ORDER BY table_name;

-- Check new columns in patterns table
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'code_roach_patterns' 
AND column_name IN ('project_id', 'shared', 'shared_at');
```

---

## 🔧 Troubleshooting

### **"Database password not found"**
- Set `SUPABASE_DB_PASSWORD` in `.env`
- Get it from Supabase Dashboard → Settings → Database

### **"Connection failed"**
- Check your Supabase URL is correct in config
- Verify database password is correct
- Try manual migration via dashboard

### **"Table already exists"**
- Migration uses `CREATE TABLE IF NOT EXISTS` - safe to run multiple times
- If you get errors, tables may already exist (this is OK)

### **"Permission denied"**
- Ensure you're using the service role key
- Check RLS policies are set correctly

---

## 📝 Migration File

**Location:** `supabase/migrations/20251215000000_new_services_schema.sql`

**Safe to run multiple times:** ✅ Yes (uses IF NOT EXISTS)

---

## 🎯 Next Steps

After migration:
1. ✅ Verify tables were created
2. ✅ Test new services
3. ✅ Check API endpoints work
4. ✅ Verify frontend can access new data

---

**Need help?** Check the migration file or run it manually via Supabase Dashboard.

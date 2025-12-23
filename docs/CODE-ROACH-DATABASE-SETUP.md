# Code Roach Database Setup

**Status:** ⚠️ Migrations Need to Be Applied

## Current Status

All 13 Code Roach database tables are **missing** and need to be created.

## Quick Setup

### Option 1: Supabase Dashboard (Recommended - Easiest)

1. **Go to Supabase Dashboard**
   - Visit: https://supabase.com/dashboard
   - Select your project

2. **Open SQL Editor**
   - Click "SQL Editor" in the left sidebar
   - Click "New query"

3. **Run Migration**
   - Open the file: `supabase/code_roach_combined_migration.sql`
   - Copy all the SQL
   - Paste into SQL Editor
   - Click "Run" (or press Cmd/Ctrl + Enter)

4. **Verify**
   ```bash
   node scripts/check-code-roach-tables.js
   ```
   Should show all tables as ✅

### Option 2: Supabase CLI

```bash
# If project is linked
supabase db push

# OR apply specific migrations
supabase migration up
```

### Option 3: psql (Direct Database Access)

```bash
# If you have DATABASE_URL in .env
psql $DATABASE_URL < supabase/code_roach_combined_migration.sql
```

## Required Tables

After applying migrations, these tables should exist:

1. ✅ `code_roach_issues` - Main issues table
2. ✅ `code_roach_patterns` - Error patterns
3. ✅ `code_roach_fix_learning` - Learning data
4. ✅ `code_roach_file_health` - File health tracking
5. ✅ `code_roach_cursor_rules` - Cursor rules
6. ✅ `code_roach_rule_effectiveness` - Rule effectiveness
7. ✅ `code_roach_quality_improvements` - Quality improvements
8. ✅ `code_roach_expertise` - Expertise tracking
9. ✅ `code_roach_file_cache` - File cache
10. ✅ `projects` - Projects (SaaS)
11. ✅ `organizations` - Organizations (SaaS)
12. ✅ `code_roach_fixes` - Fixes (SaaS)
13. ✅ `code_roach_analytics` - Analytics (SaaS)

## Verification

After applying migrations, verify with:

```bash
node scripts/check-code-roach-tables.js
```

All tables should show ✅ with record counts.

## Migration Files

The combined migration includes:
- `20251213213917_code_roach_schema.sql` - Core schema
- `20251213_code_roach_saas.sql` - SaaS tables
- `20251214173708_code_roach_saas.sql` - Additional SaaS
- `20251214174751_code_roach_saas.sql` - More SaaS
- `20251214174943_code_roach_saas.sql` - More SaaS
- `20251216011144_code_roach_saas.sql` - Latest SaaS
- `20250114000000_code_roach_expertise.sql` - Expertise
- `20251214005941_code_roach_expertise.sql` - Expertise update
- `20251214075923_code_roach_expertise.sql` - Expertise update
- `20250115000000_code_roach_expert_training.sql` - Expert training

## Troubleshooting

### "Table already exists" errors
- Migrations use `CREATE TABLE IF NOT EXISTS` - safe to re-run
- Some migrations alter existing tables - also safe

### Connection errors
- Verify `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` in `.env`
- Check Supabase project is active

### Permission errors
- Ensure using service role key (not anon key)
- Check RLS policies if needed

## Next Steps

After tables are created:
1. ✅ Code Roach can store issues
2. ✅ Learning system can persist data
3. ✅ Analytics can track metrics
4. ✅ All Code Roach features will work


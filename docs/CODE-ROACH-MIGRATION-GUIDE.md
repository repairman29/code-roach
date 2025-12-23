# Code Roach Migration Guide

**Problem:** Large migration file causes connection timeout  
**Solution:** Apply in smaller batches or use essential tables first

## Quick Start - Essential Tables Only

If you just need Code Roach to work, apply the minimal migration:

1. **Open Supabase Dashboard > SQL Editor**
2. **Open file:** `supabase/code_roach_essential_tables.sql`
3. **Copy and paste into SQL Editor**
4. **Run** (should complete in < 5 seconds)

This creates the 4 core tables needed for basic functionality:
- ✅ `code_roach_issues` - Store issues
- ✅ `code_roach_patterns` - Store patterns
- ✅ `code_roach_file_health` - Track file health
- ✅ `code_roach_file_cache` - Cache file hashes

## Full Migration - Apply in Batches

For complete functionality, apply the full migration in batches:

### Batch Files Location
```
supabase/migrations-batches/
```

### Apply Batches One at a Time

1. **Batch 1** (Core Schema - 330 lines)
   - File: `01_batch_01_20251213213917_code_roach_schema_sql.sql`
   - Apply this first
   - Creates core tables and indexes

2. **Batch 2-11** (SaaS Tables)
   - Apply sequentially
   - Each batch is ~300-450 lines
   - Creates organizations, projects, and enhanced tables

3. **Batch 12-14** (Expertise Tables)
   - Apply sequentially
   - Creates expertise tracking

4. **Batch 15-16** (Expert Training)
   - Apply sequentially
   - Creates expert training tables

### Batch Application Process

For each batch:
1. Open Supabase Dashboard > SQL Editor
2. Open the batch file
3. Copy SQL
4. Paste into SQL Editor
5. Click "Run"
6. Wait for "Success"
7. **Verify:** `node scripts/check-code-roach-tables.js`
8. Move to next batch

### Tips to Avoid Timeouts

1. **Apply one batch at a time** - Don't combine batches
2. **Wait for completion** - Don't start next batch until previous completes
3. **Check after each batch** - Verify tables were created
4. **If timeout occurs:**
   - Wait 30 seconds
   - Try the same batch again (uses `IF NOT EXISTS` - safe to retry)
   - If still failing, try splitting that batch further

## Verification

After applying batches, verify with:

```bash
node scripts/check-code-roach-tables.js
```

Expected output:
```
✅ code_roach_issues: 0 records
✅ code_roach_patterns: 0 records
✅ code_roach_file_health: 0 records
✅ code_roach_file_cache: 0 records
... (all 13 tables should show ✅)
```

## Troubleshooting

### Connection Timeout
- **Cause:** Migration too large or complex
- **Fix:** Use essential tables first, then apply batches

### "Table already exists" errors
- **Safe to ignore** - Migrations use `IF NOT EXISTS`
- Tables are idempotent

### "Column already exists" errors
- **Safe to ignore** - Migrations check before adding columns
- Indicates partial migration was applied

### Missing tables after batch
- Check which batch failed
- Re-run that specific batch
- Verify with checker script

## Recommended Approach

**For Quick Setup:**
1. Apply `code_roach_essential_tables.sql` (4 core tables)
2. Test Code Roach functionality
3. Apply full batches later if needed

**For Complete Setup:**
1. Apply batches 1-16 sequentially
2. Verify after each batch
3. Test full functionality

## Batch File List

```
01_batch_01_20251213213917_code_roach_schema_sql.sql (330 lines)
01_batch_02_20251213_code_roach_saas_sql.sql (2 lines - header only)
01_batch_03_20251213_code_roach_saas_sql.sql (451 lines)
01_batch_04_20251214173708_code_roach_saas_sql.sql (2 lines - header only)
01_batch_05_20251213_code_roach_saas_sql.sql (288 lines)
01_batch_06_20251214174751_code_roach_saas_sql.sql (2 lines - header only)
01_batch_07_20251213_code_roach_saas_sql.sql (288 lines)
01_batch_08_20251214174943_code_roach_saas_sql.sql (2 lines - header only)
01_batch_09_20251213_code_roach_saas_sql.sql (288 lines)
01_batch_10_20251216011144_code_roach_saas_sql.sql (2 lines - header only)
01_batch_11_20251213_code_roach_saas_sql.sql (451 lines)
01_batch_12_20250114000000_code_roach_expertise_sql.sql (48 lines)
01_batch_13_20251214005941_code_roach_expertise_sql.sql (49 lines)
01_batch_14_20251214075923_code_roach_expertise_sql.sql (50 lines)
01_batch_15_20250115000000_code_roach_expert_training_sql.sql (2 lines - header only)
01_batch_16_20250115000000_code_roach_expert_training_sql.sql (155 lines)
```

**Note:** Batches with only 2 lines are just headers - you can skip those or combine with the next batch.

# Code Roach Migration - Quick Start

**Migration:** New Services Schema (December 2025)

---

## ⚡ Fastest Method

### **Via Supabase Dashboard (2 minutes)**

1. Open: https://supabase.com/dashboard
2. Select your project
3. Click **"SQL Editor"** → **"New query"**
4. Copy entire contents of: `supabase/migrations/20251215000000_new_services_schema.sql`
5. Paste and click **"Run"**

✅ Done!

---

## 🔧 Automated Method

### **Step 1: Get Database Password**

1. Go to Supabase Dashboard → Settings → Database
2. Find "Connection string" section
3. Copy the password (or reset it if needed)

### **Step 2: Set Environment Variable**

Add to `.env`:

```bash
SUPABASE_DB_PASSWORD=your_database_password_here
```

### **Step 3: Run Migration**

```bash
node scripts/run-migration-via-config.js
```

---

## ✅ Verify It Worked

Run this in Supabase SQL Editor:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name LIKE 'code_roach_%'
ORDER BY table_name;
```

You should see the 5 new tables:

- `code_roach_fix_monitoring`
- `code_roach_fix_pipelines`
- `code_roach_pattern_ratings`
- `code_roach_team_preferences`
- `code_roach_quality_metrics_history`

---

**That's it!** Your new services are ready to use. 🎉

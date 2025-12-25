# Code Roach Project ID Setup Guide

## Overview

Project IDs are used to associate issues with specific projects in Code Roach. Without a project ID, issues are still detected but won't be stored in the database.

## Current Status

✅ **Your project ID is set**: `8b3442e1-3198-4d08-9d05-69ce49b8a051`

This project ID is configured in your `.env` file as `DEFAULT_PROJECT_ID`.

## Methods to Set Up Project ID

### Method 1: Automatic Setup (Recommended)

Run the setup script to automatically create a project and configure it:

```bash
node scripts/enable-code-roach-all.js
```

This script will:

- Create an organization "Smugglers" (if it doesn't exist)
- Create a project "Smugglers Main" (if it doesn't exist)
- Set `DEFAULT_PROJECT_ID` in your `.env` file
- Enable all Code Roach features

### Method 2: Manual Setup via UI

1. **Go to Projects Page**: `http://localhost:3000/code-roach-projects`

2. **Create Organization** (if needed):
   - Click "➕ New" button next to the organization dropdown
   - Enter organization name and slug
   - Click "Create"

3. **Create Project**:
   - Select an organization from the dropdown
   - Click "Create Project" button
   - Fill in project details:
     - Name: e.g., "Smugglers Main"
     - Slug: e.g., "smugglers-main"
     - Repository URL (optional)
   - Click "Create"

4. **Copy Project ID**:
   - The project ID is displayed on the project card
   - Copy the ID (it looks like: `8b3442e1-3198-4d08-9d05-69ce49b8a051`)

5. **Set in .env**:

   ```bash
   echo "DEFAULT_PROJECT_ID=your-project-id-here" >> .env
   ```

6. **Restart Server**:
   ```bash
   npm run dev
   ```

### Method 3: Manual .env Configuration

1. **Get Project ID** from the database or UI
2. **Add to .env**:
   ```bash
   DEFAULT_PROJECT_ID=your-project-id-here
   ```
3. **Restart Server**

### Method 4: Pass Project ID in API Calls

When calling the `/api/code-roach/crawl` endpoint, you can pass `projectId` in the request body:

```javascript
const response = await fetch("/api/code-roach/crawl", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    projectId: "your-project-id-here",
    options: {
      autoFix: true,
    },
  }),
});
```

## How Project ID is Used

### 1. **File Watcher**

- Uses `DEFAULT_PROJECT_ID` from `.env`
- Stores issues with this project ID when files change
- Location: `server/server.js` (lines ~1277-1300)

### 2. **Autonomous Mode**

- Uses `DEFAULT_PROJECT_ID` from `.env`
- Automatically scans and stores issues for this project
- Location: `server/server.js` (lines ~1310-1340)

### 3. **Scheduled Scans**

- Uses `DEFAULT_PROJECT_ID` from `.env`
- Runs daily scans and stores issues for this project
- Location: `server/server.js` (lines ~1350-1370)

### 4. **Manual Crawls**

- Can pass `projectId` in API request body
- Or uses `DEFAULT_PROJECT_ID` if not provided
- Location: `server/routes/codeRoachAPI.js` (line ~64)

## Verifying Project ID Setup

### Check .env File:

```bash
grep DEFAULT_PROJECT_ID .env
```

### Check Database:

```bash
node -e "
const {createClient} = require('@supabase/supabase-js');
const config = require('./server/config');
const supabase = createClient(config.supabase.url, config.supabase.serviceRoleKey);
supabase.from('projects').select('id, name').then(({data}) => {
    console.log('Projects:', data);
});
"
```

### Check Issues Page:

- Go to `http://localhost:3000/code-roach-issues?project=your-project-id`
- Issues should be filtered by project ID

## Troubleshooting

### Issue: "Issues not being stored"

**Problem**: Issues are detected but not saved to database.

**Solution**:

1. Check if `DEFAULT_PROJECT_ID` is set in `.env`
2. Verify the project ID exists in the database
3. Restart the server after setting `DEFAULT_PROJECT_ID`

### Issue: "Dashboard shows more issues than database"

**Problem**: Dashboard shows crawl stats (issues found during scan) but database has fewer issues.

**Solution**:

- This happens when scans run without a `projectId`
- Ensure `DEFAULT_PROJECT_ID` is set before running scans
- Re-run scans with project ID to store all issues

### Issue: "Project ID not found"

**Problem**: Project ID in `.env` doesn't exist in database.

**Solution**:

1. Check projects in UI: `http://localhost:3000/code-roach-projects`
2. Create a new project if needed
3. Update `.env` with correct project ID
4. Restart server

## Best Practices

1. **Set DEFAULT_PROJECT_ID**: Always set this in `.env` for automated features
2. **Use One Project Per Codebase**: Create separate projects for different repositories
3. **Verify After Setup**: Check that issues are being stored with the correct project ID
4. **Restart After Changes**: Always restart the server after changing `DEFAULT_PROJECT_ID`

## Related Files

- **Project Management UI**: `public/code-roach-projects.html`
- **API Routes**: `server/routes/codeRoachAPI.js`
- **Server Setup**: `server/server.js` (file watcher, autonomous mode, scheduled scans)
- **Setup Script**: `scripts/enable-code-roach-all.js`
- **Issue Storage**: `server/services/issueStorageService.js`
- **Crawler**: `server/services/codebaseCrawler.js`

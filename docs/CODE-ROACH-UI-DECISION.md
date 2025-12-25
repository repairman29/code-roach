# Code Roach UI Decision - Admin-Only Visibility

## Decision: Completely Invisible to Regular Users

### Implementation

**For Regular Users:**

- ✅ Code Roach runs 100% invisibly in background
- ✅ No UI widget at all
- ✅ All errors fixed silently
- ✅ Only shows minimal toast notification for critical errors that can't be auto-fixed
- ✅ Zero visual clutter

**For Admins:**

- ✅ Full widget visible
- ✅ Access to dashboard at `/code-roach-dashboard`
- ✅ All controls and features
- ✅ Can see all errors, fixes, and analytics

### How It Works

1. **On Init:**
   - Checks if user is admin (admin_token, adminKey, or on admin page)
   - If admin: Shows full widget
   - If not admin: Hides widget completely

2. **Error Handling:**
   - Works identically for both users and admins
   - Errors are caught, analyzed, and fixed
   - Only difference: UI visibility

3. **Critical Errors (Non-Admin):**
   - If critical error can't be auto-fixed
   - Shows minimal toast notification
   - Non-intrusive, dismissible
   - Auto-dismisses after 10 seconds

### Benefits

1. **Better UX for Players**
   - No visual clutter
   - Clean interface
   - Focus on game, not debugging

2. **Still Gets All Benefits**
   - All errors still caught
   - All fixes still applied
   - All monitoring still active
   - Just invisible to user

3. **Admins Can Debug**
   - Full visibility when needed
   - Dashboard for analytics
   - Can see what's happening

4. **Professional**
   - Infrastructure should be invisible
   - Users don't need to know about error fixing
   - Like a good waiter - you don't see them working

### Admin Detection

Code Roach checks for admin status by:

1. `localStorage.getItem('admin_token')` or `adminKey`
2. `window.adminKey` exists
3. On admin dashboard page (`/admin` or `/admin-dashboard`)

### Critical Error Notifications

For non-admin users, only critical errors that can't be auto-fixed show a toast:

- Minimal, non-intrusive
- Bottom-right corner
- Auto-dismisses
- Can be manually dismissed
- Only for truly critical issues

### Dashboard Access

Admins can access full analytics at:

- `/code-roach-dashboard`
- Or via widget dashboard button (if widget visible)

---

**Result: Code Roach is now invisible infrastructure for users, full visibility for admins!** 🎯

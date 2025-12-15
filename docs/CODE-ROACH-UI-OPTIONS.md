# Code Roach UI Options - Admin vs User Visibility

## Current State
- Widget is visible to all users (even in silent mode)
- Silent mode just hides notifications
- Widget still appears on screen edge

## Options

### Option 1: Completely Invisible to Users (Recommended)
**For Regular Users:**
- ✅ Code Roach runs 100% invisibly in background
- ✅ No UI widget at all
- ✅ All errors fixed silently
- ✅ Only shows minimal toast notification for critical errors that can't be auto-fixed

**For Admins:**
- ✅ Full widget visible
- ✅ Access to dashboard
- ✅ All controls and features
- ✅ Can toggle visibility

**Benefits:**
- Clean UX for players
- No visual clutter
- Still gets all the benefits
- Admins can monitor/debug

### Option 2: Minimal Indicator Only
**For Regular Users:**
- ✅ Tiny, unobtrusive indicator (maybe just a dot)
- ✅ Only appears when errors are being fixed
- ✅ No details, just "system working" indicator
- ✅ Can be dismissed

**For Admins:**
- ✅ Full widget as above

### Option 3: Opt-In Visibility
**For Regular Users:**
- ✅ Hidden by default
- ✅ Can enable via settings if they want to see it
- ✅ Most users never see it

**For Admins:**
- ✅ Always visible

## Recommendation: Option 1

**Why:**
- Best user experience - players don't need to know about error fixing
- Code Roach should be invisible infrastructure
- Admins get full visibility for debugging
- Critical errors can still notify users if needed

## Implementation Plan

1. **Check if user is admin** on widget init
2. **If not admin:**
   - Hide widget completely
   - Run all functionality in background
   - Only show critical error notifications (toast-style)
3. **If admin:**
   - Show full widget
   - All features available
   - Dashboard access

## Critical Error Notifications (Users)

Even for regular users, we might want to show:
- Critical errors that can't be auto-fixed
- Game-breaking issues
- Data loss warnings

But these would be:
- Toast notifications (not widget)
- Dismissible
- Non-intrusive
- Only for truly critical issues


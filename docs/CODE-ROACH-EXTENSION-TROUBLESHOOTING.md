# Code Roach Extension Troubleshooting

## Command Palette Not Working?

If the "Show Issues Needing Review" command isn't appearing in Cursor's command palette, try these steps:

---

## Step 1: Verify Extension is Installed

### Check if Extension is Installed

1. Open Cursor
2. Go to Extensions view (`Cmd+Shift+X` or `Ctrl+Shift+X`)
3. Search for "Code Roach"
4. Check if it's installed and enabled

### If Not Installed

The extension is located at: `.vscode-extension/`

To install it:

```bash
cd /Users/jeffadkins/Smugglers/smugglers/.vscode-extension
code --install-extension code-roach-1.0.0.vsix
```

Or in Cursor:
1. Open Command Palette (`Cmd+Shift+P`)
2. Type: "Extensions: Install from VSIX..."
3. Navigate to `.vscode-extension/code-roach-1.0.0.vsix`
4. Select and install

---

## Step 2: Reload Cursor Window

After installing or updating the extension:

1. Open Command Palette (`Cmd+Shift+P`)
2. Type: "Developer: Reload Window"
3. Press Enter

This reloads the extension and registers all commands.

---

## Step 3: Check Command Registration

### Try Different Search Terms

In Command Palette, try searching for:
- `Code Roach`
- `Show Issues`
- `Issues Review`
- `codeRoach`

The command should appear as: **"Code Roach: Show Issues Needing Review"**

### Check All Commands

1. Open Command Palette (`Cmd+Shift+P`)
2. Type: `>Code Roach`
3. You should see all Code Roach commands:
   - Code Roach: Analyze File with Code Roach
   - Code Roach: Show Code Health Score
   - Code Roach: Auto-Fix Errors
   - Code Roach: Ask Code Roach (Natural Language)
   - Code Roach: Scan Workspace (Crawl All Files)
   - Code Roach: Open Code Roach Dashboard (Review Issues)
   - **Code Roach: Show Issues Needing Review** ← This one!

---

## Step 4: Check Extension Activation

### Check Extension Logs

1. Open Command Palette (`Cmd+Shift+P`)
2. Type: "Developer: Show Logs"
3. Select: "Extension Host"
4. Look for "Code Roach" messages

### Check for Errors

1. Open Command Palette (`Cmd+Shift+P`)
2. Type: "Developer: Toggle Developer Tools"
3. Check Console tab for errors

---

## Step 5: Verify Server is Running

The extension needs the Code Roach server to be running:

```bash
# Check if server is running
curl http://localhost:3000/health

# If not running, start it
npm start
```

---

## Step 6: Check Extension Configuration

1. Open Settings (`Cmd+,` or `Ctrl+,`)
2. Search for "Code Roach"
3. Verify:
   - `codeRoach.serverUrl` is set to `http://localhost:3000`
   - Extension is enabled

---

## Step 7: Rebuild Extension (If Needed)

If the extension still doesn't work:

```bash
cd /Users/jeffadkins/Smugglers/smugglers/.vscode-extension
npm install
npm run compile
```

Then reinstall the extension.

---

## Alternative: Use CLI or Dashboard

If the extension still doesn't work, you can use:

### CLI Method
```bash
npm run code-roach issues --review
```

### Dashboard Method
Open: `http://localhost:3000/code-roach-dashboard`

### API Method
```bash
curl http://localhost:3000/api/code-roach/issues/review
```

---

## Quick Fix Checklist

- [ ] Extension is installed
- [ ] Extension is enabled
- [ ] Cursor window has been reloaded
- [ ] Server is running (`http://localhost:3000`)
- [ ] Configuration is correct
- [ ] No errors in Extension Host logs
- [ ] Tried searching for "Code Roach" in command palette

---

## Still Not Working?

1. **Uninstall and reinstall** the extension
2. **Restart Cursor** completely
3. **Check Cursor version** - requires VS Code 1.80.0+
4. **Try manual command execution**:
   - Open Command Palette
   - Type: `>Code Roach: Show Issues Needing Review`
   - Or use the command ID directly: `codeRoach.showIssues`

---

## Manual Command Execution

If the command exists but doesn't show in palette, you can execute it directly:

1. Open Command Palette (`Cmd+Shift+P`)
2. Type: `>codeRoach.showIssues`
3. Press Enter

This bypasses the title search and uses the command ID directly.


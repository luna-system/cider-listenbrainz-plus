# Debug Guide for ListenBrainz Plus Plugin

## Opening Electron Dev Tools in Cider

### Method 1: Keyboard Shortcuts (MOST COMMON)
- **Linux/Windows**: Press `Ctrl + Shift + I` or `F12`
- **macOS**: Press `Cmd + Option + I`

### Method 2: Via Cider Settings
1. Open Cider Settings
2. Go to "Experiments" or "Advanced" section
3. Look for "Enable Developer Mode" or similar option
4. Once enabled, dev tools keyboard shortcuts should work

### Method 3: Menu (if available)
- Look for View → Toggle Developer Tools in the Cider menu
- On macOS: Check the View menu in the top menu bar
- On Windows/Linux: Look for hamburger menu or View menu

### Method 4: Command Line (if running from source)
```bash
# If you built Cider from source
npm start -- --enable-logging

# Or with additional debug flags
npm start -- --enable-logging --remote-debugging-port=9222
```

### Method 5: Modify Cider Launch
If you have access to Cider's main process:
- Add `mainWindow.webContents.openDevTools()` in the main.js/main.ts file
- Restart Cider

### Method 6: External Chrome DevTools
If remote debugging is enabled:
1. Start Cider with `--remote-debugging-port=9222`
2. Open Chrome/Chromium browser
3. Go to `chrome://inspect`
4. Click "Configure" and add `localhost:9222`
5. Your Cider window should appear in the list

## Viewing Plugin Logs

Once dev tools are open:

1. **Console Tab**: All our `console.log` statements appear here
2. **Look for these messages**:
   - `[ListenBrainz+] Plugin setup() called` - Plugin loaded
   - `[ListenBrainz+] Initializing scrobble queue...` - Queue starting
   - `[ListenBrainz+] Queue size: X` - Queue initialized
   - `[ScrobbleQueue] Constructor called` - Queue being created
   - `[ListenBrainz+] Getting MusicKit API...` - MusicKit access
   - `[ListenBrainz+] Setting up MusicKit listeners...` - Event listeners attached

3. **Red errors mean**:
   - Missing dependency
   - Syntax error in built code
   - API not available

## Common Issues

### Plugin doesn't load at all
- Check Console for JavaScript errors
- Verify plugin is in correct directory
- Check `plugin.yml` is present

### Plugin loads but no scrobbles
- Check Settings: Token entered? Scrobbling enabled?
- Check Console for `[ListenBrainz+]` messages
- Open "ListenBrainz Plus Advanced" page from menu to see detailed status

### Queue errors
- Check Console for `[ScrobbleQueue]` messages
- Check localStorage in Application tab: look for `de.airsi.listenbrainz-plus/queue/v1`

## Manual Console Testing

Once dev tools are open, you can test the plugin manually:

```javascript
// Check if plugin loaded
console.log(window.__CIDER_PLUGINS__)

// Check localStorage
console.log(localStorage.getItem('de.airsi.listenbrainz-plus/settings/v1'))
console.log(localStorage.getItem('de.airsi.listenbrainz-plus/queue/v1'))

// Check MusicKit
console.log(MusicKit.getInstance())
```

## Deploy and Test

After building:
```bash
pnpm deploy-dev
```

Then restart Cider and open dev tools immediately to catch any early errors.

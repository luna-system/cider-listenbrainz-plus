# Plugin Loading Issue - FIXED ✓

## Problem
Cider was looking for the plugin at the old identifier:
- `plugins/de.airsi.cider-listenbrainz-plus/` ❌

But the plugin was deployed to:
- `plugins/de.airsi.listenbrainz-plus/` ✓

## Root Cause
When we renamed the plugin from `de.airsi.cider-listenbrainz-plus` to `de.airsi.listenbrainz-plus`, the old identifier remained registered in Cider's config file.

## What Was Fixed
1. ✓ Removed old plugin directory: `~/.config/sh.cider.genten/de.airsi.cider-listenbrainz-plus/`
2. ✓ Removed old plugin entry from: `~/.config/sh.cider.genten/spa-config.yml`
3. ✓ Verified new plugin is in correct location: `~/.config/sh.cider.genten/plugins/de.airsi.listenbrainz-plus/`

## Next Steps
1. **Restart Cider completely** (close and relaunch)
2. Open Dev Tools (Ctrl+Shift+I)
3. Look for these success messages:
   - `[ListenBrainz+] Plugin setup() called`
   - `[ListenBrainz+] Initializing scrobble queue...`
   - `[ListenBrainz+] Queue size: 0`
   - `[ListenBrainz+] Getting MusicKit API...`
   - `[ListenBrainz+] Setting up MusicKit listeners...`

## Verify Plugin Loaded
After restart, in the Console:
```javascript
Object.keys(window.__CIDER_PLUGINS__ || {})
// Should include: "de.airsi.listenbrainz-plus"
```

## If Still Not Working
Check for error messages in Console that start with `[ListenBrainz+]` or any red errors mentioning our plugin.

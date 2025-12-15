# Diagnostic Commands for Electron Dev Tools Console

Run these commands in the Cider dev tools Console (Ctrl+Shift+I) to diagnose the multiple plugin copies issue:

## 1. Check Loaded Plugins
```javascript
// See all loaded plugins
console.log('Loaded plugins:', Object.keys(window.__CIDER_PLUGINS__ || {}));

// Count how many times our plugin appears
const ourPlugins = Object.keys(window.__CIDER_PLUGINS__ || {}).filter(k => k.includes('listenbrainz'));
console.log('ListenBrainz plugins found:', ourPlugins.length, ourPlugins);

// Check full plugin details
console.log('Plugin details:', window.__CIDER_PLUGINS__);
```

## 2. Check Custom Elements
```javascript
// See if custom elements are registered multiple times
const elements = ['listenbrainz-plus-settings', 'listenbrainz-plus-status-dropdown', 'listenbrainz-plus-page-advanced'];
elements.forEach(el => {
  console.log(`${el}:`, customElements.get(el) ? 'registered' : 'not registered');
});
```

## 3. Check Plugin Store State
```javascript
// Access Cider's plugin store (if available)
if (window.$pinia) {
  const stores = window.$pinia._s;
  console.log('Pinia stores:', Array.from(stores.keys()));
  
  // Look for plugin-related stores
  const pluginStores = Array.from(stores.keys()).filter(k => k.includes('plugin'));
  console.log('Plugin stores:', pluginStores);
}
```

## 4. Check for Duplicate Menu Items
```javascript
// Check main menu entries
const menu = document.querySelector('.main-menu');
if (menu) {
  const menuItems = Array.from(menu.querySelectorAll('[data-label], .menu-item'));
  const listenbrainzItems = menuItems.filter(el => 
    el.textContent.toLowerCase().includes('listenbrainz')
  );
  console.log('ListenBrainz menu items:', listenbrainzItems.length, listenbrainzItems.map(el => el.textContent));
}
```

## 5. Check Chrome Buttons
```javascript
// Check for duplicate chrome buttons (music note icons)
const chromeButtons = document.querySelectorAll('[data-custom-button], .chrome-button');
const musicNotes = Array.from(chromeButtons).filter(el => el.textContent.includes('🎵'));
console.log('Music note buttons found:', musicNotes.length, musicNotes);
```

## 6. Export All Plugin Info
```javascript
// Create a comprehensive diagnostic report
const diagnostics = {
  timestamp: new Date().toISOString(),
  pluginKeys: Object.keys(window.__CIDER_PLUGINS__ || {}),
  customElements: [
    'listenbrainz-plus-settings',
    'listenbrainz-plus-status-dropdown', 
    'listenbrainz-plus-page-advanced'
  ].map(el => ({ name: el, registered: !!customElements.get(el) })),
  chromeButtons: document.querySelectorAll('[title="ListenBrainz Status"]').length,
  menuItems: document.querySelectorAll('[onclick*="listenbrainz"], [data-label*="ListenBrainz"]').length,
};

console.log('=== DIAGNOSTIC REPORT ===');
console.log(JSON.stringify(diagnostics, null, 2));
console.log('=== END REPORT ===');

// Copy to clipboard if possible
if (navigator.clipboard) {
  navigator.clipboard.writeText(JSON.stringify(diagnostics, null, 2));
  console.log('✓ Copied to clipboard');
}
```

## What to Share

After running the commands above, please share:
1. The output from command #1 (how many plugins are registered)
2. The output from command #5 (how many music note buttons)
3. The full diagnostic report from command #6
4. A screenshot of the Cider plugins list showing multiple copies

## Expected Behavior
- `Object.keys(window.__CIDER_PLUGINS__)` should show our plugin **once**
- Each custom element should be registered **once**
- There should be **one** music note button
- There should be **one** menu item "ListenBrainz Plus Advanced"

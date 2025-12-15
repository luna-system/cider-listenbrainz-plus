#!/bin/bash

# Script to verify ListenBrainz Plus plugin installation

PLUGIN_DIR="$HOME/.config/sh.cider.genten/plugins/de.airsi.listenbrainz-plus"

echo "=== ListenBrainz Plus Plugin Installation Check ==="
echo ""

if [ -d "$PLUGIN_DIR" ]; then
    echo "✓ Plugin directory exists: $PLUGIN_DIR"
    echo ""
    echo "Files in plugin directory:"
    ls -lh "$PLUGIN_DIR"
    echo ""
    
    if [ -f "$PLUGIN_DIR/plugin.yml" ]; then
        echo "✓ plugin.yml found"
        echo "Contents:"
        cat "$PLUGIN_DIR/plugin.yml"
        echo ""
    else
        echo "✗ plugin.yml NOT FOUND - Plugin will not load!"
    fi
    
    if [ -f "$PLUGIN_DIR/plugin.js" ]; then
        echo "✓ plugin.js found"
        SIZE=$(stat -f%z "$PLUGIN_DIR/plugin.js" 2>/dev/null || stat -c%s "$PLUGIN_DIR/plugin.js" 2>/dev/null)
        echo "  Size: $SIZE bytes"
        
        # Check for syntax errors
        if node -c "$PLUGIN_DIR/plugin.js" 2>/dev/null; then
            echo "  ✓ JavaScript syntax is valid"
        else
            echo "  ✗ JavaScript has syntax errors!"
        fi
    else
        echo "✗ plugin.js NOT FOUND - Plugin will not load!"
    fi
    
    echo ""
    JS_FILES=$(find "$PLUGIN_DIR" -name "*.js" -type f | wc -l)
    echo "JavaScript files found: $JS_FILES"
    if [ "$JS_FILES" -lt 3 ]; then
        echo "  ⚠ Warning: Expected at least 3 JS files (plugin.js, main-*.js, scrobbleQueue-*.js)"
        echo "  Missing chunk files will cause loading failures!"
    else
        echo "  ✓ All required JavaScript chunks present"
        find "$PLUGIN_DIR" -name "*.js" -type f -exec basename {} \; | sed 's/^/    - /'
    fi
    
    echo ""
    echo "=== Troubleshooting Steps ==="
    echo "1. Restart Cider completely (quit and relaunch)"
    echo "2. Open Dev Tools with Ctrl+Shift+I (Linux/Win) or Cmd+Option+I (Mac)"
    echo "3. Check Console tab for errors starting with:"
    echo "   - [ListenBrainz+]"
    echo "   - [ScrobbleQueue]"
    echo "4. Look for any red error messages"
    echo ""
    echo "If dev tools won't open, see DEBUG.md for alternative methods"
    
else
    echo "✗ Plugin directory NOT FOUND: $PLUGIN_DIR"
    echo ""
    echo "Run 'pnpm deploy-dev' to install the plugin"
fi

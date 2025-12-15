#!/bin/bash

# Script to safely reset Cider plugin state while preserving settings

CIDER_CONFIG="$HOME/.config/sh.cider.genten"
BACKUP_DIR="$HOME/.config/sh.cider.genten.backup.$(date +%Y%m%d_%H%M%S)"

echo "=== Cider Plugin State Reset ==="
echo ""

# Step 1: Backup current config
echo "1. Creating backup..."
cp -r "$CIDER_CONFIG" "$BACKUP_DIR"
echo "   ✓ Backed up to: $BACKUP_DIR"
echo ""

# Step 2: Save your ListenBrainz token
echo "2. Your ListenBrainz Plus settings:"
SETTINGS=$(cat "$CIDER_CONFIG/spa-config.yml" | grep -A5 "de.airsi.listenbrainz-plus:")
echo "$SETTINGS"
echo ""

# Step 3: Clear just the plugin cache (safer than full reset)
echo "3. Choose an option:"
echo "   a) Clear only plugin state (RECOMMENDED)"
echo "   b) Full config reset (nuclear option)"
echo ""
read -p "Enter choice (a/b): " choice

if [ "$choice" = "a" ]; then
    echo ""
    echo "Clearing plugin state only..."
    
    # Remove plugin directory
    rm -rf "$CIDER_CONFIG/plugins/de.airsi.listenbrainz-plus"
    echo "   ✓ Removed plugin directory"
    
    # Remove from config (but preserve settings)
    sed -i.bak '/^plugins:/,/^[^ ]/ {
        /de.airsi.listenbrainz-plus:/,/^  [a-z]/ {
            /de.airsi.listenbrainz-plus:/d
            /^    /d
        }
    }' "$CIDER_CONFIG/spa-config.yml"
    echo "   ✓ Cleared plugin from config"
    
    echo ""
    echo "Now run: pnpm deploy-dev"
    echo "Then restart Cider for a clean plugin installation"
    
elif [ "$choice" = "b" ]; then
    echo ""
    echo "⚠️  WARNING: This will reset ALL Cider settings!"
    read -p "Are you sure? (yes/no): " confirm
    
    if [ "$confirm" = "yes" ]; then
        mv "$CIDER_CONFIG" "${CIDER_CONFIG}.old"
        echo "   ✓ Moved old config to: ${CIDER_CONFIG}.old"
        echo ""
        echo "Restart Cider - it will create a fresh config"
        echo "You'll need to reconfigure everything!"
    else
        echo "   Cancelled"
    fi
else
    echo "Invalid choice, cancelled"
fi

echo ""
echo "Backup location: $BACKUP_DIR"

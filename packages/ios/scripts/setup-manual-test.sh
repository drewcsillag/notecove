#!/bin/bash
# Setup script for manual cross-platform testing
# This creates a shared directory that both iOS and Desktop can access

set -e

echo "🔧 Setting up manual cross-platform test environment"
echo ""

# Find booted simulator
SIMULATOR_ID=$(xcrun simctl list devices booted | grep "iPhone" | head -1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')

if [ -z "$SIMULATOR_ID" ]; then
  echo "❌ No booted iPhone simulator found"
  echo "   Please boot a simulator first"
  exit 1
fi

# Get app container
APP_CONTAINER=$(xcrun simctl get_app_container "$SIMULATOR_ID" com.notecove.NoteCove data 2>/dev/null)

if [ -z "$APP_CONTAINER" ]; then
  echo "❌ NoteCove app not installed in simulator"
  echo "   Please run the app from Xcode first to install it"
  exit 1
fi

# Create shared directory in app's Documents
SHARED_DIR="$APP_CONTAINER/Documents/ManualTestStorage"
mkdir -p "$SHARED_DIR"

echo "✅ Created shared storage directory"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📱 FOR iOS APP (in app settings):"
echo "   Use this path: Documents/ManualTestStorage"
echo ""
echo "💻 FOR DESKTOP APP (paste this full path):"
echo "$SHARED_DIR"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "🔍 To browse in Finder:"
echo "   open '$SHARED_DIR'"
echo ""
echo "📝 NEXT STEPS:"
echo "1. In Desktop app: Add storage directory with the path above"
echo "2. Create some notes in Desktop"
echo "3. In iOS app: Add storage directory: Documents/ManualTestStorage"
echo "4. Verify you see the same notes!"
echo ""

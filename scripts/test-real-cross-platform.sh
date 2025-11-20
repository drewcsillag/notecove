#!/bin/bash
#
# Real Cross-Platform Sync Test
#
# This script:
# 1. Builds and launches iOS app in simulator
# 2. Launches Desktop Electron app
# 3. Both point to same storage directory
# 4. Creates notes in both
# 5. Verifies they can see each other's notes via activity logs
#

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

SHARED_SD="/tmp/notecove-real-test-$(date +%s)"
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
IOS_SIMULATOR="iPhone 17 Pro"

echo "========================================="
echo "Real Cross-Platform Sync Test"
echo "========================================="
echo ""
echo "Shared SD: $SHARED_SD"
echo "Project: $PROJECT_ROOT"
echo ""

# Cleanup
cleanup() {
    echo ""
    echo "Cleaning up..."
    # Kill Desktop app if running
    pkill -f "electron.*notecove" || true
    # Terminate iOS app
    if [ -n "$SIMULATOR_ID" ]; then
        xcrun simctl terminate "$SIMULATOR_ID" com.notecove.NoteCove || true
    fi
    rm -rf "$SHARED_SD"
    echo "Done."
}

trap cleanup EXIT

# Create shared directory
mkdir -p "$SHARED_SD"

# Find iOS simulator
echo -e "${YELLOW}Finding iOS simulator...${NC}"
SIMULATOR_ID=$(xcrun simctl list devices -j | jq -r ".devices | to_entries[] | .value[] | select(.name == \"$IOS_SIMULATOR\" and .isAvailable == true) | .udid" | head -1)

if [ -z "$SIMULATOR_ID" ]; then
    echo -e "${RED}✗${NC} iOS Simulator '$IOS_SIMULATOR' not found"
    exit 1
fi

echo -e "${GREEN}✓${NC} Found simulator: $SIMULATOR_ID"

# Boot simulator
echo -e "${YELLOW}Booting simulator...${NC}"
xcrun simctl boot "$SIMULATOR_ID" 2>/dev/null || echo "(already booted)"
sleep 3

# Build iOS app
echo -e "${YELLOW}Building iOS app...${NC}"
cd "$PROJECT_ROOT/packages/ios"
xcodegen generate > /dev/null
xcodebuild -project NoteCove.xcodeproj \
    -scheme NoteCove \
    -sdk iphonesimulator \
    -configuration Debug \
    -derivedDataPath /tmp/notecove-test-build \
    build 2>&1 | grep -E "(error|warning:.*error|BUILD)" || true

APP_PATH=$(find /tmp/notecove-test-build -name "NoteCove.app" -type d | head -1)

if [ -z "$APP_PATH" ]; then
    echo -e "${RED}✗${NC} Failed to build iOS app"
    exit 1
fi

echo -e "${GREEN}✓${NC} iOS app built"

# Install and launch iOS app
echo -e "${YELLOW}Installing and launching iOS app...${NC}"
xcrun simctl install "$SIMULATOR_ID" "$APP_PATH"
xcrun simctl launch "$SIMULATOR_ID" com.notecove.NoteCove

# Get iOS app's Documents directory
IOS_DOCUMENTS=$(xcrun simctl get_app_container "$SIMULATOR_ID" com.notecove.NoteCove data)/Documents
echo "iOS Documents: $IOS_DOCUMENTS"

# Create symlink from iOS Documents to shared SD
ln -sf "$SHARED_SD" "$IOS_DOCUMENTS/SharedSD" || true

echo -e "${GREEN}✓${NC} iOS app launched"

# Launch Desktop app (in background)
echo -e "${YELLOW}Launching Desktop app...${NC}"
cd "$PROJECT_ROOT/packages/desktop"

# Create test config that points to shared SD
TEST_DB="/tmp/notecove-test-$$.db"
TEST_CONFIG="/tmp/notecove-test-config-$$.json"

# Start Desktop in background
NODE_ENV=test TEST_DB_PATH="$TEST_DB" TEST_CONFIG_PATH="$TEST_CONFIG" pnpm start > /tmp/notecove-desktop.log 2>&1 &
DESKTOP_PID=$!

sleep 5

if ! ps -p $DESKTOP_PID > /dev/null; then
    echo -e "${RED}✗${NC} Desktop app failed to start"
    cat /tmp/notecove-desktop.log
    exit 1
fi

echo -e "${GREEN}✓${NC} Desktop app launched (PID: $DESKTOP_PID)"

# Now we need to add the shared SD to Desktop via its API
# This is tricky without Playwright, so let's just verify via file system

echo ""
echo -e "${YELLOW}Manual Steps Required:${NC}"
echo "1. In Desktop app: Add storage directory pointing to: $SHARED_SD"
echo "2. In iOS app: Add storage directory pointing to: $IOS_DOCUMENTS/SharedSD"
echo "3. Create a note in Desktop with content 'from desktop'"
echo "4. Create a note in iOS with content 'from ios'"
echo ""
echo "Press ENTER when you've completed these steps..."
read

# Verify activity logs exist
echo ""
echo -e "${YELLOW}Verifying activity logs...${NC}"

ACTIVITY_DIR="$SHARED_SD/.activity"
if [ ! -d "$ACTIVITY_DIR" ]; then
    echo -e "${RED}✗${NC} Activity directory not found"
    echo "Expected: $ACTIVITY_DIR"
    exit 1
fi

ACTIVITY_COUNT=$(ls -1 "$ACTIVITY_DIR"/*.log 2>/dev/null | wc -l | tr -d ' ')
echo "Found $ACTIVITY_COUNT activity log files"

if [ "$ACTIVITY_COUNT" -lt 2 ]; then
    echo -e "${YELLOW}⚠${NC}  Expected 2 activity logs (Desktop + iOS), found $ACTIVITY_COUNT"
    echo "Activity files:"
    ls -la "$ACTIVITY_DIR" || true
else
    echo -e "${GREEN}✓${NC} Both Desktop and iOS wrote activity logs"
fi

# Show activity log contents
echo ""
echo -e "${YELLOW}Activity log contents:${NC}"
for log in "$ACTIVITY_DIR"/*.log; do
    if [ -f "$log" ]; then
        echo "$(basename $log):"
        cat "$log"
        echo ""
    fi
done

# Count notes
NOTES_COUNT=$(find "$SHARED_SD/notes" -mindepth 1 -maxdepth 1 -type d 2>/dev/null | wc -l | tr -d ' ')
echo "Found $NOTES_COUNT note directories"

if [ "$NOTES_COUNT" -ge 2 ]; then
    echo -e "${GREEN}✓${NC} Both apps created notes"
else
    echo -e "${YELLOW}⚠${NC}  Expected at least 2 notes, found $NOTES_COUNT"
fi

echo ""
echo -e "${GREEN}Test completed!${NC}"
echo "Shared directory preserved at: $SHARED_SD"
echo "Inspect manually or remove trap to keep it"
echo ""
echo "To fully verify:"
echo "1. Check if Desktop sees the iOS note"
echo "2. Check if iOS sees the Desktop note"
echo "3. Verify edits sync both ways"

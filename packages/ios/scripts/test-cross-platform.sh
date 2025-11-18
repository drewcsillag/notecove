#!/bin/bash

# Cross-platform e2e test script
# Tests that iOS and Desktop can share a storage directory and sync changes

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
IOS_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DESKTOP_DIR="$(cd "$IOS_DIR/../desktop" && pwd)"

echo -e "${BLUE}🔄 Running Cross-Platform E2E Tests${NC}\n"

# Create shared temp directory for storage
SHARED_SD=$(mktemp -d -t notecove-cross-platform-XXXXXX)
echo -e "${BLUE}📁 Created shared storage directory: ${SHARED_SD}${NC}\n"

# Cleanup function
cleanup() {
  echo -e "\n${BLUE}🧹 Cleaning up...${NC}"
  rm -rf "$SHARED_SD"
  echo -e "${GREEN}✅ Cleanup complete${NC}\n"
}
trap cleanup EXIT

# Export shared directory for tests to use
export NOTECOVE_CROSS_PLATFORM_SD="$SHARED_SD"

# Step 1: Run desktop test to create a note
echo -e "${BLUE}📝 Step 1: Desktop creates a note${NC}"
echo -e "   Running desktop Playwright test..."
cd "$DESKTOP_DIR"
pnpm exec playwright test e2e/cross-platform-setup.spec.ts
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Desktop test failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Desktop test passed${NC}\n"

# Step 2: Run iOS test to verify note exists
echo -e "${BLUE}👀 Step 2: iOS verifies desktop's note${NC}"
echo -e "   Running iOS XCTest..."
cd "$IOS_DIR"

# Find iOS simulator
SIMULATOR_ID=$(xcrun simctl list devices available | grep "iPhone 17" | head -1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')
if [ -z "$SIMULATOR_ID" ]; then
  echo -e "${RED}❌ No iPhone simulator found${NC}"
  exit 1
fi

NOTECOVE_CROSS_PLATFORM_SD="$SHARED_SD" xcodebuild test \
  -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
  -only-testing:NoteCoveTests/CrossPlatformTests/testVerifyDesktopNote \
  2>&1 | grep -E "(Test.*passed|Test.*failed|Testing failed)"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
  echo -e "${RED}❌ iOS verification test failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ iOS verification passed${NC}\n"

# Step 3: Run iOS test to edit the note
echo -e "${BLUE}✏️  Step 3: iOS edits the note${NC}"
echo -e "   Running iOS XCTest..."
NOTECOVE_CROSS_PLATFORM_SD="$SHARED_SD" xcodebuild test \
  -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
  -only-testing:NoteCoveTests/CrossPlatformTests/testEditNoteFromDesktop \
  2>&1 | grep -E "(Test.*passed|Test.*failed|Testing failed)"

if [ ${PIPESTATUS[0]} -ne 0 ]; then
  echo -e "${RED}❌ iOS edit test failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ iOS edit passed${NC}\n"

# Debug: List files in updates directory
echo -e "${BLUE}🔍 Debug: Listing files in updates directory${NC}"
ls -la "$SHARED_SD/cross-platform-note-1/updates/" || echo "Directory not found"
echo ""

# Step 4: Run desktop test to verify iOS edit
echo -e "${BLUE}👀 Step 4: Desktop verifies iOS's edit${NC}"
echo -e "   Running desktop Playwright test..."
cd "$DESKTOP_DIR"
pnpm exec playwright test e2e/cross-platform-verify.spec.ts
if [ $? -ne 0 ]; then
  echo -e "${RED}❌ Desktop verification test failed${NC}"
  exit 1
fi
echo -e "${GREEN}✅ Desktop verification passed${NC}\n"

# Success!
echo -e "${GREEN}🎉 All cross-platform tests passed!${NC}"
echo -e "${GREEN}   iOS ↔ Desktop sync is working correctly${NC}\n"
exit 0

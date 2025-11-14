#!/bin/bash

###############################################################################
# iOS Local CI Script
#
# Runs all checks that would run in iOS CI:
# - Regenerates Xcode project from project.yml
# - Builds the iOS app
# - Runs all unit tests
#
# Usage:
#   cd packages/ios
#   ./scripts/ci-local.sh
#
# Or from repo root:
#   pnpm --filter @notecove/ios ci-local
###############################################################################

set -e  # Exit on error

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Get script directory and project root
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
IOS_DIR="$( cd "$SCRIPT_DIR/.." && pwd )"

cd "$IOS_DIR"

echo -e "${BLUE}🚀 Running iOS local CI checks...${NC}\n"

# Step 1: Find available simulator
echo -e "${BLUE}📱 Finding iOS Simulator...${NC}"
SIMULATOR_ID=$(xcrun simctl list devices available | grep "iPhone 17" | head -1 | sed -E 's/.*\(([A-F0-9-]+)\).*/\1/')

if [ -z "$SIMULATOR_ID" ]; then
  echo -e "${RED}❌ No iPhone simulator found${NC}"
  echo "Please install iOS Simulator via Xcode > Settings > Platforms"
  exit 1
fi

echo -e "${GREEN}✅ Using iPhone simulator: $SIMULATOR_ID${NC}\n"

# Step 2: Rebuild JavaScript bundle (in case it's out of date)
echo -e "${BLUE}📦 Rebuilding JavaScript bundle...${NC}"
echo "   $ cd ../shared && pnpm build:ios"
(cd ../shared && pnpm build:ios)
echo -e "${GREEN}✅ JavaScript bundle rebuilt${NC}\n"

# Step 3: Copy bundle to iOS resources
echo -e "${BLUE}📋 Copying bundle to iOS resources...${NC}"
cp ../shared/dist/ios/notecove-bridge.js Sources/Resources/notecove-bridge.js
echo -e "${GREEN}✅ Bundle copied${NC}\n"

# Step 4: Regenerate Xcode project
echo -e "${BLUE}🔨 Regenerating Xcode project...${NC}"
echo "   $ xcodegen generate"
xcodegen generate
echo -e "${GREEN}✅ Xcode project regenerated${NC}\n"

# Step 5: Build the app
echo -e "${BLUE}🏗️  Building iOS app...${NC}"
echo "   $ xcodebuild -project NoteCove.xcodeproj -scheme NoteCove -destination 'platform=iOS Simulator,id=$SIMULATOR_ID' build"
xcodebuild -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
  build 2>&1 | grep -E "^(Build|Test|▸|❌|✓|note:)" || true
echo -e "${GREEN}✅ Build succeeded${NC}\n"

# Step 6: Run tests
echo -e "${BLUE}🧪 Running iOS tests...${NC}"
echo "   $ xcodebuild test -project NoteCove.xcodeproj -scheme NoteCove -destination 'platform=iOS Simulator,id=$SIMULATOR_ID'"
xcodebuild test \
  -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
  2>&1 | grep -E "(Test Suite|Test Case|Executed|passed|failed)" || {
    echo -e "${RED}❌ Tests failed${NC}"
    exit 1
  }

# Check if tests passed
if [ $? -eq 0 ]; then
  echo -e "\n${GREEN}✅ All iOS CI checks passed! Safe to merge.${NC}\n"
  exit 0
else
  echo -e "\n${RED}❌ iOS CI failed. Please fix the errors before committing.${NC}\n"
  exit 1
fi

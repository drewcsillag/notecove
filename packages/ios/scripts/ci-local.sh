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

# Step 6: Run tests with code coverage
echo -e "${BLUE}🧪 Running iOS tests with code coverage...${NC}"
echo "   $ xcodebuild test -project NoteCove.xcodeproj -scheme NoteCove -destination 'platform=iOS Simulator,id=$SIMULATOR_ID' -enableCodeCoverage YES"

# Create derived data directory for coverage reports
DERIVED_DATA_PATH="$IOS_DIR/DerivedData"
mkdir -p "$DERIVED_DATA_PATH"

xcodebuild test \
  -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -destination "platform=iOS Simulator,id=$SIMULATOR_ID" \
  -enableCodeCoverage YES \
  -derivedDataPath "$DERIVED_DATA_PATH" \
  2>&1 | grep -E "(Test Suite|Test Case|Executed|passed|failed)"

# Check the xcodebuild exit status (from PIPESTATUS[0])
TEST_EXIT_CODE=${PIPESTATUS[0]}

if [ $TEST_EXIT_CODE -ne 0 ]; then
  echo -e "\n${RED}❌ iOS tests failed. Please fix the errors before committing.${NC}\n"
  exit 1
fi

echo -e "${GREEN}✅ Tests passed${NC}\n"

# Step 7: Check code coverage
echo -e "${BLUE}📊 Checking code coverage...${NC}"

# Find the coverage file
COVERAGE_FILE=$(find "$DERIVED_DATA_PATH" -name "*.xcresult" | head -1)

if [ -z "$COVERAGE_FILE" ]; then
  echo -e "${YELLOW}⚠️  Warning: Could not find coverage file${NC}"
  echo -e "${YELLOW}   Coverage check skipped${NC}\n"
else
  # Extract coverage report using xcrun
  COVERAGE_REPORT=$(xcrun xccov view --report "$COVERAGE_FILE" 2>/dev/null)

  if [ $? -ne 0 ]; then
    echo -e "${YELLOW}⚠️  Warning: Could not extract coverage report${NC}"
    echo -e "${YELLOW}   Coverage check skipped${NC}\n"
  else
    # Parse overall coverage percentage
    # The report format is: "AppName.app -> 85.67%"
    COVERAGE_PCT=$(echo "$COVERAGE_REPORT" | grep "NoteCove.app" | grep -oE '[0-9]+\.[0-9]+%' | head -1 | sed 's/%//')

    if [ -z "$COVERAGE_PCT" ]; then
      echo -e "${YELLOW}⚠️  Warning: Could not parse coverage percentage${NC}"
      echo -e "${YELLOW}   Coverage check skipped${NC}\n"
    else
      echo -e "${BLUE}   Current coverage: ${COVERAGE_PCT}%${NC}"

      # Check if coverage meets minimum threshold (80%)
      MINIMUM_COVERAGE=80

      # Use awk for floating point comparison
      MEETS_THRESHOLD=$(awk -v cov="$COVERAGE_PCT" -v min="$MINIMUM_COVERAGE" 'BEGIN { print (cov >= min) ? 1 : 0 }')

      if [ "$MEETS_THRESHOLD" -eq 1 ]; then
        echo -e "${GREEN}✅ Coverage meets minimum threshold (${MINIMUM_COVERAGE}%)${NC}\n"
      else
        echo -e "${RED}❌ Coverage is below minimum threshold${NC}"
        echo -e "${RED}   Required: ${MINIMUM_COVERAGE}%${NC}"
        echo -e "${RED}   Current:  ${COVERAGE_PCT}%${NC}"
        echo -e "${RED}   Please add tests to improve coverage${NC}\n"
        exit 1
      fi
    fi
  fi
fi

echo -e "${GREEN}✅ All iOS CI checks passed! Safe to merge.${NC}\n"
exit 0

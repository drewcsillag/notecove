#!/bin/bash
set -e

# NoteCove iOS - Local CI Script
# Run this before commits to verify everything builds and tests pass

cd "$(dirname "$0")/.."

echo "=== NoteCove iOS Local CI ==="
echo ""

# Regenerate project if needed
echo "Regenerating Xcode project..."
xcodegen generate

echo ""
echo "=== Building for iOS Simulator ==="
xcodebuild \
  -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)' \
  -configuration Debug \
  build \
  | xcbeautify || cat

echo ""
echo "=== Running Unit Tests ==="
xcodebuild \
  -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -destination 'platform=iOS Simulator,name=iPad Pro 13-inch (M5)' \
  -configuration Debug \
  test \
  | xcbeautify || cat

echo ""
echo "=== Building for Release ==="
xcodebuild \
  -project NoteCove.xcodeproj \
  -scheme NoteCove \
  -destination 'generic/platform=iOS' \
  -configuration Release \
  build \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  | xcbeautify || cat

echo ""
echo "=== CI Complete ==="

#!/bin/bash
# Create a distributable tarball of the learning system
#
# Usage:
#   ./package.sh [output_path]
#
# Example:
#   ./package.sh                              # Creates claude-learning-system.tar.gz in current dir
#   ./package.sh ~/Downloads/learning.tar.gz  # Creates at specified path

set -euo pipefail

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Output path
OUTPUT="${1:-claude-learning-system.tar.gz}"

echo -e "${YELLOW}Creating distributable package...${NC}"

# Create temp directory
TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# Copy learning-system folder
mkdir -p "$TEMP_DIR/learning-system"
cp -r "$SCRIPT_DIR"/* "$TEMP_DIR/learning-system/"

# Remove any .bak files that might exist
find "$TEMP_DIR" -name "*.bak" -delete

# Create tarball
cd "$TEMP_DIR"
tar -czf "$OUTPUT" learning-system/

# Move to final destination if not already there
if [[ "$OUTPUT" != /* ]]; then
  mv "$OUTPUT" "$(pwd -P)/$OUTPUT" 2>/dev/null || mv "$TEMP_DIR/$OUTPUT" "$OUTPUT"
fi

echo -e "${GREEN}Package created: $OUTPUT${NC}"
echo ""
echo "To install on another machine:"
echo "  1. Copy $OUTPUT to the target machine"
echo "  2. tar -xzf $OUTPUT"
echo "  3. ./learning-system/install.sh /path/to/project [project-id]"

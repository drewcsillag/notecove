#!/bin/bash
# Claude Code Learning System Installer
# Self-contained installer - copy this entire learning-system folder to install elsewhere
#
# Usage:
#   ./install.sh [target_dir] [project_id]
#
# Examples:
#   ./install.sh                          # Install to current directory, derive project ID from dir name
#   ./install.sh /path/to/project         # Install to specific directory
#   ./install.sh /path/to/project myproj  # Install with custom project ID

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script lives (learning-system folder)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Verify this is a complete installation package
if [ ! -d "$SCRIPT_DIR/hooks" ] || [ ! -d "$SCRIPT_DIR/commands" ] || [ ! -d "$SCRIPT_DIR/templates" ]; then
  echo -e "${RED}Error: Incomplete installation package.${NC}"
  echo "Expected directories: hooks/, commands/, templates/"
  echo "Current directory: $SCRIPT_DIR"
  exit 1
fi

# Target directory (default: current directory)
TARGET_DIR="${1:-$(pwd)}"
TARGET_CLAUDE_DIR="$TARGET_DIR/.claude"

# Project ID (default: basename of target directory)
PROJECT_ID="${2:-$(basename "$TARGET_DIR")}"

echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║       Claude Code Learning System Installer              ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Target directory:${NC} $TARGET_DIR"
echo -e "${BLUE}Project ID:${NC}       $PROJECT_ID"
echo ""

# Check target exists
if [ ! -d "$TARGET_DIR" ]; then
  echo -e "${RED}Error: Target directory does not exist: $TARGET_DIR${NC}"
  exit 1
fi

# Create .claude directory structure
echo -e "${YELLOW}[1/6]${NC} Creating directory structure..."
mkdir -p "$TARGET_CLAUDE_DIR/hooks"
mkdir -p "$TARGET_CLAUDE_DIR/commands"
mkdir -p "$TARGET_CLAUDE_DIR/state"

# Copy hooks from bundled files
echo -e "${YELLOW}[2/6]${NC} Installing hooks..."
cp "$SCRIPT_DIR/hooks/common.sh" "$TARGET_CLAUDE_DIR/hooks/"
cp "$SCRIPT_DIR/hooks/bash-canary.sh" "$TARGET_CLAUDE_DIR/hooks/"
cp "$SCRIPT_DIR/hooks/post-bash.sh" "$TARGET_CLAUDE_DIR/hooks/"
cp "$SCRIPT_DIR/hooks/edit-canary.sh" "$TARGET_CLAUDE_DIR/hooks/"
cp "$SCRIPT_DIR/hooks/track-read.sh" "$TARGET_CLAUDE_DIR/hooks/"
chmod +x "$TARGET_CLAUDE_DIR/hooks/"*.sh

# Update common.sh with project ID (replace placeholder)
echo -e "${YELLOW}[3/6]${NC} Configuring project ID: $PROJECT_ID"
sed -i.bak "s/__PROJECT_ID_PLACEHOLDER__/$PROJECT_ID/g" "$TARGET_CLAUDE_DIR/hooks/common.sh"
rm -f "$TARGET_CLAUDE_DIR/hooks/common.sh.bak"

# Copy commands from bundled files and replace project ID placeholder
echo -e "${YELLOW}[4/6]${NC} Installing slash commands..."
cp "$SCRIPT_DIR/commands/learn-mistake.md" "$TARGET_CLAUDE_DIR/commands/"
cp "$SCRIPT_DIR/commands/review-failures.md" "$TARGET_CLAUDE_DIR/commands/"
# Replace __PROJECT_ID__ placeholder in commands
sed -i.bak "s/__PROJECT_ID__/$PROJECT_ID/g" "$TARGET_CLAUDE_DIR/commands/learn-mistake.md"
sed -i.bak "s/__PROJECT_ID__/$PROJECT_ID/g" "$TARGET_CLAUDE_DIR/commands/review-failures.md"
rm -f "$TARGET_CLAUDE_DIR/commands/"*.bak

# Copy MISTAKES.md template if not exists
if [ ! -f "$TARGET_CLAUDE_DIR/MISTAKES.md" ]; then
  echo -e "${YELLOW}[5/6]${NC} Creating local MISTAKES.md template..."
  cp "$SCRIPT_DIR/templates/MISTAKES.md" "$TARGET_CLAUDE_DIR/"
else
  echo -e "${YELLOW}[5/6]${NC} MISTAKES.md already exists, skipping..."
fi

# Create or update settings.local.json
SETTINGS_FILE="$TARGET_CLAUDE_DIR/settings.local.json"
echo -e "${YELLOW}[6/6]${NC} Configuring hooks in settings.local.json..."
if [ -f "$SETTINGS_FILE" ]; then
  if grep -q '"hooks"' "$SETTINGS_FILE"; then
    echo -e "  ${YELLOW}Hooks already configured - manual merge may be needed${NC}"
  else
    echo -e "  ${YELLOW}settings.local.json exists without hooks - please merge manually:${NC}"
    echo ""
    cat "$SCRIPT_DIR/templates/settings.local.json"
    echo ""
  fi
else
  cp "$SCRIPT_DIR/templates/settings.local.json" "$SETTINGS_FILE"
  echo -e "  ${GREEN}Created settings.local.json${NC}"
fi

# Create shared state directory
SHARED_DIR="$HOME/.claude/shared-learning/$PROJECT_ID"
mkdir -p "$SHARED_DIR"

# Summary
echo ""
echo -e "${GREEN}╔══════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║                 Installation Complete!                   ║${NC}"
echo -e "${GREEN}╚══════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${BLUE}Installed to:${NC}"
echo "  $TARGET_CLAUDE_DIR/"
echo ""
echo -e "${BLUE}Shared state directory:${NC}"
echo "  $SHARED_DIR"
echo "  (MISTAKES.md and pending-lessons.jsonl will be stored here)"
echo ""
echo -e "${YELLOW}Recommended .gitignore additions:${NC}"
echo "  .claude/state/"
echo "  .claude/settings.local.json"
echo ""
echo -e "${YELLOW}Add Memory Canaries section to CLAUDE.md:${NC}"
echo "  See: $SCRIPT_DIR/CLAUDE-SNIPPET.md"
echo ""
echo -e "${GREEN}Restart Claude Code to activate hooks.${NC}"

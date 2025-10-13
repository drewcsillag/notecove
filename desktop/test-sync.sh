#!/bin/bash
# NoteCove Multi-Instance Sync Test Script
# 
# This script helps you test CRDT-based sync between two instances of NoteCove

set -e

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}╔════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║   NoteCove Sync Testing Script        ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════╝${NC}"
echo ""

# Get the directory where the script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

# Setup shared notes directory for testing
TEST_NOTES_DIR="$HOME/Documents/NoteCove-SyncTest"
INSTANCE1_DATA="$HOME/.notecove-test-instance1"
INSTANCE2_DATA="$HOME/.notecove-test-instance2"

echo -e "${YELLOW}Sync Test Configuration:${NC}"
echo "  Shared Notes: $TEST_NOTES_DIR"
echo "  Instance 1 Data: $INSTANCE1_DATA"
echo "  Instance 2 Data: $INSTANCE2_DATA"
echo ""

# Clean up previous test data if exists
if [ -d "$TEST_NOTES_DIR" ]; then
  echo -e "${YELLOW}Cleaning up previous test data...${NC}"
  rm -rf "$TEST_NOTES_DIR"
fi

mkdir -p "$TEST_NOTES_DIR"
mkdir -p "$TEST_NOTES_DIR/crdt"
mkdir -p "$TEST_NOTES_DIR/notes"

echo -e "${GREEN}✓ Test environment prepared${NC}"
echo ""

# Build the app first
echo -e "${BLUE}Building app...${NC}"
npm run build:main
echo ""

# Function to start an instance
start_instance() {
  local instance_num=$1
  local user_data_dir=$2
  
  echo -e "${BLUE}Starting Instance $instance_num...${NC}"
  echo "  User Data: $user_data_dir"
  echo "  Notes Path: $TEST_NOTES_DIR"
  echo ""
  
  # Start Vite dev server if not running
  if ! lsof -i:5173 > /dev/null 2>&1; then
    echo -e "${YELLOW}Starting Vite dev server...${NC}"
    npm run dev:renderer > /dev/null 2>&1 &
    sleep 3
  fi
  
  # Start Electron with custom paths
  # Use nohup to ensure the process doesn't get killed
  nohup npx electron . \
    --user-data-dir="$user_data_dir" \
    --notes-path="$TEST_NOTES_DIR" \
    --instance="test$instance_num" \
    > "/tmp/notecove-instance$instance_num.log" 2>&1 &

  local pid=$!

  # Give it a moment to start
  sleep 1

  # Check if process is still running
  if ps -p $pid > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Instance $instance_num started (PID: $pid)${NC}"
    echo "  Log: /tmp/notecove-instance$instance_num.log"
  else
    echo -e "${YELLOW}⚠ Instance $instance_num may have failed to start${NC}"
    echo "  Check log: /tmp/notecove-instance$instance_num.log"
  fi
  echo ""

  return $pid
}

# Show instructions
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}  How to Test Sync${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo ""
echo "1. Two instances will open shortly"
echo "2. Create a note in Instance 1"
echo "3. Watch it appear in Instance 2"
echo "4. Edit in Instance 2"
echo "5. See changes sync back to Instance 1"
echo ""
echo -e "${YELLOW}What to look for:${NC}"
echo "  • New .yjs files in: $TEST_NOTES_DIR/crdt/"
echo "  • Cached .json files in: $TEST_NOTES_DIR/notes/"
echo "  • Console logs showing CRDT sync events"
echo ""
echo -e "${BLUE}Press ENTER to start both instances...${NC}"
read

# Start both instances
echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}Starting Instance 1...${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
start_instance 1 "$INSTANCE1_DATA"
sleep 3

echo -e "${BLUE}═══════════════════════════════════════${NC}"
echo -e "${BLUE}Starting Instance 2...${NC}"
echo -e "${BLUE}═══════════════════════════════════════${NC}"
start_instance 2 "$INSTANCE2_DATA"
sleep 2

echo ""
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo -e "${GREEN}Both instances are running!${NC}"
echo -e "${GREEN}═══════════════════════════════════════${NC}"
echo ""
echo "Test the sync by editing notes in either window."
echo ""
echo "To view logs:"
echo "  Instance 1: tail -f /tmp/notecove-instance1.log"
echo "  Instance 2: tail -f /tmp/notecove-instance2.log"
echo ""
echo "To inspect CRDT files:"
echo "  ls -la $TEST_NOTES_DIR/crdt/"
echo "  ls -la $TEST_NOTES_DIR/notes/"
echo ""
echo -e "${YELLOW}Press CTRL+C to stop testing and clean up${NC}"
echo ""

# Wait for user to stop
trap "echo ''; echo 'Cleaning up...'; killall electron 2>/dev/null; echo 'Done'; exit 0" INT
wait

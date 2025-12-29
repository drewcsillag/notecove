#!/bin/bash
# Wrapper script for launching Electron in E2E tests
# Clears macOS saved application state before launching to prevent
# the "unexpectedly quit" dialog from appearing.

# Clear saved state for all Electron-related bundle IDs
SAVED_STATE_DIR="$HOME/Library/Saved Application State"

if [ -d "$SAVED_STATE_DIR" ]; then
    # Find and remove all electron-related saved state directories
    find "$SAVED_STATE_DIR" -maxdepth 1 -type d \( -iname '*electron*' -o -iname '*notecove*' \) -name '*.savedState' -exec rm -rf {} + 2>/dev/null
fi

# Launch Electron with the original arguments
# The first argument is the path to Electron, subsequent args are passed through
exec "$@"

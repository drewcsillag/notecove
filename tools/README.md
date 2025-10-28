# NoteCove Development Tools

Command-line utilities for managing NoteCove during development.

## Storage Directory (SD) Management

Before the Settings UI is implemented, use these scripts to manage Storage Directories.

### Prerequisites

```bash
cd /Users/drew/devel/nc2
pnpm install  # Installs better-sqlite3
chmod +x tools/*.js  # Make scripts executable
```

### Scripts

#### List SDs

```bash
./tools/sd-list.js
```

Shows all configured Storage Directories with their status.

#### Create SD

```bash
./tools/sd-create.js "Name" "/path/to/directory"

# Examples:
./tools/sd-create.js "Work" "/Users/drew/Dropbox/NoteCove-Work"
./tools/sd-create.js "Personal" "/Users/drew/Documents/NoteCove-Personal"
```

Creates a new SD. The first SD is automatically set as active.

#### Activate SD

```bash
./tools/sd-activate.js <sd-id>

# Example:
./tools/sd-activate.js "default"
```

Sets the specified SD as active. Only one SD can be active at a time.

### Environment Variables

- `NC_DB_PATH` - Override the default database path
  ```bash
  NC_DB_PATH=/tmp/notecove-test.db ./tools/sd-list.js
  ```

### Database Locations

- **macOS**: `~/Library/Application Support/Electron/notecove.db`
- **Linux**: `~/.config/Electron/notecove.db`
- **Windows**: `%APPDATA%\Electron\notecove.db`
- **Test mode**: Uses `TEST_STORAGE_DIR` environment variable

### Notes

- **Restart required**: After modifying SDs, restart the app for changes to take effect
- **Path validation**: The app doesn't validate paths yet - ensure directories exist
- **Unique constraints**: SD names and paths must be unique
- **Active SD**: Only one SD can be active; the UI will use this SD for operations

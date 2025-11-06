# Storage Directory Migrations

This directory contains migration tools for upgrading Storage Directories (SDs) to newer format versions.

## SD Version System

Each Storage Directory has a version number stored in the `SD_VERSION` file in the SD root. This indicates the format version of the SD's data files.

**Current Version:** 1

### Version History

- **Version 1**: Flag byte protocol for `.yjson` files
  - All CRDT update files (`.yjson`) have a 1-byte header:
    - `0x00` = File is being written (incomplete)
    - `0x01` = File is ready to read
  - Prevents partial file read race conditions during cloud sync
  - Migration: `migrate-flag-byte.ts`

- **Version 0** (implicit): Legacy format
  - No `SD_VERSION` file
  - `.yjson` files without flag byte

## Migration Process

### Before Running Migration

1. **Backup your SD** - Always backup before migrating
2. **Close all instances** - Ensure no other app instances are accessing the SD
3. **Check current version**: Look for `SD_VERSION` file in SD root

### Running a Migration

```bash
# From the desktop package directory
cd packages/desktop

# Dry run (preview changes)
pnpm migrate:flag-byte /path/to/sd --dry-run

# Actual migration
pnpm migrate:flag-byte /path/to/sd
```

Or from the repository root:

```bash
# Dry run
pnpm --filter @notecove/desktop migrate:flag-byte /path/to/sd --dry-run

# Actual migration
pnpm --filter @notecove/desktop migrate:flag-byte /path/to/sd
```

### Migration Safety Features

- **Migration lock**: Creates `.migration-lock` file to prevent concurrent access
- **Atomic operations**: Uses temp files and rename for safety
- **Version checking**: Checks `SD_VERSION` to determine if migration is needed
- **Version file**: Updates `SD_VERSION` after successful migration

### What Happens During Migration

1. Checks `SD_VERSION` file - if version >= 1, exits early (already migrated)
2. Creates `.migration-lock` file
3. Scans all `.yjson` files in the SD
4. For each file:
   - Writes to temp file with new format (0x01 flag byte + data)
   - Atomically renames temp file to original
5. Writes `SD_VERSION` file with new version number
6. Removes `.migration-lock` file

## App Version Checking

The app checks SD version compatibility:

### SD Version > App Version (SD too new)

**Error**: "This Storage Directory (version X) requires a newer version of the app (supports version Y)"

**Options**:

- Update the app to latest version
- Disable/remove this SD
- Quit

### SD Version < App Version (SD too old)

**Warning**: "This Storage Directory (version X) is from an older version. The app supports version Y."

**Options**:

- Upgrade SD (when migration is implemented)
- Quit

### Missing SD_VERSION (Legacy SD)

Treated as version 0. Show upgrade prompt.

## Multi-Instance Safety

If multiple app instances are running:

1. One instance starts migration → creates `.migration-lock`
2. Other instances detect lock → show "Migration in progress" error
3. After migration completes and lock is removed → other instances can access SD
4. When syncing, instances check if SD version changed → reload or prompt user

## Creating New Migrations

When creating a new migration for version N:

1. Create `migrate-to-v{N}.ts` in this directory
2. Follow the pattern from `migrate-flag-byte.ts`:
   - Use migration lock
   - Handle dry-run mode
   - Atomic file operations
   - Write `SD_VERSION` file at end
3. Update this README with version history
4. Update `CURRENT_SD_VERSION` in `sd-version.ts`
5. Add version check logic in app startup code

## Troubleshooting

### "Migration in progress" error

Another instance is migrating the SD. Wait for it to complete or manually remove `.migration-lock` if the process crashed.

### "SD Version not supported" error

The SD is from a newer app version. Update your app or use a different SD.

### SD already migrated

If you run the migration on an SD that's already at version 1 or higher, the tool will detect this via `SD_VERSION` and exit immediately without modifying any files.

### Migration failed partway through

Some files may be migrated while others are not. The `SD_VERSION` file is only written after ALL files are successfully migrated. If migration fails partway through, you can safely re-run it - the tool will complete the remaining files.

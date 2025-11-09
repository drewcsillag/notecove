# Sync Configuration

NoteCove syncs your notes through shared folders on your cloud storage provider.

## How Sync Works

NoteCove uses a file-based synchronization model:

1. **Local Storage**: All notes are stored locally in SQLite
2. **CRDT Updates**: Changes are written as CRDT update files to a sync folder
3. **Cloud Sync**: Your cloud storage provider syncs these files across devices
4. **Merge**: Other devices read the updates and merge them conflict-free

## Supported Cloud Storage

### Dropbox

**Setup:**

1. Install Dropbox desktop app
2. Ensure Dropbox is syncing
3. In NoteCove: File → Preferences → Sync
4. Choose a folder inside your Dropbox folder
5. Enable sync

**Recommended folder**: `~/Dropbox/Apps/NoteCove/`

### Google Drive

**Setup:**

1. Install Google Drive desktop app (Drive File Stream or Backup and Sync)
2. Ensure Google Drive is syncing
3. In NoteCove: File → Preferences → Sync
4. Choose a folder inside your Google Drive folder
5. Enable sync

**Recommended folder**: `~/Google Drive/NoteCove/`

### iCloud Drive (macOS)

**Setup:**

1. Enable iCloud Drive in System Preferences
2. In NoteCove: File → Preferences → Sync
3. Choose a folder inside `~/Library/Mobile Documents/com~apple~CloudDocs/`
4. Enable sync

**Recommended folder**: `~/Library/Mobile Documents/com~apple~CloudDocs/NoteCove/`

## Sync Folder Structure

Inside your sync folder, NoteCove creates:

```
sync-folder/
├── sync-data/           # Sync data directory
│   ├── SD-xxxxx/        # Individual sync data instances
│   │   ├── metadata.json
│   │   └── updates/     # CRDT update files
│   └── registry.json    # Registry of all sync data instances
└── .notecove/          # Configuration and metadata
```

## Multi-Device Setup

### Adding a Second Device

1. Install NoteCove on the second device
2. Install the same cloud storage app (Dropbox, Google Drive, etc.)
3. Wait for the sync folder to sync from your first device
4. In NoteCove: File → Preferences → Sync
5. Choose the same sync folder as your first device
6. Enable sync

NoteCove will automatically detect existing sync data and download all notes.

### Sync Status

Monitor sync status in the status bar:

- **Synced**: All changes uploaded and downloaded
- **Syncing**: Changes are being processed
- **Error**: Problem with sync (see activity log)

## Conflict Resolution

NoteCove uses CRDTs (Conflict-free Replicated Data Types) to handle conflicts automatically:

- **Simultaneous edits**: Merges changes from all devices
- **No "last write wins"**: All edits are preserved
- **No conflict dialogs**: Everything merges automatically

### How CRDTs Work

When you edit a note on multiple devices:

1. Each device records its changes as CRDT operations
2. Changes sync via your cloud storage
3. Each device applies operations in causal order
4. Result is mathematically guaranteed to converge

## Troubleshooting

### Sync Not Working

**Check:**

1. Cloud storage app is running and syncing
2. Sync folder has read/write permissions
3. Internet connection is active
4. View activity log: Help → View Activity Log

### Duplicate Notes

If you see duplicate notes:

1. This shouldn't happen with CRDTs, but if it does:
2. Check that all devices are using the same sync folder
3. Verify sync data UUIDs match in Preferences

### Slow Sync

**Optimize:**

- Ensure cloud storage app isn't rate-limited
- Check network bandwidth
- Reduce sync frequency in Preferences (if needed)

### Reset Sync

**Warning: This will re-download all notes from sync folder**

1. File → Preferences → Sync
2. Click "Reset Sync State"
3. Confirm the reset
4. NoteCove will rebuild local state from sync data

## Advanced Configuration

### Sync Frequency

(Coming soon)

Adjust how often NoteCove checks for new updates:

- Real-time (default): Check every few seconds
- Balanced: Check every 30 seconds
- Conservative: Check every few minutes

### Selective Sync

(Coming soon)

Choose which folders to sync on each device:

- Sync all folders (default)
- Sync specific folders only
- Exclude folders from sync

## Privacy & Security

### Data Encryption

- NoteCove stores data locally unencrypted for performance
- Cloud sync relies on your cloud storage provider's encryption
- Consider using full-disk encryption (FileVault, BitLocker)

### Who Can Access Your Notes?

- **You**: Full access to all notes
- **Cloud Provider**: Can access files (use their encryption features)
- **NoteCove**: No access (no servers, no tracking, no telemetry)

## Next Steps

- [Learn keyboard shortcuts](/guide/keyboard-shortcuts)
- [Understand CRDT synchronization](/architecture/crdt-sync)

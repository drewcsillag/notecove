# Offline-First Sync

NoteCove is designed to work perfectly offline, with seamless synchronization when you reconnect.

## Philosophy

### Offline-First Architecture

NoteCove follows the **offline-first** principle:

1. **All data local**: Complete copy of your notes on every device
2. **Full functionality**: All features work without internet
3. **Automatic sync**: Changes sync when connection is available
4. **No blockers**: Never wait for network or servers

This is different from cloud-first apps that require internet connectivity for basic operations.

### Why Offline-First?

**Reliability:**

- Work anywhere (airplane, coffee shop, remote areas)
- No downtime from server issues
- No dependency on third-party services

**Performance:**

- Instant loading and saving
- No network latency
- Fast search and navigation

**Privacy:**

- Your data stays on your devices
- No third-party server access
- You control sync through your own cloud storage

**Ownership:**

- You own your data
- No vendor lock-in
- Export and backup anytime

## How It Works

### Local Storage

NoteCove stores everything locally:

- **SQLite database**: Note metadata, folders, tags, search index
- **CRDT updates**: Sync data for merging changes
- **Configuration**: App preferences and settings

Location on disk:

- macOS: `~/Library/Application Support/NoteCove/`
- Windows: `%APPDATA%\NoteCove\`
- Linux: `~/.config/NoteCove/`

### Cloud Sync

NoteCove syncs through your cloud storage:

1. **You edit** a note on Device A
2. **CRDT update** written to sync folder on disk
3. **Cloud storage** syncs the file (Dropbox, Google Drive, iCloud)
4. **Device B** detects new file
5. **CRDT merge** applies changes to Device B's local database

[Learn more about sync configuration →](/guide/sync-configuration)

### Conflict Resolution

NoteCove uses **CRDTs** (Conflict-free Replicated Data Types) for automatic conflict resolution:

- All edits preserved and merged
- No "last write wins" - all changes kept
- Mathematically guaranteed convergence
- No conflict dialogs or manual resolution

[Learn more about sync mechanism →](/architecture/sync-mechanism)

## Sync Features

### Multi-Device Sync

Use NoteCove on multiple devices:

- **Desktop**: Multiple computers (Mac, Windows, Linux)
- **iOS**: iPhone and iPad (coming soon)
- **Sync folder**: Same cloud folder on all devices
- **Automatic merge**: Changes from all devices merged seamlessly

### Real-Time Updates

Changes appear quickly on other devices:

- **Local network**: Near-instant via file system watching
- **Internet**: Depends on cloud storage sync speed
- **Offline**: Syncs when connection restored

### Selective Sync

(Coming soon)

Choose what to sync on each device:

- Sync all folders
- Sync specific folders only
- Exclude large folders on mobile

## Sync Status

### Status Indicator

Monitor sync status in the app:

- **Green dot**: Synced and up to date
- **Yellow dot**: Syncing in progress
- **Red dot**: Sync error (check activity log)

### Activity Log

View detailed sync activity:

1. Help → View Activity Log
2. See all sync operations
3. Filter by type (send/receive)
4. Export logs for debugging

### Sync Statistics

(Coming soon)

Track sync performance:

- Updates sent/received
- Sync latency
- Storage used
- Error rate

## Offline Capabilities

### What Works Offline

Everything works without internet:

✅ Create and edit notes
✅ Rich text formatting
✅ Organize folders
✅ Search notes (FTS5)
✅ Multi-window support
✅ Keyboard shortcuts
✅ App preferences

### What Requires Connection

Only cloud sync needs internet:

❌ Syncing changes to other devices
❌ Initial setup of cloud folder
❌ Downloading notes on new device

But even these work eventually - changes queue offline and sync when reconnected.

## Sync Strategies

### Cloud Storage Providers

NoteCove works with popular cloud storage:

**Dropbox:**

- Fast sync
- Good conflict handling
- Cross-platform support

**Google Drive:**

- Large free tier
- Integrates with Google ecosystem
- Desktop sync app required

**iCloud Drive (macOS/iOS):**

- Built into Apple devices
- No extra app needed
- Great for Apple-only users

[Learn more about configuring sync →](/guide/sync-configuration)

### Local Network Sync

(Coming soon)

Sync directly between devices on same network:

- Faster than cloud sync
- No internet required
- Peer-to-peer CRDT sync
- Falls back to cloud sync

### USB Sync

(Coming soon)

Sync via USB drive for air-gapped environments:

- Copy sync folder to USB
- Import updates on other device
- No internet required
- Perfect for high-security environments

## Advanced Sync

### Sync Algorithms

NoteCove uses efficient sync algorithms:

**Change Detection:**

- File system watching for new updates
- Periodic polling as fallback
- SHA-256 hashing to detect changes

**Update Processing:**

- Sequential processing by timestamp
- Batch processing for performance
- Duplicate detection and deduplication

**Error Handling:**

- Automatic retry with exponential backoff
- Conflict detection and logging
- Manual recovery tools

### Sync Data Format

Sync data stored as JSON files:

```json
{
  "noteId": "note-123",
  "timestamp": 1234567890,
  "update": "<binary CRDT update>",
  "checksum": "sha256..."
}
```

### Performance Optimization

**Incremental Sync:**

- Only changed data syncs
- No full database transfers
- Efficient bandwidth usage

**Compression:**

- CRDT updates compressed
- Reduces storage and bandwidth
- Transparent to users

**Deduplication:**

- Identical updates detected
- Prevents redundant processing
- Saves storage space

## Troubleshooting

### Sync Not Working

**Check:**

1. Cloud storage app is running
2. Sync folder has correct permissions
3. Internet connection (for cloud sync)
4. View activity log for errors

### Slow Sync

**Optimize:**

- Check cloud storage app settings
- Reduce sync frequency
- Close unused devices
- Check network speed

### Sync Conflicts

**Note:** CRDTs should prevent conflicts, but if you see issues:

1. Check all devices use same sync folder
2. Verify NoteCove versions match
3. Check activity log for errors
4. Contact support with logs

### Reset Sync

**Last resort** - re-downloads all notes:

1. File → Preferences → Sync
2. "Reset Sync State"
3. Confirm
4. NoteCove rebuilds from sync data

[Learn more troubleshooting →](/guide/sync-configuration#troubleshooting)

## Best Practices

### Sync Setup

**Do:**

- Use same cloud provider on all devices
- Test sync with a few notes first
- Monitor activity log initially
- Keep cloud storage app updated

**Don't:**

- Use multiple cloud providers simultaneously
- Delete sync folder manually
- Edit sync data files directly
- Share sync folder with other users

### Backup

Even with sync, maintain backups:

1. **Regular exports**: Export notes periodically
2. **Separate backup**: Use Time Machine, Backblaze, etc.
3. **Sync folder backup**: Cloud provider usually backs up automatically

### Security

Protect your synced data:

1. **Encryption**: Use cloud provider's encryption features
2. **2FA**: Enable two-factor auth on cloud account
3. **Local encryption**: Use FileVault (Mac) or BitLocker (Windows)
4. **Access control**: Don't share sync folder publicly

## Future Enhancements

### Planned Features

**End-to-End Encryption:**

- Encrypt sync data before cloud upload
- Only you can decrypt your notes
- Zero-knowledge architecture

**P2P Sync:**

- Direct device-to-device sync
- No cloud storage required
- WebRTC or local network

**Git-Based Sync:**

- Use Git for version control
- Full history and branching
- Self-hosted Git servers

## Next Steps

- [Configure sync settings](/guide/sync-configuration)
- [Understand sync mechanism](/architecture/sync-mechanism)
- [Learn about storage architecture](/architecture/storage-architecture)

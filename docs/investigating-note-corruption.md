# Investigating Note Corruption and Data Loss

This guide documents how to investigate missing or corrupted note content in NoteCove.

## Overview

NoteCove stores note data using Yjs CRDTs with the following file structure:

```
notes/
  {note-id}/
    updates/        - Individual CRDT update files (.yjson)
    packs/          - Consolidated update packs (.yjson.zst)
    snapshots/      - Point-in-time snapshots (.yjson.zst)
    meta/           - Metadata files
```

## File Formats

### Update Files (.yjson)

- **Format**: `0x01` prefix byte + binary Yjs update
- **Naming**: `{instanceId}_{noteId}_{timestamp}-{sequence}.yjson`
- **Purpose**: Individual CRDT operations (insertions, deletions, metadata changes)

### Pack Files (.yjson.zst)

- **Format**: `0x01` prefix byte + zstd-compressed JSON
- **Naming**: `{instanceId}_pack_{start}-{end}.yjson.zst`
- **JSON Structure**:
  ```json
  {
    "version": 1,
    "instanceId": "...",
    "noteId": "...",
    "sequenceRange": [start, end],
    "updates": [
      { "seq": N, "timestamp": T, "data": [byte array] }
    ]
  }
  ```

### Snapshot Files (.yjson.zst)

- **Format**: `0x01` prefix byte + zstd-compressed JSON
- **Naming**: `snapshot_{totalChanges}_{instanceId}.yjson.zst`
- **JSON Structure**:
  ```json
  {
    "version": 1,
    "noteId": "...",
    "timestamp": T,
    "totalChanges": N,
    "documentState": [byte array],  // Merged Yjs state
    "maxSequences": { "instanceId": maxSeq, ... }
  }
  ```

## Investigation Tools

Three manual diagnostic scripts are available in `packages/shared/src/__manual__/`:

### 1. replay-note-updates.ts

Replays all update files sequentially to show document state at each point.

**Usage**:

```bash
pnpm --filter @notecove/shared build
NODE_ENV=test node packages/shared/dist/cjs/__manual__/replay-note-updates.js \
  "/path/to/notes/{note-id}"
```

**Output**: Shows content after each update, marks deletions, displays final state.

### 2. extract-snapshot.ts

Extracts content from a snapshot file.

**Usage**:

```bash
# First decompress the snapshot (skipping 0x01 prefix):
dd bs=1 skip=1 if=snapshot_file.yjson.zst | zstd -d -c > /tmp/snapshot.yjson

# Then extract content:
NODE_ENV=test node packages/shared/dist/cjs/__manual__/extract-snapshot.js \
  /tmp/snapshot.yjson
```

**Output**: Shows note metadata and extracted text content.

### 3. extract-pack.ts

Extracts content from a pack file, showing progression through updates.

**Usage**:

```bash
# First decompress the pack (skipping 0x01 prefix):
dd bs=1 skip=1 if=pack_file.yjson.zst | zstd -d -c > /tmp/pack.yjson

# Then extract content:
NODE_ENV=test node packages/shared/dist/cjs/__manual__/extract-pack.js \
  /tmp/pack.yjson
```

**Output**: Shows content after each update in the pack.

## Investigation Process

### Step 1: Examine File Structure

```bash
NOTE_DIR="/path/to/notes/{note-id}"

# Check what files exist
ls -lh "$NOTE_DIR/updates/"
ls -lh "$NOTE_DIR/packs/"
ls -lh "$NOTE_DIR/snapshots/"

# Count update files and note size distribution
ls -lh "$NOTE_DIR/updates/" | awk '{print $5}' | sort | uniq -c
```

**What to look for**:

- Unusually small files (< 20 bytes) may be metadata-only
- Multiple instance IDs indicate different devices/sessions
- Gaps in sequence numbers

### Step 2: Check Latest Snapshot

Snapshots represent the most recent consolidated state.

```bash
cd "$NOTE_DIR/snapshots/"
LATEST_SNAPSHOT=$(ls -t *.yjson.zst | head -1)

# Decompress and extract
dd bs=1 skip=1 if="$LATEST_SNAPSHOT" | zstd -d -c > /tmp/snapshot.yjson
NODE_ENV=test node packages/shared/dist/cjs/__manual__/extract-snapshot.js \
  /tmp/snapshot.yjson
```

**What to look for**:

- If snapshot shows empty content, data loss occurred before this point
- Check `totalChanges` to see how many updates were included
- Check `timestamp` to see when snapshot was created

### Step 3: Check Pack Files

Pack files may contain content even if individual updates are corrupted.

```bash
cd "$NOTE_DIR/packs/"

# Process each pack file
for pack in *.yjson.zst; do
  echo "=== $pack ==="
  dd bs=1 skip=1 if="$pack" | zstd -d -c > /tmp/pack.yjson
  NODE_ENV=test node packages/shared/dist/cjs/__manual__/extract-pack.js \
    /tmp/pack.yjson
done
```

**What to look for**:

- Pack files are often the best source for recovery
- They consolidate multiple updates and may have been written before corruption
- Check sequence ranges to understand timeline

### Step 4: Replay All Updates

This shows the complete history of document changes.

```bash
NODE_ENV=test node packages/shared/dist/cjs/__manual__/replay-note-updates.js \
  "$NOTE_DIR" > /tmp/replay.log 2>&1

# Check for content
grep "Content length: [1-9]" /tmp/replay.log

# Check for errors
grep "Error processing" /tmp/replay.log

# View the final state
tail -20 /tmp/replay.log
```

**What to look for**:

- Decode errors indicate file corruption (check if you forgot to skip 0x01 prefix)
- Large deletions may indicate intentional or accidental content removal
- Empty content throughout indicates note never had text

### Step 5: Examine Raw Update Files

If you suspect corruption, examine the binary structure.

```bash
# Check a suspicious file
hexdump -C "$NOTE_DIR/updates/some-file.yjson" | head -20
```

**Expected structure**:

```
00000000  01 01 XX XX XX ...  |........|
          ↑  ↑
          |  └─ Yjs binary update data
          └─── 0x01 write completion marker
```

**Warning signs**:

- Missing 0x01 prefix (incomplete write)
- Repeated patterns (corruption)
- File size doesn't match expected update size

## Common Scenarios

### Scenario 1: "Note had content, now it's empty"

**Investigation**:

1. Check latest snapshot - is it empty?
2. Replay updates - look for large deletions
3. Check pack files for older content
4. Look for updates from other instance IDs (different devices)

**Possible causes**:

- Content was deleted (intentional or accidental)
- Sync conflict resulted in empty state winning
- Application bug caused deletion

### Scenario 2: "All update files appear corrupted"

**Investigation**:

1. Verify you're skipping the 0x01 prefix byte
2. Check pack files - they may be intact
3. Check snapshots - they may have older content
4. Look for backups (Time Machine, cloud sync)

**Possible causes**:

- Forgot to skip 0x01 prefix when decoding
- Disk corruption
- File system issues
- Yjs version incompatibility

### Scenario 3: "Content exists in pack but not in updates"

**Investigation**:

1. Check sequence numbers in pack vs individual updates
2. Verify pack content can be extracted
3. Check if individual updates are metadata-only

**Possible causes**:

- This is normal! Pack files consolidate updates
- Individual updates may only contain metadata changes
- Content updates were packed and consolidated

## Recovery Strategies

### Priority Order for Recovery

1. **Latest snapshot** - Most recent consolidated state
2. **Pack files** - Consolidated updates, often most reliable
3. **Individual updates** - Replay sequentially
4. **Backups** - Time Machine, cloud sync, etc.
5. **Other devices** - If synced, other devices may have content

### Extracting Recovered Content

Once you find content in a pack or snapshot:

```bash
# Save to file
NODE_ENV=test node packages/shared/dist/cjs/__manual__/extract-pack.js \
  /tmp/pack.yjson | \
  sed -n '/^Content:$/,/^====/p' | \
  sed '1d;$d' > /tmp/recovered-content.txt
```

## Prevention

### Best Practices

1. **Enable automatic snapshots** - Provides recovery points
2. **Monitor pack file creation** - Consolidates updates reliably
3. **Test restoration periodically** - Verify recovery tools work
4. **Keep backups** - Multiple recovery options
5. **Log CRDT operations** - Helps diagnose issues

### Debugging Code

When investigating in application code:

```typescript
import { decodeUpdateFile } from '@notecove/shared/crdt/update-format';

// Read update file
const fileData = await fs.readFile(updatePath);

// Decode (automatically handles 0x01 prefix)
const updateData = decodeUpdateFile(fileData);

// Apply to Yjs doc
Y.applyUpdate(doc, updateData);
```

The `decodeUpdateFile` function should handle the 0x01 prefix internally.

## Case Study: Note 13fd9c31-824a-44fc-9098-e0d00c14d9bd

**Symptoms**: Note appeared to have content, then became empty.

**Investigation Results**:

1. ✅ 81 update files - all decoded successfully after skipping 0x01 prefix
2. ✅ Updates contained only metadata, no text content
3. ✅ Snapshot at sequence 77 - empty document
4. ✅ Pack file (sequences 1-24) - **contained recoverable content**

**Recovered Content**:

```
Note wher

069d0284-ff55-43a7-976c-0a3e59e40957
```

**Timeline**:

- Sequences 1-24: Content added ("Note wher..." + UUID)
- Sequences 25-77: Only metadata updates (no content changes)
- Snapshot at 77: Captured empty state
- Instance IDs: 3 different devices/sessions involved

**Conclusion**: Pack file was the only source with actual content. Individual updates from sequences 25+ were metadata-only. The note appears to have been mostly empty from the start, with only minimal test content.

**Key Learning**: Always check pack files first - they're often the most reliable recovery source.

## Troubleshooting

### "Error: Unexpected case" when replaying updates

**Cause**: Not skipping the 0x01 prefix byte before passing to Yjs.

**Fix**:

```typescript
const fileData = await fs.readFile(updatePath);
const updateData = fileData.slice(1); // Skip first byte
Y.applyUpdate(doc, updateData);
```

### "Error: Unexpected end of array"

**Cause**: File is truncated or corrupted, or 0x01 prefix not skipped.

**Fix**:

1. Verify file has 0x01 prefix and skip it
2. Check file size - should be > 1 byte
3. Try pack files instead

### "zstd: error 70 : Restore default decompression parameters"

**Cause**: Trying to decompress with 0x01 prefix included.

**Fix**:

```bash
dd bs=1 skip=1 if=file.yjson.zst | zstd -d -c > output.yjson
```

### All content shows as "(empty)"

**Possible causes**:

1. Note genuinely never had content
2. Content was deleted in a later update
3. Looking at wrong fragment (should be 'content', not other fragments)

**Verify**:

- Check pack files for earlier content
- Look for deletion operations in update replay
- Examine other instance IDs

## Related Documentation

- [CRDT Format Specification](../packages/shared/src/crdt/README.md) (if exists)
- [Snapshot Format Tests](../packages/shared/src/crdt/__tests__/snapshot-format.test.ts)
- [Update Manager](../packages/shared/src/storage/update-manager.ts)

## Tools Reference

All investigation scripts are in `packages/shared/src/__manual__/`:

- `replay-note-updates.ts` - Replay all updates sequentially
- `extract-snapshot.ts` - Extract content from snapshots
- `extract-pack.ts` - Extract content from pack files

Build before use:

```bash
pnpm --filter @notecove/shared build
```

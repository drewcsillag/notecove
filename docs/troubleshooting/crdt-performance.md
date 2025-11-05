# CRDT Performance Troubleshooting Guide

This guide helps diagnose and resolve performance issues with the CRDT snapshot and packing system.

## Symptoms and Solutions

### Slow Document Loading

**Symptom:** Document takes 3+ seconds to load on cold start

**Diagnostic Steps:**

1. Check console logs for snapshot loading:
   ```
   [CRDT Manager] Attempting to load snapshot <filename>
   ```

2. Check if snapshots exist:
   ```bash
   ls -la ~/Library/Application\ Support/NoteCove/notes/<note-id>/snapshots/
   ```

3. Check file counts:
   ```bash
   find ~/Library/Application\ Support/NoteCove/notes/<note-id> -type f | wc -l
   ```

**Common Causes:**

1. **No snapshots created**
   - **Cause:** Document hasn't been edited enough (< 50-500 updates depending on activity)
   - **Solution:** Snapshots are created automatically. Continue editing or close/reopen document
   - **Check:** Look for "Snapshot created" in logs

2. **Corrupted snapshots**
   - **Cause:** Filesystem error during write, Google Drive sync issue
   - **Solution:** System automatically falls back to update files. Check logs for:
     ```
     Failed to load snapshot <filename>, trying next
     ```
   - **Recovery:** Delete corrupted snapshot file, new one will be created

3. **Too many update files**
   - **Cause:** Packing not running or gap in sequence numbers
   - **Solution:** Check packing job logs:
     ```
     [CRDT Manager] Periodic packing: packed N updates
     ```
   - **Manual fix:** Close and reopen app to trigger packing

### High File Count (>200 files per note)

**Symptom:** Notes directory has hundreds or thousands of files

**Diagnostic Steps:**

1. Count files by type:
   ```bash
   cd ~/Library/Application\ Support/NoteCove/notes/<note-id>
   echo "Snapshots: $(find snapshots -type f 2>/dev/null | wc -l)"
   echo "Packs: $(find packs -type f 2>/dev/null | wc -l)"
   echo "Updates: $(find updates -type f 2>/dev/null | wc -l)"
   ```

2. Check for gaps in sequence numbers:
   ```bash
   ls updates/ | grep -oE '_[0-9]+\.yjson$' | sed 's/_//;s/.yjson//' | sort -n
   ```

**Common Causes:**

1. **Packing not running**
   - **Cause:** App closed before background job runs (every 5 minutes)
   - **Solution:** Leave app open for 5+ minutes to allow packing
   - **Check:** Look for "Started periodic packing job" in logs

2. **Sequence gaps preventing packing**
   - **Cause:** Instance crashed during write, sync latency
   - **Solution:** Wait 24 hours for gap timeout, or manually delete gap files
   - **Check:** Look for non-sequential numbers in updates/

3. **Multiple instances creating files faster than packing**
   - **Normal:** During active multi-device editing
   - **Solution:** Files will be packed in next 5-minute cycle
   - **Not a problem** unless file count grows continuously

### Garbage Collection Not Running

**Symptom:** Old snapshots and packs not being deleted

**Diagnostic Steps:**

1. Check GC logs:
   ```
   [CRDT Manager] GC: deleted X snapshots, Y packs, Z updates
   ```

2. Count old snapshots:
   ```bash
   ls snapshots/ | wc -l
   # Should be ≤ 3 (configurable, default retention)
   ```

3. Check GC timing (runs every 30 minutes)

**Common Causes:**

1. **App not running long enough**
   - **Cause:** GC runs every 30 minutes
   - **Solution:** Leave app open for 30+ minutes
   - **Check:** Look for "Started periodic GC" in logs

2. **Recent snapshots (< 24 hours old)**
   - **Cause:** Minimum history retention (24h by default)
   - **Solution:** Wait 24 hours, files will be deleted
   - **Config:** See gc-config.ts for MINIMUM_HISTORY_HOURS

3. **No newer snapshot to supersede old ones**
   - **Cause:** Document not being edited
   - **Solution:** This is normal, GC only deletes when newer snapshot exists
   - **Expected:** Old snapshots retained until new one created

### Google Drive Sync Issues

**Symptom:** Missing files, sync errors, slow performance

**Diagnostic Steps:**

1. Check if files are cloud-synced:
   ```bash
   # macOS: look for cloud icon in Finder
   xattr -l <file-path>
   ```

2. Check Google Drive File Stream status

3. Look for "ENOENT" errors in console logs

**Common Causes:**

1. **Files not synced yet**
   - **Cause:** Google Drive sync latency (seconds to minutes)
   - **Solution:** System automatically retries, eventual consistency
   - **Workaround:** Wait for sync, or copy files manually

2. **Selective Sync disabled for NoteCove folder**
   - **Cause:** Google Drive settings
   - **Solution:** Enable selective sync for NoteCove folder
   - **Check:** Google Drive preferences

3. **Quota exceeded**
   - **Cause:** Google Drive storage full
   - **Solution:** Free up space or upgrade storage
   - **Check:** Google Drive web interface

### High CPU Usage

**Symptom:** App using high CPU continuously

**Diagnostic Steps:**

1. Check telemetry for operation frequency:
   ```
   [Telemetry] Snapshot creation: X ms
   [Telemetry] Pack creation: Y ms
   ```

2. Profile with Activity Monitor (macOS) or Task Manager (Windows)

3. Check for excessive edit rate (console logs)

**Common Causes:**

1. **Very high edit rate (>10 edits/min)**
   - **Cause:** Rapid typing, automated edits, bulk paste
   - **Solution:** This is normal, adaptive snapshots will adjust
   - **Effect:** More frequent snapshots (every 50 updates)
   - **Not a problem** unless sustained for hours

2. **Snapshot creation loop**
   - **Cause:** Bug in snapshot trigger logic
   - **Solution:** Report as bug with logs
   - **Workaround:** Restart app

3. **Infinite packing loop**
   - **Cause:** Sequence gap causing repeated packing attempts
   - **Solution:** Delete problematic update files
   - **Check:** Look for "packing failed" errors repeatedly

## Configuration Options

### Snapshot Triggers (Adaptive)

**File:** `packages/desktop/src/main/crdt/crdt-manager.ts`

**Thresholds:**
- Very high activity (>10 edits/min): 50 updates
- High activity (5-10 edits/min): 100 updates
- Medium activity (1-5 edits/min): 200 updates
- Low activity (<1 edit/min): 500 updates
- Idle (>30 min): 50 updates (forced)

**Modification:** Edit `calculateSnapshotThreshold()` function

### Packing Configuration

**File:** `packages/desktop/src/main/crdt/crdt-manager.ts`

**Settings:**
- Interval: Every 5 minutes (`startPeriodicPacking()`)
- Keep recent: Last 50 updates unpacked
- Minimum pack size: 10 updates

**Modification:** Edit interval in `startPeriodicPacking()`

### Garbage Collection Configuration

**File:** `packages/shared/src/crdt/gc-config.ts`

**Settings:**
- Interval: Every 30 minutes
- Snapshot retention: Last 3 snapshots
- Minimum history: 24 hours

**Modification:** Edit `DEFAULT_GC_CONFIG` object

### Telemetry Configuration

**File:** Settings → Telemetry tab

**Options:**
- Local metrics: Always on (console/file)
- Remote metrics: Optional (Datadog via OTLP)
- Export interval: 60 seconds

**Modification:** Use settings UI or edit config

## Monitoring Metrics

### Key Performance Indicators

**Cold Load Time:**
- Target: < 250ms
- Warning: > 500ms
- Critical: > 1000ms

**File Count per Note:**
- Target: 50-100 files
- Warning: > 200 files
- Critical: > 500 files

**Snapshot Frequency:**
- Should match activity level
- Very active: snapshot every few minutes
- Idle: snapshot every 30+ minutes

**Pack/GC Success Rate:**
- Target: 100% (no errors)
- Warning: Occasional errors OK
- Critical: Repeated failures

### Viewing Metrics

**Console Logs:**
```
[Telemetry] Cold load: 150ms
[Telemetry] Snapshot created: 45ms (threshold: 100, edits: 127)
[Telemetry] Pack created: 23ms (50 updates)
[Telemetry] GC: deleted 2 snapshots, 15 packs, 0 updates (freed 1.2 MB)
```

**Datadog Dashboard (if enabled):**
- crdt.cold_load.duration_ms (P50, P95, P99)
- crdt.files.total_per_note (histogram)
- crdt.snapshot.created (counter)
- crdt.gc.files_deleted (counter)

## Manual Recovery Procedures

### Reset All Snapshots/Packs (Nuclear Option)

**When:** Corrupted state, excessive file count, testing

**Procedure:**
1. Close NoteCove app
2. Delete snapshot and pack directories:
   ```bash
   cd ~/Library/Application\ Support/NoteCove/notes/<note-id>
   rm -rf snapshots/
   rm -rf packs/
   ```
3. Reopen app
4. Document will load from update files (slower first time)
5. New snapshot will be created on close

**Effect:**
- Next load will be slower (loading all updates)
- File count may temporarily increase
- System will self-heal within 30 minutes

### Fix Sequence Gaps

**When:** Packing stalled due to gaps

**Procedure:**
1. Identify gap in sequence numbers:
   ```bash
   ls updates/ | grep instance-ABC | grep -oE '[0-9]+\.yjson' | sed 's/.yjson//' | sort -n
   ```
2. Check if gap is permanent (>24 hours old)
3. If permanent, files after gap are safe to keep
4. System will automatically pack around gaps after 24h timeout

**Note:** Do not manually delete update files unless absolutely necessary (data loss risk)

### Clear Telemetry Data

**When:** Privacy concerns, testing

**Procedure:**
- Telemetry is ephemeral (not persisted)
- To disable remote metrics: Settings → Telemetry → Toggle off
- Local metrics cannot be disabled (used for debugging)

## Getting Help

If issues persist after following this guide:

1. **Collect Logs:**
   - Console output from app startup to issue reproduction
   - File listing: `find notes/<note-id> -type f`
   - Telemetry metrics (if enabled)

2. **Report Issue:**
   - Include logs, file counts, and symptoms
   - Describe reproduction steps
   - Note your environment (OS, filesystem, cloud sync)

3. **Community Resources:**
   - GitHub Issues: https://github.com/anthropics/notecove/issues
   - Documentation: docs/architecture/crdt-snapshot-packing.md

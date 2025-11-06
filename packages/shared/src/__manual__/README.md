# Sync Fuzz Testing

This directory contains a comprehensive fuzz testing system for multi-instance CRDT synchronization. It simulates sloppy file sync (like Google Drive or iCloud) to validate that the sync mechanisms work correctly under realistic conditions.

## Overview

The system consists of:

- **Event Log**: Records all operations for replay and debugging
- **Sync Daemon**: Simulates file sync with delays, out-of-order delivery, partial writes
- **Test Instance**: Wraps UpdateManager, ActivityLogger, ActivitySync to simulate running instances
- **Validation**: Checks if instances converge to the same state
- **Timeline Visualizer**: Generates ASCII and HTML timelines for debugging

## Usage

### Building

First, build the shared package:

```bash
cd packages/shared
pnpm build
```

### Running Tests

Run a built-in scenario:

```bash
# Quick smoke test (30 seconds)
NODE_ENV=test node packages/shared/dist/esm/__manual__/sync-fuzz-test.js --scenario quick-smoke

# Rapid edits to same note (60 seconds)
NODE_ENV=test node packages/shared/dist/esm/__manual__/sync-fuzz-test.js --scenario rapid-same-note

# Many different notes (2 minutes)
NODE_ENV=test node packages/shared/dist/esm/__manual__/sync-fuzz-test.js --scenario many-notes

# Half-duplex test (1.5 minutes)
NODE_ENV=test node packages/shared/dist/esm/__manual__/sync-fuzz-test.js --scenario half-duplex-test

# Chaos test (5 minutes)
NODE_ENV=test node packages/shared/dist/esm/__manual__/sync-fuzz-test.js --scenario chaos
```

Override duration:

```bash
# Run chaos test for 20 minutes
NODE_ENV=test node packages/shared/dist/esm/__manual__/sync-fuzz-test.js --scenario chaos --duration 1200
```

### Output

Results are saved to `/tmp/fuzz-test-{scenario}-{timestamp}/`:

```
/tmp/fuzz-test-chaos-2025-01-06T12-34-56/
├── instance-1/              # First instance's storage directory
│   ├── notes/
│   ├── updates/
│   └── .activity/
├── instance-2/              # Second instance's storage directory
│   ├── notes/
│   ├── updates/
│   └── .activity/
├── event-log.jsonl         # Complete event log (one JSON per line)
├── timeline.txt            # ASCII timeline
├── timeline.html           # Interactive HTML timeline
├── validation-report.json  # Machine-readable validation results
└── validation-report.md    # Human-readable summary
```

## Built-in Scenarios

### quick-smoke

- **Duration**: 30s
- **Purpose**: Quick sanity check
- **Operations**: 5 creates, 10 edits per instance
- **Sync**: Bidirectional, moderate delays

### rapid-same-note

- **Duration**: 60s
- **Purpose**: Stress-test CRDT merging
- **Operations**: Both instances rapidly edit the same note (50 edits each)
- **Sync**: Bidirectional, out-of-order enabled

### many-notes

- **Duration**: 2 minutes
- **Purpose**: Test handling of many different notes
- **Operations**: 20 creates, 40 edits per instance
- **Sync**: Bidirectional with batching
- **GC**: Triggered every 30s

### half-duplex-test

- **Duration**: 90s
- **Purpose**: Validate one-way sync
- **Operations**: Instance 1 writes, Instance 2 only receives
- **Sync**: Instance 1 → Instance 2 only

### chaos

- **Duration**: 5 minutes (configurable)
- **Purpose**: Maximum sloppiness with all operation types
- **Operations**: Creates, edits, deletes on both instances
- **Sync**: Maximum delay variance (100ms - 5000ms), out-of-order, batching, 40% partial writes
- **GC**: Every 60s
- **Snapshots**: Every 90s

## What Gets Tested

### Sync Daemon Sloppiness

- ✅ **Random delays**: 100ms - 5000ms per file
- ✅ **Out-of-order delivery**: Files arrive in different order than written
- ✅ **Batching**: Multiple files arrive together after delay
- ✅ **Partial writes**: File written incompletely (30-70%), then completed later
- ✅ **Half-duplex**: One-way sync (instance1 → instance2 or vice versa)

### Operations Tested

- ✅ **Concurrent edits to same note** (CRDT merge)
- ✅ **Concurrent edits to different notes**
- ✅ **Create/delete operations**
- ✅ **Rapid consecutive edits** (activity log coalescing)
- ✅ **Garbage collection** (activity log compaction)
- ✅ **Snapshotting**

### Validation

After all operations complete + 30s settling time, the system validates:

1. **Note count matches** between instances
2. **Yjs state vectors match** for each note (byte-for-byte identical CRDT state)
3. **Delete flags match**

## Debugging Failures

When a test fails, examine:

### 1. Validation Report

```bash
cat /tmp/fuzz-test-*/validation-report.md
```

Shows:

- Which notes diverged
- What the divergence was (missing, content mismatch, delete mismatch)
- Statistics about the test run

### 2. HTML Timeline

```bash
open /tmp/fuzz-test-*/timeline.html
```

Features:

- Swimlane view of all events
- Filter by note ID
- Color-coded event types
- Expandable metadata

### 3. Event Log

```bash
less /tmp/fuzz-test-*/event-log.jsonl
```

Each line is a JSON event with:

- Timestamp
- Instance ID
- Event type
- Note ID and title
- Sequence number
- Metadata

### 4. File System Inspection

```bash
# Compare storage directories
ls -R /tmp/fuzz-test-*/instance-1/
ls -R /tmp/fuzz-test-*/instance-2/

# Check specific note
cat /tmp/fuzz-test-*/instance-1/notes/note-xyz/updates/*
```

## Adding Custom Scenarios

Create a new scenario in `sync-fuzz-test.ts`:

```typescript
scenarios['my-scenario'] = {
  name: 'My custom scenario',
  duration: 120,
  description: 'What this tests',
  syncDelayRange: [500, 2000],
  syncDirection: 'bidirectional',
  enableOutOfOrder: true,
  enableBatching: true,
  batchWindowMs: 500,
  partialWriteProbability: 0.3,
  instance1Operations: [
    { type: 'create', delayMs: 200, repeat: 10 },
    { type: 'edit', delayMs: 300, repeat: 20, textLength: 100 },
  ],
  instance2Operations: [
    { type: 'create', delayMs: 250, repeat: 10 },
    { type: 'edit', delayMs: 350, repeat: 20, textLength: 100 },
  ],
};
```

## Architecture

### Event Flow

```
Instance 1                     Sync Daemon                    Instance 2
    │                               │                               │
    ├─ create note ────────────────>│                               │
    │  writeUpdate()                │                               │
    │  recordActivity()             │                               │
    │                               ├─ Queue sync (delay: 2.3s)    │
    │                               │                               │
    ├─ edit note ──────────────────>│                               │
    │                               ├─ Queue sync (delay: 1.8s)    │
    │                               │                               │
    │                               ├─ Process queue ──────────────>│
    │                               │  (copy files)                 │
    │                               │                               ├─ syncFromOthers()
    │                               │                               │  reloadNote()
    │                               │                               │
```

### Validation Flow

```
1. Run operations on both instances
2. Sync daemon copies files with delays
3. Instances periodically call syncFromOthers()
4. Activity log triggers reloadNote() when updates appear
5. After test: wait 30s for settling
6. Compare Yjs states between instances
7. Generate reports
```

## Known Limitations

- **Not run in CI**: These are manual tests due to long duration and non-determinism
- **Requires build**: Must run `pnpm build` before testing
- **macOS/Linux only**: Uses POSIX file system features

## Tips

- Start with `quick-smoke` to verify setup
- Use `chaos` for long soak tests (20+ minutes)
- Check `timeline.html` first when debugging - it's the most visual
- Event log is JSON Lines - easy to grep: `grep "note-123" event-log.jsonl`
- Partial writes stress-test the "read while writing" case

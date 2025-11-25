# Sync Testing Guide

This guide documents NoteCove's sync testing infrastructure, including fuzz tests for CRDT synchronization and E2E tests for cross-machine sync scenarios.

## Overview

NoteCove uses several types of tests to verify sync reliability:

1. **Sloppy Sync Fuzz Test** - Tests CRDT log sync under adverse conditions (partial files, delayed sync)
2. **Cross-SD Move Fuzz Test** - Tests note move operations with concurrent instances and crash recovery
3. **Cross-Machine Sync E2E Tests** - Playwright tests simulating two machines syncing via cloud storage

## Sloppy Sync Fuzz Test

Tests CRDT log synchronization under conditions that simulate cloud sync services like iCloud or Dropbox.

### Location

```
packages/shared/src/__manual__/sloppy-sync-fuzz-test.ts
```

### What It Tests

- **Sloppy inter-file sync**: Files sync at different times/rates
- **Ordered intra-file sync**: Individual file changes arrive in order
- **Partial file sync**: Files may be truncated during sync (simulating incomplete uploads)

### Running the Test

```bash
# Run all scenarios (30s each by default)
npx tsx packages/shared/src/__manual__/sloppy-sync-fuzz-test.ts

# Run a specific scenario
npx tsx packages/shared/src/__manual__/sloppy-sync-fuzz-test.ts --scenario partial-file
npx tsx packages/shared/src/__manual__/sloppy-sync-fuzz-test.ts --scenario delayed-sync

# Adjust duration (in seconds)
npx tsx packages/shared/src/__manual__/sloppy-sync-fuzz-test.ts --duration 120
```

### Scenarios

| Scenario                  | Description                                                   |
| ------------------------- | ------------------------------------------------------------- |
| `basic-sloppy-sync`       | Two instances write records, sync is delayed and out of order |
| `partial-file-sync`       | Files may arrive partially (30% probability of truncation)    |
| `rapid-edits`             | Stress test with rapid alternating writes from two instances  |
| `note-load-partial-files` | Tests NoteStorageManager handling of truncated files          |

### How It Works

The test uses `SloppySyncFileSystem`, an in-memory file system that simulates:

- Configurable sync delays (100ms - 2000ms)
- Random partial file visibility (0-50% probability)
- Delayed file visibility (files become "visible" after a random delay)

## Cross-SD Move Fuzz Test

Tests note move operations across storage directories with concurrent instances and crash recovery.

### Location

```
packages/desktop/src/__manual__/cross-sd-move-fuzz-test.ts
```

### What It Tests

- **Concurrent moves**: Multiple instances moving notes simultaneously
- **Interrupted moves**: Recovery from crashes at each state in the move state machine
- **Missing SD access**: Handling when source/target SD is not accessible during recovery

### Running the Test

```bash
# Run all scenarios
NODE_ENV=test npx tsx packages/desktop/src/__manual__/cross-sd-move-fuzz-test.ts

# Run a specific scenario
NODE_ENV=test npx tsx packages/desktop/src/__manual__/cross-sd-move-fuzz-test.ts --scenario=concurrent-moves
NODE_ENV=test npx tsx packages/desktop/src/__manual__/cross-sd-move-fuzz-test.ts --scenario=interrupted-moves
NODE_ENV=test npx tsx packages/desktop/src/__manual__/cross-sd-move-fuzz-test.ts --scenario=missing-sd
```

### Scenarios

| Scenario            | Description                                                                           |
| ------------------- | ------------------------------------------------------------------------------------- |
| `concurrent-moves`  | Two instances move 10 notes concurrently to different SDs                             |
| `interrupted-moves` | Simulates crash at each state: initiated, copying, files_copied, db_updated, cleaning |
| `missing-sd`        | Tests recovery when source SD becomes inaccessible mid-move                           |

### Move State Machine

The NoteMoveManager uses a state machine to ensure atomic cross-SD moves:

```
initiated → copying → files_copied → db_updated → cleaning → completed
```

The fuzz test verifies recovery from each intermediate state.

## Cross-Machine Sync E2E Tests

Playwright tests that simulate two machines syncing via cloud storage using a file sync simulator.

### Location

```
packages/desktop/e2e/cross-machine-sync.spec.ts
packages/desktop/e2e/utils/sync-simulator.ts
```

### Running the Tests

```bash
# Run all cross-machine sync tests
pnpm --filter @notecove/desktop test:e2e --grep "cross-machine"

# Run a specific test
pnpm --filter @notecove/desktop test:e2e --grep "should sync content from Instance A to Instance B"
pnpm --filter @notecove/desktop test:e2e --grep "should update live editor"
pnpm --filter @notecove/desktop test:e2e --grep "should resolve conflicting moves"
```

### Test Scenarios

| Test               | Description                                                        |
| ------------------ | ------------------------------------------------------------------ |
| Smoke test         | Two instances share same SD, verify basic edit sync                |
| Basic sync         | Instance A types → file sync → Instance B sees content             |
| Bidirectional sync | A types → sync → B types → sync → both verify                      |
| Live editor sync   | Both instances have same note open, edits sync live                |
| Note move sync     | A moves note to folder → syncs to B                                |
| Move conflict      | Both instances move same note to different folders → CRDT resolves |

### FileSyncSimulator

The `FileSyncSimulator` class simulates cloud storage sync behavior:

```typescript
const simulator = new FileSyncSimulator({
  sourceDir: sd1Path,
  targetDir: sd2Path,
  minDelay: 1000, // Minimum sync delay in ms
  maxDelay: 3000, // Maximum sync delay in ms
  bidirectional: true, // Enable two-way sync
  logger: new SimulatorLogger({ enabled: true, verbose: false }),
});

simulator.start();
// ... run test ...
simulator.stop();
```

#### Features

- **Configurable delays**: Simulate real-world cloud sync latency
- **Bidirectional sync**: Both SDs sync to each other
- **Partial file simulation**: Files can appear truncated initially
- **File ordering randomization**: Activity logs and CRDT logs sync independently
- **Append-only file handling**: "Largest file wins" logic for `.crdtlog` and `.log` files

### Debug Utilities

The sync simulator includes several debugging utilities:

```typescript
import {
  inspectSDContents,
  formatSDContents,
  parseCRDTLogSequences,
  validateSequenceOrder,
  validateAllSequences,
} from './utils/sync-simulator';

// Inspect SD directory contents
const contents = await inspectSDContents(sdPath);
console.log(formatSDContents(contents));

// Validate CRDT log sequence numbers are in order
const sequences = await parseCRDTLogSequences(logFilePath);
const { valid, errors } = validateSequenceOrder(sequences);

// Validate all log files in an SD
const allValid = await validateAllSequences(sdPath);
```

### Known Limitations

1. **macOS FSEvents reliability**: ~10-30% flakiness due to FSEvents not always detecting file appends reliably
2. **Test cleanup race conditions**: Occasional cleanup failures don't affect test validity
3. **Timing variations**: Cloud sync simulation introduces variable timing

### Troubleshooting

**Tests timing out:**

- Increase test timeout in playwright.config.ts
- Check that builds are up to date: `pnpm build`

**Inconsistent results:**

- Run multiple times to verify (tests have expected ~70-90% pass rate)
- Check console logs for ActivitySync and CRDT Manager messages

**Cleanup failures:**

- Temporary directories in `/tmp/notecove-*` can be manually removed
- Tests clean up after themselves but may leave artifacts on crash

## CI Configuration

Cross-machine sync tests are excluded from normal CI runs to avoid flakiness issues:

```typescript
// playwright.config.ts
{
  grep: /^((?!cross-machine).)*$/,  // Exclude cross-machine tests
}
```

To run these tests locally or in a dedicated CI job:

```bash
pnpm --filter @notecove/desktop test:e2e --grep "cross-machine"
```

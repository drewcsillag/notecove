# NoteCove Sync TLA+ Specification

This directory contains a TLA+ specification for verifying the correctness of NoteCove's synchronization system.

## Overview

The spec models:

- **CRDT logs**: Append-only logs per node, synced via cloud storage
- **Activity logs**: Notification mechanism for note changes
- **Vector clocks**: Track what each node has seen from others
- **Cloud sync**: Non-deterministic file delivery
- **Failure modes**: Crashes, restarts, activity log compaction

## Files

| File                    | Description                                         |
| ----------------------- | --------------------------------------------------- |
| `NoteCoveSync.tla`      | Main specification with state variables and actions |
| `NoteCoveSyncTypes.tla` | Type definitions and helper functions               |
| `NoteCoveSync.cfg`      | TLC model checker configuration                     |

## Prerequisites

1. Install TLA+ Toolbox: `brew install --cask tla+-toolbox`
2. Ensure TLC is available in PATH or create a wrapper script

## Running the Spec

```bash
# From this directory
~/bin/tlc NoteCoveSync.tla

# Or with Java directly
java -cp /path/to/tla2tools.jar tlc2.TLC NoteCoveSync.tla
```

## Properties Verified

### Safety Invariants

- **TypeOK**: All state variables have correct types
- **VectorClockMonotonic**: Vector clocks never decrease
- **SequenceContiguous**: Log sequence numbers are contiguous (no gaps)
- **ValidUpdates**: Documents only contain valid update IDs
- **ConvergenceInvariant**: `FullySynced => Converged`

### Temporal Properties

- **AlwaysConvergesWhenFullySynced**: Once fully synced, nodes have identical state

## Model Parameters

| Constant       | Default    | Description                         |
| -------------- | ---------- | ----------------------------------- |
| `Node`         | `{n1, n2}` | Set of node identifiers             |
| `MaxUpdates`   | `3`        | Maximum number of edits to model    |
| `MaxLogSize`   | `5`        | Activity log size before compaction |
| `ActivityMode` | `"append"` | `"append"` or `"replace"` mode      |

## State Space

With default parameters:

- **538,557 states generated**
- **98,612 distinct states**
- **7 seconds** to check

With compaction enabled (MaxLogSize=2):

- **552,557 states generated**
- **101,172 distinct states**

## Actions

| Action                  | Description                                |
| ----------------------- | ------------------------------------------ |
| `Edit(n)`               | User makes a change on node n              |
| `CloudSyncLog(n)`       | CRDT log entry syncs to cloud              |
| `CloudSyncActivity(n)`  | Activity log entry syncs to cloud          |
| `ReloadDirect(n)`       | Node reloads from CRDT logs (folder-style) |
| `PollActivity(n)`       | Node polls activity logs (note-style)      |
| `ReloadFromActivity(n)` | Node reloads after detecting activity      |
| `CompactActivity(n)`    | Activity log is compacted                  |
| `FullScanFallback(n)`   | Node recovers from compaction gap          |
| `SaveSnapshot(n)`       | Node saves state to DB cache               |
| `Crash(n)`              | Node crashes                               |
| `Restart(n)`            | Node restarts from cache + logs            |

## Key Design Decisions

1. **Yjs as black box**: CRDT merging abstracted as set union
2. **Documents as update sets**: Convergence = same set of update IDs
3. **Two sync modes**: Direct (folders) and activity-based (notes)
4. **Non-deterministic cloud**: Files appear in arbitrary order
5. **Crash recovery**: Load DB cache, then replay CRDT logs

## Known Limitations

- Models single note/folder (actual system has many)
- No network partitions modeled
- No partial file reads (handled by retry in real system)
- Timing abstracted away (polling intervals, backoff delays)

## Related Documents

- [SYNC-ARCHITECTURE.md](../SYNC-ARCHITECTURE.md) - Implementation details
- [MODEL-DESIGN.md](../MODEL-DESIGN.md) - Design rationale
- [PLAN-TLA.md](../PLAN-TLA.md) - Development plan

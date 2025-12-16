# TLA+ Formal Specification

NoteCove's sync system has been formally verified using TLA+ and the TLC model checker to ensure correctness.

## What is TLA+?

**TLA+** (Temporal Logic of Actions) is a formal specification language for designing, modeling, and verifying concurrent and distributed systems.

**Why formal verification?**

- Finds bugs that testing misses
- Proves correctness mathematically
- Documents system behavior precisely
- Catches edge cases in concurrent code

**Who uses TLA+?**

- Amazon Web Services (S3, DynamoDB, EBS)
- Microsoft (Azure Cosmos DB)
- MongoDB
- Elastic

## What We Verify

The specification models NoteCove's sync architecture and verifies:

### Safety Properties

**Convergence:** After synchronization completes, all nodes have identical document state.

```
FullySynced => Converged
```

**Vector Clock Monotonicity:** Vector clocks never decrease (no lost updates).

**Sequence Contiguity:** Log sequence numbers have no gaps.

**Valid Updates:** Documents only contain legitimate update IDs.

### Liveness Properties

**Eventually Synchronized:** The system eventually reaches a fully synchronized state.

```
[](FullySynced => Converged)
```

## Model Coverage

The specification models:

| Component      | Description                                 |
| -------------- | ------------------------------------------- |
| CRDT Logs      | Append-only logs per node, synced via cloud |
| Activity Logs  | Notification mechanism for note changes     |
| Vector Clocks  | Track what each node has seen               |
| Cloud Sync     | Non-deterministic file delivery             |
| Crash Recovery | Restart from DB cache + log replay          |
| Compaction     | Activity log truncation with gap detection  |

### Actions Modeled

| Action               | Description                         |
| -------------------- | ----------------------------------- |
| `Edit`               | User makes a change                 |
| `CloudSyncLog`       | CRDT log syncs to cloud             |
| `CloudSyncActivity`  | Activity notification syncs         |
| `ReloadDirect`       | Load from CRDT logs (folder-style)  |
| `PollActivity`       | Check for new activity (note-style) |
| `ReloadFromActivity` | Reload after detecting activity     |
| `CompactActivity`    | Activity log is truncated           |
| `FullScanFallback`   | Recover from compaction gap         |
| `SaveSnapshot`       | Save state to DB cache              |
| `Crash`              | Node crashes                        |
| `Restart`            | Node restarts from cache + logs     |

## Verification Results

With the default model parameters:

| Metric            | Value     |
| ----------------- | --------- |
| States generated  | 538,557   |
| Distinct states   | 98,612    |
| Verification time | 7 seconds |
| Errors found      | 0         |

All safety and liveness properties pass.

### Bugs Found During Development

The TLC model checker found a subtle bug during specification development:

**Sequence collision on restart:** If a node crashes after writing to its local log but before cloud sync, and then restarts without reading its own pending logs, it could reuse sequence numbers. This was fixed by ensuring restart reads the node's own local logs (which the real implementation already does correctly).

## Running the Specification

### Prerequisites

Install the TLA+ Toolbox which includes TLC:

**macOS:**

```bash
brew install --cask tla-plus-toolbox
```

**Windows/Linux:**

Download from [https://github.com/tlaplus/tlaplus/releases](https://github.com/tlaplus/tlaplus/releases)

### Option 1: Command Line

Create a wrapper script for TLC:

```bash
#!/bin/bash
# Save as ~/bin/tlc and chmod +x

TLATOOLS="/Applications/TLA+ Toolbox.app/Contents/Eclipse/plugins/org.lamport.tlatools_1.0.0.202408081958/tla2tools.jar"
cd "$(dirname "$1")"
java -XX:+UseParallelGC -cp "$TLATOOLS" tlc2.TLC "$(basename "$1")" "${@:2}"
```

Then run:

```bash
cd /path/to/notecove/spec
~/bin/tlc NoteCoveSync.tla
```

### Option 2: TLA+ Toolbox GUI

1. Open TLA+ Toolbox
2. File → Open Spec → Add New Spec
3. Select `NoteCoveSync.tla`
4. Create a new model (TLC Model Checker → New Model)
5. Configure constants and properties
6. Run the model checker

### Configuration

The `NoteCoveSync.cfg` file specifies:

```
CONSTANTS
    Node = {n1, n2}      \* Two nodes
    MaxUpdates = 3       \* Max edits to model
    MaxLogSize = 5       \* Activity log size
    ActivityMode = "append"

INVARIANT TypeOK
INVARIANT VectorClockMonotonic
INVARIANT SequenceContiguous
INVARIANT ValidUpdates
INVARIANT ConvergenceInvariant

PROPERTY AlwaysConvergesWhenFullySynced
```

You can adjust these parameters to explore different scenarios:

- Increase `MaxUpdates` to model more edits (increases state space)
- Set `ActivityMode = "replace"` to test replace-last-line mode
- Decrease `MaxLogSize` to trigger compaction behavior

## Specification Files

| File                    | Description                               |
| ----------------------- | ----------------------------------------- |
| `NoteCoveSync.tla`      | Main specification with state and actions |
| `NoteCoveSyncTypes.tla` | Type definitions and helper operators     |
| `NoteCoveSync.cfg`      | TLC model checker configuration           |
| `README.md`             | Detailed specification documentation      |

## Architecture Mapping

The specification abstracts the real implementation:

| Spec Concept            | Implementation                 |
| ----------------------- | ------------------------------ |
| `localDoc` (set of IDs) | `Y.Doc` (Yjs document)         |
| `pendingLogs`           | Local log files not yet synced |
| `syncedLogs`            | Log files visible on cloud     |
| `vectorClock`           | `VectorClock` type in code     |
| `dbCache`               | SQLite `note_sync_state` table |
| `CloudSync` action      | Cloud provider file sync       |
| `Crash`/`Restart`       | App crash and relaunch         |

## Limitations

The specification makes simplifying assumptions:

- **Single document:** Models one note/folder (real system has many)
- **No network partitions:** Files eventually sync (no permanent isolation)
- **No partial reads:** Files are read completely or not at all
- **Abstract timing:** No real-time constraints modeled

These simplifications keep the state space tractable while capturing the essential sync logic.

## Further Reading

- [TLA+ Home Page](https://lamport.azurewebsites.net/tla/tla.html)
- [Learn TLA+ (online book)](https://learntla.com/)
- [TLA+ Video Course by Leslie Lamport](https://lamport.azurewebsites.net/video/videos.html)
- [Amazon's Use of Formal Methods](https://www.amazon.science/publications/how-amazon-web-services-uses-formal-methods)

## Next Steps

- [Understand sync mechanism](/architecture/sync-mechanism)
- [Learn about storage architecture](/architecture/storage-architecture)
- [Back to architecture overview](/architecture/)

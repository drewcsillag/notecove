# Plan Critique Summary

## Issues Fixed

### 1. Ordering/Dependency Problems

- **Consolidated Phase 3 and 5**: NoteStorageManager changes now in one place (Phase 3)
- **Moved index.ts wiring earlier**: Phase 2.4 now wires profileId through before Phase 3 needs it
- **Merged generateCompactId()**: Now in Phase 1.1 with other encoding utilities

### 2. Added Missing Details

- **Mid-append crash handling**: Added to Phase 3.1 validateFileIntegrity()
- **ActivitySync reader**: Explicit in Phase 4.3
- **Checkpoint commits**: Added after each phase

### 3. Phase Consolidation

- Reduced from 10 phases to 8
- Clearer progression: utilities → IDs → logs → entities → links → IPC → tests

## Final Phase Structure

| Phase | Content                      | Checkpoint                      |
| ----- | ---------------------------- | ------------------------------- |
| 1     | UUID encoding + About window | Encoding works, About shows IDs |
| 2     | Profile/Instance migration   | App starts with compact IDs     |
| 3     | CRDT log system              | Logs use new format             |
| 4     | Activity/Deletion loggers    | Activity logs use new format    |
| 5     | Entity ID generation         | New notes get compact IDs       |
| 6     | Inter-note links             | Links work both formats         |
| 7     | IPC handlers                 | IPC accepts both formats        |
| 8     | Testing                      | Full coverage                   |

## Remaining Considerations

1. **Database lookups**: Old notes keep old IDs in DB. Links to old notes work via old ID, not compact equivalent.

2. **Test fixture updates**: Many tests have hardcoded UUIDs. Update progressively per phase.

3. **Profile lock files**: May use profile ID in filename - verify and update if needed.

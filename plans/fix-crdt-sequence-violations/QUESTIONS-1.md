# Questions - Phase 1: CRDT Sequence Violation Bug

## Root Cause Analysis

After analyzing the codebase, I've identified the architecture and potential issue points:

### Architecture Overview

1. **Sequence Number Generation**: `NoteStorageManager.saveUpdate()` (lines 154-194 in note-storage-manager.ts)
   - Uses an in-memory `sequences` Map keyed by `${sdId}:${noteId}`
   - Each write increments the sequence: `sequence = (this.sequences.get(seqKey) || 0) + 1`
   - **Has a write queue** (`writeQueues` Map) to serialize writes per note

2. **Sequence Validation**: `DocumentSnapshot.applyUpdate()` and `recordExternalUpdate()` (document-snapshot.ts)
   - Validates `sequence === expectedSequence` where `expectedSequence = current.sequence + 1`
   - Throws `Sequence violation` error if validation fails

3. **Update Flow - Two Paths**:

   **Path A: `crdt-manager.applyUpdate()` (IPC from renderer)**
   - Writes to disk first via `storageManager.writeNoteUpdate()`
   - Gets sequence number from the write result
   - Applies to snapshot with that sequence
   - Uses 'ipc' origin to prevent double-write

   **Path B: `doc.on('update')` handler → `handleUpdate()`**
   - Y.Doc 'update' event fires (from some source)
   - Calls `handleUpdate()` which writes to disk
   - Calls `snapshot.recordExternalUpdate()` to update vector clock

### Hypothesis: Race Condition in recordExternalUpdate

Looking at `recordExternalUpdate()` (lines 170-197 in document-snapshot.ts):

```typescript
async recordExternalUpdate(...): Promise<void> {
  // Chain this operation onto the lock and await it
  this.operationLock = this.operationLock.then(() => {
    // Validate sequence is next in order
    const current = this.vectorClock[instanceId];
    const expectedSequence = current ? current.sequence + 1 : 1;

    if (sequence !== expectedSequence) {
      throw new Error(`Sequence violation...`);
    }
    // ...
  });
  return this.operationLock;
}
```

**Key observation**: The `operationLock` chains operations, but the **error is thrown inside the `.then()` callback**. This means:

1. When the error is thrown, it becomes a rejected promise
2. `this.operationLock` now holds a rejected promise
3. ALL subsequent operations chained onto it will also reject

**However**, the actual bug might be elsewhere. Let me trace the typing flow:

### Typing Flow Analysis

When a user types in the editor:

1. TipTap/Y.js generates updates
2. `doc.on('update')` fires for each keystroke
3. `handleUpdate()` is called for each update
4. `saveUpdate()` queues the writes (serialized per note)
5. `recordExternalUpdate()` chains vector clock updates (serialized)

The write queue in `saveUpdate()` should serialize writes. But there could be a timing issue if:

- Multiple Y.Doc updates fire very quickly
- The `handleUpdate()` calls get interleaved somehow

**Wait** - I see the issue now. Looking at `handleUpdate()` (lines 428-481):

```typescript
private async handleUpdate(noteId: string, update: Uint8Array): Promise<void> {
  // ...
  const saveResult = await this.storageManager.writeNoteUpdate(state.sdId, noteId, update);

  await state.snapshot.recordExternalUpdate(
    instanceId,
    saveResult.sequence,  // <-- sequence from disk write
    saveResult.offset,
    saveResult.file
  );
}
```

The sequence comes from `saveResult.sequence`, which is assigned by `NoteStorageManager.saveUpdate()`. The write queue there should ensure sequential ordering.

But look at how `handleUpdate` is called (lines 208-223 in crdt-manager.ts):

```typescript
doc.on('update', (update: Uint8Array, origin: unknown) => {
  // ...
  const updatePromise = this.handleUpdate(noteId, update)
    .then(() => { ... })
    .catch((error: Error) => { ... })
    .finally(() => { ... });

  this.pendingUpdates.add(updatePromise);
});
```

**THE BUG**: Multiple `handleUpdate()` calls are NOT serialized! Each one is fired independently and runs concurrently.

The `saveUpdate()` has its own queue, so disk writes are ordered. But:

1. Update A gets sequence 8
2. Update B gets sequence 9
3. But `recordExternalUpdate()` might process them out of order if the async operations interleave!

Actually wait, `recordExternalUpdate` has its own lock (`operationLock`). Let me re-check...

The `operationLock` chains operations, so they SHOULD be ordered. Unless... the lock is being bypassed somehow.

Actually, I think I see it now. The `recordExternalUpdate` uses a `.then()` pattern:

```typescript
this.operationLock = this.operationLock.then(() => { ... });
return this.operationLock;
```

But what if two calls to `recordExternalUpdate` happen before either resolves?

```
Call 1: this.operationLock = Promise.resolve().then(fn1)  // Returns promise P1
Call 2: this.operationLock = P1.then(fn2)                 // Returns promise P2
```

Actually that SHOULD work - fn2 would wait for fn1. Let me think more...

**Wait** - I think the issue might be in the interaction between `applyUpdate()` and `recordExternalUpdate()`.

Looking at `applyUpdate()` (lines 104-132):

- It's synchronous (not async)
- It directly modifies `this.vectorClock`

While `recordExternalUpdate()` (lines 170-197):

- Is async
- Uses an operation lock

If both paths are used for the same note, they could conflict!

---

## Questions

### Q1: Which update path is used during normal typing?

The tests use `keyboard.type()` which generates keystrokes in the renderer. Which path do these updates take?

- **Path A**: Renderer sends updates via IPC → `crdt-manager.applyUpdate()` → synchronous `snapshot.applyUpdate()`
- **Path B**: Y.Doc 'update' event → `handleUpdate()` → async `recordExternalUpdate()`

**ANSWER FOUND**: It's **Path A** (IPC).

Looking at `useNoteSync.ts:129`:

```typescript
window.electronAPI.note.applyUpdate(noteId, update).catch((error: Error) => {
  console.error(`Failed to apply update for note ${noteId}:`, error);
});
```

When user types, the renderer's Y.Doc fires an 'update' event, and the handler sends it via IPC to main. **Critically: this is NOT awaited** - it's fire-and-forget with just a `.catch()`.

**ROOT CAUSE IDENTIFIED**: When user types rapidly:

1. Keystroke 'a' → IPC call #1 sent (not awaited)
2. Keystroke 'b' → IPC call #2 sent (not awaited)
3. Keystroke 'c' → IPC call #3 sent (not awaited)

All three IPC calls are in-flight concurrently! In main process:

- Three `applyUpdate()` calls start concurrently
- The write queue (`writeQueues` in NoteStorageManager) serializes disk writes: seq 1, 2, 3
- But `snapshot.applyUpdate()` calls happen when each write FINISHES
- If write #2 finishes before #1 → applies seq 2 when expecting seq 1 → VIOLATION!

### Q2: Is the operationLock actually working?

**No longer relevant** - the bug is in `applyUpdate()` not `recordExternalUpdate()`.

### Q3: Could there be duplicate handling?

**No longer relevant** - the 'ipc' origin check correctly prevents double-writes.

### Q4: Website Documentation

This is a bug fix for core functionality, not a user-facing feature change. No website documentation changes should be needed.

**Confirmed** - no website docs needed.

## Root Cause Summary

The bug is in `CRDTManager.applyUpdate()` (crdt-manager.ts lines 278-402):

1. **Problem**: The method awaits disk write, then applies to snapshot. But multiple concurrent IPC calls mean multiple `applyUpdate()` calls run simultaneously.

2. **What's serialized**: `NoteStorageManager.writeQueues` serializes disk writes per note.

3. **What's NOT serialized**: The `snapshot.applyUpdate()` calls after the writes complete.

4. **Result**: Write #2 might finish before write #1, causing seq 2 to be applied when expecting seq 1.

## Fix Approach

Add a queue in `CRDTManager` to serialize the ENTIRE `applyUpdate()` operation per note, not just the disk write portion. This ensures that for each note, operations complete fully in order.

```typescript
// In CRDTManager
private applyUpdateQueues: Map<string, Promise<void>> = new Map();

async applyUpdate(noteId: string, update: Uint8Array, options?: {...}): Promise<void> {
  // Chain this operation after any pending operations for this note
  const previousOp = this.applyUpdateQueues.get(noteId) ?? Promise.resolve();

  const currentOp = previousOp.then(async () => {
    // ... existing applyUpdate logic ...
  });

  this.applyUpdateQueues.set(noteId, currentOp);
  return currentOp;
}
```

---

## User Answers Section

(To be filled in by user)

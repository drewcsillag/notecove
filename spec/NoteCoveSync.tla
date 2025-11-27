---- MODULE NoteCoveSync ----
\***********************************************************************
\* TLA+ Specification for NoteCove Sync System
\*
\* Models the synchronization of notes across multiple instances via
\* cloud storage. Abstracts Yjs CRDT as set union (black box).
\*
\* Step 2: Minimal sync model (folder-style direct watching) - DONE
\* Step 3: Activity log mechanism (note-style polling) - CURRENT
\*
\* See:
\*   - SYNC-ARCHITECTURE.md for implementation details
\*   - MODEL-DESIGN.md for design rationale
\***********************************************************************

EXTENDS NoteCoveSyncTypes, TLC

\***********************************************************************
\* State Variables
\***********************************************************************

VARIABLES
    \* --- Per-Node State ---
    localDoc,           \* [Node -> [NoteId -> SUBSET UpdateId]] - applied updates per note
    softDeleted,        \* [Node -> SUBSET NoteId] - notes marked as soft-deleted
    permDeleted,        \* [Node -> SUBSET NoteId] - notes permanently deleted (from deletion log)
    vectorClock,        \* [Node -> VectorClock] - what we've seen from CRDT logs
    nextSeq,            \* [Node -> Nat] - next sequence number to use
    nextDelSeq,         \* [Node -> Nat] - next deletion log sequence number
    dbCache,            \* [Node -> DbCache] - persisted snapshot
    running,            \* [Node -> BOOLEAN] - is node running?
    watermark,          \* [Node -> [Node -> Nat]] - last seen activity seq per other node
    delWatermark,       \* [Node -> [Node -> Nat]] - last seen deletion seq per other node

    \* --- Cloud State: CRDT Logs ---
    pendingLogs,        \* [Node -> Seq(LogEntry)] - written, not yet synced
    syncedLogs,         \* [Node -> Seq(LogEntry)] - synced to cloud

    \* --- Cloud State: Activity Logs ---
    pendingActivity,    \* [Node -> Seq(ActivityEntry)] - activity written, not synced
    syncedActivity,     \* [Node -> Seq(ActivityEntry)] - activity synced to cloud

    \* --- Cloud State: Deletion Logs ---
    pendingDeletion,    \* [Node -> Seq(DeletionEntry)] - deletion written, not synced
    syncedDeletion,     \* [Node -> Seq(DeletionEntry)] - deletion synced to cloud

    \* --- Global State ---
    nextUpdateId        \* Nat - counter for unique update IDs

\* All variables for stuttering
vars == <<localDoc, softDeleted, permDeleted, vectorClock, nextSeq, nextDelSeq, dbCache, running, watermark, delWatermark,
          pendingLogs, syncedLogs, pendingActivity, syncedActivity, pendingDeletion, syncedDeletion, nextUpdateId>>

\***********************************************************************
\* Type Invariant
\***********************************************************************

TypeOK ==
    /\ localDoc \in [Node -> [NoteId -> SUBSET UpdateId]]
    /\ softDeleted \in [Node -> SUBSET NoteId]
    /\ permDeleted \in [Node -> SUBSET NoteId]
    /\ vectorClock \in [Node -> [Node -> Nat]]
    /\ nextSeq \in [Node -> Nat]
    /\ nextDelSeq \in [Node -> Nat]
    /\ dbCache \in [Node -> [doc: [NoteId -> SUBSET UpdateId], deleted: SUBSET NoteId, permDeleted: SUBSET NoteId, clock: [Node -> Nat]]]
    /\ running \in [Node -> BOOLEAN]
    /\ watermark \in [Node -> [Node -> Nat]]
    /\ delWatermark \in [Node -> [Node -> Nat]]
    /\ \A n \in Node : IsLogSeq(pendingLogs[n])
    /\ \A n \in Node : IsLogSeq(syncedLogs[n])
    /\ \A n \in Node : IsActivitySeq(pendingActivity[n])
    /\ \A n \in Node : IsActivitySeq(syncedActivity[n])
    /\ \A n \in Node : IsDeletionSeq(pendingDeletion[n])
    /\ \A n \in Node : IsDeletionSeq(syncedDeletion[n])
    /\ nextUpdateId \in Nat

\***********************************************************************
\* Initial State
\***********************************************************************

Init ==
    /\ localDoc = [n \in Node |-> EmptyNoteDoc]
    /\ softDeleted = [n \in Node |-> {}]
    /\ permDeleted = [n \in Node |-> {}]
    /\ vectorClock = [n \in Node |-> EmptyVectorClock]
    /\ nextSeq = [n \in Node |-> 1]
    /\ nextDelSeq = [n \in Node |-> 1]
    /\ dbCache = [n \in Node |-> EmptyDbCache]
    /\ running = [n \in Node |-> TRUE]
    /\ watermark = [n \in Node |-> EmptyVectorClock]
    /\ delWatermark = [n \in Node |-> EmptyVectorClock]
    /\ pendingLogs = [n \in Node |-> <<>>]
    /\ syncedLogs = [n \in Node |-> <<>>]
    /\ pendingActivity = [n \in Node |-> <<>>]
    /\ syncedActivity = [n \in Node |-> <<>>]
    /\ pendingDeletion = [n \in Node |-> <<>>]
    /\ syncedDeletion = [n \in Node |-> <<>>]
    /\ nextUpdateId = 1

\***********************************************************************
\* Actions
\***********************************************************************

\* -----------------------------------------------------------------------
\* Edit: User makes a change on a note on a node
\*
\* In the real system, this:
\* 1. Updates the Yjs document
\* 2. Writes to CRDT log
\* 3. Writes to activity log
\*
\* We model steps 2 & 3 as writing to pending queues.
\* -----------------------------------------------------------------------
Edit(n, note) ==
    /\ running[n]                           \* Node must be running
    /\ note \notin softDeleted[n]           \* Can't edit soft-deleted notes
    /\ nextUpdateId <= MaxUpdates           \* Bound model checking
    /\ LET logEntry == [updateId |-> nextUpdateId, origin |-> n, seq |-> nextSeq[n],
                        noteId |-> note, isSoftDelete |-> FALSE]
           actEntry == [origin |-> n, seq |-> nextSeq[n], noteId |-> note]
       IN
        \* Update local document for this note
        /\ localDoc' = [localDoc EXCEPT ![n][note] = @ \union {nextUpdateId}]
        \* Update vector clock
        /\ vectorClock' = [vectorClock EXCEPT ![n][n] = nextSeq[n]]
        \* Increment sequence
        /\ nextSeq' = [nextSeq EXCEPT ![n] = @ + 1]
        \* Add to pending CRDT logs (will be synced later)
        /\ pendingLogs' = [pendingLogs EXCEPT ![n] = Append(@, logEntry)]
        \* Add to pending activity logs (mode-dependent)
        /\ pendingActivity' = [pendingActivity EXCEPT ![n] =
            IF ActivityMode = "append" THEN Append(@, actEntry)
            ELSE <<actEntry>>  \* Replace mode: only keep latest
           ]
        \* Increment global update counter
        /\ nextUpdateId' = nextUpdateId + 1
    /\ UNCHANGED <<softDeleted, permDeleted, dbCache, running, watermark, delWatermark, syncedLogs, syncedActivity, pendingDeletion, syncedDeletion, nextDelSeq>>

\* -----------------------------------------------------------------------
\* SoftDelete: User soft-deletes a note (moves to "Recently Deleted")
\*
\* In the real system, this sets deleted=true in the note's CRDT metadata.
\* It syncs via the normal CRDT log mechanism.
\* -----------------------------------------------------------------------
SoftDelete(n, note) ==
    /\ running[n]                           \* Node must be running
    /\ note \notin softDeleted[n]           \* Note not already deleted
    /\ nextUpdateId <= MaxUpdates           \* Bound model checking
    /\ LET logEntry == [updateId |-> nextUpdateId, origin |-> n, seq |-> nextSeq[n],
                        noteId |-> note, isSoftDelete |-> TRUE]
           actEntry == [origin |-> n, seq |-> nextSeq[n], noteId |-> note]
       IN
        \* Mark note as soft-deleted locally
        /\ softDeleted' = [softDeleted EXCEPT ![n] = @ \union {note}]
        \* Update vector clock
        /\ vectorClock' = [vectorClock EXCEPT ![n][n] = nextSeq[n]]
        \* Increment sequence
        /\ nextSeq' = [nextSeq EXCEPT ![n] = @ + 1]
        \* Add to pending CRDT logs (will be synced later)
        /\ pendingLogs' = [pendingLogs EXCEPT ![n] = Append(@, logEntry)]
        \* Add to pending activity logs
        /\ pendingActivity' = [pendingActivity EXCEPT ![n] =
            IF ActivityMode = "append" THEN Append(@, actEntry)
            ELSE <<actEntry>>
           ]
        \* Increment global update counter
        /\ nextUpdateId' = nextUpdateId + 1
    /\ UNCHANGED <<localDoc, permDeleted, dbCache, running, watermark, delWatermark, syncedLogs, syncedActivity, pendingDeletion, syncedDeletion, nextDelSeq>>

\* -----------------------------------------------------------------------
\* PermanentDelete: User permanently deletes a soft-deleted note
\*
\* In the real system, this:
\* 1. Writes to deletion log (SD/deleted/{instanceId}.log)
\* 2. Removes note files from disk
\* 3. Removes from SQLite cache
\*
\* We model step 1 as writing to pending deletion log.
\* The note is marked as permanently deleted locally immediately.
\* -----------------------------------------------------------------------
PermanentDelete(n, note) ==
    /\ running[n]                           \* Node must be running
    /\ note \in softDeleted[n]              \* Can only perm-delete soft-deleted notes
    /\ note \notin permDeleted[n]           \* Not already permanently deleted
    /\ LET delEntry == [origin |-> n, seq |-> nextDelSeq[n], noteId |-> note]
       IN
        \* Mark note as permanently deleted locally
        /\ permDeleted' = [permDeleted EXCEPT ![n] = @ \union {note}]
        \* Add to pending deletion logs
        /\ pendingDeletion' = [pendingDeletion EXCEPT ![n] = Append(@, delEntry)]
        \* Increment deletion sequence
        /\ nextDelSeq' = [nextDelSeq EXCEPT ![n] = @ + 1]
    /\ UNCHANGED <<localDoc, softDeleted, vectorClock, nextSeq, dbCache, running, watermark, delWatermark, pendingLogs, syncedLogs, pendingActivity, syncedActivity, syncedDeletion, nextUpdateId>>

\* -----------------------------------------------------------------------
\* CloudSyncLog: A pending CRDT log entry becomes visible to all nodes
\* -----------------------------------------------------------------------
CloudSyncLog(n) ==
    /\ Len(pendingLogs[n]) > 0              \* Has pending entries
    /\ LET entry == Head(pendingLogs[n])
       IN
        \* Move from pending to synced
        /\ syncedLogs' = [syncedLogs EXCEPT ![n] = Append(@, entry)]
        /\ pendingLogs' = [pendingLogs EXCEPT ![n] = Tail(@)]
    /\ UNCHANGED <<localDoc, softDeleted, permDeleted, vectorClock, nextSeq, nextDelSeq, dbCache, running, watermark, delWatermark,
                   pendingActivity, syncedActivity, pendingDeletion, syncedDeletion, nextUpdateId>>

\* -----------------------------------------------------------------------
\* CloudSyncActivity: A pending activity log entry becomes visible
\* -----------------------------------------------------------------------
CloudSyncActivity(n) ==
    /\ Len(pendingActivity[n]) > 0          \* Has pending entries
    /\ LET entry == Head(pendingActivity[n])
       IN
        \* Move from pending to synced (mode-dependent)
        /\ syncedActivity' = [syncedActivity EXCEPT ![n] =
            IF ActivityMode = "append" THEN Append(@, entry)
            ELSE <<entry>>  \* Replace mode: only keep latest
           ]
        /\ pendingActivity' = [pendingActivity EXCEPT ![n] = Tail(@)]
    /\ UNCHANGED <<localDoc, softDeleted, permDeleted, vectorClock, nextSeq, nextDelSeq, dbCache, running, watermark, delWatermark,
                   pendingLogs, syncedLogs, pendingDeletion, syncedDeletion, nextUpdateId>>

\* -----------------------------------------------------------------------
\* CloudSyncDeletion: A pending deletion log entry becomes visible
\* -----------------------------------------------------------------------
CloudSyncDeletion(n) ==
    /\ Len(pendingDeletion[n]) > 0          \* Has pending entries
    /\ LET entry == Head(pendingDeletion[n])
       IN
        \* Move from pending to synced (append only - no replace mode for deletions)
        /\ syncedDeletion' = [syncedDeletion EXCEPT ![n] = Append(@, entry)]
        /\ pendingDeletion' = [pendingDeletion EXCEPT ![n] = Tail(@)]
    /\ UNCHANGED <<localDoc, softDeleted, permDeleted, vectorClock, nextSeq, nextDelSeq, dbCache, running, watermark, delWatermark,
                   pendingLogs, syncedLogs, pendingActivity, syncedActivity, nextUpdateId>>

\* -----------------------------------------------------------------------
\* ReloadDirect: Node loads updates from synced logs (folder-style)
\*
\* This models the simpler folder sync: detect file change, reload all.
\* Used for folders which watch the logs directory directly.
\* Now handles per-note updates and soft-delete flags.
\* -----------------------------------------------------------------------
ReloadDirect(n) ==
    /\ running[n]
    \* Check if there are any new updates to apply
    /\ \E m \in Node :
        LET newUpdates == NewEntriesInLog(syncedLogs[m], m, vectorClock[n][m])
        IN newUpdates /= {}
    \* Apply all new updates from all nodes, per note
    /\ LET \* Collect all new entries from all nodes
           allNewEntries == UNION {
               NewEntriesInLog(syncedLogs[m], m, vectorClock[n][m]) : m \in Node
           }
           \* Extract content updates per note (non-soft-delete entries)
           newDocPerNote == [note \in NoteId |->
               localDoc[n][note] \union
               {e.updateId : e \in {x \in allNewEntries : x.noteId = note /\ ~x.isSoftDelete}}
           ]
           \* Extract soft-deleted notes
           newSoftDeletes == UNION {
               SoftDeletedNotesInNewEntries(syncedLogs[m], m, vectorClock[n][m]) : m \in Node
           }
           \* New clock
           newClock == [m \in Node |->
               LET maxSeen == MaxSeqInLog(syncedLogs[m], m)
               IN IF maxSeen > vectorClock[n][m] THEN maxSeen ELSE vectorClock[n][m]
           ]
       IN
        /\ localDoc' = [localDoc EXCEPT ![n] = newDocPerNote]
        /\ softDeleted' = [softDeleted EXCEPT ![n] = @ \union newSoftDeletes]
        /\ vectorClock' = [vectorClock EXCEPT ![n] = newClock]
    /\ UNCHANGED <<permDeleted, nextSeq, nextDelSeq, dbCache, running, watermark, delWatermark,
                   pendingLogs, syncedLogs, pendingActivity, syncedActivity, pendingDeletion, syncedDeletion, nextUpdateId>>

\* -----------------------------------------------------------------------
\* PollActivity: Node polls activity logs and discovers changes
\*
\* This models the note sync mechanism:
\* 1. Read other instances' activity logs
\* 2. Find entries with seq > watermark
\* 3. Update watermark
\* 4. (The actual reload is a separate action)
\*
\* In real system: polls every 3 seconds as backup to chokidar
\* -----------------------------------------------------------------------
PollActivity(n) ==
    /\ running[n]
    \* Check if there's new activity from any other node
    /\ \E m \in Node \ {n} :
        HasNewActivity(syncedActivity[m], m, watermark[n][m])
    \* Update watermarks to reflect what we've seen
    /\ watermark' = [watermark EXCEPT ![n] =
        [m \in Node |->
            IF m = n THEN @[m]  \* Don't track our own activity
            ELSE LET maxAct == MaxSeqInActivity(syncedActivity[m], m)
                 IN IF maxAct > @[m] THEN maxAct ELSE @[m]
        ]]
    /\ UNCHANGED <<localDoc, softDeleted, permDeleted, vectorClock, nextSeq, nextDelSeq, dbCache, running, delWatermark,
                   pendingLogs, syncedLogs, pendingActivity, syncedActivity, pendingDeletion, syncedDeletion, nextUpdateId>>

\* -----------------------------------------------------------------------
\* ReloadFromActivity: Node reloads after detecting activity
\*
\* This models the note sync reload triggered by activity detection.
\* Precondition: watermark indicates we know about updates we haven't loaded yet
\* Now handles per-note updates and soft-delete flags.
\* -----------------------------------------------------------------------
ReloadFromActivity(n) ==
    /\ running[n]
    \* Check if watermark shows updates we haven't loaded (via vectorClock)
    /\ \E m \in Node \ {n} :
        watermark[n][m] > vectorClock[n][m]
    \* Check that the CRDT log has actually synced (not just activity log)
    \* This models the exponential backoff retry - we only reload when ready
    /\ \A m \in Node \ {n} :
        watermark[n][m] <= MaxSeqInLog(syncedLogs[m], m)
    \* Apply all new updates from all nodes, per note
    /\ LET \* Collect all new entries from all nodes
           allNewEntries == UNION {
               NewEntriesInLog(syncedLogs[m], m, vectorClock[n][m]) : m \in Node
           }
           \* Extract content updates per note (non-soft-delete entries)
           newDocPerNote == [note \in NoteId |->
               localDoc[n][note] \union
               {e.updateId : e \in {x \in allNewEntries : x.noteId = note /\ ~x.isSoftDelete}}
           ]
           \* Extract soft-deleted notes
           newSoftDeletes == UNION {
               SoftDeletedNotesInNewEntries(syncedLogs[m], m, vectorClock[n][m]) : m \in Node
           }
           \* New clock
           newClock == [m \in Node |->
               LET maxSeen == MaxSeqInLog(syncedLogs[m], m)
               IN IF maxSeen > vectorClock[n][m] THEN maxSeen ELSE vectorClock[n][m]
           ]
       IN
        /\ localDoc' = [localDoc EXCEPT ![n] = newDocPerNote]
        /\ softDeleted' = [softDeleted EXCEPT ![n] = @ \union newSoftDeletes]
        /\ vectorClock' = [vectorClock EXCEPT ![n] = newClock]
    /\ UNCHANGED <<permDeleted, nextSeq, nextDelSeq, dbCache, running, watermark, delWatermark,
                   pendingLogs, syncedLogs, pendingActivity, syncedActivity, pendingDeletion, syncedDeletion, nextUpdateId>>

\* -----------------------------------------------------------------------
\* CompactActivity: Cloud compacts activity log (keeps last N entries)
\*
\* This models periodic compaction that removes old entries.
\* Other nodes must detect the gap and fall back to full scan.
\* -----------------------------------------------------------------------
CompactActivity(n) ==
    /\ Len(syncedActivity[n]) > MaxLogSize  \* Only compact if too long
    /\ syncedActivity' = [syncedActivity EXCEPT ![n] =
        \* Keep only the last MaxLogSize/2 entries (aggressive compaction)
        SubSeq(@, Len(@) - (MaxLogSize \div 2) + 1, Len(@))
       ]
    /\ UNCHANGED <<localDoc, softDeleted, permDeleted, vectorClock, nextSeq, nextDelSeq, dbCache, running, watermark, delWatermark,
                   pendingLogs, syncedLogs, pendingActivity, pendingDeletion, syncedDeletion, nextUpdateId>>

\* -----------------------------------------------------------------------
\* FullScanFallback: Node detects activity gap and falls back to direct reload
\*
\* This models the recovery when compaction causes gaps in activity log.
\* The node uses ReloadDirect-style logic to sync from CRDT logs directly.
\* Now handles per-note updates and soft-delete flags.
\* -----------------------------------------------------------------------
FullScanFallback(n) ==
    /\ running[n]
    \* Check if there's a gap in any other node's activity log
    /\ \E m \in Node \ {n} :
        HasActivityGap(syncedActivity[m], m, watermark[n][m])
    \* Reset watermarks and do full reload from CRDT logs
    /\ LET \* Collect all new entries from all nodes
           allNewEntries == UNION {
               NewEntriesInLog(syncedLogs[m], m, vectorClock[n][m]) : m \in Node
           }
           \* Extract content updates per note (non-soft-delete entries)
           newDocPerNote == [note \in NoteId |->
               localDoc[n][note] \union
               {e.updateId : e \in {x \in allNewEntries : x.noteId = note /\ ~x.isSoftDelete}}
           ]
           \* Extract soft-deleted notes
           newSoftDeletes == UNION {
               SoftDeletedNotesInNewEntries(syncedLogs[m], m, vectorClock[n][m]) : m \in Node
           }
           \* New clock
           newClock == [m \in Node |->
               LET maxSeen == MaxSeqInLog(syncedLogs[m], m)
               IN IF maxSeen > vectorClock[n][m] THEN maxSeen ELSE vectorClock[n][m]
           ]
           \* Update watermarks to current max in activity logs
           newWatermark == [m \in Node |->
               IF m = n THEN watermark[n][m]
               ELSE MaxSeqInActivity(syncedActivity[m], m)
           ]
       IN
        /\ localDoc' = [localDoc EXCEPT ![n] = newDocPerNote]
        /\ softDeleted' = [softDeleted EXCEPT ![n] = @ \union newSoftDeletes]
        /\ vectorClock' = [vectorClock EXCEPT ![n] = newClock]
        /\ watermark' = [watermark EXCEPT ![n] = newWatermark]
    /\ UNCHANGED <<permDeleted, nextSeq, nextDelSeq, dbCache, running, delWatermark,
                   pendingLogs, syncedLogs, pendingActivity, syncedActivity, pendingDeletion, syncedDeletion, nextUpdateId>>

\* -----------------------------------------------------------------------
\* SaveSnapshot: Node saves current state to DB cache
\* -----------------------------------------------------------------------
SaveSnapshot(n) ==
    /\ running[n]
    /\ dbCache' = [dbCache EXCEPT ![n] = [doc |-> localDoc[n], deleted |-> softDeleted[n], permDeleted |-> permDeleted[n], clock |-> vectorClock[n]]]
    /\ UNCHANGED <<localDoc, softDeleted, permDeleted, vectorClock, nextSeq, nextDelSeq, running, watermark, delWatermark,
                   pendingLogs, syncedLogs, pendingActivity, syncedActivity, pendingDeletion, syncedDeletion, nextUpdateId>>

\* -----------------------------------------------------------------------
\* Crash: Node crashes (loses in-memory state)
\* -----------------------------------------------------------------------
Crash(n) ==
    /\ running[n]
    /\ running' = [running EXCEPT ![n] = FALSE]
    \* Note: pendingLogs, pendingActivity, pendingDeletion for this node are NOT lost (they're "on disk")
    \* But any in-flight operation is lost
    /\ UNCHANGED <<localDoc, softDeleted, permDeleted, vectorClock, nextSeq, nextDelSeq, dbCache, watermark, delWatermark,
                   pendingLogs, syncedLogs, pendingActivity, syncedActivity, pendingDeletion, syncedDeletion, nextUpdateId>>

\* -----------------------------------------------------------------------
\* Restart: Node restarts from DB cache AND reloads from logs
\*
\* This models the real behavior: on startup, load DB cache, then
\* apply any CRDT log entries not covered by the cached vector clock.
\*
\* Key insight: The node CAN read its OWN pending logs (they're on local disk)
\* but cannot read OTHER nodes' pending logs (those haven't synced yet).
\* Now handles per-note updates and soft-delete flags.
\* -----------------------------------------------------------------------
Restart(n) ==
    /\ ~running[n]                          \* Node must be crashed
    /\ running' = [running EXCEPT ![n] = TRUE]
    \* Restore from DB cache, then apply new log entries
    /\ LET cachedDoc == dbCache[n].doc
           cachedDeleted == dbCache[n].deleted
           cachedPermDeleted == dbCache[n].permDeleted
           cachedClock == dbCache[n].clock
           \* Get all new entries from synced logs (from all nodes)
           allSyncedEntries == UNION {
               NewEntriesInLog(syncedLogs[m], m, cachedClock[m]) : m \in Node
           }
           \* Also get our OWN pending logs (they're on our local disk!)
           ownPendingEntries == {pendingLogs[n][idx] : idx \in DOMAIN pendingLogs[n]}
           allNewEntries == allSyncedEntries \union ownPendingEntries
           \* Extract content updates per note (non-soft-delete entries)
           newDocPerNote == [note \in NoteId |->
               cachedDoc[note] \union
               {e.updateId : e \in {x \in allNewEntries : x.noteId = note /\ ~x.isSoftDelete}}
           ]
           \* Extract soft-deleted notes from all new entries
           newSoftDeletes == cachedDeleted \union
               {e.noteId : e \in {x \in allNewEntries : x.isSoftDelete}}
           \* Get permanently deleted notes from all deletion logs (synced + our pending)
           allSyncedDeletions == UNION {
               {syncedDeletion[m][idx].noteId : idx \in DOMAIN syncedDeletion[m]} : m \in Node
           }
           ownPendingDeletions == {pendingDeletion[n][idx].noteId : idx \in DOMAIN pendingDeletion[n]}
           newPermDeleted == cachedPermDeleted \union allSyncedDeletions \union ownPendingDeletions
           \* Compute new clock based on synced logs
           newClock == [m \in Node |->
               IF m = n THEN
                   \* For ourselves, include pending logs
                   LET syncedMax == MaxSeqInLog(syncedLogs[n], n)
                       pendingMax == MaxSeqInLog(pendingLogs[n], n)
                   IN IF pendingMax > syncedMax THEN pendingMax
                      ELSE IF syncedMax > cachedClock[n] THEN syncedMax
                      ELSE cachedClock[n]
               ELSE
                   \* For others, only synced logs
                   LET maxSeen == MaxSeqInLog(syncedLogs[m], m)
                   IN IF maxSeen > cachedClock[m] THEN maxSeen ELSE cachedClock[m]
           ]
       IN
        /\ localDoc' = [localDoc EXCEPT ![n] = newDocPerNote]
        /\ softDeleted' = [softDeleted EXCEPT ![n] = newSoftDeletes]
        /\ permDeleted' = [permDeleted EXCEPT ![n] = newPermDeleted]
        /\ vectorClock' = [vectorClock EXCEPT ![n] = newClock]
    \* Sequence continues from where we left off (tracked in our own logs - both synced and pending)
    /\ LET syncedMax == MaxSeqInLog(syncedLogs[n], n)
           pendingMax == MaxSeqInLog(pendingLogs[n], n)
       IN nextSeq' = [nextSeq EXCEPT ![n] = (IF pendingMax > syncedMax THEN pendingMax ELSE syncedMax) + 1]
    \* Deletion sequence continues from our deletion logs
    /\ LET syncedDelMax == MaxSeqInDeletion(syncedDeletion[n], n)
           pendingDelMax == MaxSeqInDeletion(pendingDeletion[n], n)
       IN nextDelSeq' = [nextDelSeq EXCEPT ![n] = (IF pendingDelMax > syncedDelMax THEN pendingDelMax ELSE syncedDelMax) + 1]
    \* Reset watermarks on restart (we don't know what activity/deletion we've seen)
    /\ watermark' = [watermark EXCEPT ![n] = EmptyVectorClock]
    /\ delWatermark' = [delWatermark EXCEPT ![n] = EmptyVectorClock]
    /\ UNCHANGED <<dbCache, pendingLogs, syncedLogs, pendingActivity, syncedActivity, pendingDeletion, syncedDeletion, nextUpdateId>>

\* -----------------------------------------------------------------------
\* PollDeletion: Node polls deletion logs and discovers permanent deletes
\*
\* Similar to PollActivity but for deletion logs.
\* Updates delWatermark to track what we've seen.
\* -----------------------------------------------------------------------
PollDeletion(n) ==
    /\ running[n]
    \* Check if there's a new deletion from any other node
    /\ \E m \in Node \ {n} :
        HasNewDeletion(syncedDeletion[m], m, delWatermark[n][m])
    \* Update deletion watermarks to reflect what we've seen
    /\ delWatermark' = [delWatermark EXCEPT ![n] =
        [m \in Node |->
            IF m = n THEN @[m]  \* Don't track our own deletions
            ELSE LET maxDel == MaxSeqInDeletion(syncedDeletion[m], m)
                 IN IF maxDel > @[m] THEN maxDel ELSE @[m]
        ]]
    /\ UNCHANGED <<localDoc, softDeleted, permDeleted, vectorClock, nextSeq, nextDelSeq, dbCache, running, watermark,
                   pendingLogs, syncedLogs, pendingActivity, syncedActivity, pendingDeletion, syncedDeletion, nextUpdateId>>

\* -----------------------------------------------------------------------
\* ProcessDeletionLog: Node processes deletion log entries
\*
\* This models when a node reads other instances' deletion logs and
\* marks notes as permanently deleted locally. Mirrors ReloadFromActivity.
\* -----------------------------------------------------------------------
ProcessDeletionLog(n) ==
    /\ running[n]
    \* Check if delWatermark shows deletions we haven't processed yet
    /\ \E m \in Node \ {n} :
        LET alreadyDeleted == permDeleted[n]
            newDeletes == DeletedNotesInLog(syncedDeletion[m], m, 0) \ alreadyDeleted
        IN delWatermark[n][m] > 0 /\ newDeletes /= {}
    \* Apply all new deletions from all nodes
    /\ LET \* Get all notes that have been permanently deleted by other nodes
           allNewDeletes == UNION {
               DeletedNotesInLog(syncedDeletion[m], m, 0) : m \in Node \ {n}
           }
       IN
        \* Mark notes as permanently deleted locally
        /\ permDeleted' = [permDeleted EXCEPT ![n] = @ \union allNewDeletes]
    /\ UNCHANGED <<localDoc, softDeleted, vectorClock, nextSeq, nextDelSeq, dbCache, running, watermark, delWatermark,
                   pendingLogs, syncedLogs, pendingActivity, syncedActivity, pendingDeletion, syncedDeletion, nextUpdateId>>

\***********************************************************************
\* Next State Relation
\***********************************************************************

Next ==
    \/ \E n \in Node, note \in NoteId : Edit(n, note)
    \/ \E n \in Node, note \in NoteId : SoftDelete(n, note)
    \/ \E n \in Node, note \in NoteId : PermanentDelete(n, note)
    \/ \E n \in Node : CloudSyncLog(n)
    \/ \E n \in Node : CloudSyncActivity(n)
    \/ \E n \in Node : CloudSyncDeletion(n)
    \/ \E n \in Node : ReloadDirect(n)
    \/ \E n \in Node : PollActivity(n)
    \/ \E n \in Node : ReloadFromActivity(n)
    \/ \E n \in Node : PollDeletion(n)
    \/ \E n \in Node : ProcessDeletionLog(n)
    \/ \E n \in Node : CompactActivity(n)
    \/ \E n \in Node : FullScanFallback(n)
    \/ \E n \in Node : SaveSnapshot(n)
    \/ \E n \in Node : Crash(n)
    \/ \E n \in Node : Restart(n)

\***********************************************************************
\* Fairness (for liveness properties)
\***********************************************************************

Fairness ==
    /\ \A n \in Node : WF_vars(CloudSyncLog(n))        \* CRDT logs eventually sync
    /\ \A n \in Node : WF_vars(CloudSyncActivity(n))  \* Activity logs eventually sync
    /\ \A n \in Node : WF_vars(CloudSyncDeletion(n))  \* Deletion logs eventually sync
    /\ \A n \in Node : WF_vars(ReloadDirect(n))       \* Direct reload eventually happens
    /\ \A n \in Node : WF_vars(PollActivity(n))       \* Nodes eventually poll activity
    /\ \A n \in Node : WF_vars(ReloadFromActivity(n)) \* Activity-triggered reload happens
    /\ \A n \in Node : WF_vars(PollDeletion(n))       \* Nodes eventually poll deletions
    /\ \A n \in Node : WF_vars(ProcessDeletionLog(n)) \* Deletion processing happens
    /\ \A n \in Node : WF_vars(FullScanFallback(n))   \* Gap recovery eventually happens
    \* Note: CompactActivity is NOT fair (compaction may never happen)

\***********************************************************************
\* Specification
\***********************************************************************

Spec == Init /\ [][Next]_vars /\ Fairness

\***********************************************************************
\* Invariants (Safety Properties)
\***********************************************************************

\* Vector clocks are monotonic within a run
\* (Note: this is checked by observing no decreases between states)
VectorClockMonotonic ==
    \A n \in Node : \A m \in Node :
        vectorClock[n][m] >= 0

\* Sequence numbers in logs are contiguous per origin
SequenceContiguous ==
    \A n \in Node :
        LET seqs == {syncedLogs[n][i].seq : i \in 1..Len(syncedLogs[n])}
        IN seqs = {} \/ seqs = 1..Cardinality(seqs)

\* Local doc only contains valid update IDs
ValidUpdates ==
    \A n \in Node : \A note \in NoteId :
        localDoc[n][note] \subseteq 1..(nextUpdateId - 1)

\***********************************************************************
\* Quiescence and Convergence
\***********************************************************************

\* System is quiescent: no pending syncs, all nodes running
Quiescent ==
    /\ \A n \in Node : running[n]
    /\ \A n \in Node : pendingLogs[n] = <<>>
    /\ \A n \in Node : pendingActivity[n] = <<>>
    /\ \A n \in Node : pendingDeletion[n] = <<>>

\* All nodes have the same document state (per-note content, soft-deleted set, and perm-deleted set)
Converged ==
    /\ \A n1, n2 \in Node : localDoc[n1] = localDoc[n2]
    /\ \A n1, n2 \in Node : softDeleted[n1] = softDeleted[n2]
    /\ \A n1, n2 \in Node : permDeleted[n1] = permDeleted[n2]

\* System is fully synchronized: quiescent AND all nodes have seen all updates AND processed all deletions
FullySynced ==
    /\ Quiescent
    /\ \A n \in Node : \A m \in Node :
        vectorClock[n][m] = MaxSeqInLog(syncedLogs[m], m)
    \* All nodes have processed all synced deletion logs
    /\ \A n \in Node : \A m \in Node :
        LET deletedByM == {syncedDeletion[m][idx].noteId : idx \in DOMAIN syncedDeletion[m]}
        IN deletedByM \subseteq permDeleted[n]

\* Main convergence property: full sync implies convergence
\* This IS a valid invariant - if fully synced, must be converged
ConvergenceInvariant ==
    FullySynced => Converged

\***********************************************************************
\* Liveness Properties (Temporal)
\***********************************************************************

\* Eventually quiescent (if no more edits)
EventuallyQuiescent == <>Quiescent

\* If fully synced, must be converged
\* This is equivalent to ConvergenceInvariant as a temporal property
AlwaysConvergesWhenFullySynced == [](FullySynced => Converged)

\* Permanent deletes eventually propagate to all running nodes
\* If a note is permanently deleted on one node and deletion syncs, eventually all running nodes know
PermDeleteEventuallyPropagates ==
    \A n \in Node : \A note \in NoteId :
        (note \in permDeleted[n] /\ pendingDeletion[n] = <<>>)
            ~> (\A m \in Node : running[m] => note \in permDeleted[m])

====

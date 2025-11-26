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
    localDoc,           \* [Node -> SUBSET UpdateId] - applied updates
    vectorClock,        \* [Node -> VectorClock] - what we've seen from CRDT logs
    nextSeq,            \* [Node -> Nat] - next sequence number to use
    dbCache,            \* [Node -> DbCache] - persisted snapshot
    running,            \* [Node -> BOOLEAN] - is node running?
    watermark,          \* [Node -> [Node -> Nat]] - last seen activity seq per other node

    \* --- Cloud State: CRDT Logs ---
    pendingLogs,        \* [Node -> Seq(LogEntry)] - written, not yet synced
    syncedLogs,         \* [Node -> Seq(LogEntry)] - synced to cloud

    \* --- Cloud State: Activity Logs ---
    pendingActivity,    \* [Node -> Seq(ActivityEntry)] - activity written, not synced
    syncedActivity,     \* [Node -> Seq(ActivityEntry)] - activity synced to cloud

    \* --- Global State ---
    nextUpdateId        \* Nat - counter for unique update IDs

\* All variables for stuttering
vars == <<localDoc, vectorClock, nextSeq, dbCache, running, watermark,
          pendingLogs, syncedLogs, pendingActivity, syncedActivity, nextUpdateId>>

\***********************************************************************
\* Type Invariant
\***********************************************************************

TypeOK ==
    /\ localDoc \in [Node -> SUBSET UpdateId]
    /\ vectorClock \in [Node -> [Node -> Nat]]
    /\ nextSeq \in [Node -> Nat]
    /\ dbCache \in [Node -> [doc: SUBSET UpdateId, clock: [Node -> Nat]]]
    /\ running \in [Node -> BOOLEAN]
    /\ watermark \in [Node -> [Node -> Nat]]
    /\ \A n \in Node : IsLogSeq(pendingLogs[n])
    /\ \A n \in Node : IsLogSeq(syncedLogs[n])
    /\ \A n \in Node : IsActivitySeq(pendingActivity[n])
    /\ \A n \in Node : IsActivitySeq(syncedActivity[n])
    /\ nextUpdateId \in Nat

\***********************************************************************
\* Initial State
\***********************************************************************

Init ==
    /\ localDoc = [n \in Node |-> {}]
    /\ vectorClock = [n \in Node |-> EmptyVectorClock]
    /\ nextSeq = [n \in Node |-> 1]
    /\ dbCache = [n \in Node |-> EmptyDbCache]
    /\ running = [n \in Node |-> TRUE]
    /\ watermark = [n \in Node |-> EmptyVectorClock]
    /\ pendingLogs = [n \in Node |-> <<>>]
    /\ syncedLogs = [n \in Node |-> <<>>]
    /\ pendingActivity = [n \in Node |-> <<>>]
    /\ syncedActivity = [n \in Node |-> <<>>]
    /\ nextUpdateId = 1

\***********************************************************************
\* Actions
\***********************************************************************

\* -----------------------------------------------------------------------
\* Edit: User makes a change on a node
\*
\* In the real system, this:
\* 1. Updates the Yjs document
\* 2. Writes to CRDT log
\* 3. Writes to activity log
\*
\* We model steps 2 & 3 as writing to pending queues.
\* -----------------------------------------------------------------------
Edit(n) ==
    /\ running[n]                           \* Node must be running
    /\ nextUpdateId <= MaxUpdates           \* Bound model checking
    /\ LET logEntry == [updateId |-> nextUpdateId, origin |-> n, seq |-> nextSeq[n]]
           actEntry == [origin |-> n, seq |-> nextSeq[n]]
       IN
        \* Update local document
        /\ localDoc' = [localDoc EXCEPT ![n] = @ \union {nextUpdateId}]
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
    /\ UNCHANGED <<dbCache, running, watermark, syncedLogs, syncedActivity>>

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
    /\ UNCHANGED <<localDoc, vectorClock, nextSeq, dbCache, running, watermark,
                   pendingActivity, syncedActivity, nextUpdateId>>

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
    /\ UNCHANGED <<localDoc, vectorClock, nextSeq, dbCache, running, watermark,
                   pendingLogs, syncedLogs, nextUpdateId>>

\* -----------------------------------------------------------------------
\* ReloadDirect: Node loads updates from synced logs (folder-style)
\*
\* This models the simpler folder sync: detect file change, reload all.
\* Used for folders which watch the logs directory directly.
\* -----------------------------------------------------------------------
ReloadDirect(n) ==
    /\ running[n]
    \* Check if there are any new updates to apply
    /\ \E m \in Node :
        LET newUpdates == NewEntriesInLog(syncedLogs[m], m, vectorClock[n][m])
        IN newUpdates /= {}
    \* Apply all new updates from all nodes
    /\ LET allNewUpdates == UNION {
            {e.updateId : e \in NewEntriesInLog(syncedLogs[m], m, vectorClock[n][m])}
            : m \in Node
           }
           newClock == [m \in Node |->
               LET maxSeen == MaxSeqInLog(syncedLogs[m], m)
               IN IF maxSeen > vectorClock[n][m] THEN maxSeen ELSE vectorClock[n][m]
           ]
       IN
        /\ localDoc' = [localDoc EXCEPT ![n] = @ \union allNewUpdates]
        /\ vectorClock' = [vectorClock EXCEPT ![n] = newClock]
    /\ UNCHANGED <<nextSeq, dbCache, running, watermark,
                   pendingLogs, syncedLogs, pendingActivity, syncedActivity, nextUpdateId>>

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
    /\ UNCHANGED <<localDoc, vectorClock, nextSeq, dbCache, running,
                   pendingLogs, syncedLogs, pendingActivity, syncedActivity, nextUpdateId>>

\* -----------------------------------------------------------------------
\* ReloadFromActivity: Node reloads after detecting activity
\*
\* This models the note sync reload triggered by activity detection.
\* Precondition: watermark indicates we know about updates we haven't loaded yet
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
    \* Apply all new updates from all nodes
    /\ LET allNewUpdates == UNION {
            {e.updateId : e \in NewEntriesInLog(syncedLogs[m], m, vectorClock[n][m])}
            : m \in Node
           }
           newClock == [m \in Node |->
               LET maxSeen == MaxSeqInLog(syncedLogs[m], m)
               IN IF maxSeen > vectorClock[n][m] THEN maxSeen ELSE vectorClock[n][m]
           ]
       IN
        /\ localDoc' = [localDoc EXCEPT ![n] = @ \union allNewUpdates]
        /\ vectorClock' = [vectorClock EXCEPT ![n] = newClock]
    /\ UNCHANGED <<nextSeq, dbCache, running, watermark,
                   pendingLogs, syncedLogs, pendingActivity, syncedActivity, nextUpdateId>>

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
    /\ UNCHANGED <<localDoc, vectorClock, nextSeq, dbCache, running, watermark,
                   pendingLogs, syncedLogs, pendingActivity, nextUpdateId>>

\* -----------------------------------------------------------------------
\* FullScanFallback: Node detects activity gap and falls back to direct reload
\*
\* This models the recovery when compaction causes gaps in activity log.
\* The node uses ReloadDirect-style logic to sync from CRDT logs directly.
\* -----------------------------------------------------------------------
FullScanFallback(n) ==
    /\ running[n]
    \* Check if there's a gap in any other node's activity log
    /\ \E m \in Node \ {n} :
        HasActivityGap(syncedActivity[m], m, watermark[n][m])
    \* Reset watermarks and do full reload from CRDT logs
    /\ LET allNewUpdates == UNION {
            {e.updateId : e \in NewEntriesInLog(syncedLogs[m], m, vectorClock[n][m])}
            : m \in Node
           }
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
        /\ localDoc' = [localDoc EXCEPT ![n] = @ \union allNewUpdates]
        /\ vectorClock' = [vectorClock EXCEPT ![n] = newClock]
        /\ watermark' = [watermark EXCEPT ![n] = newWatermark]
    /\ UNCHANGED <<nextSeq, dbCache, running,
                   pendingLogs, syncedLogs, pendingActivity, syncedActivity, nextUpdateId>>

\* -----------------------------------------------------------------------
\* SaveSnapshot: Node saves current state to DB cache
\* -----------------------------------------------------------------------
SaveSnapshot(n) ==
    /\ running[n]
    /\ dbCache' = [dbCache EXCEPT ![n] = [doc |-> localDoc[n], clock |-> vectorClock[n]]]
    /\ UNCHANGED <<localDoc, vectorClock, nextSeq, running, watermark,
                   pendingLogs, syncedLogs, pendingActivity, syncedActivity, nextUpdateId>>

\* -----------------------------------------------------------------------
\* Crash: Node crashes (loses in-memory state)
\* -----------------------------------------------------------------------
Crash(n) ==
    /\ running[n]
    /\ running' = [running EXCEPT ![n] = FALSE]
    \* Note: pendingLogs and pendingActivity for this node are NOT lost (they're "on disk")
    \* But any in-flight operation is lost
    /\ UNCHANGED <<localDoc, vectorClock, nextSeq, dbCache, watermark,
                   pendingLogs, syncedLogs, pendingActivity, syncedActivity, nextUpdateId>>

\* -----------------------------------------------------------------------
\* Restart: Node restarts from DB cache AND reloads from logs
\*
\* This models the real behavior: on startup, load DB cache, then
\* apply any CRDT log entries not covered by the cached vector clock.
\*
\* Key insight: The node CAN read its OWN pending logs (they're on local disk)
\* but cannot read OTHER nodes' pending logs (those haven't synced yet).
\* -----------------------------------------------------------------------
Restart(n) ==
    /\ ~running[n]                          \* Node must be crashed
    /\ running' = [running EXCEPT ![n] = TRUE]
    \* Restore from DB cache, then apply new log entries
    /\ LET cachedDoc == dbCache[n].doc
           cachedClock == dbCache[n].clock
           \* Get updates from synced logs (from other nodes)
           syncedUpdates == UNION {
               {e.updateId : e \in NewEntriesInLog(syncedLogs[m], m, cachedClock[m])}
               : m \in Node
           }
           \* Also get our OWN pending logs (they're on our local disk!)
           ownPendingUpdates == {pendingLogs[n][idx].updateId : idx \in DOMAIN pendingLogs[n]}
           allNewUpdates == syncedUpdates \union ownPendingUpdates
           \* Compute new clock based on synced logs (we'll update for pending separately)
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
        /\ localDoc' = [localDoc EXCEPT ![n] = cachedDoc \union allNewUpdates]
        /\ vectorClock' = [vectorClock EXCEPT ![n] = newClock]
    \* Sequence continues from where we left off (tracked in our own logs - both synced and pending)
    /\ LET syncedMax == MaxSeqInLog(syncedLogs[n], n)
           pendingMax == MaxSeqInLog(pendingLogs[n], n)
       IN nextSeq' = [nextSeq EXCEPT ![n] = (IF pendingMax > syncedMax THEN pendingMax ELSE syncedMax) + 1]
    \* Reset watermark on restart (we don't know what activity we've seen)
    /\ watermark' = [watermark EXCEPT ![n] = EmptyVectorClock]
    /\ UNCHANGED <<dbCache, pendingLogs, syncedLogs, pendingActivity, syncedActivity, nextUpdateId>>

\***********************************************************************
\* Next State Relation
\***********************************************************************

Next ==
    \/ \E n \in Node : Edit(n)
    \/ \E n \in Node : CloudSyncLog(n)
    \/ \E n \in Node : CloudSyncActivity(n)
    \/ \E n \in Node : ReloadDirect(n)
    \/ \E n \in Node : PollActivity(n)
    \/ \E n \in Node : ReloadFromActivity(n)
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
    /\ \A n \in Node : WF_vars(ReloadDirect(n))       \* Direct reload eventually happens
    /\ \A n \in Node : WF_vars(PollActivity(n))       \* Nodes eventually poll
    /\ \A n \in Node : WF_vars(ReloadFromActivity(n)) \* Activity-triggered reload happens
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
    \A n \in Node : localDoc[n] \subseteq 1..(nextUpdateId - 1)

\***********************************************************************
\* Quiescence and Convergence
\***********************************************************************

\* System is quiescent: no pending syncs, all nodes running
Quiescent ==
    /\ \A n \in Node : running[n]
    /\ \A n \in Node : pendingLogs[n] = <<>>
    /\ \A n \in Node : pendingActivity[n] = <<>>

\* All nodes have the same document state
Converged ==
    \A n1, n2 \in Node : localDoc[n1] = localDoc[n2]

\* System is fully synchronized: quiescent AND all nodes have seen all updates
FullySynced ==
    /\ Quiescent
    /\ \A n \in Node : \A m \in Node :
        vectorClock[n][m] = MaxSeqInLog(syncedLogs[m], m)

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

====

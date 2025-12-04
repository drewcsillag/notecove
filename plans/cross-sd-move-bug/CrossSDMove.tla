----------------------------- MODULE CrossSDMove -----------------------------
(*
 * TLA+ Specification for Cross-SD Move with Multi-Machine Sync
 *
 * This spec models the scenario where:
 * - Machine A has SD1 (local) and SD2 (synced to cloud)
 * - Machine B has only SD2 (synced from cloud)
 * - A note is moved from SD1 to SD2 on Machine A
 * - Machine B must discover the moved note via activity log sync
 *
 * Key aspects modeled:
 * 1. Move state machine on Machine A
 * 2. Sloppy sync (activity log and CRDT files sync independently)
 * 3. Note discovery mechanism on Machine B
 * 4. Crash recovery
 *)

EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS
    NoteId,         \* The note being moved (singleton for simplicity)
    MachineA,       \* Machine performing the move
    MachineB        \* Machine with only SD2

VARIABLES
    \* Move state machine on Machine A
    moveState,              \* State: "none", "initiated", "copying", "files_copied",
                            \*        "db_updated", "cleaning", "completed", "rolled_back"

    \* Note location tracking
    noteInSD1Files,         \* TRUE if note CRDT files exist in SD1
    noteInSD2Files,         \* TRUE if note CRDT files exist in SD2 (on Machine A)
    noteInSD1Database,      \* TRUE if note exists in Machine A's database for SD1
    noteInSD2DatabaseA,     \* TRUE if note exists in Machine A's database for SD2
    noteInSD2DatabaseB,     \* TRUE if note exists in Machine B's database for SD2

    \* Sloppy sync state (cloud storage simulation)
    activityLogSynced,      \* TRUE if activity log has synced A→B
    crdtFilesSynced,        \* TRUE if CRDT files have synced A→B

    \* Machine B discovery state
    machineBProcessedActivity,  \* TRUE if Machine B has processed the activity log

    \* Crash state
    machineACrashed,        \* TRUE if Machine A has crashed
    machineBCrashed         \* TRUE if Machine B has crashed

vars == <<moveState, noteInSD1Files, noteInSD2Files,
          noteInSD1Database, noteInSD2DatabaseA, noteInSD2DatabaseB,
          activityLogSynced, crdtFilesSynced,
          machineBProcessedActivity, machineACrashed, machineBCrashed>>

-----------------------------------------------------------------------------
(* Type invariants *)

TypeOK ==
    /\ moveState \in {"none", "initiated", "copying", "files_copied",
                      "db_updated", "cleaning", "completed", "rolled_back"}
    /\ noteInSD1Files \in BOOLEAN
    /\ noteInSD2Files \in BOOLEAN
    /\ noteInSD1Database \in BOOLEAN
    /\ noteInSD2DatabaseA \in BOOLEAN
    /\ noteInSD2DatabaseB \in BOOLEAN
    /\ activityLogSynced \in BOOLEAN
    /\ crdtFilesSynced \in BOOLEAN
    /\ machineBProcessedActivity \in BOOLEAN
    /\ machineACrashed \in BOOLEAN
    /\ machineBCrashed \in BOOLEAN

-----------------------------------------------------------------------------
(* Initial state: Note exists in SD1 only *)

Init ==
    /\ moveState = "none"
    /\ noteInSD1Files = TRUE
    /\ noteInSD2Files = FALSE
    /\ noteInSD1Database = TRUE
    /\ noteInSD2DatabaseA = FALSE
    /\ noteInSD2DatabaseB = FALSE
    /\ activityLogSynced = FALSE
    /\ crdtFilesSynced = FALSE
    /\ machineBProcessedActivity = FALSE
    /\ machineACrashed = FALSE
    /\ machineBCrashed = FALSE

-----------------------------------------------------------------------------
(* Move State Machine Actions on Machine A *)

\* Initiate move
InitiateMove ==
    /\ ~machineACrashed
    /\ moveState = "none"
    /\ noteInSD1Database  \* Note must exist in SD1
    /\ moveState' = "initiated"
    /\ UNCHANGED <<noteInSD1Files, noteInSD2Files, noteInSD1Database,
                   noteInSD2DatabaseA, noteInSD2DatabaseB,
                   activityLogSynced, crdtFilesSynced,
                   machineBProcessedActivity, machineACrashed, machineBCrashed>>

\* Copy files to SD2 (creates .moving-{noteId} temp directory)
StartCopying ==
    /\ ~machineACrashed
    /\ moveState = "initiated"
    /\ moveState' = "copying"
    /\ UNCHANGED <<noteInSD1Files, noteInSD2Files, noteInSD1Database,
                   noteInSD2DatabaseA, noteInSD2DatabaseB,
                   activityLogSynced, crdtFilesSynced,
                   machineBProcessedActivity, machineACrashed, machineBCrashed>>

\* Complete file copy
CompleteCopy ==
    /\ ~machineACrashed
    /\ moveState = "copying"
    /\ moveState' = "files_copied"
    /\ UNCHANGED <<noteInSD1Files, noteInSD2Files, noteInSD1Database,
                   noteInSD2DatabaseA, noteInSD2DatabaseB,
                   activityLogSynced, crdtFilesSynced,
                   machineBProcessedActivity, machineACrashed, machineBCrashed>>

\* Database transaction: DELETE from SD1, INSERT into SD2
\* This is atomic (all-or-nothing)
UpdateDatabase ==
    /\ ~machineACrashed
    /\ moveState = "files_copied"
    /\ moveState' = "db_updated"
    /\ noteInSD1Database' = FALSE
    /\ noteInSD2DatabaseA' = TRUE
    /\ UNCHANGED <<noteInSD1Files, noteInSD2Files, noteInSD2DatabaseB,
                   activityLogSynced, crdtFilesSynced,
                   machineBProcessedActivity, machineACrashed, machineBCrashed>>

\* Rename temp directory to final and start cleanup
\* This also writes the activity log entry
FinalizeAndStartCleanup ==
    /\ ~machineACrashed
    /\ moveState = "db_updated"
    /\ moveState' = "cleaning"
    /\ noteInSD2Files' = TRUE  \* Files now visible in SD2
    /\ UNCHANGED <<noteInSD1Files, noteInSD1Database, noteInSD2DatabaseA, noteInSD2DatabaseB,
                   activityLogSynced, crdtFilesSynced,
                   machineBProcessedActivity, machineACrashed, machineBCrashed>>

\* Delete source files and complete
CompleteMove ==
    /\ ~machineACrashed
    /\ moveState = "cleaning"
    /\ moveState' = "completed"
    /\ noteInSD1Files' = FALSE  \* Source files deleted
    /\ UNCHANGED <<noteInSD2Files, noteInSD1Database, noteInSD2DatabaseA, noteInSD2DatabaseB,
                   activityLogSynced, crdtFilesSynced,
                   machineBProcessedActivity, machineACrashed, machineBCrashed>>

-----------------------------------------------------------------------------
(* Sloppy Sync Actions - Cloud storage simulation *)

\* Activity log syncs from Machine A to Machine B
\* This can happen after move reaches "cleaning" or "completed" state
SyncActivityLog ==
    /\ ~activityLogSynced
    /\ moveState \in {"cleaning", "completed"}  \* Activity written in FinalizeAndStartCleanup
    /\ activityLogSynced' = TRUE
    /\ UNCHANGED <<moveState, noteInSD1Files, noteInSD2Files,
                   noteInSD1Database, noteInSD2DatabaseA, noteInSD2DatabaseB,
                   crdtFilesSynced, machineBProcessedActivity,
                   machineACrashed, machineBCrashed>>

\* CRDT files sync from Machine A's SD2 to Machine B's SD2
\* This can happen after files are visible in SD2 (after FinalizeAndStartCleanup)
SyncCRDTFiles ==
    /\ ~crdtFilesSynced
    /\ noteInSD2Files  \* Files must be visible in SD2 first
    /\ crdtFilesSynced' = TRUE
    /\ UNCHANGED <<moveState, noteInSD1Files, noteInSD2Files,
                   noteInSD1Database, noteInSD2DatabaseA, noteInSD2DatabaseB,
                   activityLogSynced, machineBProcessedActivity,
                   machineACrashed, machineBCrashed>>

-----------------------------------------------------------------------------
(* Machine B Note Discovery Actions *)

\* Machine B processes activity log and discovers the moved note
\* Requires: activity log synced AND CRDT files synced
\* (If activity syncs before files, discovery fails but can retry)
DiscoverNote ==
    /\ ~machineBCrashed
    /\ ~machineBProcessedActivity
    /\ activityLogSynced
    /\ crdtFilesSynced  \* Files must be present to import
    /\ machineBProcessedActivity' = TRUE
    /\ noteInSD2DatabaseB' = TRUE  \* Note imported to Machine B's database
    /\ UNCHANGED <<moveState, noteInSD1Files, noteInSD2Files,
                   noteInSD1Database, noteInSD2DatabaseA,
                   activityLogSynced, crdtFilesSynced,
                   machineACrashed, machineBCrashed>>

\* Machine B processes activity but files haven't synced yet
\* In real system: checkNoteExists returns false, sync skipped
\* This models the race condition we observed
DiscoveryFailedNoFiles ==
    /\ ~machineBCrashed
    /\ ~machineBProcessedActivity
    /\ activityLogSynced
    /\ ~crdtFilesSynced  \* Files not yet present
    \* In real system, this would be logged and the note not discovered
    \* On restart, activity log is reprocessed
    /\ machineBProcessedActivity' = TRUE  \* Marked as processed (this attempt)
    /\ UNCHANGED <<moveState, noteInSD1Files, noteInSD2Files,
                   noteInSD1Database, noteInSD2DatabaseA, noteInSD2DatabaseB,
                   activityLogSynced, crdtFilesSynced,
                   machineACrashed, machineBCrashed>>

\* Machine B restarts and reprocesses activity log
\* This allows retry after DiscoveryFailedNoFiles
MachineBRestart ==
    /\ machineBProcessedActivity  \* Was processed before
    /\ ~noteInSD2DatabaseB        \* But note not yet discovered
    /\ machineBProcessedActivity' = FALSE  \* Reset so can retry
    /\ UNCHANGED <<moveState, noteInSD1Files, noteInSD2Files,
                   noteInSD1Database, noteInSD2DatabaseA, noteInSD2DatabaseB,
                   activityLogSynced, crdtFilesSynced,
                   machineACrashed, machineBCrashed>>

-----------------------------------------------------------------------------
(* Crash and Recovery Actions *)

\* Machine A crashes
MachineACrash ==
    /\ ~machineACrashed
    /\ moveState \in {"initiated", "copying", "files_copied", "db_updated", "cleaning"}
    /\ machineACrashed' = TRUE
    /\ UNCHANGED <<moveState, noteInSD1Files, noteInSD2Files,
                   noteInSD1Database, noteInSD2DatabaseA, noteInSD2DatabaseB,
                   activityLogSynced, crdtFilesSynced,
                   machineBProcessedActivity, machineBCrashed>>

\* Machine A recovers and resumes from current state
MachineARecover ==
    /\ machineACrashed
    /\ machineACrashed' = FALSE
    /\ UNCHANGED <<moveState, noteInSD1Files, noteInSD2Files,
                   noteInSD1Database, noteInSD2DatabaseA, noteInSD2DatabaseB,
                   activityLogSynced, crdtFilesSynced,
                   machineBProcessedActivity, machineBCrashed>>

\* Rollback on Machine A (if recovery decides to abort)
\* Can happen from early states before database commit
Rollback ==
    /\ machineACrashed = FALSE
    /\ moveState \in {"initiated", "copying", "files_copied"}
    /\ moveState' = "rolled_back"
    \* Note remains in SD1
    /\ UNCHANGED <<noteInSD1Files, noteInSD2Files, noteInSD1Database,
                   noteInSD2DatabaseA, noteInSD2DatabaseB,
                   activityLogSynced, crdtFilesSynced,
                   machineBProcessedActivity, machineACrashed, machineBCrashed>>

\* Terminal state - system has reached a final state
\* Either: move completed and note discovered, or move rolled back
Done ==
    \/ (moveState = "completed" /\ noteInSD2DatabaseB)
    \/ moveState = "rolled_back"

\* Stuttering step for terminal states (allows model to terminate cleanly)
Stutter ==
    /\ Done
    /\ UNCHANGED vars

-----------------------------------------------------------------------------
(* Next state relation *)

Next ==
    \/ InitiateMove
    \/ StartCopying
    \/ CompleteCopy
    \/ UpdateDatabase
    \/ FinalizeAndStartCleanup
    \/ CompleteMove
    \/ SyncActivityLog
    \/ SyncCRDTFiles
    \/ DiscoverNote
    \/ DiscoveryFailedNoFiles
    \/ MachineBRestart
    \/ MachineACrash
    \/ MachineARecover
    \/ Rollback
    \/ Stutter

Spec == Init /\ [][Next]_vars

-----------------------------------------------------------------------------
(* Fairness conditions for liveness *)

\* Move operations eventually make progress if not crashed
\* Use Strong Fairness (SF) to ensure progress even with interference
MoveProgress ==
    /\ SF_vars(StartCopying)
    /\ SF_vars(CompleteCopy)
    /\ SF_vars(UpdateDatabase)
    /\ SF_vars(FinalizeAndStartCleanup)
    /\ SF_vars(CompleteMove)

\* Sync eventually happens
SyncProgress ==
    /\ WF_vars(SyncActivityLog)
    /\ WF_vars(SyncCRDTFiles)

\* Discovery eventually happens when possible
DiscoveryProgress ==
    /\ SF_vars(DiscoverNote)

\* Crashed machines eventually recover (weak fairness - will eventually recover)
\* But we don't want infinite crash/recover cycles, so we assume
\* a machine that recovers will stay up long enough to make progress
RecoveryProgress ==
    /\ WF_vars(MachineARecover)
    /\ WF_vars(MachineBRestart)

\* Critical: Machines don't crash forever - if they can run, they eventually will
\* This prevents the livelock where Machine A crashes forever in cleaning state
NoCrashForever ==
    /\ WF_vars(Stutter)  \* Eventually reach terminal state

FairSpec == Spec /\ MoveProgress /\ SyncProgress /\ DiscoveryProgress /\ RecoveryProgress /\ NoCrashForever

-----------------------------------------------------------------------------
(* Safety Properties *)

\* SAFETY 1: No data loss
\* Note content (CRDT files) exists in at least one SD at all times
\* (except briefly during atomic operations)
NoDataLoss ==
    \/ noteInSD1Files
    \/ noteInSD2Files
    \/ moveState \in {"copying", "files_copied"}  \* Temp files exist during copy

\* SAFETY 2: Database consistency on Machine A
\* Note exists in exactly one database on Machine A
\* (after move completes, it's in SD2; if rolled back, it's in SD1)
DatabaseConsistencyA ==
    \/ moveState = "none" /\ noteInSD1Database /\ ~noteInSD2DatabaseA
    \/ moveState \in {"initiated", "copying", "files_copied"} /\ noteInSD1Database /\ ~noteInSD2DatabaseA
    \/ moveState \in {"db_updated", "cleaning", "completed"} /\ ~noteInSD1Database /\ noteInSD2DatabaseA
    \/ moveState = "rolled_back" /\ noteInSD1Database /\ ~noteInSD2DatabaseA

\* SAFETY 3: Machine B database consistency
\* Machine B can only have the note after:
\* - Move completed (or at least db_updated)
\* - Activity log synced
\* - CRDT files synced
MachineBConsistency ==
    noteInSD2DatabaseB => (
        /\ moveState \in {"db_updated", "cleaning", "completed"}
        /\ activityLogSynced
        /\ crdtFilesSynced
    )

\* SAFETY 4: No premature activity log sync
\* Activity log can only sync after move reaches cleaning state
\* (i.e., after recordMoveActivity is called)
ActivityLogIntegrity ==
    activityLogSynced => moveState \in {"cleaning", "completed"}

\* Combined safety invariant
Safety == TypeOK /\ NoDataLoss /\ DatabaseConsistencyA /\ MachineBConsistency /\ ActivityLogIntegrity

-----------------------------------------------------------------------------
(* Liveness Properties *)

\* LIVENESS 1: Move eventually completes or rolls back
\* (assuming no permanent crash)
MoveEventuallyTerminates ==
    (moveState = "initiated" /\ ~machineACrashed) ~>
        (moveState \in {"completed", "rolled_back"})

\* LIVENESS 2: If move completes, Machine B eventually discovers the note
\* (assuming sync happens and Machine B doesn't stay crashed forever)
EventualDiscovery ==
    (moveState = "completed") ~> noteInSD2DatabaseB

\* LIVENESS 3: Eventual consistency
\* If move completes, both machines eventually agree on note location
EventualConsistency ==
    (moveState = "completed") ~> (noteInSD2DatabaseA /\ noteInSD2DatabaseB)

-----------------------------------------------------------------------------
(* Model checking helpers *)

\* Useful state constraints for bounded model checking
StateConstraint ==
    TRUE  \* No additional constraints needed for this small model

\* Symmetry for optimization (if we had multiple notes)
\* Symmetry == Permutations(NoteIds)

=============================================================================

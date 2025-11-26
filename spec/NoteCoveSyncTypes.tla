---- MODULE NoteCoveSyncTypes ----
\***********************************************************************
\* Type definitions and constants for NoteCove sync specification
\*
\* This module defines the basic types used throughout the spec.
\* See MODEL-DESIGN.md for rationale.
\***********************************************************************

EXTENDS Naturals, Sequences, FiniteSets

\***********************************************************************
\* Constants (configured in .cfg file)
\***********************************************************************

CONSTANTS
    Node,           \* Set of node identifiers, e.g., {n1, n2}
    MaxUpdates,     \* Maximum number of updates to model
    MaxLogSize,     \* Maximum activity log size before compaction
    ActivityMode    \* "append" or "replace" - activity log write mode

\***********************************************************************
\* Derived Constants
\***********************************************************************

\* All possible update IDs
UpdateId == 1..MaxUpdates

\* Sequence numbers start at 1
SeqNum == 1..MaxUpdates

\***********************************************************************
\* Record Types
\***********************************************************************

\* A CRDT log entry: one Yjs update
LogEntry == [
    updateId: UpdateId,     \* Unique ID for this update
    origin: Node,           \* Node that created this update
    seq: SeqNum             \* Sequence number from origin
]

\* An activity log entry: notification that a note changed
ActivityEntry == [
    origin: Node,           \* Node that made the change
    seq: SeqNum             \* Sequence number of the change
]

\* Vector clock entry: what we've seen from one instance
ClockEntry == [
    seq: Nat                \* Highest sequence number seen (0 = nothing)
]

\* A vector clock: what we've seen from all instances
VectorClock == [Node -> Nat]

\* DB cache: persisted snapshot
DbCache == [
    doc: SUBSET UpdateId,   \* Document state (set of applied updates)
    clock: VectorClock      \* Vector clock at snapshot time
]

\***********************************************************************
\* Type Predicates
\***********************************************************************

\* Check if a value is a valid log entry
IsLogEntry(e) ==
    /\ e.updateId \in UpdateId
    /\ e.origin \in Node
    /\ e.seq \in SeqNum

\* Check if a value is a valid activity entry
IsActivityEntry(e) ==
    /\ e.origin \in Node
    /\ e.seq \in SeqNum

\* Check if a value is a valid vector clock
IsVectorClock(vc) ==
    /\ DOMAIN vc = Node
    /\ \A n \in Node : vc[n] \in Nat

\* Check if a sequence contains only log entries
IsLogSeq(s) ==
    \A i \in 1..Len(s) : IsLogEntry(s[i])

\* Check if a sequence contains only activity entries
IsActivitySeq(s) ==
    \A i \in 1..Len(s) : IsActivityEntry(s[i])

\***********************************************************************
\* Helper Functions
\***********************************************************************

\* Empty vector clock (haven't seen anything)
EmptyVectorClock == [n \in Node |-> 0]

\* Empty DB cache
EmptyDbCache == [doc |-> {}, clock |-> EmptyVectorClock]

\* Get all update IDs from a log sequence
UpdatesInLog(log) ==
    {log[idx].updateId : idx \in DOMAIN log}

\* Get highest sequence number for a node in a log
MaxSeqInLog(log, node) ==
    LET nodeEntries == {log[idx].seq : idx \in {j \in DOMAIN log : log[j].origin = node}}
    IN IF nodeEntries = {} THEN 0 ELSE CHOOSE s \in nodeEntries : \A t \in nodeEntries : s >= t

\* Filter log entries with seq > threshold for a given origin
NewEntriesInLog(log, origin, threshold) ==
    {log[idx] : idx \in {j \in DOMAIN log : log[j].origin = origin /\ log[j].seq > threshold}}

\* Get highest sequence number in an activity log for a given origin
MaxSeqInActivity(log, origin) ==
    LET entries == {log[idx].seq : idx \in {j \in DOMAIN log : log[j].origin = origin}}
    IN IF entries = {} THEN 0 ELSE CHOOSE s \in entries : \A t \in entries : s >= t

\* Check if activity log has entries with seq > threshold for an origin
HasNewActivity(log, origin, threshold) ==
    \E idx \in DOMAIN log : log[idx].origin = origin /\ log[idx].seq > threshold

\* Get minimum sequence number in an activity log for a given origin
MinSeqInActivity(log, origin) ==
    LET entries == {log[idx].seq : idx \in {j \in DOMAIN log : log[j].origin = origin}}
    IN IF entries = {} THEN 0 ELSE CHOOSE s \in entries : \A t \in entries : s <= t

\* Check if there's a gap in activity log (compaction happened)
\* Gap exists if min seq in log > watermark + 1
HasActivityGap(log, origin, watermark) ==
    LET minSeq == MinSeqInActivity(log, origin)
    IN minSeq > 0 /\ minSeq > watermark + 1

====

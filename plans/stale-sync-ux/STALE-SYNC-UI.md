# Stale Sync UI Design

## Overview

When sync entries can't be fulfilled (missing CRDT files), users need visibility and control. Two UI components:

1. **Toast notification** - Proactive alert when syncs are pending
2. **Sync Status panel** - Full details and actions (Tools menu)

---

## Toast Notification

### Trigger

Appears when:

- Stale sync detected (sequence gap > threshold)
- Sync retry exhausted (10 attempts failed)

### Format

```
⏳ Waiting for sync from @drew's MacBook (2 notes)
   [View Details]
```

### Behavior

- Dismissable (X button)
- Click "View Details" opens Sync Status panel
- Auto-dismiss after 30 seconds if syncs resolve
- Re-appears if new stale syncs detected

---

## Sync Status Panel

### Access

**Tools → Sync Status**

### Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Sync Status                                            [X] │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│ ⚠️ 2 notes waiting for sync                                 │
│                                                             │
│ ┌─────────────────────────────────────────────────────────┐ │
│ │ Note          │ From              │ Gap    │ Actions   │ │
│ ├───────────────┼───────────────────┼────────┼───────────┤ │
│ │ Project Ideas │ @drew (MacBook)   │ 308    │ [Skip]    │ │
│ │               │ 2 days ago        │        │ [Retry]   │ │
│ ├───────────────┼───────────────────┼────────┼───────────┤ │
│ │ Meeting Notes │ @drew (iMac)      │ 12     │ [Skip]    │ │
│ │               │ 5 min ago         │        │ [Retry]   │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                                             │
│ [Export Diagnostics]                                        │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Columns

| Column  | Content                                                 |
| ------- | ------------------------------------------------------- |
| Note    | Note title (from local DB if available, else "Unknown") |
| From    | Profile info: "@user (hostname)" + relative time        |
| Gap     | Sequence gap: expectedSeq - highestSeq                  |
| Actions | Skip, Retry buttons                                     |

### Actions

#### Skip

Accepts data loss. Updates watermark to skip past stale entry.

**Confirmation dialog:**

```
Skip sync for "Project Ideas"?

This note is waiting for 308 updates from @drew's MacBook
that may never arrive. Skipping will:

• Use the data currently available (may be incomplete)
• Stop waiting for the missing updates
• Cannot be undone

[Cancel] [Skip and Continue]
```

#### Retry

Forces immediate retry of sync for this entry.

### Details Panel (expandable)

Click a row to expand:

```
─────────────────────────────────────────────────────
Note: Project Ideas
Note ID: 927c5777-9654-465a-8117-0e924a05e6e2

Source Profile:
  Name: Personal
  User: @drew
  Device: Drews-MacBook-Pro.local
  Platform: darwin
  Last Updated: Dec 2, 2024 3:45 PM

Sync Details:
  Expected Sequence: 3434
  Available Sequence: 3126
  Gap: 308 updates missing
  Retry Attempts: 10/10 (exhausted)

[View Note Anyway] [Delete Activity Entry]
─────────────────────────────────────────────────────
```

---

## Export Diagnostics

### Contents

JSON/ZIP package containing:

```json
{
  "exportedAt": "2024-12-04T16:45:00Z",
  "appVersion": "0.1.2",
  "platform": "darwin",
  "staleSyncs": [
    {
      "noteId": "927c5777-...",
      "noteTitle": "Project Ideas",
      "sourceProfileId": "2379a4cf-...",
      "expectedSeq": 3434,
      "highestSeq": 3126,
      "retryAttempts": 10,
      "lastAttempt": "2024-12-04T16:40:00Z"
    }
  ],
  "profilePresence": {
    "2379a4cf-...": {
      "profileName": "Personal",
      "user": "@drew",
      "hostname": "Drews-MacBook-Pro.local"
    }
  },
  "activityLogSummaries": {
    "2379a4cf-...": {
      "entryCount": 1523,
      "lastEntry": "927c5777-...|2379a4cf-..._3434",
      "fileMtime": "2024-12-02T15:30:00Z"
    }
  }
}
```

### Privacy

- Note titles included (for support debugging)
- Note content NOT included
- Profile names/usernames included
- No file paths beyond SD-relative

---

## State Management

### Stale Sync Tracking

```typescript
interface StaleSyncEntry {
  noteId: string;
  noteTitle: string | null;
  sourceProfileId: string;
  sourceInstanceSeq: string;
  expectedSequence: number;
  highestAvailableSequence: number;
  retryAttempts: number;
  lastAttemptAt: number;
  sdId: string;
}
```

### IPC Endpoints

```typescript
// Get current stale syncs
'sync:getStaleSyncs': () => Promise<StaleSyncEntry[]>

// Skip a stale entry (accept data loss)
'sync:skipStaleEntry': (noteId: string, sdId: string) => Promise<void>

// Force retry a stale entry
'sync:retryStaleEntry': (noteId: string, sdId: string) => Promise<void>

// Export diagnostics package
'sync:exportDiagnostics': () => Promise<string> // Returns file path
```

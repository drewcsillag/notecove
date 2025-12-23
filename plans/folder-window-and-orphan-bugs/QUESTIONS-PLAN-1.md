# Plan Review Questions

## Question 1: Cascade Delete - Where Do Nested Notes Go?

When cascade-deleting a folder hierarchy:

```
Parent (being deleted)
├── Child (also deleted)
│   └── Grandchild (also deleted)
│       └── Note X
└── Note Y
```

**Current plan says**: "Move notes from deleted folders to parent"

**Clarification needed**: Should ALL notes (X and Y) go to Parent's parent (the great-grandparent)?

**My recommendation**: Yes - all notes from the entire deleted subtree should move to the topmost deleted folder's parent. This is simpler and matches user expectation ("delete this folder and everything in it, but save my notes").

Your preference?

- A) All notes go to the deleted folder's parent (my recommendation)
- B) Each note goes to its immediate folder's parent (could result in notes in deleted folders)
- C) Other approach

## Question 2: Orphan Cleanup Strategy

Current plan says cleanup orphans "on app startup."

**Concern**: If another synced device still has those folders as non-deleted, auto-cleanup could cause sync conflicts.

**Recommendation**:

- Add ancestry filtering (B5) so orphans are hidden from UI
- Make cleanup MANUAL via a button in Settings or a one-time migration dialog
- OR: Only cleanup folders that have been orphaned for >30 days (based on modification date)

Your preference?

- A) Manual cleanup (button in Settings)
- B) One-time migration dialog on first launch after update
- C) Automatic on startup (accept sync risk)
- D) Ancestry filtering only, no actual cleanup (orphans stay in DB but invisible)

## Not a Question - Just Noting

I'll first query the Production SD to see what orphaned folders currently exist before implementing the fix. This gives us a baseline.

SD ID: `af7545b4-c309-4bc0-942e-bfef06130437`

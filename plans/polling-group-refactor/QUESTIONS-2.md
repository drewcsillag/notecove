# Polling Group Refactor - Questions Round 2

Based on your answers, a few follow-up clarifications:

## 1. Recently Edited Notes - Time Window

You said yes to adding "recently edited notes" to the polling group.

**Question**: What's the time window for "recently edited"?

- Last 5 minutes?
- Last 15 minutes?
- Configurable in settings?

Let's go with 5 and make it configurable

## 2. Per-SD Overrides UI

You mentioned "global with per-SD overrides" for settings.

**Question**: Where should per-SD overrides be configured?

- In the Advanced settings tab (dropdown to select SD)?
- In the existing Storage Directories settings tab?
- In the new Tools > Advanced window?

Advanced settings tab

## 3. Tools > Advanced Window

You want a visibility window accessible via Tools > Advanced.

**Questions**:
a. Should this be a new menu item "Tools > Sync Status" or add to an existing window?
b. What information should be shown?

- List of notes in polling group with their status
- Current polling rate (notes/minute)
- Time until next full repoll
- Per-SD sync status
- All of the above?
  c. Should the "Sync Now" button be in this window or also in Settings?

a. There's already a Tools>Advanced>SyncStatus and I think this would be a good place to do it as
Stale sync doesn't really mean anything any more unless I'm misunderstanding. So you can replace the content of the window we already have
b. all of the above
c. should be in this window

## 4. Open Notes Definition

You said open notes get priority.

**Question**: What counts as "open"?

- Only the currently visible/focused note in each window?
- All notes in the editor (including background tabs if we have them)?
- Notes in the notes list panel (visible but not in editor)?

notes in note editor (including background windows) and notes that appear in notes lists (including background windows)

## 5. Stale Entries Migration

You want stale entries to be absorbed into the polling group for retry.

**Question**: Should we keep the existing "stale sync" UI in the status bar, or replace it with a link to the new Tools > Advanced window?

Get rid of the stale sync UI in the status bar

## 6. CRDT Log Check Recommendation

I recommended Option C (track expected sequence per note). Does that approach work for you?

yes, with a clarification that it's track expected sequenes (plural as there may be multiple other instances/profiles with history on the note).

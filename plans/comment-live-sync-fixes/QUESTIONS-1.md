# Comment Live Sync Fixes - Questions Round 1

After analyzing the codebase, I have several questions to clarify before proceeding with the implementation plan.

## Issue Summary

You've reported 6 distinct issues:

1. **Comment content doesn't live sync** - highlighting syncs, but comment text requires navigating away and back
2. **Overlapping comments from concurrent editors** - both should be visible if two editors highlight the same text
3. **No way to open comments sidebar without clicking a comment** - need a toolbar button
4. **Race condition on concurrent comments** - editor A selects, editor B comments, both save - A's wins, both should show
5. **Username always shows "You"** - should show actual profile username
6. **Replies don't live update** - require switching notes to appear

---

## Questions

### 1. Toolbar Button Behavior

For "open comments sidebar without clicking on a comment":

**Option A:** Add a separate "View Comments" button that opens the panel (shows all comments, no selection)
**Option B:** Rework the existing comment button to toggle the panel when no text is selected, and add comment when text is selected
**Option C:** Both - keep existing button for adding, add new "show all comments" button

Which approach do you prefer?

## C

### 2. Overlapping Comments Display

When two editors independently highlight and comment on the same text:

**Option A:** Show both comments in the sidebar, but the text only gets one visual highlight (combine threadIds somehow)
**Option B:** Allow multiple highlight colors/styles to show overlapping regions
**Option C:** Stack multiple marks - clicking reveals a picker to choose which comment

Which behavior matches your expectations?

## Give me pros and cons on the options. I expect there's a decent amount of impacting detail here

### 3. Race Condition Scenario Clarification

You described: "A selects text and hits add comment, B clicks on the now-highlighted text, types something and saves. A then types and saves, and A wins."

I want to confirm my understanding:

- A creates a thread (with empty content), applies highlight
- The highlight syncs to B immediately (via CRDT)
- B sees the highlight, clicks it, types comment text, saves
- A (not seeing B's content yet) types their own text and saves
- A's content "wins" because it came later?

**Clarifying question:** Should this result in:

- **Two separate threads** (each person's comment is its own thread on the same text)
- **One thread with two replies** (B's becomes a reply under A's thread)
- **One thread with both contents merged** (show both authors' comments within the same thread, perhaps like concurrent edits)

## Two seperate threads

### 4. Username Display Strategy

Currently hardcoded to "You" for the current user. Two options:

**Option A:** Always show actual username (e.g., "Drew Colthorp"), even for your own comments
**Option B:** Show "You" for your own comments, actual username for others

Which do you prefer?

## What do other tools do here? I'm inclined to A, but would rather go with convention here.

### 5. CRDT Live Updates Architecture

The current architecture broadcasts IPC events (`comment:threadAdded`, etc.) only to windows in the _same process_. When comments sync via CRDT from another machine:

1. The CRDT layer applies the remote update
2. But no IPC broadcast happens because it wasn't initiated by this process

This explains why synced comments don't appear until you switch notes (forcing a reload).

**Proposed fix:** Add CRDT observers that detect remote changes and trigger the appropriate broadcasts.

Does this approach sound correct to you, or do you have concerns about this design?

## yes that sounds correct

### 6. Concurrent Comment Threads - CRDT Consideration

Two editors creating threads at "the same time" on overlapping text:

- Each creates a thread with a unique ID (UUIDs don't collide)
- CRDT merges both threads without conflict
- Both highlights should appear

But currently, CommentMark is a simple TipTap mark with `data-thread-id`. If two marks overlap the exact same range:

- The TipTap marks may merge or conflict depending on exact positions
- The highlight might only show one `data-thread-id`

**Question:** Should I investigate making the comment mark support multiple thread IDs per text range, or is it acceptable to have separate visual highlights for each thread (even if they overlap the same text)?

## If they overlap, it probably makes sense to have separate visuals, the fact that they overlap exactly is happenstance, but something we need to ensure has an answer.

### 7. Testing Approach

For testing live sync between instances, I'll need to:

- Unit test the CRDT observer logic
- Unit test the new IPC handlers
- Integration test with mocked multi-instance scenarios

Is there an existing pattern in the codebase for testing multi-instance sync, or should I design a new approach?

## There is and there's also one for cross-machine sync which tends to be sloppy (files sync out of order, various delays, etc.)

## Summary of My Understanding

| Issue                          | Root Cause                                                              |
| ------------------------------ | ----------------------------------------------------------------------- |
| Comment text doesn't live sync | No CRDT observer triggering UI refresh                                  |
| Replies don't live update      | Same as above                                                           |
| "You" hardcoded                | TODOs never implemented in TipTapEditor and CommentPanel                |
| Overlapping comments           | Need to support multiple marks/threads on same text                     |
| No way to open sidebar         | Missing toolbar functionality                                           |
| A wins race                    | CRDT semantics are fine; both comments should exist as separate threads |

Please answer the questions above so I can proceed with the implementation plan.

# Link Text Separation - Implementation Plan

**Overall Progress:** `100%`

## Problem

When typing text before or after a link in a note, the new text incorrectly becomes part of the link. Text typed before a link should never be linked, and text typed after a link should not extend the link.

## Root Cause

TipTap's Link extension has `inclusive() { return this.options.autolink }`. Since our WebLink extension sets `autolink: true`, the mark is inclusive, meaning typing at link boundaries extends the link mark.

## Solution

Override `inclusive()` in WebLink extension to return `false`. This makes link marks have fixed boundaries - typing adjacent to them won't extend them.

## Tasks

- [x] 🟩 **Step 1: Write failing tests for link boundary behavior**
  - [x] 🟩 Create `WebLink.test.ts` test file
  - [x] 🟩 Test: typing after a link should not extend the link
  - [x] 🟩 Test: typing before a link should not extend the link
  - [x] 🟩 Test: autolink still works (regression test - typing URL + space creates link)
  - [x] 🟩 Verify boundary tests fail with current implementation

- [x] 🟩 **Step 2: Implement the fix**
  - [x] 🟩 Add `inclusive()` method to WebLink extension returning `false`

- [x] 🟩 **Step 3: Verify fix**
  - [x] 🟩 Run tests and confirm they pass
  - [x] 🟩 Run full CI suite

## Files Modified

- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/WebLink.ts` - Added `inclusive()` override, fixed DEBUG constant for Jest compatibility
- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/__tests__/WebLink.test.ts` - New test file

## Related Files (Reference)

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Requirements clarification

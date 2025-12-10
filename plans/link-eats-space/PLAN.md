# Link-Eats-Space Bug Fix Plan

**Overall Progress:** `100%`

## Summary

When inserting an inter-note link via autocomplete (`[[`), the preceding whitespace/newline was incorrectly consumed, causing:

- Links to merge into the previous line (e.g., H1 title)
- Spaces before `[[` to disappear (`foo [[link]]` → `foo[[link]]`)

**Root Cause:** `findDoubleBracketMatch()` in `InterNoteLink.ts` used `$position.before()` which returns position _before_ the parent node (including the node's opening), but added `match.index` which is a _text content_ offset. This caused the range to be off by 1, including preceding whitespace/newlines.

**Fix:** Changed `$position.before()` to `$position.start()` which returns the position at the _start of the parent's content_.

## Tasks

- [x] 🟩 **Step 1: Write failing test**
  - [x] 🟩 Create `InterNoteLink.test.ts` in `packages/desktop/src/renderer/src/components/EditorPanel/extensions/__tests__/`
  - [x] 🟩 Test: inserting link after heading preserves paragraph separation
  - [x] 🟩 Test: inserting link after space preserves the space (`foo [[` → `foo [[link]]`)
  - [x] 🟩 Verified tests fail with current implementation (7 failures)

- [x] 🟩 **Step 2: Fix `findDoubleBracketMatch` position calculation**
  - [x] 🟩 Changed `$position.before()` to `$position.start()`
  - [x] 🟩 Added documentation comment explaining the fix

- [x] 🟩 **Step 3: Verify fix**
  - [x] 🟩 Run new unit tests - all 10 pass
  - [x] 🟩 Run EditorPanel tests - all 28 pass
  - [x] 🟩 One pre-existing failure in `handlers.test.ts` (unrelated - missing module)

## Files Modified

| File                    | Change                                      |
| ----------------------- | ------------------------------------------- |
| `InterNoteLink.ts:70`   | `$position.before()` → `$position.start()`  |
| `InterNoteLink.ts:63`   | Export `findDoubleBracketMatch` for testing |
| `InterNoteLink.test.ts` | New test file with 10 tests                 |

## Technical Details

### Before (buggy):

```typescript
const textFrom = $position.before(); // Position BEFORE parent node
```

### After (fixed):

```typescript
const textFrom = $position.start(); // Position at START of parent's content
```

## Related Files

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Q&A clarifying the bug behavior

# Feature: Code Block Exit at Document End

**Overall Progress:** `100%`

## Problem

When a code block (fenced by triple backticks) is at the end of a note, users cannot add content after it. Neither the built-in exit methods work:

- Triple Enter (press Enter 3 times) - stays in code block
- Arrow Down at end of code block - nothing happens
- Clicking below code block - no effect

## Root Cause

In `CodeBlockLowlight.ts`, the `addKeyboardShortcuts()` method was overriding the parent's keyboard shortcuts without inheriting them:

```typescript
// BEFORE (broken)
addKeyboardShortcuts() {
  return {
    'Mod-Shift-c': () => {
      return this.editor.commands.toggleCodeBlock();
    },
  };
},
```

This completely replaced the parent `CodeBlock` extension's keyboard shortcuts which include:

- `Enter` - exits on triple enter when `exitOnTripleEnter: true`
- `ArrowDown` - exits when at end if `exitOnArrowDown: true`
- `Backspace` - clears empty code block

## Solution

Inherit parent keyboard shortcuts using `this.parent?.()`:

```typescript
// AFTER (fixed)
addKeyboardShortcuts() {
  return {
    // IMPORTANT: Inherit parent keyboard shortcuts (Enter, ArrowDown, Backspace)
    // These enable exiting the code block at document end
    ...this.parent?.(),
    'Mod-Shift-c': () => {
      return this.editor.commands.toggleCodeBlock();
    },
  };
},
```

## Tasks

- [x] 🟩 **Step 1: Analyze the issue**
  - [x] 🟩 Explored codebase to find code block implementation
  - [x] 🟩 Identified root cause in `CodeBlockLowlight.ts`
  - [x] 🟩 Documented findings in QUESTIONS-1.md

- [x] 🟩 **Step 2: Write tests (TDD)**
  - [x] 🟩 Added test for `exitCode` command working
  - [x] 🟩 Added tests for exit options being enabled

- [x] 🟩 **Step 3: Implement fix**
  - [x] 🟩 Added `...this.parent?.()` to inherit parent keyboard shortcuts

- [x] 🟩 **Step 4: Verify fix**
  - [x] 🟩 All unit tests pass
  - [ ] 🟥 Manual verification in app (pending user testing)
  - [ ] 🟥 CI run before commit

## Files Changed

| File                                                                                                      | Change                                                          |
| --------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| `packages/desktop/src/renderer/src/components/EditorPanel/extensions/CodeBlockLowlight.ts`                | Added `...this.parent?.()` to inherit parent keyboard shortcuts |
| `packages/desktop/src/renderer/src/components/EditorPanel/extensions/__tests__/CodeBlockLowlight.test.ts` | Added tests for exit code block functionality                   |

## Related

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial questions and user answers

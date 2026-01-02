# Feature Implementation Plan

**Overall Progress:** `100%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

**Questions & Answers:** [QUESTIONS-1.md](./QUESTIONS-1.md)

---

## Summary

Two changes:

1. CRDT log filenames: change delimiter from `_` to `.` (with backward compatibility)
2. Profile wizard: simplify local/paranoid mode UI - remove path display, update descriptions

---

## Tasks

### Part 1: CRDT Log Delimiter Change

- [x] 🟩 **Step 1: Write failing tests for new CRDT log filename format**
  - [x] 🟩 Add test for new `.` delimiter format in log-writer.test.ts
  - [x] 🟩 Add test for backward compatibility reading old `_` format in log-reader.test.ts
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 2: Update log-writer.ts to use `.` delimiter**
  - [x] 🟩 Change `createNewFile()` to use `.` instead of `_`
  - [x] 🟩 Change `getUniqueTimestamp()` prefix to use `.` instead of `_`
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 3: Update log-reader.ts for backward compatibility**
  - [x] 🟩 Add regex pattern for new `.` format
  - [x] 🟩 Keep existing `_` format patterns for backward compatibility
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 4: Update existing tests to expect new format**
  - [x] 🟩 Update log-writer.test.ts filename expectations
  - [x] 🟩 Update note-storage-manager.test.ts filename expectations
  - [x] 🟩 Update folder-storage-manager.test.ts filename expectations
  - [x] 🟩 Verify all log-related tests pass
  - [x] 🟩 Update PLAN.md

### Part 2: Profile Wizard UI Changes

- [x] 🟩 **Step 5: Write failing tests for wizard UI changes**
  - [x] 🟩 Add/update test for local mode description text
  - [x] 🟩 Add/update test that storage path is NOT displayed for local/paranoid
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 6: Update StepModeSelection.tsx descriptions**
  - [x] 🟩 Change local mode: "Store notes in the profile. Simple and private."
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 7: Update StepStorageConfig.tsx for local/paranoid**
  - [x] 🟩 Remove path display for local/paranoid modes
  - [x] 🟩 Simplify the info text
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 8: Update StepConfirmation.tsx for local/paranoid**
  - [x] 🟩 Don't show storage path in confirmation for local/paranoid
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **Step 9: Update wizard tests**
  - [x] 🟩 Fix WizardContainer.test.tsx expecting old path display behavior
  - [x] 🟩 Verify all wizard tests pass
  - [x] 🟩 Update PLAN.md

### Part 3: Final Verification

- [x] 🟩 **Step 10: Run full CI and commit**
  - [x] 🟩 Run `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test`
  - [x] 🟩 Fix formatting issues
  - [x] 🟩 Commit with user approval
  - [x] 🟩 Update PLAN.md to 100%

---

## Deferred Items

None

---

## Files Modified

| File                                                                        | Changes                                |
| --------------------------------------------------------------------------- | -------------------------------------- |
| `packages/shared/src/storage/log-writer.ts`                                 | Change `_` to `.` delimiter            |
| `packages/shared/src/storage/log-reader.ts`                                 | Add new format, keep backward compat   |
| `packages/shared/src/storage/__tests__/log-writer.test.ts`                  | Update filename expectations           |
| `packages/shared/src/storage/__tests__/log-reader.test.ts`                  | Add backward compat tests              |
| `packages/shared/src/storage/__tests__/note-storage-manager.test.ts`        | Update filename expectations           |
| `packages/shared/src/storage/__tests__/folder-storage-manager.test.ts`      | Update filename expectations           |
| `packages/desktop/src/renderer/profile-picker/wizard/StepModeSelection.tsx` | Update local description               |
| `packages/desktop/src/renderer/profile-picker/wizard/StepStorageConfig.tsx` | Remove path display for local/paranoid |
| `packages/desktop/src/renderer/profile-picker/wizard/StepConfirmation.tsx`  | Remove path from confirmation          |
| `packages/desktop/src/renderer/profile-picker/wizard/__tests__/*.test.tsx`  | Update test expectations               |

# Checkbox Settings Feature Implementation Plan

**Overall Progress:** `100%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)

**Questions & Answers:** [QUESTIONS-1.md](./QUESTIONS-1.md)

**Plan Critique:** [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md)

## Summary

Add three toggle settings to the Appearance tab:

1. **Strikethrough completed items** (default: enabled)
2. **Auto-reorder completed items to bottom** (default: enabled)
3. **Enable nope state** (default: enabled) - when disabled, checkboxes are 2-state only; existing nope items remain visible but cycle back to unchecked

---

## Tasks

### Step 1: Add AppStateKey entries for new settings

- [x] 🟩 Add `CheckboxStrikethrough`, `CheckboxAutoReorder`, `CheckboxNopeEnabled` to `AppStateKey` enum in `packages/shared/src/database/schema.ts`
- [x] 🟩 Update PLAN.md

### Step 2: Create settings infrastructure

- [x] 🟩 **2a**: Write tests for `checkboxSettingsStore.ts` (integrated into context tests)
- [x] 🟩 **2a**: Create `checkboxSettingsStore.ts` - module-level store with getters/setters for TriStateTaskItem to read (integrated into CheckboxSettingsContext.tsx)
- [x] 🟩 **2b**: Write tests for `CheckboxSettingsContext.tsx`
- [x] 🟩 **2b**: Create `CheckboxSettingsContext.tsx` - loads settings via IPC, updates store, listens for broadcasts
- [x] 🟩 **2c**: Add IPC broadcast handler for checkbox settings in main process (sync-handlers.ts)
- [x] 🟩 Update PLAN.md

### Step 3: Add UI toggles to AppearanceSettings

- [x] 🟩 Write tests for the new toggles in AppearanceSettings
- [x] 🟩 Add three `Switch` components to `AppearanceSettings.tsx`
- [x] 🟩 Connect toggles to CheckboxSettingsContext
- [x] 🟩 Fix SettingsDialog tests to include CheckboxSettingsProvider
- [x] 🟩 Update PLAN.md

### Step 4: Modify tipTapEditorStyles for conditional strikethrough

- [x] 🟩 Write tests for conditional strikethrough styling
- [x] 🟩 Modify `getTipTapEditorStyles()` to accept strikethrough setting parameter
- [x] 🟩 Update TipTapEditor to consume setting from context and pass to styles
- [x] 🟩 Update PLAN.md

### Step 5: Modify TriStateTaskItem for conditional behaviors

- [x] 🟩 Write tests for conditional auto-reorder behavior
- [x] 🟩 Write tests for disabled nope state (2-state cycling)
- [x] 🟩 Write tests for input rules respecting nope setting
- [x] 🟩 Modify `getNextState()` to read from store and skip nope when disabled
- [x] 🟩 Modify click handler to read from store and skip reordering when disabled
- [x] 🟩 Modify input rules to check store (disable `[n]`/`[N]` input when nope disabled)
- [x] 🟩 Update PLAN.md

### Step 6: Integration and wrap-up

- [x] 🟩 Wrap TipTapEditor with CheckboxSettingsContext provider (or add to App.tsx)
- [x] 🟩 Test multi-window synchronization manually
- [x] 🟩 Update PLAN.md

### Step 7: Final testing and commit

- [x] 🟩 Run full CI suite (`pnpm format:check && pnpm lint && pnpm typecheck && pnpm test`)
- [x] 🟩 Perform manual testing of all three settings
- [x] 🟩 Code review
- [x] 🟩 Update PLAN.md with final status

---

## Deferred Items

None

---

## Technical Notes

### Settings Values

- Stored as strings: `'true'` / `'false'`
- Defaults: All three settings default to `'true'` (enabled)

### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Process                              │
│  ┌────────────────┐    ┌─────────────────────────────────────┐  │
│  │ sync-handlers  │───▶│ checkboxSettings:changed broadcast  │  │
│  │ appState:set   │    └─────────────────────────────────────┘  │
│  └────────────────┘                                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                       Renderer Process                           │
│  ┌─────────────────────┐      ┌────────────────────────────┐    │
│  │ CheckboxSettings    │─────▶│ checkboxSettingsStore      │    │
│  │ Context             │      │ (module-level, sync reads) │    │
│  └─────────────────────┘      └────────────────────────────┘    │
│           │                              │                       │
│           ▼                              ▼                       │
│  ┌─────────────────────┐      ┌────────────────────────────┐    │
│  │ AppearanceSettings  │      │ TriStateTaskItem extension │    │
│  │ (UI toggles)        │      │ (reads store on click)     │    │
│  └─────────────────────┘      └────────────────────────────┘    │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────────┐                                        │
│  │ TipTapEditor        │                                        │
│  │ (passes strikethrough│                                        │
│  │  setting to styles)  │                                        │
│  └─────────────────────┘                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Nope State Behavior (when disabled)

- Clicking cycles: unchecked → checked → unchecked (skips nope)
- Existing nope items remain visible with red X and strikethrough
- Clicking existing nope items: nope → unchecked → checked → unchecked
- Input rule `[n] ` / `[N] ` does not trigger (text passes through)

### Strikethrough Behavior (when disabled)

- Checked items show green checkbox but no strikethrough, normal opacity
- Nope items show red X checkbox but no strikethrough, normal opacity

### Auto-reorder Behavior (when disabled)

- Completed items stay in place when checked/unchecked
- No automatic sorting of task lists

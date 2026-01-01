# Plan Critique & Adjustments

## Issues Identified

### 1. Extension Settings Access (Critical)

**Problem**: `TriStateTaskItem` is a TipTap extension configured at editor creation time. It doesn't have access to React context. The click handler and `getNextState()` function need to read current settings.

**Solution**: Create a module-level settings store (`checkboxSettingsStore.ts`) that:

- Exports getter functions for each setting
- Exports a setter function called by CheckboxSettingsContext when settings change
- Is imported by TriStateTaskItem to read current values

This avoids re-creating the editor when settings change.

### 2. Styles are Parameter-Based (Minor)

**Problem**: `getTipTapEditorStyles(theme)` only takes theme. Need to add strikethrough setting.

**Solution**: Add parameter: `getTipTapEditorStyles(theme, options?: { strikethroughEnabled: boolean })`. TipTapEditor consumes setting from context and passes it.

### 3. Input Rules for [n]/[N] (Missing from Plan)

**Problem**: When nope state is disabled, typing `[n] ` still creates a nope task item.

**Solution**: Input rules need to check the settings store. When nope is disabled, the `[n]` rule should either:

- Create an unchecked task item instead, OR
- Not trigger at all (let the text pass through)

**Recommendation**: Not trigger at all - user typed `[n]` expecting nope, if they can't have nope, they should see their literal text.

### 4. Broadcast Pattern (Clarification)

**Observation**: The existing `appState:set` handler doesn't broadcast for arbitrary keys. Only Username/UserHandle have special broadcast logic.

**Solution**: For checkbox settings, we can:

- A) Add specific broadcast channels (like theme has `theme:changed`)
- B) Use a generic `checkboxSettings:changed` broadcast

**Recommendation**: Option B - single broadcast channel when any checkbox setting changes. Context listens for it and reloads all three settings.

---

## Updated Plan Adjustments

### Step 2 Split:

- **2a**: Create `checkboxSettingsStore.ts` (module-level store)
- **2b**: Create `CheckboxSettingsContext.tsx` that loads settings, updates the store, and listens for broadcasts

### Step 5 Addition:

- **5e**: Modify input rules to check settings store (disable `[n]`/`[N]` when nope disabled)

### Missing from Original Plan:

- Need to add IPC handler for broadcasting checkbox settings changes (in main process)

---

## Ordering Validation

Current ordering is correct:

1. AppStateKey first (foundation)
2. Settings store second (needed by extension)
3. Context third (uses store)
4. UI fourth (uses context)
5. Editor modifications last (uses store/context)

**Feedback Loop**: After Step 3 (UI), user can toggle settings and see them persist, even though editor behavior doesn't change yet. This provides early validation.

---

## Risk Assessment

| Risk                          | Likelihood | Impact | Mitigation                                                               |
| ----------------------------- | ---------- | ------ | ------------------------------------------------------------------------ |
| Settings store race condition | Low        | Medium | Store uses simple sync reads/writes; React context updates synchronously |
| Editor not reflecting changes | Medium     | Low    | Store is read on each click, not cached                                  |
| Multi-window desync           | Low        | Medium | Broadcast pattern proven with theme                                      |
| Input rule bypass             | Low        | Low    | Users rarely type `[n]` without expecting nope                           |

---

## No Questions for User

All technical decisions can be made based on existing patterns. Proceeding with adjusted plan.

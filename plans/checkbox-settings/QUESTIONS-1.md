# Questions for Checkbox Settings Feature

## Questions for User

### 1. Behavior when "nope state" is disabled

When the user disables the nope state:

- **Option A**: The checkbox becomes a 2-state toggle (unchecked ↔ checked only)
- **Option B**: Existing nope items in documents remain visible but user can't create new ones (clicking a checked item wraps back to unchecked)

Which behavior is expected?

B

### 2. What happens to existing "nope" items when the setting is disabled?

If a user disables the nope state:

- **Option A**: Existing nope items visually convert to "checked" (appear as done)
- **Option B**: Existing nope items remain displayed as nope (red X, strikethrough) but clicking them cycles back to unchecked → checked → unchecked
- **Option C**: Existing nope items get converted to "unchecked" state

B

### 3. Should strikethrough and completed-item-reordering settings apply to regular lists?

Currently these only affect task items (checkboxes). Should these settings:

- **A**: Only affect checkbox/task items (current behavior scope)
- **B**: Also potentially affect regular bullet/numbered lists with some future syntax for "completed"

(I assume **A** - just checking)

A

### 4. Website documentation

These are minor behavioral customization options. Should they be added to the feature list on the website? They might not warrant prominent inclusion.

## No

## Analysis Notes (No User Action Needed)

### Current Architecture Understanding

**Settings storage**: Uses `AppStateKey` enum in `schema.ts` with `appState:get` and `appState:set` IPC calls. Boolean settings should be stored as strings (`'true'`/`'false'`).

**Strikethrough styling**: Located in `tipTapEditorStyles.ts` lines 663-689. Currently hardcoded to apply `textDecoration: 'line-through'` and `opacity: 0.6` for checked/nope states.

**Reordering logic**: Located in `TriStateTaskItem.ts` lines 61-142 and 295-341. The `findReorderTargetPosition()` function controls the auto-sort behavior.

**Nope state cycling**: In `getNextState()` at line 40-44 of `TriStateTaskItem.ts`: `unchecked → checked → nope → unchecked`.

### Implementation Approach

1. Add 3 new `AppStateKey` entries:
   - `CheckboxStrikethrough` (default: 'true')
   - `CheckboxAutoReorder` (default: 'true')
   - `CheckboxNopeEnabled` (default: 'true')

2. Modify `AppearanceSettings.tsx` to add 3 toggle switches

3. Create a context or store mechanism to provide these settings to the editor (currently the editor doesn't have direct access to app state)

4. Modify `tipTapEditorStyles.ts` to conditionally apply strikethrough based on setting

5. Modify `TriStateTaskItem.ts`:
   - Make `findReorderTargetPosition()` respect the auto-reorder setting
   - Make `getNextState()` skip the nope state when disabled

### Edge Cases Identified

- **Multiple windows**: Settings changes should broadcast to all windows (existing pattern via `broadcastToAll`)
- **Real-time update**: When user changes a setting, it should immediately affect the editor display without requiring note reload
- **Persisted content**: Nope state is stored in the document (`data-checked="nope"`). Disabling the nope setting shouldn't corrupt documents.

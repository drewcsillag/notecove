# ESLint React Hook Dependency Warnings Assessment

**Date:** 2025-10-31
**Status:** 4 warnings, all non-blocking

## Summary

The codebase has 4 ESLint warnings related to React hook dependencies (`react-hooks/exhaustive-deps`). All warnings are in UI components and are intentional design decisions to avoid unnecessary re-renders or infinite loops.

**Risk Level:** Low - All warnings are safe and intentional

## Warnings Breakdown

### 1. TipTapEditor.tsx:62:6

**Warning:**

```
React Hook useEffect has missing dependencies: 'editor' and 'onTitleChange'.
Either include them or remove the dependency array. If 'onTitleChange' changes
too often, find the parent component that defines it and wrap that definition
in useCallback
```

**Location:** `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx:62`

**Analysis:**

- **Purpose:** This useEffect handles note switching and title extraction
- **Why dependencies are omitted:**
  - `editor`: Including it would cause infinite loop since editor changes on every keystroke
  - `onTitleChange`: Parent callback that shouldn't trigger re-initialization
- **Current approach:** Uses `noteIdRef.current` to track previous note and only runs logic when `noteId` changes
- **Risk:** Low - This is a standard pattern for handling note switching

**Recommendation:**

- **Option 1 (Preferred):** Add ESLint disable comment with explanation
- **Option 2:** Wrap `onTitleChange` in `useCallback` in parent component (EditorPanel.tsx)
- **Option 3:** Leave as-is (current status is safe)

---

### 2. FolderPanel.tsx:45:6

**Warning:**

```
React Hook useEffect has a missing dependency: 'loadState'. Either include it
or remove the dependency array
```

**Location:** `packages/desktop/src/renderer/src/components/FolderPanel/FolderPanel.tsx:45`

**Analysis:**

- **Purpose:** Load persisted state on component mount
- **Why dependency is omitted:**
  - `loadState` is a function defined in component scope
  - Including it would cause re-run on every render (not just mount)
  - This is intentionally a mount-only effect
- **Current approach:** Empty dependency array `[]` to run only once on mount
- **Risk:** Low - Standard mount-only pattern

**Recommendation:**

- **Option 1 (Preferred):** Move `loadState` outside component or add ESLint disable comment
- **Option 2:** Wrap `loadState` in `useCallback` with proper dependencies
- **Option 3:** Leave as-is (current status is safe)

---

### 3. FolderPanel.tsx:76:6

**Warning:**

```
React Hook useEffect has a missing dependency: 'onActiveSdChange'. Either
include it or remove the dependency array. If 'onActiveSdChange' changes too
often, find the parent component that defines it and wrap that definition in
useCallback
```

**Location:** `packages/desktop/src/renderer/src/components/FolderPanel/FolderPanel.tsx:76`

**Analysis:**

- **Purpose:** Listen for SD updates and notify parent of active SD changes
- **Why dependency is omitted:**
  - `onActiveSdChange` is an optional callback from parent
  - Including it would cause event listener to be re-registered on every render
  - This is intentionally a mount-only event listener setup
- **Current approach:** Empty dependency array `[]` to set up listener once
- **Risk:** Low - Event listeners should be set up once and cleaned up on unmount

**Recommendation:**

- **Option 1 (Preferred):** Have parent wrap `onActiveSdChange` in `useCallback`
- **Option 2:** Add ESLint disable comment with explanation
- **Option 3:** Leave as-is (current status is safe)

---

### 4. FolderTree.tsx:338:6

**Warning:**

```
React Hook useEffect has missing dependencies: 'expandedFolderIds.length' and
'onExpandedChange'. Either include them or remove the dependency array. If
'onExpandedChange' changes too often, find the parent component that defines
it and wrap that definition in useCallback
```

**Location:** `packages/desktop/src/renderer/src/components/FolderPanel/FolderTree.tsx:338`

**Analysis:**

- **Purpose:** Load folders and SDs data
- **Why dependencies are omitted:**
  - `expandedFolderIds.length`: Array identity changes trigger reload, not length
  - `onExpandedChange`: Parent callback that shouldn't trigger data reload
- **Current approach:** Depends on `sdId`, `refreshTrigger`, `isMultiSDMode`, `activeSdId`
- **Risk:** Low - Loading data should only depend on ID/trigger changes, not callbacks

**Recommendation:**

- **Option 1 (Preferred):** Add ESLint disable comment explaining why callback is excluded
- **Option 2:** Have parent wrap `onExpandedChange` in `useCallback`
- **Option 3:** Leave as-is (current status is safe)

---

## Impact Assessment

### Does this affect functionality?

**No** - All code works correctly as designed.

### Does this affect performance?

**No** - The current approach actually prevents performance issues by avoiding unnecessary re-renders.

### Does this affect maintainability?

**Minor** - Future developers should understand why dependencies are omitted. Adding comments would help.

---

## Recommended Actions

### High Priority (Quick Wins)

1. Add ESLint disable comments with explanations for all 4 warnings
2. This documents the intentional decisions without changing behavior

### Medium Priority (Better Pattern)

1. Wrap parent callbacks in `useCallback`:
   - `EditorPanel.tsx`: Wrap `handleTitleChange` in `useCallback`
   - `FolderPanel.tsx`: Wrap `handleActiveSdChange` in `useCallback`
2. This follows React best practices and silences warnings

### Low Priority (Refactoring)

1. Move `loadState` function outside component or to custom hook
2. Extract event listener setup to custom hooks
3. This is more architectural and can wait

---

## Code Examples

### Option 1: Add ESLint Disable Comments

**TipTapEditor.tsx:**

```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [noteId]); // Only depend on noteId changes, not editor/onTitleChange
```

**FolderPanel.tsx (line 45):**

```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Run only on mount
```

**FolderPanel.tsx (line 76):**

```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Set up event listener once on mount
```

**FolderTree.tsx:**

```typescript
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [sdId, refreshTrigger, isMultiSDMode, activeSdId]); // Callbacks excluded intentionally
```

---

### Option 2: Wrap Callbacks in useCallback

**EditorPanel.tsx:**

```typescript
const handleTitleChange = useCallback((noteId: string, title: string, text: string) => {
  void window.electronAPI.note.updateTitle(noteId, title, text);
}, []); // No dependencies needed
```

**FolderPanel.tsx:**

```typescript
const handleActiveSdChange = useCallback((sdId: string) => {
  setActiveSdId(sdId);
  void window.electronAPI.appState.set('activeSdId', sdId);
}, []); // No dependencies needed
```

---

## Decision

**Recommended:** Option 1 (Add ESLint disable comments) + Option 2 (useCallback for parent callbacks)

**Rationale:**

1. Quick to implement (15 minutes)
2. Documents intentional decisions
3. Follows React best practices
4. Zero risk of breaking existing functionality
5. Satisfies ESLint rules properly

**Effort Estimate:** 15-30 minutes

**When to do it:** Next maintenance session or before adding more hooks to these components

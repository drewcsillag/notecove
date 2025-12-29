# Plan Critique - Round 1

## Review Summary

I've reviewed the plan from a staff engineer perspective. Here are my findings:

---

## 1. Ordering Analysis ✅

**Good:** The ordering is correct. Dependencies flow properly:

- Step 1 (Statusbar) is independent
- Step 2 (ExpandStrip) is independent, used by Steps 3 & 4
- Step 3 (Left pane collapse) depends on Steps 1 & 2
- Step 4 (Middle pane) depends on Step 2
- Steps 5 & 6 enhance previous steps

**Minor Issue:** Step 6.1 (Add AppStateKeys) should happen before Step 4.1 (which uses `ShowNotesListPanel`). However, this can be handled by adding the key inline in Step 4.1.

---

## 2. Feedback Loop ✅

**Good:** Each step produces something testable:

1. Statusbar → visible at bottom immediately
2. ExpandStrip → can test in isolation
3. Left collapse → testable with Cmd+Shift+1/2
4. Middle collapse → testable with Cmd+Shift+3

**Suggestion:** We could get even faster feedback by implementing a minimal version first (auto-collapse logic without expand strip), then adding the strip.

---

## 3. Technical Risk: react-resizable-panels API

I researched the library and it has a good [imperative API](https://react-resizable-panels.vercel.app/examples/imperative-panel-api):

```typescript
import { ImperativePanelHandle } from 'react-resizable-panels';

const panelRef = useRef<ImperativePanelHandle>(null);

// Methods available:
panelRef.current.collapse(); // collapse fully
panelRef.current.expand(); // expand to previous size
panelRef.current.resize(25); // resize to 25%
panelRef.current.isCollapsed(); // check if collapsed
panelRef.current.getSize(); // get current size
```

**This means:** We don't need to manually track `previousLeftPaneSize` - the library handles "expand to previous size" automatically.

**Risk Mitigation:** The expand strip interaction (drag to resize) may need careful handling to work with the library's drag handling.

---

## 4. Missing Items

### 4.1 Menu Checkbox State

Should "Toggle Folder Panel", "Toggle Tags Panel", and new "Toggle Notes List" show checkmarks when visible?

Currently the menu items don't show checked state. Should we add this?

### 4.2 Accessibility

- Should ExpandStrip be keyboard-focusable?
- Should it have aria-label like "Expand left panel"?

### 4.3 Platform-specific Tooltip Text

Tooltip says "Cmd+Shift+1" but on Windows it should say "Ctrl+Shift+1". Should we detect platform?

### 4.4 What Panel to Show on Expand?

When user clicks the left expand strip:

- Should it show folder panel only? (Current assumption)
- Should it show both folder and tags?
- Should it restore whatever was previously visible?

Current plan says "Click: restore previous size, set `showFolderPanel=true`" - but what if user had only tags visible before collapsing both?

---

## 5. Risk Assessment

| Risk                                              | Likelihood | Impact | Mitigation                                        |
| ------------------------------------------------- | ---------- | ------ | ------------------------------------------------- |
| react-resizable-panels API mismatch               | Low        | Medium | Library API is well-documented                    |
| State sync issues between visibility and collapse | Medium     | Medium | Derive `collapsed` from visibility states         |
| Expand strip + drag interaction                   | Medium     | Low    | Can fallback to click-only if drag is problematic |
| Tooltip timing/positioning                        | Low        | Low    | MUI Tooltip is well-tested                        |

---

## Questions for User

### Q16: Menu Checkmarks

Should the View menu items show checkmarks when panels are visible?

```
View
├── Toggle Folder Panel    ✓   Cmd+Shift+1
├── Toggle Tags Panel      ✓   Cmd+Shift+2
├── Toggle Notes List      ✓   Cmd+Shift+3
```

**Answer: Yes** - Add checkmarks to menu items.

### Q17: Expand Strip Restore Behavior

When clicking the left expand strip after both folder and tags were hidden:

- **A)** Show folder panel only (simple, predictable)
- **B)** Show both folder and tags (full restore)
- **C)** Show whatever was visible last (complex, remembers preference)

**Answer: C** - Remember and restore whatever was visible last.

### Q18: Accessibility

Should the expand strip:

- **A)** Be keyboard focusable with proper aria-labels
- **B)** Not be focusable (menu/hotkeys are sufficient)

**Answer: A** - Yes, keyboard focusable with aria-labels.

# Plan Critique - Questions

## Issue 1: Regular List Items (not just Task Items)

The requirement says: "tab only indents the item if at the beginning of the line following the list item thing (bullet, checkbox, number, whatever)"

This applies to **all list types**, not just task items:

- Bullet list items
- Numbered list items
- Task items

**Finding:** TipTap's default `ListItem` extension already has `Tab = sinkListItem` built-in ([TipTap docs](https://tiptap.dev/api/nodes/list-item)). But like TriStateTaskItem, it unconditionally sinks - it doesn't check cursor position.

**Question:** Should we also modify ListItem's Tab handling to only indent at start? Or does the current behavior work for regular lists?

I lean toward: **yes, modify for consistency**. If task items only indent at start, regular list items should behave the same.

---

## Issue 2: Shift-Tab in Task/List Items

The plan mentions modifying TriStateTaskItem's Tab handler, but **Shift-Tab** also needs the same treatment:

- At start of content → outdent the item (existing `liftListItem`)
- Elsewhere → remove tab character

**Question:** Confirm Shift-Tab should also check cursor position for consistency?

---

## Issue 3: Extension Order Risk

The plan assumes TabIndent runs "last" as a fallback. But extension order in TipTapEditor.tsx is:

1. StarterKit (includes ListItem with Tab handler)
2. ...
3. TriStateTaskItem (Tab handler)
4. NotecoveTable (Tab handler)

**Risk:** If TabIndent is added at the end, it only runs if ALL previous Tab handlers return `false`. Currently:

- Table.ts returns `false` when not in table ✓
- TriStateTaskItem always returns `true` when in task item ✗
- StarterKit's ListItem behavior is unclear

**Recommendation:** Make TabIndent context-aware (check for table/list contexts) rather than relying on extension order. This makes the code more robust.

---

## Issue 4: CSS Verification Needed Earlier

The plan puts CSS verification in Phase 3 after implementation. But if tabs don't render correctly, we'll waste time debugging.

**Recommendation:** Move CSS verification to Phase 1 or add a quick spike test first.

---

## Summary: Plan Adjustments Needed

1. **Add:** Modify ListItem Tab/Shift-Tab handling (same as TriStateTaskItem)
2. **Add:** Modify TriStateTaskItem Shift-Tab handling (not just Tab)
3. **Move:** CSS verification earlier (or quick spike first)
4. **Clarify:** TabIndent should check contexts itself, not rely on extension order

Do you want me to update PLAN.md with these adjustments?

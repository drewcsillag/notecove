# Plan Critique

**Reviewed by:** Claude (Staff Engineer perspective)
**Date:** 2025-12-26

---

## 1. Ordering Analysis ✅

**Verdict:** Ordering is correct.

The dependency chain is:

```
Phase 1 (packages) → Phase 2 (fork S&R) → Phase 5 (useEditorState for SearchPanel)
                  ↘ Phase 3 (Floating UI suggestions) → Phase 4 (Floating UI links)
Phase 6 (iOS) depends on Phase 1
Phase 7 (validation) depends on all
```

No circular dependencies or missing prerequisites found.

---

## 2. Feedback Loop ✅

**Verdict:** Good incremental testability.

| After Phase | What Can Be Tested                       |
| ----------- | ---------------------------------------- |
| 1           | Editor loads, basic typing, formatting   |
| 2           | Search/replace functionality             |
| 3           | Hashtag, @mention, [[link]] autocomplete |
| 4           | Link create/edit popovers                |
| 5           | Toolbar state, search result count       |
| 6           | iOS bundle builds                        |
| 7           | Full integration                         |

**Recommendation:** Add explicit "smoke test" checkpoints after each phase.

---

## 3. Debug Tools ⚠️

**Issue:** No debug tooling mentioned.

**Recommendation:** None needed - we have console.log statements in existing code and can add temporarily if needed. The test suite is the primary debugging tool.

---

## 4. Missing Items Found

### 4.1 `pnpm install` step

**Impact:** Critical - build will fail without it
**Fix:** Add to Phase 1.1 after updating package.json

### 4.2 Verify third-party compatibility

**Impact:** Medium - could cause subtle issues
**Packages to verify:**

- `y-prosemirror@1.3.7` - Yjs-ProseMirror binding
- `lowlight@3.3.0` - Syntax highlighting

**Fix:** Add verification step in Phase 1.6

### 4.3 useEditorState selector pattern

**Impact:** Medium - affects Phase 5 implementation
**Finding:** Confirmed API exists. Usage pattern:

```typescript
const { isBold } = useEditorState({
  editor,
  selector: (ctx) => ({
    isBold: ctx.editor.isActive('bold'),
  }),
});
```

**Fix:** Already in plan, just need this reference

### 4.4 List extension import path

**Issue:** Plan says `@tiptap/extension-list` but need to verify package name
**Finding:** Confirmed - v3 consolidates to `@tiptap/extension-list`
**Fix:** Already correct in plan

---

## 5. Risk Assessment Update

| Risk                                       | Severity | Likelihood | Mitigation                             |
| ------------------------------------------ | -------- | ---------- | -------------------------------------- |
| y-prosemirror incompatibility              | High     | Low        | Check changelogs, test CRDT sync early |
| Floating UI positioning differs from tippy | Medium   | Medium     | Create utility, test each popup        |
| useEditorState perf issues                 | Low      | Low        | Selector pattern minimizes re-renders  |
| iOS bundle size increase                   | Low      | Medium     | Monitor bundle size                    |
| lowlight API change                        | Medium   | Low        | Test code blocks in Phase 1            |

---

## 6. API Verification Summary

Verified from [TipTap v2 to v3 Upgrade Guide](https://tiptap.dev/docs/guides/upgrade-tiptap-v2):

| API                | v2                  | v3                        | Status       |
| ------------------ | ------------------- | ------------------------- | ------------ |
| Table imports      | Individual packages | `@tiptap/extension-table` | ✅ Confirmed |
| List imports       | Individual packages | `@tiptap/extension-list`  | ✅ Confirmed |
| StarterKit history | `history: false`    | `undoRedo: false`         | ✅ Confirmed |
| React rerender     | Auto-rerender       | `useEditorState` hook     | ✅ Confirmed |
| Floating elements  | tippy.js            | `@floating-ui/dom`        | ✅ Confirmed |
| BubbleMenu import  | `@tiptap/react`     | `@tiptap/react/menus`     | ✅ Not used  |

---

## 7. Recommended Plan Updates

### Add to Phase 1.1:

```diff
- [ ] 🟥 Update all @tiptap/* packages to 3.14.0
+ [ ] 🟥 Update all @tiptap/* packages to 3.14.0
+ [ ] 🟥 Run `pnpm install` to update lockfile
```

### Add to Phase 1.6:

```diff
- [ ] 🟥 Fix any API changes (getPos() undefined checks, etc.)
+ [ ] 🟥 Fix any API changes (getPos() undefined checks, etc.)
+ [ ] 🟥 Verify y-prosemirror and lowlight still work
+ [ ] 🟥 Test basic CRDT sync between two editors
```

### Add Phase 5.1 reference:

```typescript
// useEditorState usage pattern for EditorToolbar:
const { isBold, isItalic, isUnderline } = useEditorState({
  editor,
  selector: (ctx) => ({
    isBold: ctx.editor.isActive('bold'),
    isItalic: ctx.editor.isActive('italic'),
    isUnderline: ctx.editor.isActive('underline'),
  }),
});
```

---

## 8. Questions for User

None - all questions resolved in QUESTIONS-1.md.

---

## Conclusion

**Plan is sound.** Minor updates recommended:

1. Add `pnpm install` step
2. Add y-prosemirror/lowlight verification
3. Document useEditorState pattern for Phase 5

No blocking issues found. Ready to proceed with implementation.

---

## Sources

- [TipTap React Documentation](https://tiptap.dev/docs/editor/getting-started/install/react)
- [TipTap Performance Guide](https://tiptap.dev/docs/guides/performance)
- [TipTap v2 to v3 Upgrade Guide](https://tiptap.dev/docs/guides/upgrade-tiptap-v2)

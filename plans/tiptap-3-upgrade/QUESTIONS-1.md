# TipTap 3 Upgrade - Questions Round 1

## 1. Version Pinning Strategy

The FEATURE-PROMPT.md specifies "latest stable, currently 3.14.0". Should I:

**A)** Pin to exact version `3.14.0` for reproducibility?
**B)** Use caret `^3.14.0` to get patch updates automatically?

_Recommendation: A - Pin to exact version during upgrade, can relax to caret after validation_

## agree with recommendation

## 2. Floating UI Migration Scope

TipTap 3 removes tippy.js dependency. I found 4 files using tippy.js:

1. `extensions/Hashtag.ts` - Tag autocomplete popup
2. `extensions/AtMention.ts` - @mention autocomplete popup
3. `extensions/InterNoteLink.ts` - [[link]] autocomplete popup
4. `useEditorLinkPopovers.tsx` - Link edit/create popovers (3 separate popover types)

**Question:** Should I replace all tippy.js usage with Floating UI in one phase, or prioritize the suggestion popovers first (since TipTap's suggestion API may have Floating UI built-in now)?

_Note: The useEditorLinkPopovers.tsx uses tippy.js for 3 different popovers that are more complex (React component rendering via createRoot)_

What do you suggest? Give me pros and cons

---

## 3. StarterKit Extension Conflicts

The ASSESSMENT mentions TipTap 3's StarterKit now includes:

- Underline (we currently import separately)
- Link (we have custom WebLink extension)

**Questions:**

- Should we remove the separate `Underline` import and use StarterKit's built-in?
- Will our custom `WebLink` extension conflict with StarterKit's Link? Do we need to explicitly disable Link in StarterKit config?

## what do you suggest? Give me pros and cons

## 4. shouldRerenderOnTransaction Behavior

The ASSESSMENT notes `shouldRerenderOnTransaction` defaults to `false` in TipTap 3.

**Question:** I see we use:

- `editor.storage['searchAndReplace']` to read search results
- Toolbar state (bold/italic buttons) that need to reflect editor state

Should I:
**A)** Set `shouldRerenderOnTransaction: true` globally (simpler, may have perf impact)?
**B)** Use `useEditorState` hook for specific state tracking (more work, better perf)?

## what do you suggest? Give me pros and cons

## 5. iOS Bundle Scope

The iOS bundle (`packages/shared/scripts/build-editor-bundle.js`) currently imports:

- `@tiptap/core`
- `@tiptap/starter-kit`
- `@tiptap/extension-collaboration`
- `@tiptap/extension-underline`

It does NOT include tables, lists extensions, or search-and-replace.

**Question:** Is the iOS bundle feature-parity with desktop required? Or is the current simpler editor for iOS acceptable?

## yes to feature parity

## 6. Test Coverage During Migration

The codebase has tests in:

- `packages/desktop/src/renderer/src/components/EditorPanel/extensions/__tests__/`
- Including `DecorationFlickering.test.ts` that tests SearchAndReplace

**Question:** Should I update tests as part of each phase, or have a dedicated test-fixing phase at the end?

_Recommendation: Update tests within each phase (TDD approach)_

## do it as part of each phase

## 7. Fork Location for SearchAndReplace

The FEATURE-PROMPT suggests forking to `extensions/SearchAndReplace.ts`.

**Question:** Should the forked extension:
**A)** Live alongside other custom extensions in `packages/desktop/src/renderer/src/components/EditorPanel/extensions/`?
**B)** Go into a shared location since it might be useful for iOS bundle in the future?

_Recommendation: A - Keep in desktop package for now, can extract to shared later if needed_

## A

## 8. Menu Import Path Change

The ASSESSMENT mentions:

```typescript
// v2
import { BubbleMenu, FloatingMenu } from '@tiptap/react';

// v3
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
```

**Question:** I don't see BubbleMenu or FloatingMenu usage in the current codebase. Can you confirm these aren't used?

## If you can't find them, I probably can't either.

## Summary

Please respond to each question, or let me know if you want me to proceed with my recommendations marked above.

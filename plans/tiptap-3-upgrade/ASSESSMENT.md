# TipTap 3 Upgrade Assessment

**Date:** 2025-12-26
**Current Version:** v2.26.4 - v2.27.1
**Target Version:** v3.14.0 (latest stable)

## Executive Summary

**Verdict: FEASIBLE with MODERATE complexity - NO BLOCKERS**

The upgrade to TipTap 3 is feasible. Main work items:

1. Package consolidations (table, list extensions) - straightforward import changes
2. Fork search-and-replace extension (~300 lines, uses standard APIs)
3. tippy.js → Floating UI migration for 4 suggestion popovers - biggest effort
4. Minor API changes (shouldRerenderOnTransaction, etc.)

All third-party dependencies are compatible or easily internalized.

---

## Current TipTap Usage

### Packages in Use (desktop)

| Package                                 | Current Version | Notes                  |
| --------------------------------------- | --------------- | ---------------------- |
| `@tiptap/core`                          | ^2.26.4         | Core editor            |
| `@tiptap/react`                         | ^2.26.4         | React integration      |
| `@tiptap/pm`                            | ^2.26.4         | ProseMirror APIs       |
| `@tiptap/starter-kit`                   | ^2.26.4         | Base extensions bundle |
| `@tiptap/suggestion`                    | ^2.27.1         | Autocomplete system    |
| `@tiptap/extension-bullet-list`         | ^2.26.4         | → Consolidated in v3   |
| `@tiptap/extension-ordered-list`        | ^2.26.4         | → Consolidated in v3   |
| `@tiptap/extension-list-item`           | ^2.26.4         | → Consolidated in v3   |
| `@tiptap/extension-code-block-lowlight` | ^2.27.1         | Syntax highlighting    |
| `@tiptap/extension-collaboration`       | ^2.26.4         | Yjs CRDT sync          |
| `@tiptap/extension-underline`           | ^2.26.4         | Now in StarterKit v3   |
| `@tiptap/extension-link`                | 2.26.4          | Now in StarterKit v3   |
| `@tiptap/extension-table`               | ^2.26.4         | → Consolidated in v3   |
| `@tiptap/extension-table-row`           | ^2.26.4         | → Consolidated in v3   |
| `@tiptap/extension-table-header`        | ^2.26.4         | → Consolidated in v3   |
| `@tiptap/extension-table-cell`          | ^2.26.4         | → Consolidated in v3   |
| `@tiptap/extension-task-item`           | ^2.27.1         | → Consolidated in v3   |
| `@tiptap/extension-task-list`           | ^2.27.1         | → Consolidated in v3   |

### Third-Party Dependencies

| Package                                       | Current Version | TipTap 3 Status                                |
| --------------------------------------------- | --------------- | ---------------------------------------------- |
| `@sereneinserenade/tiptap-search-and-replace` | 0.1.1           | Fork into codebase (~300 lines, standard APIs) |
| `y-prosemirror`                               | 1.3.7           | Compatible (ProseMirror-level)                 |
| `yjs`                                         | 13.6.10         | Compatible                                     |
| `tippy.js`                                    | 6.3.7           | **MUST REMOVE** - Replaced by Floating UI      |
| `lowlight`                                    | 3.3.0           | Compatible (using v3 API)                      |

### Custom Extensions (14 total)

All located in `packages/desktop/src/renderer/src/components/EditorPanel/extensions/`:

- Hashtag, AtMention, InterNoteLink (use suggestion API + tippy.js)
- WebLink, CommentMark, DateChip
- NotecoveImage, NotecoveTable (wraps official table)
- TriStateTaskItem (extends TaskItem)
- TabIndent, NotecoveListItem, MoveBlock
- NotecoveCodeBlock (wraps CodeBlockLowlight)
- MentionNode

---

## Breaking Changes Impact

### 1. Package Consolidations (HIGH IMPACT)

TipTap 3 consolidates many packages into single imports:

**Tables:**

```typescript
// v2 (current)
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';

// v3 (new)
import { Table, TableRow, TableCell, TableHeader } from '@tiptap/extension-table';
```

**Lists:**

```typescript
// v2 (current)
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import ListItem from '@tiptap/extension-list-item';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';

// v3 (new)
import {
  BulletList,
  OrderedList,
  ListItem,
  TaskList,
  TaskItem,
  ListKeymap,
} from '@tiptap/extension-list';
```

**Files affected:**

- `TipTapEditor.tsx` - Main import location
- `extensions/Table.ts` - Wraps table extensions
- `extensions/NotecoveListItem.ts` - Extends ListItem
- `extensions/TriStateTaskItem.ts` - Extends TaskItem

### 2. tippy.js → Floating UI Migration (HIGH IMPACT)

TipTap 3 replaces tippy.js with Floating UI for all floating elements. This affects:

**Files using tippy.js directly:**

- `TipTapEditor.tsx` - Link popovers
- `extensions/Hashtag.ts` - Tag suggestion popup
- `extensions/InterNoteLink.ts` - Note link suggestion popup
- `extensions/AtMention.ts` - @-mention suggestion popup

**Migration required:**

```typescript
// v2 (current)
import tippy from 'tippy.js';
popup = tippy('body', {
  getReferenceClientRect: props.clientRect,
  appendTo: () => document.body,
  content: component.element,
  ...
});

// v3 (new)
import { computePosition, flip, shift, offset } from '@floating-ui/dom';
// Manual positioning with Floating UI API
```

**New dependency:** `@floating-ui/dom@^1.6.0`

### 3. Search and Replace Extension (MEDIUM IMPACT - MANAGEABLE)

`@sereneinserenade/tiptap-search-and-replace` is v2-only with no active maintenance.

**Fork Analysis - RECOMMENDED:**

The extension is only **~300 lines of actual code** (432 with license/comments). After reviewing the source:

**Imports used:**

```typescript
import { Extension, Range, type Dispatch } from '@tiptap/core';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import { Plugin, PluginKey, type EditorState, type Transaction } from '@tiptap/pm/state';
import { Node as PMNode } from '@tiptap/pm/model';
```

**V3 Compatibility Assessment:**

- `Extension.create<Options, Storage>()` - Standard, unchanged in v3
- `addOptions()`, `addStorage()`, `addCommands()`, `addProseMirrorPlugins()` - Standard hooks, unchanged
- ProseMirror Plugin with decorations - Standard ProseMirror API, unchanged
- `DecorationSet.create()`, `Decoration.inline()` - Standard ProseMirror, unchanged
- **One potential issue:** `Range` type import from `@tiptap/core` - may need to verify if still exported

**Verdict:** This extension uses standard ProseMirror patterns and should work with TipTap 3 with minimal changes. The `Range` type is just `{ from: number; to: number }` - if removed from exports, we can define it locally.

**Recommended approach:**

1. Copy the 300 lines into `extensions/SearchAndReplace.ts`
2. Test with TipTap 3
3. Fix any type issues (likely just `Range` → inline type)

**Current usage in SearchPanel.tsx:**

```typescript
editor.commands.setSearchTerm(searchTerm);
editor.commands.setCaseSensitive(caseSensitive);
const storage = editor.storage['searchAndReplace'];
```

### 4. React Rendering Behavior (MEDIUM IMPACT)

`shouldRerenderOnTransaction` is now `false` by default. This may affect:

- Toolbar state updates (bold/italic buttons)
- Search result highlighting
- Comment highlighting

**Fix:** Either set `shouldRerenderOnTransaction: true` or use `useEditorState` hook for manual tracking.

### 5. StarterKit Changes (LOW IMPACT)

- `history: false` → `undoRedo: false`
- Underline and Link now included by default (may cause conflicts)

### 6. Menu Import Path (LOW IMPACT)

```typescript
// v2
import { BubbleMenu, FloatingMenu } from '@tiptap/react';

// v3
import { BubbleMenu, FloatingMenu } from '@tiptap/react/menus';
```

---

## Migration Work Estimate

### Phase 1: Package Updates & Import Changes

- Update package.json dependencies
- Update consolidated package imports (table, list)
- Update StarterKit configuration
- Update menu imports if used

### Phase 2: Search and Replace Resolution

- Evaluate options (fork, native, alternative)
- Implement chosen solution
- Update SearchPanel.tsx

### Phase 3: tippy.js → Floating UI Migration

- Install @floating-ui/dom
- Migrate Hashtag suggestion popup
- Migrate AtMention suggestion popup
- Migrate InterNoteLink suggestion popup
- Migrate TipTapEditor link popovers
- Remove tippy.js dependency

### Phase 4: API Updates

- Add `shouldRerenderOnTransaction: true` or implement `useEditorState`
- Update any `getPos()` calls with undefined checks
- Test collaboration features

### Phase 5: Testing & Validation

- Run full test suite
- Manual testing of all editor features
- Cross-platform validation (desktop + iOS bundle)

### Phase 6: iOS Bundle Update

- Update shared package TipTap dependencies
- Rebuild editor bundle for iOS
- Test iOS editor functionality

---

## Risk Assessment

| Risk                                    | Severity | Mitigation                                                       |
| --------------------------------------- | -------- | ---------------------------------------------------------------- |
| Search extension incompatibility        | **Low**  | Extension is ~300 lines, uses standard APIs - fork into codebase |
| Floating UI migration complexity        | Medium   | Follow official migration guide, test each popup individually    |
| Hidden API changes in custom extensions | Medium   | Comprehensive testing with existing test suite                   |
| iOS bundle compatibility                | Low      | Isolated change, easy to validate                                |
| Yjs collaboration breakage              | Low      | `@tiptap/extension-collaboration` officially supports v3         |

---

## Recommendation

**Proceed with upgrade** - No blockers identified.

1. **Fork search-and-replace first** - Copy the ~300 lines into codebase as `extensions/SearchAndReplace.ts`. This removes the external dependency and gives us full control.

2. **Phase the migration:**
   - Phase 1: Package updates & import consolidations
   - Phase 2: Fork search-and-replace into codebase
   - Phase 3: tippy.js → Floating UI migration (biggest effort)
   - Phase 4: API updates (shouldRerenderOnTransaction, etc.)
   - Phase 5: iOS bundle update

3. **Existing test coverage** is good - run after each phase.

4. **Keep v2 on main branch** until migration is complete and validated.

---

## Sources

- [Official TipTap v2 to v3 Upgrade Guide](https://tiptap.dev/docs/guides/upgrade-tiptap-v2)
- [TipTap 3.0 Stable Release Notes](https://tiptap.dev/blog/release-notes/tiptap-3-0-is-stable)
- [TipTap GitHub Releases](https://github.com/ueberdosis/tiptap/releases)
- [tiptap-search-and-replace GitHub](https://github.com/sereneinserenade/tiptap-search-and-replace)
- [Floating UI Migration Discussion](https://github.com/ueberdosis/tiptap/discussions/4193)
- [Mantine TipTap 3 Migration Guide](https://mantine.dev/guides/tiptap-3-migration/)

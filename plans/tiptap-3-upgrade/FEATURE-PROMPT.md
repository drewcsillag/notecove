# TipTap 3 Upgrade Feature Prompt

Use this with `/feature` to start the upgrade work:

---

## Prompt

```
Upgrade TipTap from v2 (2.26.4) to v3 (latest stable, currently 3.14.0).

Key migration items:
1. Update all @tiptap/* packages to v3
2. Handle package consolidations:
   - Table extensions: import from @tiptap/extension-table
   - List extensions: import from @tiptap/extension-list
3. Replace tippy.js with @floating-ui/dom in suggestion popovers (Hashtag, AtMention, InterNoteLink) and link popovers
4. Fork @sereneinserenade/tiptap-search-and-replace into extensions/SearchAndReplace.ts (~300 lines, uses standard APIs)
5. Update StarterKit config: history: false → undoRedo: false
6. Handle React rendering: add shouldRerenderOnTransaction: true if needed
7. Update iOS bundle in packages/shared
8. Preserve MIT license header when forking search-and-replace (required for license compliance)

See plans/tiptap-3-upgrade/ASSESSMENT.md for full analysis.

TDD approach: ensure all existing tests pass after each phase before proceeding.
```

---

## Alternative: Phased Prompts

If you prefer smaller increments, use these sequentially:

### Phase 1: Package Updates

```
TipTap 3 upgrade - Phase 1: Update packages and consolidate imports.
- Update all @tiptap/* packages to v3
- Consolidate table imports to @tiptap/extension-table
- Consolidate list imports to @tiptap/extension-list
- Update StarterKit config (undoRedo instead of history)
- Fix any TypeScript errors from API changes
Do not touch tippy.js or search-and-replace yet.
See plans/tiptap-3-upgrade/ASSESSMENT.md
```

### Phase 2: Search and Replace

```
TipTap 3 upgrade - Phase 2: Fork search-and-replace extension.
Fork @sereneinserenade/tiptap-search-and-replace into extensions/SearchAndReplace.ts
- Source is ~300 lines, uses standard ProseMirror APIs
- Keep MIT license header at top of file (required for license compliance)
- The Range type import may need to be replaced with inline { from: number; to: number }
- Update import in TipTapEditor.tsx to use local extension
- Remove @sereneinserenade/tiptap-search-and-replace from package.json
SearchPanel.tsx uses: setSearchTerm, setCaseSensitive, storage.results, storage.resultIndex
See plans/tiptap-3-upgrade/ASSESSMENT.md
```

### Phase 3: Floating UI Migration

```
TipTap 3 upgrade - Phase 3: Migrate from tippy.js to Floating UI.
Files to update:
- extensions/Hashtag.ts - suggestion popup
- extensions/AtMention.ts - suggestion popup
- extensions/InterNoteLink.ts - suggestion popup
- TipTapEditor.tsx - link popovers
Install @floating-ui/dom, remove tippy.js after migration complete.
See plans/tiptap-3-upgrade/ASSESSMENT.md
```

### Phase 4: iOS Bundle

```
TipTap 3 upgrade - Phase 4: Update iOS editor bundle.
- Update packages/shared TipTap dependencies
- Run build-editor-bundle.js
- Test iOS integration
See plans/tiptap-3-upgrade/ASSESSMENT.md
```

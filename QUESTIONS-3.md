# Questions and Ambiguities - Round 3

Final clarifications based on QUESTIONS-2.md answers

---

## 1. Local Database/Cache Tradeoffs

**Q1.1:** You asked for tradeoffs and recommendation for local database/cache. Here's my analysis:

**SQLite (via better-sqlite3)**

- Pros:
  - Full SQL query capabilities for complex searches
  - Excellent performance for structured data
  - ACID compliance, good for data integrity
  - Synchronous API available (simpler code in main process)
  - Can handle large datasets efficiently
- Cons:
  - Slightly heavier dependency
  - Need to design schema carefully
  - Migration complexity if schema changes

**IndexedDB**

- Pros:
  - Native browser API (useful if we need web version later)
  - Good for key-value and indexed queries
  - Async by nature
- Cons:
  - Only available in renderer process (requires IPC for main process)
  - More complex API
  - Less powerful query capabilities than SQL

**JSON-based store (like electron-store)**

- Pros:
  - Extremely simple to use
  - No schema required
  - Easy to debug (human-readable)
- Cons:
  - Poor performance with large datasets
  - No indexing capabilities
  - Must load entire file for queries
  - Not suitable for full-text search

**My recommendation: SQLite (better-sqlite3)**

- Best fit for: note indexing, full-text search, tag indexing, metadata
- Can use FTS5 extension for full-text search
- Synchronous API works well in Electron main process
- Can handle growth as note count increases

Do you agree with SQLite, or prefer a different approach?

> SQLite agrees with what I was thinking, go with it

---

## 2. Settings Panel - Disabled SD

**Q2.1:** You asked what a "disabled SD" would mean. I was thinking:

- User has configured an SD but temporarily doesn't want to load it (e.g., large SD on slow network)
- It would remain in settings but not appear in folder tree or be watched
- Could be re-enabled without reconfiguring path/name

However, if this doesn't align with your vision, we can skip the disable/enable feature and just do add/remove. Your preference?

> that sounds good, do it.

---

## 3. Note Creation in "All Notes"

**Q3.1:** You said when creating a note with "All Notes" selected, it will have no folder association but would show in "All Notes".

Does this mean:

- Notes can exist without being in any folder (orphan notes)?
- "All Notes" shows both: notes in folders AND notes without folder association?
- Is there any other way to view these orphan notes besides "All Notes"?

> notes can exist without being in any folder, and so yes "All Notes" shows notes with or without a folder association. There is no other way to see them except via "All Notes"

---

## 4. Note Insertion Position

**Q4.1:** Regarding "Should it be inserted adjacent to that note in the list?" - I meant:

When you create a new note via right-click on an existing note, the new note will be created in the same folder. But since notes are sorted by "most recently edited," the new note would appear at the top of the list.

I was asking if you want special behavior to insert it near the right-clicked note instead of at the top. But based on your confusion, I assume the answer is: no special behavior, just use the standard "most recently edited" sort order. Correct?

> correct, no special behavior, so it should show at the top of the notes list as it would be the newest thing.

---

## 5. Documentation Website Priority

**Q5.1:** You asked what I meant by priority/scope. I was asking:

Since the website should be built incrementally, what should be prioritized first?

- A) Landing page + basic docs
- B) Landing page only initially, docs added as features complete
- C) Docs first (no fancy landing page until later)
- D) Build them all in parallel

Which approach?

> B -- I'd like the docs to match whatever we currently have implemented, if I understood correctly

---

## 6. Markdown Export

**Q6.1:** You added "export as markdown" for notes, folders, or whole SD. Should this:

- Be in the right-click menu (for notes/folders)?
- Also be in the main menu?
- Also be in settings (for whole SD export)?
- All of the above?

> all of the above

**Q6.2:** When exporting a folder or SD:

- Should it create a single markdown file with all notes?
- Or a zip file with multiple markdown files (one per note)?
- Should it preserve folder structure in the export?
- Should inter-note links be converted to relative file links or preserved as `[[title]]`?

> I'd like it to create a new folder on disk (using the file chooser) with a structure that aligns with the folder structure
> And links should be converted to relative file links.
> in the case of duplicate titles in a folder, filenames (before the .md extension) should be suffixed with a `-` and the lowest number, greater than 0 available for that tile.

---

## 7. iOS Minimum Version

**Q7.1:** You said "minimum iOS -> 26" but iOS hasn't reached version 26 yet (current is iOS 18 in 2024). Did you mean:

- iOS 16?
- iOS 17?
- iOS 18?
- Or something else?

> IDK, I just checked my iphone under general > about, and it says I'm running iOS 26.0.1, so "latest" may have changed since you were trained. Consider examining appropriate pages on Apple's website about this.

---

## 8. Monorepo Build Tool

**Q8.1:** You asked for evaluation of monorepo tools with tradeoffs:

**npm/pnpm/yarn workspaces (simple)**

- Pros:
  - Simple, built-in, no extra tools
  - Good package management
  - Easy to understand
- Cons:
  - No task orchestration/caching
  - Manual script coordination
  - No dependency graph awareness

**Turborepo**

- Pros:
  - Excellent caching (local + remote)
  - Task pipeline orchestration
  - Simple configuration
  - Growing ecosystem
  - Good for monorepos with many packages
- Cons:
  - Another tool to learn
  - Primarily focused on JS/TS (iOS would be separate)

**Nx**

- Pros:
  - Powerful task orchestration
  - Great caching
  - Plugin ecosystem
  - Code generation
  - Dependency graph visualization
- Cons:
  - More complex than Turborepo
  - Steeper learning curve
  - More opinionated

**Bazel**

- Pros:
  - Multi-language support (great for TypeScript + Swift + website)
  - Extremely powerful and scalable
  - Hermetic builds
  - Best for very large projects
- Cons:
  - Very steep learning curve
  - Complex configuration
  - Overkill for most projects
  - Slower initial setup
  - Smaller community for JS/iOS

**My recommendation: Turborepo + pnpm workspaces**

- Turborepo handles task orchestration and caching for the TypeScript/web parts
- Simple enough to get started quickly
- pnpm for package management (faster, better disk usage than npm)
- Handle iOS build separately (Xcode/xcrun)
- Can integrate them via npm scripts

**Alternative: Nx** if you want more power and don't mind complexity

**Skip: Bazel** - too complex for this project size, although it would handle Swift + TS nicely in theory

Your preference?

> Turborepo and pnpm sounds good.

---

## 9. Vite vs Webpack

**Q9.1:** You asked for recommendation on Vite vs Webpack:

**Vite**

- Pros:
  - Much faster dev server (instant startup)
  - Better DX (developer experience)
  - Simpler configuration
  - Modern, growing ecosystem
  - Built-in TypeScript support
- Cons:
  - Relatively newer (but mature now)
  - Some Electron tooling still webpack-focused

**Webpack**

- Pros:
  - More mature
  - Larger ecosystem
  - More plugins available
  - Better documentation for Electron
- Cons:
  - Slower dev builds
  - More complex configuration
  - Older architecture

**My recommendation: Vite**

- Significantly better developer experience
- Electron-vite is mature and well-maintained
- Faster iteration during development
- Simpler config for TypeScript + React

Agree?

> agree, go with vite

---

## 10. Material-UI and Alternatives

**Q10.1:** You're thinking Material-UI but open to suggestions. Here's analysis:

**Material-UI (MUI)**

- Pros:
  - Comprehensive component library
  - Good documentation
  - TypeScript support
  - Professional look
  - Customizable theme
- Cons:
  - Can be heavy (bundle size)
  - Material Design style might not fit all preferences
  - Sometimes opinionated styling

**Alternatives:**

- **Ant Design**: Similar to MUI, slightly different aesthetic
- **Chakra UI**: Lighter weight, excellent DX, very customizable
- **Radix UI + Tailwind**: Unstyled primitives + utility CSS (most flexibility)
- **Custom components**: Full control but much more work

**My recommendation: Material-UI (MUI)**

- Best balance of features, documentation, and professional appearance
- Has everything we need (dialogs, menus, trees, etc.)
- Strong TypeScript support
- Can customize theme for brand identity

Go with MUI?

> Go with MUI

---

## 11. Welcome Wizard vs Command Line

**Q11.1:** You mentioned "welcome screen with setup wizard" and "command line option to set any of the necessary things."

For command line setup, should it:

- Skip the welcome wizard entirely if settings provided via CLI?
- Still show the UI but pre-populate with CLI values?
- Be primarily for testing/automation purposes?

What settings should be configurable via CLI:

- Instance ID (you mentioned this earlier)?
- SD paths and names?
- User name?
- All settings?
- Minimal set?

> all settings should be configurable via CLI
> for command line setup, skip the wizard if the necessary is supplied, it's primarily for testing/automation

---

## 12. Folder Hierarchy CRDT Per-SD

**Q12.1:** You clarified folder structure is per-SD. So the CRDT structure should be:

- Each SD has its own `folders/` CRDT document
- Each SD's folder structure is independent
- Notes belong to folders within their SD only

For syncing: if two instances have overlapping SDs, they sync those. If they have different SDs, they don't interfere. Correct?

> correct

**Q12.2:** Does this mean:

- The `folders/updates/` directory (from original spec) exists per SD?
- So structure is: `<SD-root>/notes/...` and `<SD-root>/folders/...`?

> yes

---

## 13. User in CRDT Updates

**Q13.1:** You said "user should be included in the CRDT updates somewhere, so we know who did what."

Should we:

- Store username in each Yjs update metadata?
- Add a separate "history" or "audit log" tracking who made changes?
- Display this information in the UI (e.g., "Last edited by Alice")?
- All of the above?

> TipTap may have something here already, so look into its documentation. But having our own copy in a format we control is a good idea. As to separate history or yjs metadata, what do you suggest?

---

## 14. Live Search Complexity

**Q14.1:** You said live search in notes list is preferred "if it wouldn't be overly complex."

My assessment:

- With SQLite FTS5, live search is straightforward
- Need to debounce (250-300ms) to avoid excessive queries
- Should be fine performance-wise

So yes, implement live search. Unless you have concerns?

> let's do live search

---

## 15. Test Coverage for UI

**Q15.1:** You specified 70% minimum coverage overall, near 100% for CRDT/sync logic.

For UI components (React components, dialogs, etc.), should we:

- Aim for the 70% target?
- Focus primarily on integration tests via Playwright vs unit tests?
- What's the priority split between unit vs E2E for UI?

> I'd like solid coverage with unit tests as they're fast to run and can catch a lot, but we still need good e2e
> as there will be a fair amount of UI related things that we want covered. So yes, 70% coverage is the goal here,
> and any time I give you a bug report, either expand another test that is appropriate or create a new one.

---

## Notes

Please answer these final questions and we should have everything needed for a comprehensive plan.

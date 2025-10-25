# Questions and Ambiguities - Round 6

Final clarifications before planning

---

## 1. Note History UI Suggestion

**Q1.1:** You asked for a suggestion on note history UI. Here's my recommendation:

**History Button in Editor Toolbar:**
- Add a "History" button/icon in the editor toolbar (clock icon)
- Opens a modal/sidebar showing history view

**History View:**
- Left side: Timeline list showing:
  - Date/time of each change
  - User who made the change
  - Brief summary (e.g., "Added 3 paragraphs, deleted 1")
- Right side: Preview of note at that point in time
- Bottom: "Restore to this version" button

**Additional Features:**
- Slider at top to scrub through versions quickly
- "Compare" mode showing diff view between two versions
  - Additions in green, deletions in red
  - Side-by-side or inline diff view
- Filter by user (if multiple users have edited)

**Simple Initial Version:**
- Start with basic list of versions with restore capability
- Add diff view in a later iteration if too complex initially

Does this approach sound good?
> sounds great!

---

## 2. API Recommendation for Query Use Cases

**Q2.1:** For your use case of "query notes for things I can't readily query via search" (like finding undone todos in documents matching a pattern), here's my recommendation:

**Command-line interface + Library approach:**
- Create a TypeScript/JavaScript library that can read/query the CRDT files and SQLite cache
- Provide a CLI tool built on this library
- Users can write scripts using the library or use CLI for common queries

**Example:**
```bash
# CLI usage
notecove query "todo:incomplete AND title:project*"
notecove find --tag work --has-todos

# Library usage (Node.js script)
import { NoteCoveDB } from '@notecove/sdk';
const db = new NoteCoveDB('/path/to/sd');
const notes = await db.query({
  todos: { status: 'incomplete' },
  titlePattern: 'project*'
});
```

**Why this approach:**
- No need for running server (REST/gRPC requires app to be running)
- Direct file access is fast and doesn't require IPC
- Scriptable and composable with other tools
- Can still add REST API later if needed

**Alternative - IPC with running app:**
- If app is running, CLI can communicate via IPC for faster queries (using cached data)
- Falls back to direct file reading if app isn't running

Does this approach work for your use case?

> I prefer IPC, for a specific reason -- if the tool/sdk gets out of sync with the app, it seems like bad things could happen with storage, plus the availability of the cache. With only one potential reader/writer process to the SD, there's less potential for things to go sideways. Plus if the API supports write operations, they show up immediately in the UI I'd think.

---

## 3. Icon Set License

**Q3.1:** For icons and Apache v2 license compatibility, I can suggest:

**Icon Options:**
- **Material Design Icons** (Apache 2.0 licensed) - comprehensive, professional
- **Heroicons** (MIT) - clean, modern, good for UI
- **Lucide** (ISC) - fork of Feather icons, very clean
- **Bootstrap Icons** (MIT) - comprehensive set

For the app icon/logo itself:
- Should we use a generated/designed logo, or text-based?
- Color scheme preference?
- Any design direction (minimalist, colorful, etc.)?

Or should I plan to use placeholder and defer actual design?

> MUI's icon set sounds like a good choice, falling back to the others if there's a gap we need covered that they cover.
> color scheme, I like brown as the main accent color -- though not sure how it will go with dark mode -- blue seems pretty universal there.
> I want clean, I don't want garish colors, or lots of colors
---

## 4. Rollback Rule - Understood

**Q4.1:** Understood on the rollback rule. To confirm my understanding:

When you specify a requirement (like using a specific widget/technology):
- I should implement it as specified
- If I encounter difficulties, I should explain the problem and ask for guidance
- I should NOT pivot to alternatives without discussing first
- Even if something seems hard, I should persist and ask for help rather than changing course

Acknowledged. I'll make sure to communicate blockers rather than changing direction.

>thank you
---

## 5. Search Scope Selector

**Q5.1:** You said search should be "user selectable, defaulting to current SD" for cross-SD search.

Where should this selector be placed?
- A) Dropdown next to the search box (Current SD / All SDs / Current Folder Only)
- B) Icon/button next to search box that cycles through options
- C) In search settings/preferences
- D) Advanced search dialog

Which UI pattern?

> D and B
---

## 6. Tri-State Checkbox Visual

**Q6.1:** For the tri-state checkbox with `[N]` for NOPE, should the visual rendering be:
- Checkbox with "N" letter inside?
- Checkbox with X-through icon (strikethrough style)?
- Different color (red/gray)?
- Custom icon?

What should the actual checkbox look like visually (not just the markdown)?
> different color -- red
---

## 7. Phase 4 vs MVP Boundary

**Q7.1:** Just to clarify the phase structure:

You confirmed:
- Phase 1: Core Foundation
- Phase 2: Desktop UI (basic editing, folders)
- Phase 3: iOS App (basic editing, folders)
- Phase 4: Advanced Features (tags, links, search, export)

So MVP = Phases 1-4 complete, right?

And Phase 5 (Documentation & Polish) happens alongside/after MVP?

Or is MVP = Phases 1-3, and Phase 4 is post-MVP enhancements?

> that's a better delineation

---

## 8. CI/CD Code Signing

**Q8.1:** You want to plan for CD (code signing, app store distribution).

For code signing:
- **macOS**: Will you have an Apple Developer account for signing?
- **Windows**: Will you have a code signing certificate?
- **iOS**: Requires Apple Developer account (same as macOS)

Should the plan assume you'll set these up, or should we use:
- Ad-hoc signing for development/testing initially?
- Plan the infrastructure but defer actual signing until ready for distribution?

> For MVP, I'll want the ios app on my phone. What would be required to make that happen?

---

## 9. Checkbox in Lists Only

**Q9.1:** You said checkboxes work "only in list items."

Should they work in:
- Bullet lists only? (`- [ ] Task`)
- Numbered lists too? (`1. [ ] Task`)
- Both?

> both
---

## 10. Settings Sync Clarification

**Q10.1:** You said settings stored in "Electron store" (local).

This means each device/instance has independent settings, right? So:
- Desktop Mac might have different SDs configured than Desktop Windows
- iOS would have its own settings
- Each instance manages its own SD list, theme preference, etc.

Correct?

> correct
---

## Notes

These should be the final questions. Once answered, I'll have everything needed to create the comprehensive implementation plan with all the details we've discussed.

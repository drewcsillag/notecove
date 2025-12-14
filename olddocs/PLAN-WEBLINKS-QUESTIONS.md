# Web Links Feature - Open Questions

Questions that need clarification before/during implementation.

---

## Resolved Questions

_(Move questions here once answered)_

### Q1: Link syntax

**Question:** Auto-detect bare URLs, markdown-style, or both?
**Answer:** Both

### Q2: Adding links to text

**Question:** Toolbar button, Cmd+K, paste detection?
**Answer:** All three

### Q3: Click behavior

**Question:** What happens on click?
**Answer:** Single-click → popover (copy/edit/visit/remove). Cmd+click → opens directly. No confirmation.

### Q4: Visual appearance

**Question:** How should web links look?
**Answer:** Blue underlined, distinct from inter-note links (which are dotted)

### Q5: Markdown link rendering

**Question:** Show syntax or hide it?
**Answer:** Option A — hide syntax, show clean "text" only

### Q6: iOS scope

**Question:** Desktop only or iOS from start?
**Answer:** Include shared utilities from start

### Q7: Protocols

**Question:** Which protocols allowed?
**Answer:** http:// and https:// only, validated

### Q8: Popover actions

**Question:** What actions in popover?
**Answer:** Copy, Edit, Visit, Remove

### Q9: Auto-detection timing

**Question:** When does bare URL become link?
**Answer:** On space/enter AND on paste

---

## Open Questions

_(None — all resolved)_

---

## Recently Resolved

### Q10: Bare URL edit → non-URL text

**Context:** User types `https://foo.com`, it becomes a link. Then they edit the text to `click here` (no longer a valid URL).

**Question:** What should happen?

**Answer:** **Option A** — Keep href unchanged. Text becomes "click here" but href stays "https://foo.com" (like markdown-style links).

---

### Q11: Cmd+K with no selection, not in link

**Context:** User presses Cmd+K but has no text selected and cursor isn't in an existing link.

**Question:** What should happen?

**Answer:** **Option B** — Show dialog to enter both link text AND URL.

---

## Implementation Notes

### Architecture: Marks vs Decorations

**Web Links** use TipTap's mark-based approach:

- Link stored as a mark on text with `href` attribute
- `[text](url)` syntax is _replaced_ — markdown doesn't persist in document
- Standard TipTap Link extension behavior

**Inter-Note Links** use decoration-based approach:

- `[[uuid]]` stored as plain text in document
- Decorations render it visually as `[[title]]`
- Custom extension, not using TipTap Link

**Why different?** Inter-note links need the UUID in the document for CRDT sync and backlink extraction. Web links don't need this — the href attribute suffices.

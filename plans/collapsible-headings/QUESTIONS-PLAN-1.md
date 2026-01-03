# Plan Critique Questions

## 1. Collapse Toggle Visibility

Should the collapse toggle (▶/▼) be:

**A) Always visible** - The toggle is always shown next to headings

**B) Show on hover** - The toggle appears when you hover over the heading (like Notion)

Recommendation: **Option A** for discoverability, but B looks cleaner.

A

## 2. Copy/Paste Behavior

When you select text that includes a collapsed heading and copy it:

**A) Include hidden content** - The clipboard gets everything, collapsed sections expand on paste

**B) Exclude hidden content** - Only visible content is copied

Recommendation: **Option A** - copying should get the full content.

A

## 3. Split Heading Behavior

When you press Enter in the middle of a collapsed heading text:

**A) New heading is expanded** - The split creates an expanded heading

**B) New heading inherits collapsed state** - Both halves are collapsed

Recommendation: **Option A** - new content should be visible.

A

## 4. Architecture Confirmation

The hiding mechanism needs to use a ProseMirror Decoration plugin rather than CSS sibling selectors. This is more complex but the only correct approach. Is this acceptable, or would you prefer a simpler (but limited) v1?

**A) Full decoration-based approach** - Correct behavior, more complex

**B) Simple v1** - Maybe just CSS that hides the next N paragraphs (limited but quick)

Recommendation: **Option A** - do it right the first time.

A

# Questions - Link Text Separation

## Issue Analysis

When typing text before or after a link in a note, the new text is incorrectly included as part of the link. The user expects:

- Text typed **before** a link should never be part of the link
- Text typed **after** a link should only continue as link if... (needs clarification)

## Root Cause Identified

The TipTap Link extension has:

```typescript
inclusive() {
  return this.options.autolink
}
```

Since our WebLink extension sets `autolink: true`, the mark is **inclusive**, meaning typing at the start or end of a link extends the link mark to include the new text.

## Questions

### Q1: After-link behavior clarification

You mentioned:

> "I can see there needing to be a space after to stop the linking formatting"

Could you clarify what you'd like the behavior to be when typing **after** a link:

**Option A: Non-inclusive (recommended)**

- Typing at the end of a link **never** extends the link
- To add text to a link, user must select the link text and re-apply the link
- This is the standard behavior in most text editors (Google Docs, Notion, etc.)

**Option B: Space-terminated**

- Typing at the end of a link continues the link until user types a space
- After space, subsequent text is not part of link
- More complex to implement, less standard behavior

If A is possible and practical, I'd love A

### Q2: Autolink behavior interaction

Currently `autolink: true` enables both:

1. Auto-detection of URLs when typing (e.g., typing `https://google.com ` auto-creates a link)
2. Inclusive mark behavior (typing at link boundaries extends the link)

If we set `inclusive: false`, autolink URL detection will still work normally. Just want to confirm this tradeoff is acceptable:

- ✅ Auto-link when typing URLs
- ✅ Typing before a link = not linked
- ✅ Typing after a link = not linked (requires space/arrow to exit, then type)

How would it know when the link is done being typed to switch to not-linking? This is why I mentioned it may require a space or something for it to stop. Though there's a difference between typing in a new link, and working around an existing one.

### Q3: Existing content

Links in existing notes should continue to work normally. The change only affects typing behavior at link boundaries. Is that understood correctly?

That's correct.

# Plan Questions

## Q1: Atomic nodes vs marks for mentions?

The dual-text storage (`@drew Drew Colthorp`) has a risk: if the user places their cursor inside and edits, it could corrupt the mention.

**Option A: Marks (current plan)**
- Store `@drew Drew Colthorp` as text with a mention mark
- Hide `@drew ` via rendering
- Pros: Simpler, consistent with existing patterns
- Cons: User could edit and corrupt the text

**Option B: Atomic inline nodes**
- Store mention as an atomic node (like an image)
- Cannot place cursor inside
- Pros: Safer, no corruption risk
- Cons: More complex, different from hashtags

**My recommendation:** Start with marks. If editing corruption becomes a problem in practice, migrate to nodes. The mark approach is simpler and lets us ship faster.

Do you agree, or prefer atomic nodes from the start?

option B

## Q2: Current user without handle?

If the current user hasn't set their `@handle` in settings:
- Should they still appear in autocomplete?
- Should we show a warning/prompt to set one?

Currently the handler includes them regardless. What's your preference?

Don't appear in the autocomplete, but do have a note there about it.

# Plan Critique Questions

## 1. Scroll Position Investigation Timing

The scroll position issue could be:

- A symptom of the same root cause (hidden text confusing the browser)
- A separate issue entirely
- Something our fix might make worse

**Question**: Should I investigate the scroll issue _first_ to understand if it's related, or proceed with the selection fix and investigate scroll after?

My recommendation: Quick investigation first (30 min max), then proceed with fixes.

agree with recommendation

## 2. Shift+Right verification

The plan focuses on leftward selection, but should I also verify Shift+Right works correctly?

Specifically: With cursor at `foo| [[Link]] bar`, does Shift+Right correctly include the link when extending selection?

If it's broken, we should fix both directions together.

It does include the link

## 3. Scope of scroll issue

If the scroll investigation reveals a complex separate issue, should I:

- A) File it as a separate bug and proceed with selection fix
- B) Fix both together before committing

My recommendation: (A) - keep this PR focused on selection behavior.

Make it a later phase in the PLAN

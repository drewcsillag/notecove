# Plan Critique Questions

Questions that emerged from reviewing the plan:

---

## Q1: iOS Compatibility

The current plan is desktop-only. Should link unfurling work on iOS too?

**Options:**

- **A) Desktop only for now** - iOS shows plain links, add iOS support later
- **B) iOS from the start** - More complex, needs native network code
- **C) iOS with graceful degradation** - Try to unfurl, fall back to link on failure

If A, we should ensure the document format doesn't break iOS rendering.

## A but don't do anything that would preclude ios

## Q2: Export Behavior

How should unfurls appear when exporting/copying?

**Markdown export:**

- A) Just the URL: `https://youtube.com/watch?v=...`
- B) Link with title: `[Video Title](https://youtube.com/watch?v=...)`
- C) Full card as blockquote with metadata

B

**Copy to clipboard:**

- A) Plain URL only
- B) Title + URL
- C) Rich format (if target supports it)

## C, otherwise A

## Q3: Debug Tooling

Should we add oEmbed to the Storage Inspector?

This would show:

- All cached unfurl data
- Cache hit/miss stats
- Manual refresh/clear options

Useful for debugging but adds scope. Worth it?

## YES!

## Q4: Link Text Preservation

When `[Check this out](https://youtube.com/...)` unfurls:

**Option A) Keep text, unfurl below:**

```
Check this out
┌─────────────────────┐
│ Video Title         │
│ youtube.com         │
└─────────────────────┘
```

**Option B) Replace text with unfurl:**

```
┌─────────────────────┐
│ Video Title         │
│ youtube.com         │
└─────────────────────┘
```

**Option C) Text becomes chip, unfurl is separate block:**

```
🎬 Check this out

┌─────────────────────┐
│ Video Title         │
│ youtube.com         │
└─────────────────────┘
```

Which approach?

## C

## Q5: Thumbnail Caching

Should thumbnails be cached locally?

**Pros:**

- Faster subsequent loads
- Works offline
- Less external requests

**Cons:**

- Disk space usage
- Stale images
- More complexity

Options:

- A) No caching (always fetch)
- B) Cache with TTL (e.g., 7 days)
- C) Cache forever (until manual clear)

## C

## Summary

| Question      | Options                                       | Your Pick? |
| ------------- | --------------------------------------------- | ---------- |
| Q1 iOS        | A) Desktop only / B) iOS too / C) Degradation |            |
| Q2 Export     | Various                                       |            |
| Q3 Debug tool | Yes / No                                      |            |
| Q4 Link text  | A) Keep above / B) Replace / C) Chip + block  |            |
| Q5 Thumbnails | A) No cache / B) TTL / C) Forever             |            |

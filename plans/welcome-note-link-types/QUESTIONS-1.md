# Questions for Welcome Note Link Types Feature

## Background Understanding

After analyzing the codebase, I found:

1. **Welcome note**: Located at `packages/desktop/resources/welcome.md` - currently contains no links
2. **Markdown to ProseMirror**: Uses `markdown-it` to parse markdown, converts to ProseMirror JSON. Links are converted to text nodes with `link` marks containing `href` attribute. **No `displayMode` handling exists in markdown import.**
3. **Link display modes**: Links can have `displayMode` attribute: `'auto' | 'chip' | 'unfurl' | 'link'`
   - `'link'` = plain clickable text
   - `'chip'` = compact chip with favicon and title
   - `'unfurl'` = full preview card with thumbnail, description, etc.
   - `'auto'` = system decides based on global preference and context
4. **Global preference**: User can set preference to `'none' | 'chip' | 'unfurl' | 'secure'`
   - `'secure'` mode = all links display as plain text (no network requests)
5. **displayMode baking**: When links are created in the editor, the `displayModeBakeInPlugin` automatically sets the displayMode based on global preference and context

## Key Technical Challenge

The markdown parser doesn't know about `displayMode`. When markdown is converted to ProseMirror, links get `displayMode: 'auto'` by default. Then when loaded into the editor, if the user's global preference is something other than what we want to demonstrate, the welcome note won't show all three types.

## Proposed Solution Options

### Option A: Extended Markdown Syntax

Add a markdown-it extension or post-processing step to recognize special syntax for link display modes:

```markdown
<!-- Plain link (always shows as text) -->

[Example](https://example.com){.link}

<!-- Chip link (compact with favicon) -->

[YouTube](https://youtube.com){.chip}

<!-- Unfurl link (full preview card) -->

[YouTube Video](https://youtube.com/watch?v=xyz){.unfurl}
```

This would use a curly-brace attribute syntax similar to Markdown Extra / Pandoc.

**Pros:**

- Makes markdown import more expressive for all imports (not just welcome note)
- Standard-ish syntax (similar to Pandoc attributes)
- Could be useful for exporting too eventually

**Cons:**

- More complex to implement
- Need to document the syntax
- Could conflict with other markdown extensions

### Option B: Hard-code in Welcome Note Loading

Instead of changing the markdown parser, post-process the welcome note specifically to set displayModes on certain links.

**Pros:**

- Simpler to implement
- No changes to markdown parser
- Welcome note is a special case anyway

**Cons:**

- Less reusable
- Welcome note becomes coupled to implementation details

### Option C: Use ProseMirror JSON for Welcome Note

Convert the welcome note from markdown to raw ProseMirror JSON, which can specify displayMode directly.

**Pros:**

- Full control over node attributes
- No parser changes needed

**Cons:**

- Less maintainable (JSON is harder to edit than markdown)
- Need tooling to convert markdown → JSON for editing

## Questions

### Q1: Preferred Approach?

Which approach do you prefer?

- **Option A**: Extended markdown syntax (more general, reusable for imports)
- **Option B**: Hard-code welcome note processing (simpler, special case)
- **Option C**: Use JSON for welcome note (full control, harder to maintain)

A

### Q2: Which URLs should we use?

For demonstrating the link types, we need URLs that:

- Work reliably (won't 404)
- Have good oEmbed metadata (for unfurl to look nice)
- Are recognizable/trustworthy

Suggestions:

- **Plain link**: `https://notecove.com` or `https://example.com`
- **Chip**: `https://github.com/notecove` or similar
- **Unfurl**: A YouTube video URL or similar rich content that has good oEmbed support

What URLs should we use?

Plain link: https://github.com/drewcsillag/notecove
Chip: https://theonion.com/heroic-dog-saves-family-of-5-from-herb-roasted-chicken/
Unfurl: https://www.youtube.com/watch?v=qXD9HnrNrvk

### Q3: What text should the welcome note say about links?

Should we add a new section like:

```markdown
### Link Previews

NoteCove can display links in different ways:

- [Plain link](https://example.com){.link} - Simple text link
- [GitHub](https://github.com){.chip} - Compact chip with favicon
- [YouTube Video](https://youtube.com/watch?v=...){.unfurl} - Rich preview with thumbnail
```

Or something else?

That looks good

### Q4: Behavior when preference is 'secure'

You mentioned "if the link preview mode is secure, they'll just show as plain links."

The current implementation has this behavior:

- When `displayMode` is explicitly set to `'chip'` or `'unfurl'`, it respects that even in secure mode (the chip/unfurl just doesn't fetch metadata)
- Actually, looking more closely at the code - in secure mode, the chip plugin skips all decoration

Should the welcome note:

- **A**: Respect secure mode (all links appear as plain text in secure mode)
- **B**: Force display modes regardless (could be confusing if user chose secure for privacy)
- **C**: Show the different types but with a note explaining they appear as plain text in secure mode

A

### Q5: Markdown Syntax Details (if Option A)

If we go with Option A (extended markdown syntax), what exact syntax should we use?

Current candidates:

1. `[text](url){.displayMode}` - Pandoc-style class attribute
2. `[text](url "displayMode:chip")` - Title attribute abuse
3. `[text|chip](url)` - Custom link text suffix
4. `<chip>[text](url)</chip>` - HTML wrapper (not great for markdown)

I'd recommend option 1 (`{.link}`, `{.chip}`, `{.unfurl}`) as it's closest to established Pandoc/Kramdown syntax and is clearly an attribute, not part of the display text.

## Option 1

Please answer these questions and I'll proceed with the implementation plan.

# Questions - Phase 1: Context Menu Paste Bug Fix

## Analysis Summary

I've analyzed the context menu paste issue in `TipTapEditor.tsx`. The root cause is clear:

### The Problem

When pasting via context menu (`handleContextMenuPaste` at line 2255):

1. It reads raw HTML blob from clipboard via `navigator.clipboard.read()`
2. Passes the raw HTML directly to `editor.insertContent(html)`
3. This raw HTML may include:
   - `<meta charset="utf-8">` tags (from browser-copied content)
   - Wrapping `<html>`, `<body>` tags
   - Extra whitespace/newlines

When pasting via Cmd+V (keyboard shortcut):

- TipTap's native `handlePaste` prop receives a `ClipboardEvent`
- TipTap's internal parser strips metadata and normalizes content properly

### Proposed Fix

The simplest fix is to sanitize the HTML before inserting:

1. Parse the HTML into a temporary DOM element
2. Extract only the content from `<body>` (if present) or use as-is
3. Strip any `<meta>`, `<style>`, `<script>`, `<link>` tags
4. Use the sanitized HTML with `insertContent()`

---

## Questions for User

### 1. Scope of content sources

The clipboard content could come from:

- **Internal**: Cut/copy within the same TipTap editor (already clean HTML)
- **External**: Copy from web browsers (may have metadata)
- **External**: Copy from other apps (Word, Notes, etc.)

**Question**: Should we only handle internal and browser-copied content, or do you want to handle paste from other applications like Word as well? (Word often has very complex HTML with Microsoft-specific tags)

**My Recommendation**: Start with internal + browser paste. Word/rich app paste is a separate, more complex feature.

I want to support pasting from anywhere as much as _reasonably_ possible

### 2. Preserve formatting?

When pasting external HTML, should we:

- **Option A**: Preserve all formatting (bold, italic, links, etc.) as much as TipTap supports
- **Option B**: Strip to plain text only
- **Option C**: Preserve basic formatting (bold, italic, links) but strip complex styling

**My Recommendation**: Option A - Preserve all formatting that TipTap supports. This matches keyboard paste behavior.

A

We should have the ability to paste without formatting the way other editors support also.

### 3. Test coverage

The existing tests (`context-menu-clipboard.test.ts`) test with clean HTML like `<p>Pasted</p>`. Should I:

- Add tests specifically for `<meta charset>` in clipboard content?
- Add tests for `<html><body>` wrapped content?

**My Recommendation**: Yes, add both types of tests to prevent regression.

Yes, both

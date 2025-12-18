# Questions for Auto-Populate Link URL Feature

## Understanding the Feature

When the user selects text and presses Cmd+K (or clicks the link button), the link dialog currently shows an empty URL field. The feature should detect if the selected text looks like a URL or hostname and pre-populate the URL field with that value.

## Questions

### 1. Detection Patterns - What should be recognized?

Currently the codebase has `isValidWebUrl()` which requires `http://` or `https://` prefix. Should we recognize:

a) **Full URLs with scheme** (e.g., `https://example.com/path`)

- These would be used as-is

b) **Bare hostnames/domains** (e.g., `example.com`, `sub.domain.org`)

- These would be prepended with `https://`

c) **Hostnames with path** (e.g., `example.com/path/to/page`)

- These would be prepended with `https://`

d) **IP addresses** (e.g., `192.168.1.1`, `192.168.1.1:8080`)

- Would be prepended with `http://` (typically used for local dev)

**My recommendation**: Recognize (a), (b), (c), and (d). For (b), (c), (d), prepend `https://` (or `http://` for IPs without TLS typically).

A, B, C, D

### 2. Which popover should this apply to?

There are two popovers used when creating new links:

- **LinkInputPopover**: Used when text IS selected → shows just the URL field
- **TextAndUrlInputPopover**: Used when NO text is selected → shows text + URL fields

Since the feature is about "highlighted text", I assume it only applies to **LinkInputPopover** (text is selected).

However, should we also consider the case where the user has no selection, but presses Cmd+K while the cursor is inside/adjacent to a URL-like word? We could detect that word and use it as both the link text and URL.

**My recommendation**: Start with just LinkInputPopover for selected text. The cursor-adjacent-word detection could be a follow-up enhancement.

Go with your recommendation

### 3. Edge Cases

a) **Selected text has trailing/leading whitespace**

- Should we trim it before detection? (e.g., " example.com " → "example.com")
- **My recommendation**: Yes, trim before detection
  yes

b) **Selected text contains spaces inside**

- e.g., "example .com" or "https://example. com"
- These should NOT be detected as URLs
- **My recommendation**: Correct, spaces in the middle disqualify it
  agree

c) **Mixed content selection**

- User selects "Check out example.com for more info"
- This is clearly not a URL, should NOT be detected
- **My recommendation**: Correct, only detect if the ENTIRE trimmed selection looks like a URL
  agree with recommendation

### 4. User Experience

When URL is auto-populated:

a) Should the text be pre-selected so the user can easily replace it if wrong?

- **Current behavior**: When `initialUrl` is provided to LinkInputPopover, it selects all text
- **My recommendation**: Keep this behavior - it's already there
  go with recommendation

b) Should there be any visual indication that the URL was auto-detected?

- **My recommendation**: No, the pre-filled field is sufficient indication

go with recommendation

### 5. Hostname/Domain Pattern

For detecting bare hostnames, what pattern should we use? Options:

a) Simple: Require at least one dot and common TLD (`.com`, `.org`, `.net`, `.io`, etc.)
b) Moderate: Any word.word pattern where second part is 2-6 chars
c) Liberal: Any word.word pattern

Examples:

- `example.com` → All patterns match
- `foo.bar` → Patterns (b) and (c) match, but this could be a sentence fragment "foo.bar"
- `my.server.local` → Might be a local hostname
- `localhost` → No dot, none match (but `localhost:3000` has port)

**My recommendation**: Use a moderate approach - require the text to look like a domain with a recognized TLD, or have a scheme, or have a port number. Avoid false positives like "foo.bar" in prose.

Specifically:

- If it starts with `http://` or `https://` → valid URL
- If it ends with a recognized TLD (`.com`, `.org`, `.net`, `.io`, `.dev`, `.co`, `.ai`, etc.) → valid hostname
- If it contains `:` followed by digits (port) → valid hostname with port
- If it's `localhost` or `localhost:port` → valid

## go with recommendation

## Summary of My Recommendations

1. Detect full URLs and bare hostnames (with TLDs or ports)
2. Only apply to LinkInputPopover (text must be selected)
3. Trim whitespace, reject anything with internal spaces
4. Keep existing select-on-focus behavior
5. Use TLD-based validation to avoid false positives

Please confirm or modify these recommendations before I proceed with the plan.

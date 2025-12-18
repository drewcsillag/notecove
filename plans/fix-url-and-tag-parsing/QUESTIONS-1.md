# Questions - Fix URL and Tag Parsing

## Understanding of the Problem

Based on my analysis, there are two distinct issues:

### Issue 1: URL fragments being picked up as tags

When a URL contains a fragment (e.g., `https://example.com/page#section`), the `#section` part is incorrectly being detected as a tag by the Hashtag extension.

**Root cause**: The `HASHTAG_PATTERN` (`/#[a-zA-Z][a-zA-Z0-9_]*/g`) doesn't have any awareness of URL context. It simply finds all `#word` patterns in text, including fragments inside URLs.

### Issue 2: Bare domains being auto-linked

TipTap's Link extension (which we extend as WebLink) has an `autolink: true` option that auto-detects URLs. The built-in autolink behavior appears to be matching things like `foo.bar` or `localhost` without requiring a scheme prefix.

**Root cause**: TipTap's built-in autolink regex is more permissive than our `WEB_LINK_PATTERN` which correctly requires `https?://`.

## Questions

### 1. URL Fragment vs Tag Priority

When you type `https://example.com/page#section`:

- Should `#section` NOT be extracted as a tag? (My assumption: **YES, do not extract**)
- Should the URL still show the fragment in the link? (My assumption: **YES**)

#section should not be extracted as a tag
the URL should show the fragment

### 2. Scheme Requirement for URLs

You mentioned URLs should only be auto-linked if they have a scheme. Does this include:

- `http://` - YES
- `https://` - YES
- `file://` - NO (already excluded)
- `ftp://` - NO (already excluded)

Is this correct?

yes

### 3. What About Intentional Bare Domains?

If the user explicitly types `google.com` (no scheme), should:

- (a) It remain plain text (no auto-link) ← My assumption based on your request
- (b) Some fallback behavior (e.g., Cmd+K to manually add link)

remain plain text, but Cmd-K should add the link

### 4. Localhost Special Case

You mentioned `localhost` specifically. Should `localhost:3000` (with port) also NOT auto-link without a scheme?

- `http://localhost:3000` → link
- `localhost:3000` → plain text (my assumption)

you assumptions here are correct

### 5. Implementation Approach for Tag/URL Collision

Two approaches to prevent URL fragments from becoming tags:

**Approach A: Pre-filter URLs before tag extraction**

- In `extractTags()`, first identify all URLs in the text
- Skip any `#word` that falls within a URL's character range
- Pro: Clean separation of concerns
- Con: Requires URL detection in tag-extractor

**Approach B: Negative lookbehind in regex**

- Modify `HASHTAG_PATTERN` to exclude matches preceded by URL-like patterns
- Pro: Single regex
- Con: Complex regex, may not catch all edge cases

**Approach C: Post-filter extracted tags**

- Extract tags normally, then filter out any that appear within detected URLs
- Pro: Simple implementation
- Con: Slightly wasteful (extract then discard)

Which approach do you prefer, or should I choose based on implementation simplicity?

Which is most robust in providing correct behavior?

### 6. Editor vs Database Extraction

Both of these systems exist in two places:

1. **Editor (TipTap extensions)** - Real-time rendering/decorations
2. **Database extraction utilities** - For indexing/search

Should both be fixed, or just one?

- My assumption: **Both need to be consistent**

yes, both

### 7. Edge Cases

What about these edge cases?

a) `#tag` inside markdown links: `[link text](https://example.com#anchor)`

- The `#anchor` is inside the URL portion, should not be a tag

correct, #anchor should not be a tag

b) Multiple fragments (invalid but possible): `https://example.com#foo#bar`

- Should `#bar` be considered a tag? (I'd say no)

no

c) URL followed immediately by tag: `https://example.com#section#mytag`

- Should `#mytag` be a tag? (Ambiguous - probably no, user should add space)

no

d) Tag in URL query param: `https://example.com?tag=#test`

- Should `#test` be a tag? (I'd say no, it's part of the URL)

no, it's part of the url

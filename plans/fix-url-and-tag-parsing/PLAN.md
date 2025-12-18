# Fix URL and Tag Parsing

**Overall Progress:** `100%`

## Summary

Two bugs fixed:

1. **URL fragments picked up as tags**: `https://example.com#section` no longer creates tag `#section`
2. **Bare domains auto-linked**: `foo.bar` or `localhost` no longer become links without scheme

## Scope

Both issues fixed in two places:

- **Shared utilities** (`packages/shared/src/utils/`) - For database extraction/indexing
- **TipTap extensions** (`packages/desktop/.../extensions/`) - For real-time editor rendering

## Tasks

### Phase 1: Fix Tag Extraction to Ignore URL Fragments

- [x] 🟩 **1.1 Add URL position detection utility**
  - [x] 🟩 Write tests for `getUrlRanges()` function
  - [x] 🟩 Implement `getUrlRanges(text)` that returns `{start, end}[]` for all URLs in text

- [x] 🟩 **1.2 Update `extractTags()` to skip tags inside URLs**
  - [x] 🟩 Write failing tests for URL fragment edge cases
  - [x] 🟩 Modify `extractTags()` to use `getUrlRanges()` and skip tags within URL bounds

- [x] 🟩 **1.3 Update Hashtag TipTap extension**
  - [x] 🟩 Write E2E tests for Hashtag extension with URLs
  - [x] 🟩 Modify `findHashtags()` to skip tags in text nodes with link marks

- [x] 🟩 **1.4 Manual verification checkpoint**
  - [x] 🟩 Verify in editor: `https://example.com#section` shows NO tag decoration on `#section`

### Phase 2: Fix Autolink to Require Scheme

- [x] 🟩 **2.1 Override TipTap's autolink behavior**
  - [x] 🟩 Write E2E tests for bare domain autolink prevention
  - [x] 🟩 Add `shouldAutoLink` option to WebLink extension
  - [x] 🟩 Verify `localhost`, `foo.bar`, `google.com` remain plain text
  - [x] 🟩 Verify `http://localhost`, `https://foo.bar` still auto-link

- [x] 🟩 **2.2 Manual verification checkpoint**
  - [x] 🟩 Verify in editor: typing `foo.bar ` does NOT create link
  - [x] 🟩 Verify in editor: typing `https://foo.bar ` DOES create link

### Phase 3: Integration Testing

- [x] 🟩 **3.1 End-to-end tests**
  - [x] 🟩 E2E test: URL with fragment does not create tag decoration
  - [x] 🟩 E2E test: Bare domain does not auto-link
  - [x] 🟩 E2E test: Scheme URLs still auto-link correctly

### Phase 4: Cleanup & Verification

- [x] 🟩 **4.1 Final verification**
  - [x] 🟩 Run full CI suite - PASSED
  - [x] 🟩 Tagged unrelated flaky test in cross-machine-sync-updates.spec.ts

## Edge Cases Confirmed

All of these do NOT create tags:

- `https://example.com/page#section` - fragment is part of URL ✅
- `[link](https://example.com#anchor)` - markdown link URL fragment ✅
- `https://example.com#foo#bar` - multiple fragments, all part of URL ✅
- `https://example.com#section#mytag` - no space separation, all URL ✅
- `https://example.com?tag=#test` - query param with #, all URL ✅

These do NOT auto-link:

- `foo.bar` - no scheme ✅
- `localhost` - no scheme ✅
- `localhost:3000` - no scheme ✅
- `google.com` - no scheme ✅

These STILL auto-link:

- `http://example.com` ✅
- `https://example.com` ✅
- `http://localhost:3000` ✅

## Technical Notes

### TipTap Autolink

TipTap's Link extension uses Linkify internally. The `shouldAutoLink` callback fires after Linkify detects a potential link, allowing us to reject bare domains that don't have a scheme.

### URL Range Detection

The `getUrlRanges()` function returns character positions `{start, end}[]` for all URLs. Tag extraction checks if each potential tag's position falls within any URL range, and skips it if so.

### Hashtag Extension Approach

For the TipTap Hashtag extension, we check if a text node has a `link` mark. If it does, we skip the entire node for hashtag processing. This handles URL fragments efficiently since the entire URL (including fragment) is marked as a link.

## Files Modified

| File                                                         | Changes                           |
| ------------------------------------------------------------ | --------------------------------- |
| `packages/shared/src/utils/web-link-utils.ts`                | Added `getUrlRanges()`            |
| `packages/shared/src/utils/tag-extractor.ts`                 | Use URL ranges to filter tags     |
| `packages/shared/src/utils/__tests__/tag-extractor.test.ts`  | Added URL fragment tests          |
| `packages/shared/src/utils/__tests__/web-link-utils.test.ts` | Added `getUrlRanges()` tests      |
| `packages/desktop/.../extensions/Hashtag.ts`                 | Skip tags in text with link marks |
| `packages/desktop/.../extensions/WebLink.ts`                 | Added `shouldAutoLink` option     |
| `packages/desktop/e2e/web-links.spec.ts`                     | Added bare domain E2E tests       |
| `packages/desktop/e2e/tags.spec.ts`                          | Added URL fragment E2E tests      |
| `packages/desktop/e2e/cross-machine-sync-updates.spec.ts`    | Tagged flaky test (unrelated fix) |

## Related Files

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial questions and answers
- [PLAN-CRITIQUE.md](./PLAN-CRITIQUE.md) - Plan review and risk assessment

# Plan Critique

## Ordering Assessment

**✅ Good:** Phase 1 (tag extraction) is independent of Phase 2 (autolink). They can be done in either order.

**✅ Good:** Within Phase 1, the order is correct:

1. `getUrlRanges()` in shared package first
2. `extractTags()` uses it (same package, easy)
3. Hashtag extension uses it (imports from `@notecove/shared`, already works)

## Feedback Loop Assessment

**✅ Good:** Each component can be tested independently:

- `getUrlRanges()` - Unit tests
- `extractTags()` - Unit tests
- Hashtag extension - Unit tests exist, can add more
- WebLink autolink - E2E tests

**Suggestion:** Add a manual testing step between phases so we can verify behavior in the actual editor before moving on.

## Debug Tools Assessment

**✅ Good:** WebLink.ts already has `DEBUG` mode logging that can be enabled.

**Addition needed:** Should add similar debug logging to tag extraction if issues arise.

## Missing Items

### 1. TipTap `shouldAutoLink` Option

The plan should explicitly mention using TipTap's `shouldAutoLink` option:

```typescript
Link.configure({
  shouldAutoLink: (url) => url.startsWith('http://') || url.startsWith('https://'),
});
```

### 2. Linkify Consideration

TipTap's Link extension uses [Linkify](https://linkify.js.org/) under the hood for autolink detection. The `shouldAutoLink` callback fires AFTER Linkify detects something as a potential link. We need to verify this works correctly - if Linkify doesn't detect `foo.bar` as a link in the first place, `shouldAutoLink` won't even be called.

**Risk:** Linkify IS detecting bare domains like `foo.bar` as links (that's the bug). The `shouldAutoLink` option should let us reject them.

### 3. Export `getUrlRanges` from shared package

Need to ensure `getUrlRanges()` is exported from `packages/shared/src/utils/index.ts` (currently exports from `web-link-utils.ts` which auto-includes new exports).

## Risk Assessment

### Low Risk

- **Tag extraction changes** - Well-tested utility, adding new logic that filters results. Easy to unit test.

### Medium Risk

- **TipTap autolink override** - Depends on TipTap's API behaving as documented. Need to verify `shouldAutoLink` actually prevents the link mark from being applied.

### Mitigation

- Add E2E test that explicitly types `foo.bar` and verifies NO link is created
- Add E2E test that types `https://foo.bar` and verifies link IS created

## Updated Plan Items

Based on critique, these changes to PLAN.md:

1. **Phase 2.1** - Clarify use of `shouldAutoLink` option
2. **Add manual test checkpoint** between phases
3. **Ensure tests cover Linkify edge cases** (bare TLDs like `.com`, `.io`)

## Questions Generated

None - all questions were answered in QUESTIONS-1.md.

## Sources

- [TipTap Link Extension Docs](https://tiptap.dev/docs/editor/extensions/marks/link)
- [TipTap GitHub Issue #2779](https://github.com/ueberdosis/tiptap/issues/2779)

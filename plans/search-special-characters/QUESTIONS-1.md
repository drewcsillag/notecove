# Questions for Special Characters in Note Search

## Analysis Summary

I've analyzed the search implementation in `packages/desktop/src/main/database/database.ts`. The current code handles FTS5 special characters by quoting words that contain them, but the regex is incomplete.

**Current regex:**

```typescript
const fts5SpecialChars = /[@:^$(){}[\]\\|!&~<>]/;
```

**Characters that cause FTS5 errors (from my testing):**

- `/` - causes "syntax error near '/'" (used in `/feature`)
- `.` - causes "syntax error near '.'" (used in `v1.0.2`)
- `-` - causes "no such column: value" (interpreted as NOT operator)
- `#` - already handled via hashtag transformation
- `'` (apostrophe) - causes syntax error
- `,` `;` - cause syntax errors
- `%` `?` `=` `` ` `` - cause syntax errors

**Characters in current regex that are actually OK in FTS5:**

- `^` - works fine (used for boosting but doesn't cause errors)
- `*` - is the wildcard operator, we use it intentionally

## Questions

### 1. Search Result Behavior

When a user searches for `v1.0.2`, should the search:

- **A)** Find exact matches only (notes containing literally "v1.0.2")
- **B)** Also find prefix matches like "v1.0.2-beta" or "v1.0.20"

Currently for words >= 3 chars, we add `*` for prefix matching (e.g., `test` becomes `test*`). With special characters, we quote the whole term which makes it exact-match only.

My recommendation: **Option A (exact match)** when special characters are present, because:

- Version numbers like `v1.0.2` shouldn't match `v1.0.20`
- Email addresses shouldn't match partially
- The current behavior for special chars already does this

B normally. If they enclose it in double quotes, then exact match only.

### 2. Hyphen Handling

Hyphens are particularly interesting because they're very common:

- `test-value` - kebab-case identifiers
- `v1.0.2-beta` - version strings
- `real-time` - compound words

Should hyphenated terms be:

- **A)** Treated as a single exact-match token (`"test-value"`)
- **B)** Split into separate words (`test` AND `value`) with prefix matching

My recommendation: **Option A (exact match)** because:

- If user searches `test-value`, they probably want that exact term
- If they wanted both words separately, they'd type `test value` (with space)

A

### 3. Asterisk Handling

Currently `*` is left unquoted since it's the FTS5 wildcard. Should we:

- **A)** Keep current behavior (allow `*` as wildcard)
- **B)** Quote terms containing `*` for exact match (search for literal asterisks)

My recommendation: **Option A (keep as wildcard)** because:

- Users may intentionally use `*` for wildcard searches
- Searching for literal asterisks is rare

A

### 4. Plus Sign Handling

The `+` character works in FTS5 but has special meaning (required term). Should we:

- **A)** Quote terms with `+` for exact match (e.g., `C++`)
- **B)** Leave unquoted (may affect search behavior unexpectedly)

My recommendation: **Option A (quote it)** because:

- `C++` should find notes about C++, not require the term "+"
- Similar to how `-` is the NOT operator

A

---

## No-Questions Summary

If my recommendations align with your expectations, just say "continue" and I'll proceed with:

1. Fix the regex to include all problematic characters: `/` `.` `-` `'` `,` `;` `%` `?` `=` `` ` `` `+`
2. Keep exact-match behavior for quoted terms (no prefix wildcard)
3. Write failing tests first (TDD)
4. Update the implementation
5. Run CI before commit

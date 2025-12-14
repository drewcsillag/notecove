# Feature: Special Characters in Note Search

**Overall Progress:** `100%`

## Summary

Allow special characters like `/feature` and `v1.0.2` to be used in note search without causing SQLite FTS5 errors.

### Root Cause

The current regex for detecting FTS5 special characters is incomplete:

```typescript
const fts5SpecialChars = /[@:^$(){}[\]\\|!&~<>]/;
```

Missing characters that cause errors: `/` `.` `-` `'` `,` `;` `%` `?` `=` `` ` `` `+`

### Solution

1. Expand the regex to include all problematic characters
2. For terms with special characters (length >= 3), quote AND add prefix wildcard: `"v1.0.2"*`
3. If user explicitly wraps in double quotes, keep exact match only (no wildcard)

### Design Decisions (from [QUESTIONS-1.md](./QUESTIONS-1.md))

| Decision                          | Choice                | Rationale                                 |
| --------------------------------- | --------------------- | ----------------------------------------- |
| Prefix matching for special chars | Yes (add `*`)         | Consistency with normal search            |
| User double-quotes                | Exact match only      | User explicitly wants exact               |
| Hyphens                           | Quote as single token | `test-value` should match that exact term |
| Asterisk `*`                      | Keep as wildcard      | Users may intentionally use wildcards     |
| Plus `+`                          | Quote it              | `C++` should find C++, not require `+`    |

---

## Tasks

### Phase 1: Tests (TDD)

- [x] 🟩 **Step 1: Write failing tests for special character search**
  - [x] 🟩 Test `/feature` search (forward slash)
  - [x] 🟩 Test `v1.0.2` search (periods)
  - [x] 🟩 Test `test-value` search (hyphen)
  - [x] 🟩 Test `C++` search (plus signs)
  - [x] 🟩 Test `user@example.com` search (at sign + periods)
  - [x] 🟩 Test `"exact term"` user-quoted search (exact match)
  - [x] 🟩 Test prefix matching works: `v1.0.2` finds `v1.0.2-beta`
  - [x] 🟩 Test mixed query: `the /feature command`
  - [x] 🟩 Test wildcard preserved: `wild*` should use wildcard, not quote

### Phase 2: Implementation

- [x] 🟩 **Step 2: Fix the special character regex**
  - [x] 🟩 Update `fts5SpecialChars` regex to include: `/` `.` `-` `'` `,` `;` `%` `?` `=` `` ` `` `+`
  - [x] 🟩 Skip quoting if word contains `*` (preserve user wildcard intent)
  - [x] 🟩 Add prefix wildcard to quoted special-char terms (length >= 3)
  - [x] 🟩 Preserve exact-match for user-quoted terms

### Phase 3: Verification

- [x] 🟩 **Step 3: Run tests and verify**
  - [x] 🟩 All new tests pass (9 new tests)
  - [x] 🟩 Existing tests still pass (109 total)
  - [x] 🟩 Run CI before commit

---

## Implementation Logic Flow

```
for each word in query:
  if word contains '*'        → leave unchanged (user wants wildcard)
  else if word is user-quoted → leave unchanged (exact match)
  else if word has special chars:
    quote it
    if length >= 3 → add * for prefix match
  else if length >= 3         → add * for prefix match
  else                        → exact match (short word)
```

---

## Files to Modify

| File                                                            | Change                              |
| --------------------------------------------------------------- | ----------------------------------- |
| `packages/desktop/src/main/database/database.ts`                | Fix `searchNotes()` regex and logic |
| `packages/desktop/src/main/database/__tests__/database.test.ts` | Add special character tests         |

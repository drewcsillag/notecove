# Plan Critique

## Issues Found

### 1. Missing: Re-indexing Existing Notes (CRITICAL)

After deploying the fix, existing notes in the database will still have bad `content_preview` values. They won't be fixed until each note is edited.

**Recommendation:** Add a migration/re-index step that:

- Triggers on app startup if schema version changed
- Or provide a manual "Rebuild Index" function
- Or re-extract when note is displayed (lazy)

### 2. Missing: Investigation Step

The plan assumes we know why newlines aren't working, but we haven't confirmed the actual Yjs document structure. Before implementing, we should:

- Add debug logging to see actual XmlElement structure
- Verify each paragraph IS a separate top-level element
- Understand why current code produces no newlines

### 3. Circular Link Risk

If Note A's title contains `[[B]]` and Note B's title contains `[[A]]`:

- Resolving A's title requires B's title
- Resolving B's title requires A's title
- Could cause infinite recursion or deadlock

**Recommendation:** Add depth limit or visited set to link resolution.

### 4. Feedback Loop Could Be Faster

Current order: Write all tests → Implement utilities → Integrate all at once

Better order for faster feedback:

1. Add debug logging first to understand actual Yjs structure
2. Fix text extraction, integrate, test manually
3. Then add link resolution

This lets us verify the snippet fix works before adding link complexity.

### 5. Missing: Update References When Note Renamed

The plan defers "stale titles" to later. But we should at least note WHERE this would be implemented:

- In the IPC handler for note title changes
- Query `note_links` table for notes linking TO renamed note
- Update their cached title/snippet

---

## Recommended Plan Updates

### Add Step 0: Investigation

```
- [ ] 🟥 **0.1 Debug Yjs structure**
  - [ ] 🟥 Add console.log to dump XmlFragment structure during extraction
  - [ ] 🟥 Edit a test note to trigger extraction
  - [ ] 🟥 Verify paragraph structure matches expectations
```

### Add Step 1.5: Re-index Existing Notes

```
- [ ] 🟥 **1.5 Handle existing notes**
  - [ ] 🟥 Add function to re-extract all notes' content_preview
  - [ ] 🟥 Call during app startup or as manual action
```

### Modify Phase 2.2: Add Circular Link Protection

```
- [ ] 🟥 **2.2 Create link resolution utility**
  - [ ] 🟥 Add depth limit (max 1 level - don't resolve links inside linked titles)
  - [ ] 🟥 Or: resolve to title only, not to title's resolved form
```

---

## Order Verification

✅ Phase 1 (text extraction) before Phase 2 (link resolution) - Correct
✅ Tests before implementation - Correct
✅ Shared utilities before integration - Correct

---

## Questions from Critique

### Q1: How should we handle re-indexing?

Options:

- **A**: Automatic on startup (checks version, re-indexes all notes)
- **B**: Manual "Rebuild Index" button in settings
- **C**: Lazy re-index (re-extract when note is loaded/displayed)
- **D**: Combination - lazy by default, with manual rebuild option

My recommendation: **D** - Lazy re-index with manual option for impatient users.

### Q2: Circular links - what's the expected behavior?

If Note A = "See [[B]]" and Note B = "See [[A]]":

- **A**: Show one level deep: A's title = "See [[B's raw title]]", don't recurse
- **B**: Show as broken link: A's title = "See [[circular ref]]"
- **C**: Just use raw title without resolving: A's title = "See [[uuid]]"

My recommendation: **A** - One level deep is enough context.

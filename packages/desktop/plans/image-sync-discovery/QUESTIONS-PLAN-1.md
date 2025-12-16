# Questions - Image Sync & Storage Plan

## Answered Questions

### Q1: Media Watcher - Should it Register Images?

**Answer: B** - Update media watcher to also register images when detected

**Impact:** Added to Phase 2 - media watcher will register images, not just broadcast events.

---

### Q2: Cross-SD Image References

**Answer: B** - Check specified sdId first, then check all other registered SDs as fallback

**Impact:** Phase 1 discovery logic will iterate through all SDs if primary SD doesn't have the image.

---

### Q3: Content-Addressable Hash Format

**Answer: A** - Use full hex string (32 chars, no dashes): `a1b2c3d4e5f67890abcdef1234567890`

**Impact:** Phase 4 will use plain hex format. Phase 1's `isValidImageId` must accept both UUID format (old) and hex format (new).

---

### Q4: Startup Scan - Blocking or Background?

**Answer: B** - Run in background (faster startup, images discovered gradually)

**Impact:** Phase 2 scan will be non-blocking. On-demand discovery (Phase 1) handles images accessed before scan completes.

---

### Q5: Race Condition Protection

**Answer: A** - Just use upsert (database handles duplicates)

**Impact:** Simple implementation - no locking needed. Database's upsert handles concurrent registration attempts.

---

### Q6: Debug/Diagnostic Tooling

**Answer: Storage inspector** enhancement

**Impact:** Added task to enhance storage inspector with image debugging capabilities.

---

## Open Questions

_(None remaining)_

---

## Implementation Notes

### ID Format Validation (Q2 + Q3)

After Phase 4, valid image IDs will be:

- Old format: `a1b2c3d4-e5f6-7890-abcd-ef1234567890` (UUID with dashes, 36 chars)
- New format: `a1b2c3d4e5f67890abcdef1234567890` (hex, 32 chars)

Validation regex:

```typescript
function isValidImageId(id: string): boolean {
  // UUID format (old)
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  // Hex format (new, 32 chars)
  const hexRegex = /^[0-9a-f]{32}$/i;
  return uuidRegex.test(id) || hexRegex.test(id);
}
```

### Cross-SD Discovery (Q2)

When image not found in specified SD:

1. Try specified sdId first
2. If not found, iterate through all other registered SDs
3. If found in different SD, log warning (indicates data inconsistency)
4. Still register in database with the sdId where found

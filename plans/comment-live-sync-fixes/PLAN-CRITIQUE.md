# Plan Critique - Staff Engineer Review

## 1. Ordering Issues

### Problem: Slow Feedback Loop

The current ordering puts CRDT Observers (Phase 1) first. This is the most complex work and hardest to test interactively. Meanwhile, Phases 2 and 3 are quick wins with immediate visible results.

**Recommendation:** Reorder to get visible progress faster:

```
Original:                    Recommended:
1. CRDT Observers           1. Username Fix (quick win)
2. Username Fix             2. Toolbar Button (quick win)
3. Toolbar Button           3. CRDT Observers (core fix)
4. Overlapping Comments     4. Overlapping Comments
5. Race Condition           5. Race Condition
6. Integration              6. Integration
```

**Rationale:**

- Username fix is ~30 minutes of work, immediately verifiable
- Toolbar button is ~1 hour, immediately testable
- CRDT observers require two instances to properly verify
- Quick wins build confidence and reduce risk

### No Circular Dependencies Found

The plan correctly identifies that Phases 1-3 can run in parallel. Phase 4 correctly depends on Phase 1 for sync testing. Phase 5 depends on 1 and 4. No issues here.

---

## 2. Missing Debug Tools

### Problem: No Way to Verify Observers During Development

The plan doesn't include any debugging infrastructure for the observer system. When developing, we need to:

- See when observers fire
- Distinguish local vs remote changes
- Verify broadcasts are sent

**Recommendation:** Add debug logging task to Phase 1:

```
- [ ] 🟥 **1.1.0 Add debug logging infrastructure**
  - Add `DEBUG_COMMENTS` environment variable
  - Log observer events: type, threadId, isRemote
  - Log broadcasts sent
  - Location: packages/desktop/src/main/crdt-comment-observer.ts
```

### Problem: No Way to Simulate Remote Changes

Testing observers requires either:

- Two actual Electron instances (slow, cumbersome)
- A way to inject "remote" CRDT updates in tests

**Recommendation:** Add test helper:

```typescript
// In test setup
function simulateRemoteUpdate(noteDoc: NoteDoc, update: Uint8Array) {
  // Apply update as if it came from another instance
  noteDoc.applyUpdate(update);
}
```

This pattern already exists in `note-doc-comments.test.ts` - just ensure it's documented.

---

## 3. Missing Items

### 3.1 Profile ID Not Fixed

The plan addresses `authorName` and `authorHandle` but the `authorId` is still hardcoded to `'current-user'`:

```typescript
// TipTapEditor.tsx line 1523
authorId: CURRENT_USER_ID,  // Still 'current-user'
```

**Recommendation:** Add to Phase 2:

- Fetch actual `profileId` along with username/handle
- Use it for `authorId` in comment creation

### 3.2 Browser Stub Updates Missing

The web client (`web-client.ts`) and browser stub (`browser-stub.ts`) have placeholder implementations. If we add new APIs, these need updates.

**Recommendation:** Add task:

```
- [ ] 🟥 **2.1.6 Update browser stub for new APIs**
  - Add user:getCurrentProfile to browser-stub.ts
  - Add user:getCurrentProfile to web-client.ts
```

### 3.3 Type Definitions

When adding new IPC handlers and preload APIs, the TypeScript types need updating.

**Recommendation:** Already implicitly covered by preload API task, but make explicit:

```
- [ ] 🟥 **2.1.3b Update electron.d.ts types**
  - Add UserAPI interface
  - Add getCurrentProfile method signature
```

### 3.4 Error Handling / Fallback

What if username fetch fails? Current code will have undefined behavior.

**Recommendation:** Add explicit fallback:

- If username fetch fails, use "Anonymous" or similar
- Log warning but don't break comment creation

---

## 4. Risk Assessment

### Risk 1: Observer Performance (Medium)

**Risk:** Observers fire on every CRDT change, potentially causing excessive broadcasts.

**Mitigation:**

- Debounce broadcasts (e.g., 100ms window)
- Only broadcast if change is meaningful (actual data changed, not just vector clock)

**Recommendation:** Add debouncing task to Phase 1.

### Risk 2: Infinite Loop (High)

**Risk:** Observer fires → broadcast sent → UI reloads → triggers local change → observer fires again

**Mitigation:**

- Track transaction origin (local vs remote)
- Only broadcast for remote changes
- The Y.js transaction origin API supports this

**Recommendation:** Explicitly test for this in 1.1.1:

```
- Test observer doesn't fire for local changes
- Test no infinite loops when UI reacts to broadcast
```

### Risk 3: Memory Leaks (Medium)

**Risk:** Observers not cleaned up when notes unloaded, causing memory growth.

**Mitigation:**

- Store observer references
- Unregister in cleanup method
- Test cleanup behavior

**Recommendation:** Add explicit cleanup test:

```
- [ ] 🟥 **1.2.4 Test observer cleanup**
  - Load note, verify observer registered
  - Unload note, verify observer unregistered
  - Check for dangling references
```

### Risk 4: Race Conditions in React (Low)

**Risk:** Rapid CRDT updates cause React state thrashing.

**Mitigation:**

- React's batching usually handles this
- If needed, use `useSyncExternalStore` for CRDT state

**Recommendation:** Monitor during testing, address if observed.

### Risk 5: Partial CRDT State (Medium)

**Risk:** CRDT updates arrive in chunks during sloppy sync, causing UI to show partial comment data.

**Mitigation:**

- This is inherent to CRDT - the data is eventually consistent
- UI should handle partial data gracefully (missing fields show placeholders)

**Recommendation:** Already covered by sloppy sync tests in Phase 6.

---

## 5. Questions for User

### Q1: Should we fix `authorId` too?

Currently hardcoded to `'current-user'`. Should we use the actual `profileId`?

This affects:

- Comment ownership detection (for edit/delete permissions)
- Display of "your comments" vs "others' comments"

### Q2: Debounce Strategy

For observer broadcasts, what debounce window is acceptable?

- 0ms: Immediate, but risk of hammering UI
- 100ms: Good balance
- 500ms: Noticeable delay

Recommend 100ms.

---

## 6. Revised Phase Order

Based on critique, recommended order:

1. **Phase 1: Quick Wins**
   - 1a: Username Fix (2.1.x tasks)
   - 1b: Toolbar Button (3.x tasks)

2. **Phase 2: CRDT Observers** (original Phase 1)
   - Add debug logging task
   - Add debouncing
   - Add cleanup test

3. **Phase 3: Overlapping Comments** (original Phase 4)

4. **Phase 4: Race Condition** (original Phase 5)

5. **Phase 5: Integration** (original Phase 6)

---

## 7. Summary of Recommended Changes

| Change                                   | Priority | Effort |
| ---------------------------------------- | -------- | ------ |
| Reorder phases (quick wins first)        | High     | None   |
| Add debug logging task                   | Medium   | Low    |
| Fix authorId (use profileId)             | Medium   | Low    |
| Add browser stub updates                 | Low      | Low    |
| Add debounce to observers                | Medium   | Low    |
| Add cleanup test                         | Medium   | Low    |
| Add explicit fallback for username fetch | Low      | Low    |

---

## Next Steps

Please confirm:

1. Reorder to do quick wins first? (Username, Toolbar)
2. Fix `authorId` in addition to username/handle?
3. Debounce window of 100ms acceptable?

Then I'll update PLAN.md with these refinements.

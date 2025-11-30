# Questions: Folder Tree Ordering

These questions need answers before or during implementation.

## Answered

### Q1: Where should folder order be stored?

**Answer:** In the SD data along with other folder metadata (CRDT, syncs across devices).

### Q2: Where should SD order be stored?

**Answer:** In app state (per-device, doesn't sync).

### Q3: When a folder is created, where should it appear?

**Answer:** Inserted alphabetically among existing siblings.

### Q4: When reordering, should we renumber all siblings?

**Answer:** Yes, renumber all siblings to maintain consistent ordering.

### Q5: Case sensitivity for alphabetical sorting?

**Answer:** Case-insensitive.

### Q6: Existing folder migration?

**Question:** Current folders have `order` values based on creation time. After this change, how should they appear?

**Answer:** Option A - Leave as-is. Folders appear in creation order until user manually reorders them. No migration needed.

### Q7: Nested folder ordering scope?

**Question:** When reordering folder A among its siblings, does this only affect folders at the same level with the same parent?

**Answer:** Yes, only siblings under the same parent are affected.

### Q8: Cross-SD folder move ordering?

**Question:** When a folder is moved to a different SD, what order should it receive in the new location?

**Answer:** Insert alphabetically among new siblings.

### Q9: Placeholder visual design?

**Question:** What should the drag-drop insertion indicator look like?

**Answer:** Option A - Horizontal line between items (like Finder).

### Q10: CRDT conflict handling for order field?

**Question:** If two devices reorder simultaneously, CRDT last-write-wins could cause unexpected results.

**Answer:** Accept this limitation (rare edge case, no data loss). No special handling needed.

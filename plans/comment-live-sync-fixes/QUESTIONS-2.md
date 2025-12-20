# Comment Live Sync Fixes - Questions Round 2

## Follow-up on Overlapping Comments Display

### Option A: Single highlight, combined threadIds

**Pros:**

- Cleanest visual appearance - no visual clutter
- Simpler CSS - one highlight style
- Clicking shows both comments (via popup or sidebar)

**Cons:**

- Requires modifying CommentMark to store multiple threadIds (array instead of string)
- Click handling becomes more complex (need UI to choose which thread)
- Harder to visually indicate "there are 2 comments here vs 1"
- More complex merge logic when marks overlap partially

### Option B: Multiple highlight colors/styles

**Pros:**

- Visually obvious when multiple comments exist
- Each thread is independent - simpler data model
- Matches mental model of "separate comments"

**Cons:**

- Can look messy with many overlapping comments
- Need a color palette for differentiation
- What if 5+ people comment on same text? Colors get confusing
- CSS complexity for layered/striped backgrounds

### Option C: Stack marks, picker on click

**Pros:**

- Clean single highlight appearance
- Explicit UI for choosing which comment to view
- Scales to many comments without visual noise

**Cons:**

- Extra click to see specific comment (popup picker)
- Still need to handle the mark storage (multiple threadIds per range)
- Popup picker adds UI complexity

### My Recommendation

Given your answer that "separate visuals" is preferred, I'd suggest a **hybrid of A and B**:

- Each comment thread maintains its own mark (separate `data-thread-id`)
- When marks overlap, they visually stack (both highlights render)
- We use subtle visual differentiation (darker shade for overlaps, or dotted underline for second mark)
- Clicking in overlapped region opens sidebar showing all threads for that position
- The sidebar already shows all threads - users can scroll to find both

This approach:

- Keeps the simple data model (one threadId per mark)
- Shows overlaps are present visually
- Doesn't require complex color management
- Leverages existing sidebar for multi-thread selection

**Sound good?**

---

## Follow-up on Username Display Convention

### What Other Tools Do

| Tool                           | Own Comments     | Others' Comments  |
| ------------------------------ | ---------------- | ----------------- |
| Google Docs                    | Your actual name | Their actual name |
| Microsoft Word (Track Changes) | Your actual name | Their actual name |
| Notion                         | Your actual name | Their actual name |
| Figma                          | Your actual name | Their actual name |
| GitHub PR comments             | Your username    | Their username    |
| Slack                          | Your name        | Their name        |

**Conclusion:** The industry standard is **Option A - always show actual username**. No major collaborative tools use "You" for self-referential comments.

This makes sense because:

1. Comments are persistent artifacts that may be viewed later when context changes
2. "You" is ambiguous in screenshots or when showing to someone else
3. Consistency is clearer - no mental mapping between "You" and actual identity

**Recommendation:** Go with Option A (always actual username).

---

## Answers Confirmed

Based on your responses:

| Question                | Your Answer                                           |
| ----------------------- | ----------------------------------------------------- |
| 1. Toolbar button       | Option C - both buttons                               |
| 2. Overlapping comments | (awaiting confirmation on hybrid approach above)      |
| 3. Race condition       | Two separate threads                                  |
| 4. Username display     | (awaiting confirmation - leaning A based on research) |
| 5. CRDT observers       | Yes, approach is correct                              |
| 6. Multiple marks       | Separate visuals for overlapping                      |
| 7. Testing              | Use existing patterns in codebase                     |

Please confirm:

1. Hybrid approach for overlapping marks (stack visually, sidebar shows all)?
2. Always show actual username (Option A)?

Then I'll proceed to Phase 2 (Plan Creation).

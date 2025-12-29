# Questions - Round 2

## Feedback Received

1. **Window height**: Still scrolls a bit - need ~30px more (half a profile tile)
2. **Border**: Want a visible border around the scrollable profile area
3. **Delete confirmation off-screen**: When scrolled down and clicking delete, the confirmation appears at the top of the scroll area (off-screen)

---

## Questions

### 1. Window Height

Will increase from 460px to 490px (~30px more). Does that sound right?

### 2. Border for Scrollable Area

The profile list already has a border (`1px solid #e5e5e5`). Should the border be:

- **Option A**: On the scrollableMiddle container (wraps both delete confirmation and profile list)
- **Option B**: Keep it just on the profile list as-is, but make it more visible (darker/thicker)

### 3. Delete Confirmation Positioning

When you've scrolled down and click delete, the confirmation shows at the top of the scroll area. Options:

- **Option A**: Make it a centered overlay/modal on top of everything (most common pattern)
- **Option B**: Auto-scroll to top when delete is clicked so the confirmation is visible
- **Option C**: Move the confirmation to the footer area (always visible, but separate from the profile being deleted)
- **Option D**: Show the confirmation inline, right next to/below the profile tile being deleted

I'd recommend **Option A** (overlay modal) - it's the standard UX pattern and ensures the user always sees the confirmation regardless of scroll position.

---

## Answers

1. **Window height**: Yes, increase to 490px ✅
2. **Border**: Option B - keep on profile list, make more visible (changed to `2px solid #ccc`) ✅
3. **Delete confirmation**: Option A - centered overlay modal ✅

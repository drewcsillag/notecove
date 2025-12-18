# Questions - Reduce Tree Vertical Spacing

## Context

The vertical spacing between items in the folder tree is currently controlled by:

1. `py: 0.5` - MUI padding (4px top + 4px bottom = 8px total vertical padding)
2. `minHeight: 32` - Minimum item height of 32px

The actual rendered height includes the padding plus the content (icons, text, badges).

## Questions

1. **Scope**: Should the reduced spacing apply to:
   - All tree items (folders, All Notes, Recently Deleted, SD headers)?
   - Only regular folders (not special items like "All Notes", "Recently Deleted", SD headers)?

All tree items

2. **Precision**: When you say "about half", are you okay with me adjusting both:
   - `py: 0.5` → `py: 0.25` (halves padding from 8px total to 4px total)
   - `minHeight: 32` → `minHeight: 24` (reduces minimum height by 8px)

   Or would you prefer I start with just one adjustment and iterate?

start with one adjustment and iterate

3. **Touch targets**: Smaller items are harder to click/tap. Is this tree primarily used with mouse, or do you need to maintain touch-friendly sizing?

Mouse

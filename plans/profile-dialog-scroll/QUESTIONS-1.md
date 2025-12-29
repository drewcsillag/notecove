# Questions - Profile Dialog Scroll

## Current State Understanding

The profile picker dialog is implemented in:

- **Component**: `packages/desktop/src/renderer/profile-picker/ProfilePicker.tsx`
- **Window config**: `packages/desktop/src/main/profile-picker/index.ts`

Current dialog dimensions:

- Window: 480x400 pixels (non-resizable)
- Container padding: 24px
- Profile list max-height: 200px (already has `overflowY: 'auto'`)

Current profile tile (item) styling:

- Padding: 12px
- Gap between items: 8px
- Contains: profile name, DEV badge (if applicable), "Last used" date, edit/delete buttons

Elements that can scroll off:

- Profile list (already scrollable internally)
- "+ New Profile" button
- "Don't ask again" checkbox (production only)
- Cancel/Launch action buttons

---

## Questions

### 1. Dialog Height Increase

You want the dialog to be "about one profile tile larger." A profile tile is approximately 50-60px tall (12px padding × 2 + content). Should the dialog height increase from 400px to approximately 460px, or do you have a different target?

No, that sounds right.

### 2. Scrollable Profiles Container

You mention the "other buttons scroll off the bottom." Currently the profile list already has `maxHeight: 200px` with scroll. The issue is that when the delete confirmation dialog appears OR when there are many profiles, the entire dialog content overflows.

Should the structure be:

- **Option A**: Fixed header (title, subtitle, dev banner), scrollable middle (profiles + create form), fixed footer (checkbox, action buttons)
- **Option B**: Just increase the profile list's maxHeight to show more profiles while keeping buttons always visible

I'm leaning toward Option A as it makes the Launch/Cancel buttons always visible regardless of how many profiles exist.

Option A

### 3. Profile Tile Size

Separate from the dialog size - do you also want the individual profile tiles themselves to be larger (more padding, bigger text), or is the request purely about making the dialog taller to show more tiles?

It's just about making the dialog taller so it handles multiple profiles easier.

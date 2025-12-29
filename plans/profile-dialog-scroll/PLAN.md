# Profile Dialog Scroll - Implementation Plan

**Overall Progress:** `90%`

## Summary

Make the profile picker dialog taller and restructure it so that:

- Header (title, subtitle, dev banner) stays fixed at top
- Profile list scrolls in the middle
- Footer (new profile button, checkbox, action buttons) stays fixed at bottom

## Tasks

- [x] 🟩 **Step 1: Update dialog window height**
  - Change BrowserWindow height from 400px to 460px in `packages/desktop/src/main/profile-picker/index.ts`

- [x] 🟩 **Step 2: Restructure ProfilePicker layout**
  - [x] 🟩 Add wrapper styles for fixed header, scrollable middle, fixed footer
  - [x] 🟩 Move title, subtitle, dev banner into header section
  - [x] 🟩 Keep profile list in scrollable middle section (removed maxHeight, parent handles scroll)
  - [x] 🟩 Move create form, checkbox, and action buttons into footer section
  - [x] 🟩 Delete confirmation dialog is in scrollable area (scrolls with profile list)

- [x] 🟩 **Step 3: Test the changes**
  - [x] 🟩 Verify existing ProfilePicker tests still pass (6/6 passing)
  - [ ] 🟨 Manual verification with multiple profiles (pending user testing)

- [ ] 🟥 **Step 4: Run CI and commit**
  - [ ] 🟥 Run ci-local
  - [ ] 🟥 Commit changes

## TDD Note

This is a pure CSS/layout restructure with no behavior changes. TDD doesn't apply because:

- No new functionality is being added
- No bugs are being fixed
- Existing unit tests verify selection behavior (unchanged)
- E2E tests (`profile-picker.spec.ts`) will catch layout regressions

## Files to Modify

1. `packages/desktop/src/main/profile-picker/index.ts` - Window height
2. `packages/desktop/src/renderer/profile-picker/ProfilePicker.tsx` - Layout restructure

## Design Notes

### New Layout Structure

```
┌─────────────────────────────┐
│ HEADER (fixed)              │
│ - Title: "Select Profile"   │
│ - Dev banner (if dev build) │
│ - Subtitle                  │
├─────────────────────────────┤
│ SCROLLABLE MIDDLE           │
│ - Delete confirmation       │
│ - Profile list              │
│   ├─ Profile tile 1         │
│   ├─ Profile tile 2         │
│   └─ ...                    │
├─────────────────────────────┤
│ FOOTER (fixed)              │
│ - + New Profile button/form │
│ - "Don't ask again" checkbox│
│ - Cancel / Launch buttons   │
└─────────────────────────────┘
```

### Height Calculation

- Window: 460px (was 400px, +60px for ~1 tile)
- Container padding: 24px top + 24px bottom = 48px
- Header: ~80px (title + subtitle + optional dev banner)
- Footer: ~120px (create button + checkbox + actions with gaps)
- Scrollable area: 460 - 48 - 80 - 120 = ~212px (similar to current 200px maxHeight, but now properly structured)

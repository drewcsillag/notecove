# Visible Scrollbar Feature - Implementation Plan

**Overall Progress:** `100%`

## Summary

Add always-visible scrollbars styled to look native (macOS-like) across all scrollable areas in the app. Scrollbars will adapt to light/dark theme.

## Design Decisions

- **Scope**: All scrollable areas (editor, notes list, folder panel, etc.)
- **Style**: Native macOS-like appearance (rounded thumb, subtle track)
- **Theme**: Adaptive colors for light/dark mode
- **Width**: Sensible default (~8px - balanced visibility and footprint)
- **Code blocks**: Included (global styling applies everywhere)

See [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) for code block decision rationale.

## Tasks

- [x] 🟩 **Step 1: Write tests for scrollbar styling**
  - [x] 🟩 Add test verifying scrollbar CSS is applied via theme
  - [x] 🟩 Add test for light mode scrollbar colors
  - [x] 🟩 Add test for dark mode scrollbar colors

- [x] 🟩 **Step 2: Add scrollbar styles to theme.ts**
  - [x] 🟩 Define scrollbar CSS in MuiCssBaseline styleOverrides
  - [x] 🟩 Implement light mode scrollbar colors (gray track, darker thumb)
  - [x] 🟩 Implement dark mode scrollbar colors (darker track, lighter thumb)
  - [x] 🟩 Use `::-webkit-scrollbar` pseudo-elements for Electron/Chromium

- [ ] 🟨 **Step 3: Manual verification** (for user to verify)
  - [ ] 🟥 Test scrollbar visibility in editor panel with long note
  - [ ] 🟥 Test scrollbar visibility in notes list with many notes
  - [ ] 🟥 Test scrollbar visibility in folder panel with many folders
  - [ ] 🟥 Verify light/dark mode switching updates scrollbar colors

**CI Status:** All tests passed (360 E2E + unit tests)

## Technical Approach

The implementation will add global scrollbar styles via Material-UI's `MuiCssBaseline` component in `theme.ts`. This ensures all scrollable areas automatically get the styling without modifying individual components.

```tsx
// Example structure (not final code)
MuiCssBaseline: {
  styleOverrides: {
    // Global scrollbar styles using ::-webkit-scrollbar
  }
}
```

### Color Palette (tentative)

**Light mode:**

- Track: `rgba(0, 0, 0, 0.05)` (very subtle)
- Thumb: `rgba(0, 0, 0, 0.3)`
- Thumb hover: `rgba(0, 0, 0, 0.5)`

**Dark mode:**

- Track: `rgba(255, 255, 255, 0.05)`
- Thumb: `rgba(255, 255, 255, 0.3)`
- Thumb hover: `rgba(255, 255, 255, 0.5)`

## Files to Modify

1. `packages/desktop/src/renderer/src/theme.ts` - Add scrollbar styles
2. `packages/desktop/src/renderer/src/__tests__/theme.test.ts` - Add tests

## Risks & Mitigations

| Risk                                                    | Mitigation                                                     |
| ------------------------------------------------------- | -------------------------------------------------------------- |
| Scrollbar styling may not work in all Electron versions | Electron uses Chromium which supports `::-webkit-scrollbar`    |
| Colors may not look right                               | Use subtle, native-like colors; adjust based on manual testing |

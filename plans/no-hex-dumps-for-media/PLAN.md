# Feature: No Hex Dumps for Media Items

**Overall Progress:** `100%`

## Summary

Hide the hex viewer for file types that already have meaningful previews:

- `image` - Already has `ImagePreview`
- `activity` - Already has `TextPreview`
- `profile` - Already has `TextPreview`
- `identity` - Already has `TextPreview`

The hex viewer should still show for:

- `crdtlog` - Binary format, hex is useful for debugging
- `snapshot` - Binary format, hex is useful for debugging
- `unknown` - No other preview available
- Any unrecognized type - Safe fallback for debugging

## Tasks

- [x] 🟩 **Step 1: Create helper function and unit tests**
  - [x] 🟩 Create `shouldShowHexViewer(fileType: string): boolean` as pure function
  - [x] 🟩 Write unit tests for the helper function covering all file types
  - [x] 🟩 Run tests to confirm they fail (TDD red phase)

- [x] 🟩 **Step 2: Implement conditional hex viewer rendering**
  - [x] 🟩 Use the helper function to conditionally render HexViewer
  - [x] 🟩 Run tests to confirm they pass (TDD green phase)

- [x] 🟩 **Step 3: CI and verification**
  - [x] 🟩 Fixed unrelated E2E test (Cmd+K in existing link)
  - [x] 🟩 Run full CI - all tests pass

## File Changes

| File                                                                                                  | Change                                                                      |
| ----------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `packages/desktop/src/renderer/src/components/StorageInspector/StorageInspectorWindow.tsx`            | Added `shouldShowHexViewer()` helper and conditional rendering              |
| `packages/desktop/src/renderer/src/components/StorageInspector/__tests__/shouldShowHexViewer.test.ts` | Unit tests for the helper function (9 tests)                                |
| `packages/desktop/e2e/web-links.spec.ts`                                                              | Fixed flaky test - use keyboard navigation instead of clicking link element |

## Design Decisions

1. **Pure function helper**: `shouldShowHexViewer()` is a pure function with no dependencies - trivial to test
2. **Blocklist approach**: Uses a set of types that DON'T show hex (image, activity, profile, identity, directory) - any new/unrecognized type defaults to showing hex as a safe fallback for debugging
3. **No full UI test**: Full component testing would require heavy mocking for minimal value; unit test + manual verification is sufficient for this scope
4. **Helper in same file**: Keep it simple - can extract to utils later if needed elsewhere

## Implementation Notes

- Changed from allowlist to blocklist approach during implementation
- The blocklist is safer: any unrecognized file type will show hex as a debugging fallback
- 9 unit tests covering all file types and edge cases
- Fixed unrelated E2E test that was failing due to cursor positioning issue when clicking on link elements

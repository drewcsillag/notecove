# Feature: Add Plain Text Option to Code Block Language Selector

**Overall Progress:** `80%`

## Summary

Add "Plain Text" as an option in the code block language dropdown, positioned at the top after "Auto-detect". Also alphabetize the remaining languages by display name.

## Decisions

- Display name: "Plain Text"
- Internal language name: `plaintext` (standard lowlight/highlight.js name)
- Position: First in list (after Auto-detect), remaining languages alphabetized by display name

## Tasks (TDD Order)

- [x] 🟩 **Step 1: Write/Update Tests First**
  - [x] 🟩 Add test in CodeBlockLowlight.test.ts: `SUPPORTED_LANGUAGES` contains `'plaintext'`
  - [x] 🟩 Add test in CodeBlockComponent.test.tsx: "Plain Text" option appears in dropdown

- [x] 🟩 **Step 2: Update CodeBlockLowlight.ts**
  - [x] 🟩 Add `'plaintext'` to `SUPPORTED_LANGUAGES` array

- [x] 🟩 **Step 3: Update CodeBlockComponent.tsx**
  - [x] 🟩 Add `plaintext: 'Plain Text'` to `LANGUAGE_DISPLAY_NAMES`
  - [x] 🟩 Modify the dropdown rendering to:
    1. Render "Plain Text" first (if in list)
    2. Render remaining languages sorted alphabetically by display name

- [x] 🟩 **Step 4: Run Tests and Verify**
  - [x] 🟩 Run targeted tests for CodeBlockLowlight and CodeBlockComponent
  - [ ] 🟥 Manual verification: dropdown shows Plain Text first, rest alphabetized

- [ ] 🟨 **Step 5: Run CI and Commit**
  - [ ] 🟥 Run ci-runner
  - [ ] 🟥 Commit changes

## Files to Modify

1. `packages/desktop/src/renderer/src/components/EditorPanel/extensions/__tests__/CodeBlockLowlight.test.ts`
2. `packages/desktop/src/renderer/src/components/EditorPanel/__tests__/CodeBlockComponent.test.tsx`
3. `packages/desktop/src/renderer/src/components/EditorPanel/extensions/CodeBlockLowlight.ts`
4. `packages/desktop/src/renderer/src/components/EditorPanel/CodeBlockComponent.tsx`

## Implementation Notes

Current dropdown rendering (CodeBlockComponent.tsx:263-267):

```tsx
{
  SUPPORTED_LANGUAGES.map((lang) => (
    <MenuItem key={lang} value={lang}>
      {LANGUAGE_DISPLAY_NAMES[lang] ?? lang}
    </MenuItem>
  ));
}
```

Needs to change to sort by display name with plaintext first.

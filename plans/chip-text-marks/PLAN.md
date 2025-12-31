# Feature: Text Marks on Date and Mention Chips

**Overall Progress:** `100%`

**Original Prompt:** [PROMPT.md](./PROMPT.md)
**Questions:** [QUESTIONS-1.md](./QUESTIONS-1.md)

## Summary

Allow bold, italic, underline, and strikethrough marks to apply to date chips and mention chips. The chip styling is preserved, with text formatting showing through.

## Technical Approach

### Date Chips (Decoration-based)

- Already works at the document level - text can have marks, decorations render on top
- Need CSS updates to inherit mark styles through the `.date-chip` class
- No schema changes needed

### Mention Chips (Atomic Node)

- **Discovery**: TipTap inline nodes accept marks by default (no schema change needed!)
- Keep `atom: true` for selection behavior
- CSS updates to inherit mark styles through `.mention-chip` class

## Tasks

- [x] 🟩 **Step 1: Add tests for mark behavior on chips**
  - [x] 🟩 Create new integration test file for date chip marks (separate from existing utility tests)
  - [x] 🟩 Write test: date text with bold mark still gets date-chip decoration
  - [x] 🟩 Write test: date text with italic/underline/strike marks still gets decoration
  - [x] 🟩 Create new test file for MentionNode marks
  - [x] 🟩 Write test: mention node accepts bold/italic/underline/strike marks
  - [x] 🟩 Write test: marks can be toggled on/off for mention nodes

- [x] 🟩 **Step 2: Update MentionNode to accept marks**
  - [x] 🟩 ~~Add `marks: 'bold italic underline strike'` to MentionNode spec~~ (Not needed - already works by default!)
  - [x] 🟩 Verified tests pass

- [x] 🟩 **Step 3: Update CSS to show marks through chip styling**
  - [x] 🟩 Update `.date-chip` to inherit font-weight, font-style, text-decoration
  - [x] 🟩 Update `.mention-chip` to inherit font-weight, font-style, text-decoration
  - [x] 🟩 Update print preview `.date-chip` styles
  - [x] 🟩 Verified tests pass (25 tests)

- [x] 🟩 **Step 4: Manual verification and edge cases**
  - [x] 🟩 Test applying marks to date chips in editor (automated)
  - [x] 🟩 Test applying marks to mention chips in editor (automated)
  - [x] 🟩 Test combined marks (bold + italic) (automated)
  - [x] 🟩 Test marks on chips inside lists, headings, quotes (automated)

- [x] 🟩 **Step 5: Run CI and finalize**
  - [x] 🟩 Run full CI (format, lint, typecheck, test)
  - [x] 🟩 Fixed lint errors in test files
  - [x] 🟩 Fixed pre-existing lint error in CutLine.ts
  - [x] 🟩 All 2386 tests pass

## Deferred Items

- None

## Notes

- Marks are stripped on markdown export (per user decision)
- Mention chips remain atomic (can't place cursor inside)
- Updated print preview styles for consistency

## Implementation Notes

### Files Changed

- `tipTapEditorStyles.ts` - Updated `.date-chip` and `.mention-chip` to use `inherit` for font-weight, font-style, text-decoration
- `PrintPreviewWindow.tsx` - Updated `.date-chip` print styles to use `inherit`
- `CutLine.ts` - Fixed pre-existing lint error (unnecessary conditional)

### Files Added

- `DateChipMarks.test.ts` - 11 tests for date chip mark behavior
- `MentionNodeMarks.test.ts` - 9 tests for mention node mark behavior

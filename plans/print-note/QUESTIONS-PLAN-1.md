# Plan Critique Questions

## 1. Print Preview Flow Clarification

The plan has a "PrintPreviewDialog" (1.3) before the print preview window. But you said you want print preview first (Option B).

**Question**: Should the flow be:

- **Option A**: Cmd-P → Print Preview Window opens (with resolved comments toggle inside it) → Click Print
- **Option B**: Cmd-P → Small dialog asking about resolved comments → Print Preview Window opens → Click Print

A

## 2. Task Items (Checkboxes)

The app has tri-state task items (unchecked, checked, cancelled). I didn't include these in the plan.

**Question**: How should task items appear in print?

- **Option A**: Show checkbox symbols (☐ ☑ ☒) matching their state
- **Option B**: Show as bullet points (ignore checkbox state)

A

## 3. Hashtags

Notes can contain #hashtags with special styling.

**Question**: Should hashtags in print:

- **Option A**: Keep their colored styling
- **Option B**: Appear as plain text

A

## 4. Code Syntax Highlighting

Code blocks have syntax highlighting with colors.

**Question**: Should code blocks in print:

- **Option A**: Preserve syntax highlighting colors
- **Option B**: Print as monospace plain text (no colors)

A

Also make sure to update the feature documentation in the website to add the ability to print

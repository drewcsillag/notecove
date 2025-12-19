# Questions: Date & Mention Chips

## Date Chips

### Q1: Date Keywords
Should `@today` also be supported, or just `@yesterday`, `@tomorrow`, and `@date`?

Yes, great catch!

### Q2: Date Format Output
You mentioned `YYYY-MM-DD` format. Should this be:
- **A)** Plain text that gets inserted (like `2025-12-19`)
- **B)** A styled chip/badge that displays the date visually (similar to how Google Docs shows it)

If B, should it be editable after insertion or treated as an atomic unit?

B, yes -- it should pop up the date picker

### Q3: Date Picker for `@date`
For the date picker:
- **A)** Use MUI's DatePicker (already have MUI in project)
- **B)** A simple custom calendar dropdown
- **C)** Other preference?

A

### Q4: Relative Dates Display
When a user inserts `@yesterday`, should it:
- **A)** Insert the absolute date (`2025-12-18`) and stay fixed forever
- **B)** Insert a "relative date" chip that always shows "yesterday" but resolves to the date when it was inserted
- **C)** Something else?

A
---

## Mention Chips

### Q5: Search Behavior
The profile system has both `handle` (e.g., `@drew`) and `username` (e.g., `Drew Colthorp`). When user types `@dr`, should autocomplete search:
- **A)** Both handle and username simultaneously
- **B)** Handle only
- **C)** Username only

A

### Q6: Display Format
When a mention is inserted, what should appear in the document:
- **A)** Just the handle as text (`@drew`)
- **B)** A styled chip showing the display name (`Drew Colthorp`)
- **C)** A styled chip showing the handle (`@drew`)
- **D)** Both name and handle in some format

B
### Q7: Mention Interactivity
Should mention chips be clickable? If so, what action:
- **A)** No click action (just visual indicator)
- **B)** Show a popover with profile info
- **C)** Filter to show notes edited by that person
- **D)** Other?

B, and option for C

### Q8: Users Without Handles
What should happen for profiles that don't have a `@handle` set?
- **A)** Don't show them in autocomplete
- **B)** Show them using their username as the handle
- **C)** Show them but mark as "no handle set"

A

### Q9: Current User
Should the current user appear in the autocomplete list? (Currently the handler includes them)
yes

---

## Combined Behavior

### Q10: Trigger Disambiguation
When user types `@`, what should appear:
- **A)** Combined list: date keywords at top, then users below
- **B)** Just users; date keywords only appear when typing matches (e.g., `@yes` shows `@yesterday`)
- **C)** Separate triggers entirely (e.g., `@` for mentions, `@@` or `/date` for dates)

A

### Q11: Visual Differentiation
Should date chips and mention chips have different visual styling (colors, icons)?

No
---

## Technical

### Q12: Persistence Format
How should these be stored in the document (affects sync, search, future features)?
- **A)** As plain text (`2025-12-19` or `@drew`)
- **B)** As styled marks on text (like links)
- **C)** As atomic inline nodes (like embedded objects)

Option C gives most flexibility but is more complex. Option A is simplest but loses semantic meaning.

I'm not entirely sure. I do want it so if I use the find features (either cmd-f or cmd-shift-f) and type the name that it will find them. And for user chips I can find by either `@user` or their profile user name.


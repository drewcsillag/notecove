# Print Note Feature - Questions

## 1. Video/Rich Embeds in Print

The app supports video embeds (YouTube, Vimeo) and rich HTML embeds. These won't work in print.

**Question**: How should video/rich embeds appear in the printout?

- **Option A**: Show the thumbnail with title/provider as a static card (current unfurl card appearance)
- **Option B**: Show just the URL as a link
- **Option C**: Hide them entirely

A

## 2. Inter-Note Links

Notes can link to other notes using `[[note-id]]` syntax (rendered as clickable chips).

**Question**: How should inter-note links appear in print?

- **Option A**: Show as "Note Title" (just the title text)
- **Option B**: Show as a styled chip matching screen appearance
- **Option C**: Omit them entirely

B

## 3. Comments with Replies

Comment threads can have multiple replies.

**Question**: Should replies be included in the printed comments section?

- **Option A**: Include all replies under each comment thread
- **Option B**: Only include the original comment (no replies)

A

## 4. Resolved Comments

Some comment threads may be marked as "resolved."

**Question**: Should resolved comments be included in print?

- **Option A**: Include all comments (both resolved and unresolved)
- **Option B**: Only include unresolved comments
- **Option C**: Include resolved comments but mark them as "(Resolved)"

Give as option in a dialog

## 5. Print Trigger Location

You mentioned Cmd/Ctrl-P as the shortcut.

**Question**: Should this work only when a note is open in the editor, or from anywhere (e.g., from the notes list)?

right now only when a note is open in the editor

## 6. Print Header

**Question**: Should the printout include a header with the note title and/or other metadata (e.g., creation date, last modified)?

- **Option A**: Note title only as a header
- **Option B**: Note title + last modified date
- **Option C**: No header (just start with content)

C

## 7. Images

Notes can contain embedded images.

**Question**: Should images:

- **Option A**: Be printed at their current display size
- **Option B**: Be scaled to fit page width when needed
- **Option C**: Be given a configurable maximum size

A, but B when needed

## 8. @Mentions in Comments

Comments can contain @mentions (e.g., `@username`).

**Question**: How should @mentions in comments appear?

- **Option A**: As "@username" (plain text with @ prefix)
- **Option B**: As styled chips matching screen appearance
- **Option C**: As "Username" (no @ prefix)

B

## 9. Print Dialog

**Question**: Should the print functionality:

- **Option A**: Use the system print dialog (native OS dialog)
- **Option B**: Open a print preview first, then allow printing
- **Option C**: Just send directly to default printer with no dialog

B

## 10. Dark Mode Content

The app supports dark mode. The editor content may have styling that assumes a dark background.

**Question**: Should printed content:

- **Option A**: Always use light-mode styling (white background, dark text) regardless of current theme
- **Option B**: Match current theme (which could mean dark background on print)

A

Also not mentioned but regular text should be 11pt in print size.

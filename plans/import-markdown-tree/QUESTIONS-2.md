# Follow-up Questions

## Import Options Dialog

Since we have multiple options for the import:

1. Preserve folder hierarchy vs. flatten into single folder
2. Optionally create a container folder named after the imported directory
3. Pick target folder in NoteCove

**Q14**: Should these options be presented in a **dialog before import starts**?

Something like:

```
┌─────────────────────────────────────────────────┐
│  Import Markdown                                │
├─────────────────────────────────────────────────┤
│  Source: /Users/me/docs/                        │
│          (15 markdown files found)              │
│                                                 │
│  Import into: [All Notes ▼]                     │
│                                                 │
│  ☑ Preserve folder structure                    │
│  ☐ Create "docs" folder for imported files      │
│                                                 │
│           [Cancel]  [Import]                    │
└─────────────────────────────────────────────────┘
```

Or would you prefer a simpler approach (e.g., just folder picker, always preserve structure)?

I think the dialog looks great! Just make sure if it's not as a separate window, that it shows up in the currently focused window. There are things like the about dialog which seem to show up in a random window if there is more than one.

## Inter-note Link Resolution

You mentioned the circular reference wrinkle. My planned approach:

**Two-pass import:**

1. **Pass 1**: Create all notes first, build a map of `original-path → note-id`
2. **Pass 2**: Update all inter-note links using the map

This handles circular references naturally since all notes exist before links are resolved.

**Q15**: Does this approach sound reasonable?

That sounds reasonable!

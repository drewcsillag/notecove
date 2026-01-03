# Plan Review Questions

## Performance

**Question P1**: Activity logs can have up to 1000 entries. For the parsed table view:
- **(A)** Show all entries (simple, might be slow for large logs)
- **(B)** Paginate (show 50 at a time with next/prev)
- **(C)** Virtualize the list (only render visible rows)

C

## Error Handling

**Question P2**: If an activity log line is malformed (wrong number of fields, etc.):
- **(A)** Skip the line and show others
- **(B)** Show error indicator inline for that row
- **(C)** Fall back to raw view for the whole file

C

**Question P3**: If a profile JSON file doesn't exist or is malformed:
- **(A)** Show "Profile not found" or "Invalid profile" in tooltip
- **(B)** Just don't show tooltip (silent failure)

A

## Clipboard Feedback

**Question P4**: For "copy to clipboard" success feedback:
- **(A)** Brief tooltip change (e.g., "Copied!")
- **(B)** Snackbar/toast notification
- **(C)** Just rely on the icon changing briefly

A
## Cross-SD Notes

**Question P5**: If inspecting SD "A" and the activity log references a note that exists only in SD "B":
- **(A)** Only look up notes in the currently inspected SD
- **(B)** Look up notes across all SDs (more useful but more complex)

B

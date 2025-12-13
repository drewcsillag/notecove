# Storage Inspector - Questions Round 2

## Follow-up Questions

### 10. Media File Inspection

**Q10:** For media files (images), should the inspector:

- (A) Show image preview + metadata (dimensions, file size, format)
- (B) Show hex dump of image data (probably not useful)
- (C) Just list them with metadata, no preview

A

### 11. Hex Highlight Interaction

**Q11:** When clicking a record/field in the structure view to highlight bytes in the hex view:

- Should clicking bytes in the hex view also highlight the corresponding field in the structure view (bidirectional)?
  yes
- Should there be different colors for different field types (e.g., blue for headers, green for timestamps, yellow for data)?
  yes

### 12. Initial SD Selection

**Q12:** When opening the inspector, should it:

- (A) Show a dialog to pick which SD to inspect
- (B) Default to the currently active SD (where the selected note lives)
- (C) Show all registered SDs in a dropdown/tree

A

### 13. Copy/Export

**Q13:** Should there be options to:

- Copy hex selection to clipboard?
  yes
- Copy parsed structure as JSON?
  yes
- Export raw binary file?
  yes

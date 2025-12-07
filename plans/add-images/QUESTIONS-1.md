# Questions for Image Support Feature

Based on my analysis of the NoteCove codebase, I need clarification on the following items before creating an implementation plan.

## 1. Image Storage Architecture

The most fundamental architectural decision is how images are stored. There are two main approaches:

**Option A: Embedded in CRDT (Base64)**

- Pros: Self-contained sync (images travel with note content), simpler architecture
- Cons: Larger CRDT files, slower sync, potential memory issues with many/large images

**Option B: External File References**

- Pros: Efficient CRDT size, faster sync for text-only changes
- Cons: More complex sync (file + CRDT must sync), potential for orphaned images or missing files, cleanup complexity

**Option C: Hybrid**

- Small images (<X KB) embedded, large images external

**Question:** Which approach do you prefer? Or should I propose what I think is best?

What do you think and why? I have an idea, but curious to see if your thinking agrees.

**Answer:** Option B (External File References) chosen. Rationale:

- Images can be large; embedding would balloon CRDT sizes
- Thumbnails require external storage anyway
- Shared media folder enables image reuse
- File-based sync already handles large files well
- Broken placeholder with auto-update handles sync delays gracefully

---

## 2. Where Should Image Files Live? (If using external storage)

Current note structure:

```
sync-directory/
├── notes/
│   └── {note-id}/
│       ├── updates/     # CRDT files
│       ├── meta/
│       └── logs/
```

Options:

- **A)** `notes/{note-id}/attachments/` (per-note)
- **B)** `media/{image-id}` (shared across all notes)
- **C)** `notes/{note-id}/media/` (per-note, different name)

**Question:** Preference for image file location?

## B

## 3. Supported Image Formats

Which formats should be supported?

- [x] PNG (lossless, screenshots)
- [x] JPEG (photos)
- [x] GIF (including animated?)
- [x] WebP (modern, good compression)
- [x] SVG (vector graphics)
- [x] HEIC (iOS native format)

**Question:** Which formats to support?

## basically all of them.

## 4. Image Insertion Methods

How should users be able to add images?

- [ ] **Paste from clipboard** (Cmd+V with image on clipboard)
- [ ] **Drag and drop** from Finder/Explorer
- [ ] **File picker dialog** (button in toolbar)
- [ ] **Markdown syntax** (`![alt](url)` auto-linkified like web links)
- [ ] **Screenshot capture** (system screenshot → paste)

**Question:** Which methods should be supported initially? All of them?

## All

## 5. Image Size Limits and Optimization

- Should there be a **maximum file size limit**? (e.g., 10MB, 20MB, no limit?)
- Should large images be **automatically resized/compressed**?
- Should we generate **thumbnails** for performance?

**Question:** Any size constraints or optimization requirements?

## There shouldn't be a limit -- maybe later we'll have a setting that users can set if they want to, but notecove itself shouldn't. But yes, thumbnails for performance makes a lot of sense.

## 6. Image Display and Interaction

How should images behave in the editor?

**Display options:**

- [x] Full-width (block element)
- [x] Inline with text
- [x] User-resizable
- [x] Fixed sizes (small/medium/large)

**Interaction:**

- [x] Click to enlarge/lightbox
- [x] Right-click context menu (copy, save as, etc.)
- [x] Double-click to open in external app

**Question:** What display and interaction behaviors do you want?
All of the above

---

## 7. Image Metadata and Accessibility

- [x] **Alt text** for accessibility (optional or required?)
- [x] **Captions** below images?
- [x] **Alignment** (left/center/right)?
- [x] **Link wrapping** (click image to go to URL)?

**Question:** Which metadata features should images support?
all of them

---

## 8. iOS Compatibility

The codebase shows iOS is planned. For images:

- Should image feature work identically on iOS from the start?
- iOS-specific considerations: photo library access, HEIC format, camera roll?

**Question:** Is iOS compatibility a requirement for this feature now, or can it be deferred?

## If there are things that ios compatibility would limit or issues there, I would like to know, so I can reevaluate any choices. Same for android

## 9. Sync and Conflict Handling (If using external files)

When images are stored as separate files:

- What happens if an image file is missing on another device during sync?
- Should we show a broken-image placeholder?
- How should we handle image file conflicts?

**Question:** What behavior do you expect for sync edge cases?
show broken-image placeholder -- if the image shows up, it should be updated ideally.

---

## 10. Orphan Image Cleanup

If a user deletes an image from a note, what should happen to the file?

- [ ] Immediate deletion
- [ ] Delayed cleanup (like recently deleted notes - 30 days?)
- [ ] Manual cleanup only
- [ ] Keep forever (let sync directory cleanup handle it)

**Question:** What's the cleanup strategy for unreferenced images?

If we have images that are shared between notes, with sloppy sync, reference counting could be ... interesting... give me pros & cons and a suggestion

**Answer:** Mark-and-sweep with 14-day grace period chosen. Rationale:

- No real-time reference counting needed (complex with CRDTs)
- Sync-safe: new images won't be deleted (they're recent)
- Undo-safe: recently deleted references still have their images
- Automatic: runs as part of existing background tasks
- Simple: no distributed coordination needed

---

## 11. Copy/Paste Between Notes

When a user copies content with an image from one note to another:

- Should the image be duplicated (new file copy)?
- Should it reference the same file?
- What if copying across different sync directories?

**Question:** How should image copy/paste work?

reference the same file
if copied across sync directories, should copy the image, as other viewers of that sync directory don't necessarily have access to the source sync directory

---

## 12. Export Considerations

When exporting notes to Markdown/HTML:

- Should images be embedded (base64 in Markdown/HTML)?
- Should images be copied to an adjacent folder?
- Should they become URLs (if we ever have a web sharing feature)?

**Question:** How should images be handled in export?

copied to adjacent folder.
What do you mean re: becoming URLs?

---

## 13. Toolbar UI

Should there be a dedicated image button in the editor toolbar?

Current toolbar has: Bold, Italic, Underline, Code, Lists, Link

**Question:** Should I add an image button to the toolbar? Where (icon preference)?
yes - between the horizontal rule and undo/redo

---

## 14. Animated GIFs

**Question:** Should animated GIFs animate in the editor, or only in lightbox?

**Answer:** Animate in editor.

---

## 15. Future Media Types

**Question:** Should the architecture accommodate video/audio later?

**Answer:** Yes, design for extensibility.

---

## 16. Large File Warning

**Question:** Should we warn users when inserting very large images?

**Answer:** Soft warning at 10MB, threshold should be configurable in settings.

---

## 17. Web Paste Behavior

**Question:** When pasting HTML content from web pages containing `<img src="https://...">`, what should happen?

Options:

- **A) Download**: Fetch remote image, save locally, insert local reference
- **B) Strip**: Just paste text, ignore remote images
- **C) Keep URL**: Store as external URL reference (won't sync)

**Answer:** Option A (Download). Remote images are downloaded via main process (to avoid CORS), saved to local `media/` folder, and inserted as local image nodes. This ensures images sync properly across devices.

---

## Summary of Decisions

| Question             | Decision                                     |
| -------------------- | -------------------------------------------- |
| Storage architecture | External file references                     |
| File location        | `media/{image-id}` (shared)                  |
| Formats              | All (PNG, JPEG, GIF, WebP, SVG, HEIC)        |
| Insertion methods    | All (paste, drag-drop, picker, markdown)     |
| Display modes        | Block and inline, user-resizable             |
| Interactions         | Lightbox, context menu, external open        |
| Metadata             | Alt text, captions, alignment, link wrapping |
| Cleanup              | Mark-and-sweep with 14-day grace period      |
| Cross-SD copy        | Copy image file to target SD                 |
| Export               | Adjacent folder with relative paths          |
| Animated GIFs        | Animate in editor                            |
| Future media         | Design for extensibility                     |
| Large file warning   | 10MB soft warning, configurable              |
| Web paste            | Download remote images locally               |

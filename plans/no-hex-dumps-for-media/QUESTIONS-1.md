# Questions: No Hex Dumps for Media Items

## Analysis Summary

The storage inspector currently shows hex dumps for **all** file types, including images. The code in `StorageInspectorWindow.tsx` at lines 542-559 unconditionally renders the `HexViewer` component for any selected file.

For images, this means users see:

1. File metadata (type, size, modified date, path)
2. Image preview via `ImagePreview` component
3. Hex dump (unnecessary for images - just shows binary noise)

## Questions

### 1. Scope of "media items"

Currently the storage inspector detects file type `'image'` for files in `media/` with extensions: png, jpg, jpeg, gif, webp, svg, heic.

Should we hide hex dumps for:

- **A) Only images** (the `'image'` file type) - This is what the task description says
- **B) All non-essential previews** - e.g., also hide hex for `'activity'`, `'profile'`, `'identity'` which already have `TextPreview`?

I'm assuming **A** unless you specify otherwise.

B

### 2. Future-proofing for other media types

If we later add support for audio or video files, should the solution be:

- **A) Specific to images** - check `fileData.type === 'image'`
- **B) Category-based** - have a list of "media types" that skip hex display

I'm assuming **A** for now since audio/video aren't currently supported.

A. PDFs, or movies (e.g. mpeg) would be similar - I wouldn't want hex dumps of them

### 3. Optional toggle?

Should there be a way to show the hex dump for images if the user explicitly wants it (e.g., a "Show raw hex" toggle)?

I'm assuming **no toggle needed** - if someone really needs to see the hex, they can use the "Export file" button and open in a hex editor.

No, if they want to hex dump it, xxd is there for them in the shell.

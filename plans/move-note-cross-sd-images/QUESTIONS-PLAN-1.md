# Plan Critique Questions

## Q1: Orphaned Images After Failed Move

If we copy images to target SD, then the note move fails (e.g., disk error), the images remain in target SD as "orphans". They'll be cleaned up by the ImageCleanupManager after the 14-day grace period.

**Is this acceptable?** (I think yes - orphaned images are harmless and get cleaned up eventually)

Your answer:

## yes

## Q2: Discovery Scope for Thumbnails

Should the `thumbnail:get` handler also have cross-SD discovery? If a note was moved and we need to generate a thumbnail, we need the source image.

Current plan only lists: `getDataUrl`, `getPath`, `exists`

**Should we add thumbnail discovery?** (I think yes for consistency)

Your answer:
yes

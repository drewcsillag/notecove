# Manual Utilities

This directory contains manual utility scripts for debugging and inspecting NoteCove data.

## Available Utilities

### event-log.ts

Event logging utility for recording operations during debugging.

### extract-pack.ts

Utility for extracting and inspecting pack file contents (old `.pack.yjson` format).

### extract-snapshot.ts

Utility for extracting and inspecting snapshot file contents (old `.snapshot.yjson` format).

### timeline-visualizer.ts

Generates ASCII and HTML timelines for visualizing edit history.

## Usage

Build the shared package first:

```bash
cd packages/shared
pnpm build
```

Then run utilities via Node:

```bash
NODE_ENV=test node packages/shared/dist/esm/__manual__/<utility>.js
```

## Notes

- These are manual debugging utilities, not automated tests
- Some utilities work with the old storage format and may be deprecated
- For the new append-only log format (`.crdtlog`), use the storage module directly

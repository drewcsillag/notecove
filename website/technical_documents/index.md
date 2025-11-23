# Technical Documents

Detailed technical documentation for NoteCove developers and contributors.

## Storage System

- [Storage Format Design](./STORAGE-FORMAT-DESIGN) - Authoritative specification for the CRDT-based storage format, including binary file formats, sync behavior, and database schema
- [Storage Supplemental](./STORAGE-SUPPLEMENTAL) - Platform-specific details, debugging tips, and cross-platform sync patterns

## Architecture

- [Cross-SD Move State Machine](./cross-sd-move-state-machine) - Architecture for robust cross-Storage Directory note moves with crash recovery and multi-instance coordination

## Integration

- [IPC Protocol](./ipc-protocol) - Inter-process communication protocol between Electron main and renderer processes
- [TipTap-Yjs Compatibility](./tiptap-yjs-compatibility) - Integration details for TipTap editor with Yjs CRDT synchronization

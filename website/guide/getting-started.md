# Getting Started

Welcome to NoteCove! This guide will help you get up and running quickly.

## What is NoteCove?

NoteCove is a cross-platform notes application designed to be like Apple Notes but with advanced organization and power-user features. It works offline-first and syncs via shared file systems (Dropbox, Google Drive, iCloud) without requiring internet servers.

## Key Concepts

### Offline-First

NoteCove is designed to work completely offline. All your notes are stored locally on your device, and you can create, edit, and organize notes without any internet connection.

### CRDT Synchronization

When you have multiple devices, NoteCove uses CRDTs (Conflict-free Replicated Data Types) powered by Yjs to ensure your edits merge seamlessly across devices without conflicts.

### File-Based Sync

Instead of syncing through proprietary servers, NoteCove syncs through shared folders on your existing cloud storage (Dropbox, Google Drive, iCloud Drive). Your data remains under your control.

## Architecture Overview

NoteCove consists of:

- **Desktop App**: Electron-based application for macOS, Windows, and Linux
- **iOS App**: Native Swift app for iPhone and iPad (coming soon)
- **Shared CRDT Logic**: TypeScript package for conflict-free synchronization
- **SQLite Database**: Local storage with full-text search (FTS5)

## Next Steps

- [Install NoteCove](/guide/installation)
- [Learn basic usage](/guide/basic-usage)
- [Explore features](/features/)

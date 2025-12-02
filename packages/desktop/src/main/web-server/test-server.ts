#!/usr/bin/env npx ts-node
/**
 * Manual Test Server
 *
 * Starts the web server with mock services for manual testing with curl.
 * Run with: npx ts-node src/main/web-server/test-server.ts
 */

import { WebServer } from './server';
import { AuthManager } from './auth';
import { setRouteContext, ServiceHandlers } from './routes/context';

// Mock data
const mockNotes = [
  {
    id: 'note-1',
    title: 'Welcome to NoteCove',
    preview: 'This is a sample note...',
    folderId: null,
    sdId: 'sd-1',
    created: Date.now() - 86400000,
    modified: Date.now(),
    pinned: false,
  },
  {
    id: 'note-2',
    title: 'Getting Started',
    preview: 'Learn how to use the app...',
    folderId: 'folder-1',
    sdId: 'sd-1',
    created: Date.now() - 172800000,
    modified: Date.now() - 3600000,
    pinned: true,
  },
];

const mockFolders = [
  {
    id: 'folder-1',
    name: 'Work',
    parentId: null,
    sdId: 'sd-1',
    order: 0,
    created: Date.now() - 259200000,
    modified: Date.now() - 86400000,
  },
  {
    id: 'folder-2',
    name: 'Personal',
    parentId: null,
    sdId: 'sd-1',
    order: 1,
    created: Date.now() - 172800000,
    modified: Date.now() - 43200000,
  },
];

const mockTags = [
  { id: 'tag-1', name: 'important', count: 5 },
  { id: 'tag-2', name: 'todo', count: 3 },
];

const mockStorageDirectories = [
  {
    id: 'sd-1',
    name: 'Main Storage',
    path: '/path/to/storage',
    created: Date.now() - 604800000,
    isActive: true,
  },
];

// Mock services
const mockServices: ServiceHandlers = {
  noteList: async (sdId, folderId) => {
    console.log(`[Mock] noteList(sdId=${sdId}, folderId=${folderId})`);
    await Promise.resolve();
    return folderId
      ? mockNotes.filter((n) => n.folderId === folderId)
      : mockNotes.filter((n) => n.sdId === sdId);
  },
  noteGetMetadata: async (noteId) => {
    console.log(`[Mock] noteGetMetadata(noteId=${noteId})`);
    await Promise.resolve();
    const note = mockNotes.find((n) => n.id === noteId);
    if (!note) throw new Error('Note not found');
    return { ...note, deleted: false };
  },
  noteGetState: async () => {
    await Promise.resolve();
    return new Uint8Array();
  },
  noteApplyUpdate: async () => {
    await Promise.resolve();
  },
  noteCreate: async (sdId, folderId) => {
    console.log(`[Mock] noteCreate(sdId=${sdId}, folderId=${folderId})`);
    await Promise.resolve();
    return `note-${Date.now()}`;
  },
  noteDelete: async (noteId) => {
    console.log(`[Mock] noteDelete(noteId=${noteId})`);
    await Promise.resolve();
  },
  noteRestore: async (noteId) => {
    console.log(`[Mock] noteRestore(noteId=${noteId})`);
    await Promise.resolve();
  },
  noteMove: async (noteId, folderId) => {
    console.log(`[Mock] noteMove(noteId=${noteId}, folderId=${folderId})`);
    await Promise.resolve();
  },
  noteSearch: async (query, limit) => {
    console.log(`[Mock] noteSearch(query=${query}, limit=${limit})`);
    await Promise.resolve();
    return mockNotes
      .filter((n) => n.title.toLowerCase().includes(query.toLowerCase()))
      .map((n) => ({
        noteId: n.id,
        title: n.title,
        preview: n.preview,
        sdId: n.sdId,
        folderId: n.folderId,
        score: 1,
      }));
  },
  folderList: async (sdId) => {
    console.log(`[Mock] folderList(sdId=${sdId})`);
    await Promise.resolve();
    return mockFolders.filter((f) => f.sdId === sdId);
  },
  folderCreate: async (sdId, parentId, name) => {
    console.log(`[Mock] folderCreate(sdId=${sdId}, parentId=${parentId}, name=${name})`);
    await Promise.resolve();
    return `folder-${Date.now()}`;
  },
  folderRename: async (sdId, folderId, newName) => {
    console.log(`[Mock] folderRename(sdId=${sdId}, folderId=${folderId}, newName=${newName})`);
    await Promise.resolve();
  },
  folderDelete: async (sdId, folderId) => {
    console.log(`[Mock] folderDelete(sdId=${sdId}, folderId=${folderId})`);
    await Promise.resolve();
  },
  folderMove: async (sdId, folderId, newParentId) => {
    console.log(
      `[Mock] folderMove(sdId=${sdId}, folderId=${folderId}, newParentId=${newParentId})`
    );
    await Promise.resolve();
  },
  folderReorder: async (sdId, folderId, newOrder) => {
    console.log(`[Mock] folderReorder(sdId=${sdId}, folderId=${folderId}, newOrder=${newOrder})`);
    await Promise.resolve();
  },
  tagGetAll: async () => {
    console.log(`[Mock] tagGetAll()`);
    await Promise.resolve();
    return mockTags;
  },
  sdList: async () => {
    console.log(`[Mock] sdList()`);
    await Promise.resolve();
    return mockStorageDirectories;
  },
  sdGetActive: async () => {
    console.log(`[Mock] sdGetActive()`);
    await Promise.resolve();
    return 'sd-1';
  },
  historyGetTimeline: async (noteId) => {
    console.log(`[Mock] historyGetTimeline(noteId=${noteId})`);
    await Promise.resolve();
    return [
      { timestamp: Date.now() - 3600000, type: 'edit', size: 150 },
      { timestamp: Date.now() - 7200000, type: 'edit', size: 200 },
    ];
  },
  historyGetStats: async (noteId) => {
    console.log(`[Mock] historyGetStats(noteId=${noteId})`);
    await Promise.resolve();
    return {
      totalUpdates: 25,
      totalSessions: 5,
      firstEdit: Date.now() - 86400000,
      lastEdit: Date.now() - 3600000,
    };
  },
  diagnosticsGetStatus: async () => {
    console.log(`[Mock] diagnosticsGetStatus()`);
    await Promise.resolve();
    return {
      duplicateNotes: 0,
      orphanedFiles: 2,
      missingFiles: 1,
    };
  },
};

async function main() {
  // Set up services
  setRouteContext({ services: mockServices });

  // Create auth manager and get token
  const authManager = new AuthManager();
  const token = authManager.regenerateToken();

  // Start server
  const server = new WebServer({
    port: 3456,
    host: '127.0.0.1',
    authManager,
  });

  await server.start();

  console.log('\n========================================');
  console.log('Test Server Running!');
  console.log('========================================');
  console.log(`URL: http://127.0.0.1:3456`);
  console.log(`Token: ${token}`);
  console.log('========================================\n');
  console.log('Example curl commands:\n');
  console.log(`# Health check (no auth required)`);
  console.log(`curl http://127.0.0.1:3456/health\n`);
  console.log(`# API info`);
  console.log(`curl -H "Authorization: Bearer ${token}" http://127.0.0.1:3456/api/info\n`);
  console.log(`# List notes`);
  console.log(
    `curl -H "Authorization: Bearer ${token}" "http://127.0.0.1:3456/api/notes?sdId=sd-1"\n`
  );
  console.log(`# List folders`);
  console.log(
    `curl -H "Authorization: Bearer ${token}" "http://127.0.0.1:3456/api/folders?sdId=sd-1"\n`
  );
  console.log(`# Search notes`);
  console.log(
    `curl -H "Authorization: Bearer ${token}" "http://127.0.0.1:3456/api/search?q=welcome"\n`
  );
  console.log(`# Create a note`);
  console.log(
    `curl -X POST -H "Authorization: Bearer ${token}" -H "Content-Type: application/json" -d '{"sdId":"sd-1","folderId":null}' http://127.0.0.1:3456/api/notes\n`
  );
  console.log(`# Get tags`);
  console.log(`curl -H "Authorization: Bearer ${token}" http://127.0.0.1:3456/api/tags\n`);
  console.log(`# Get storage directories`);
  console.log(
    `curl -H "Authorization: Bearer ${token}" http://127.0.0.1:3456/api/storage-directories\n`
  );
  console.log('Press Ctrl+C to stop the server.\n');

  // Handle shutdown
  process.on('SIGINT', () => {
    void (async () => {
      console.log('\nShutting down...');
      await server.stop();
      process.exit(0);
    })();
  });
}

main().catch((err) => {
  console.error('Failed to start test server:', err);
  process.exit(1);
});

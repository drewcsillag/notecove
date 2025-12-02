/**
 * Route Handler Context
 *
 * Provides access to the application's service layer for API route handlers.
 * This allows routes to be tested in isolation with mock services.
 */

import { FastifyReply } from 'fastify';

/**
 * Note metadata as returned by API
 */
export interface ApiNoteMetadata {
  id: string;
  title: string;
  folderId: string | null;
  sdId: string;
  created: number;
  modified: number;
  deleted: boolean;
  pinned: boolean;
}

/**
 * Note list item
 */
export interface ApiNoteListItem {
  id: string;
  title: string;
  contentPreview: string;
  folderId: string | null;
  sdId: string;
  created: number;
  modified: number;
  pinned: boolean;
}

/**
 * Folder data as returned by API
 */
export interface ApiFolderData {
  id: string;
  name: string;
  parentId: string | null;
  sdId: string;
  order: number;
  created: number;
  modified: number;
}

/**
 * Storage directory info
 */
export interface ApiStorageDirectory {
  id: string;
  name: string;
  path: string;
  created: number;
  isActive: boolean;
}

/**
 * Search result
 */
export interface ApiSearchResult {
  noteId: string;
  title: string;
  contentPreview: string;
  sdId: string;
  folderId: string | null;
  score: number;
}

/**
 * Tag with count
 */
export interface ApiTag {
  id: string;
  name: string;
  count: number;
}

/**
 * Service handlers interface
 * Maps to the underlying IPC handlers but with async/Promise interface
 */
export interface ServiceHandlers {
  // Note operations
  noteList(sdId: string, folderId?: string | null): Promise<ApiNoteListItem[]>;
  noteGetMetadata(noteId: string): Promise<ApiNoteMetadata>;
  noteGetState(noteId: string, stateVector?: Uint8Array): Promise<Uint8Array>;
  noteApplyUpdate(noteId: string, update: Uint8Array): Promise<void>;
  noteCreate(sdId: string, folderId: string | null, initialContent?: string): Promise<string>;
  noteDelete(noteId: string): Promise<void>;
  noteRestore(noteId: string): Promise<void>;
  noteMove(noteId: string, newFolderId: string | null): Promise<void>;
  noteSearch(query: string, limit?: number): Promise<ApiSearchResult[]>;

  // Folder operations
  folderList(sdId: string): Promise<ApiFolderData[]>;
  folderCreate(sdId: string, parentId: string | null, name: string): Promise<string>;
  folderRename(sdId: string, folderId: string, newName: string): Promise<void>;
  folderDelete(sdId: string, folderId: string): Promise<void>;
  folderMove(sdId: string, folderId: string, newParentId: string | null): Promise<void>;
  folderReorder(sdId: string, folderId: string, newOrder: number): Promise<void>;

  // Tag operations
  tagGetAll(): Promise<ApiTag[]>;

  // Storage directory operations (read-only for browser)
  sdList(): Promise<ApiStorageDirectory[]>;
  sdGetActive(): Promise<string | null>;

  // History operations
  historyGetTimeline(noteId: string): Promise<unknown[]>;
  historyGetStats(noteId: string): Promise<{
    totalUpdates: number;
    totalSessions: number;
    firstEdit: number | null;
    lastEdit: number | null;
  }>;

  // Diagnostics
  diagnosticsGetStatus(): Promise<{
    duplicateNotes: number;
    orphanedFiles: number;
    missingFiles: number;
  }>;
}

/**
 * Route context that provides access to services
 */
export interface RouteContext {
  services: ServiceHandlers | null;
}

/**
 * Global route context - set when server starts with real services
 */
let globalContext: RouteContext = {
  services: null,
};

/**
 * Set the global route context
 */
export function setRouteContext(context: RouteContext): void {
  globalContext = context;
}

/**
 * Get the global route context
 */
export function getRouteContext(): RouteContext {
  return globalContext;
}

/**
 * Helper to get services or throw if not configured
 */
export function getServices(): ServiceHandlers {
  if (!globalContext.services) {
    throw new Error('Services not configured');
  }
  return globalContext.services;
}

/**
 * Check if services are available
 */
export function hasServices(): boolean {
  return globalContext.services !== null;
}

/**
 * Standard error response helper
 */
export function sendError(
  reply: FastifyReply,
  statusCode: number,
  error: string,
  message?: string
): FastifyReply {
  return reply.status(statusCode).send({
    error,
    message: message ?? error,
    statusCode,
  });
}

/**
 * Handle service errors and send appropriate response
 */
export function handleServiceError(reply: FastifyReply, err: unknown): FastifyReply {
  console.error('[API] Service error:', err);

  if (err instanceof Error) {
    if (err.message.includes('not found') || err.message.includes('Not found')) {
      return sendError(reply, 404, 'Not Found', err.message);
    }
    if (err.message.includes('already exists') || err.message.includes('conflict')) {
      return sendError(reply, 409, 'Conflict', err.message);
    }
    if (err.message.includes('invalid') || err.message.includes('Invalid')) {
      return sendError(reply, 400, 'Bad Request', err.message);
    }
  }

  return sendError(reply, 500, 'Internal Server Error', 'An unexpected error occurred');
}

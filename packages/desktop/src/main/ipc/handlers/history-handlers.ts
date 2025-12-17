/**
 * History Handlers
 *
 * IPC handlers for note history operations: timeline, stats, reconstruction.
 */

import { ipcMain, type IpcMainInvokeEvent } from 'electron';
import * as Y from 'yjs';
import * as path from 'path';
import type { HandlerContext } from './types';
import {
  type ActivitySession,
  type ReconstructionPoint,
  TimelineBuilder,
} from '@notecove/shared/history';
import { NodeFileSystemAdapter } from '../../storage/node-fs-adapter';

/**
 * Register all history-related IPC handlers
 */
export function registerHistoryHandlers(ctx: HandlerContext): void {
  ipcMain.handle('history:getTimeline', handleGetTimeline(ctx));
  ipcMain.handle('history:getStats', handleGetHistoryStats(ctx));
  ipcMain.handle('history:reconstructAt', handleReconstructAt(ctx));
  ipcMain.handle('history:getSessionPreview', handleGetSessionPreview(ctx));
}

/**
 * Unregister all history-related IPC handlers
 */
export function unregisterHistoryHandlers(): void {
  ipcMain.removeHandler('history:getTimeline');
  ipcMain.removeHandler('history:getStats');
  ipcMain.removeHandler('history:reconstructAt');
  ipcMain.removeHandler('history:getSessionPreview');
}

// =============================================================================
// Handler Factories
// =============================================================================

function handleGetTimeline(ctx: HandlerContext) {
  return async (_event: IpcMainInvokeEvent, noteId: string): Promise<ActivitySession[]> => {
    const { database, storageManager } = ctx;

    // Get note metadata to find which SD it belongs to
    const note = await database.getNote(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    // Get the SD path for this note
    const sdPath = storageManager.getSDPath(note.sdId);
    const logsDir = path.join(sdPath, 'notes', noteId, 'logs');

    console.log(`[History] Building timeline for note ${noteId}, logsDir: ${logsDir}`);

    // Build timeline using new log format
    const fsAdapter = new NodeFileSystemAdapter();
    const timelineBuilder = new TimelineBuilder(fsAdapter);
    const sessions = await timelineBuilder.buildTimeline(logsDir);

    console.log(`[History] Found ${sessions.length} sessions for note ${noteId}`);

    return sessions;
  };
}

function handleGetHistoryStats(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string
  ): Promise<{
    totalUpdates: number;
    totalSessions: number;
    firstEdit: number | null;
    lastEdit: number | null;
    instanceCount: number;
    instances: string[];
  }> => {
    const { database, storageManager } = ctx;

    const note = await database.getNote(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    // Get the SD path for this note
    const sdPath = storageManager.getSDPath(note.sdId);
    const logsDir = path.join(sdPath, 'notes', noteId, 'logs');

    // Build timeline and compute stats
    const fsAdapter = new NodeFileSystemAdapter();
    const timelineBuilder = new TimelineBuilder(fsAdapter);
    const sessions = await timelineBuilder.buildTimeline(logsDir);

    // Compute statistics from sessions
    const totalUpdates = sessions.reduce((sum, s) => sum + s.updateCount, 0);
    const allInstances = new Set<string>();
    for (const session of sessions) {
      for (const instanceId of session.instanceIds) {
        allInstances.add(instanceId);
      }
    }

    const firstSession = sessions[0];
    const lastSession = sessions[sessions.length - 1];
    return {
      totalUpdates,
      totalSessions: sessions.length,
      firstEdit: firstSession?.startTime ?? null,
      lastEdit: lastSession?.endTime ?? null,
      instanceCount: allInstances.size,
      instances: Array.from(allInstances),
    };
  };
}

function handleReconstructAt(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    point: ReconstructionPoint
  ): Promise<Uint8Array> => {
    const { database, storageManager } = ctx;

    const note = await database.getNote(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    // Get the SD path for this note
    const sdPath = storageManager.getSDPath(note.sdId);
    const logsDir = path.join(sdPath, 'notes', noteId, 'logs');

    // Build timeline to get all updates
    const fsAdapter = new NodeFileSystemAdapter();
    const timelineBuilder = new TimelineBuilder(fsAdapter);
    const sessions = await timelineBuilder.buildTimeline(logsDir);

    // Collect all updates from all sessions up to target timestamp
    const doc = new Y.Doc();
    for (const session of sessions) {
      for (const update of session.updates) {
        if (update.timestamp <= point.timestamp) {
          Y.applyUpdate(doc, update.data);
        }
      }
    }

    return Y.encodeStateAsUpdate(doc);
  };
}

function handleGetSessionPreview(ctx: HandlerContext) {
  return async (
    _event: IpcMainInvokeEvent,
    noteId: string,
    sessionId: string
  ): Promise<{ firstPreview: string; lastPreview: string }> => {
    const { database, storageManager } = ctx;

    const note = await database.getNote(noteId);
    if (!note) {
      throw new Error(`Note not found: ${noteId}`);
    }

    // Get the SD path for this note
    const sdPath = storageManager.getSDPath(note.sdId);
    const logsDir = path.join(sdPath, 'notes', noteId, 'logs');

    // Build timeline to find the session
    const fsAdapter = new NodeFileSystemAdapter();
    const timelineBuilder = new TimelineBuilder(fsAdapter);
    const sessions = await timelineBuilder.buildTimeline(logsDir);

    const targetSession = sessions.find((s) => s.id === sessionId);
    if (!targetSession) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Build state at first update of session
    const firstDoc = new Y.Doc();
    // Apply all updates from previous sessions
    for (const session of sessions) {
      if (session.id === sessionId) break;
      for (const update of session.updates) {
        Y.applyUpdate(firstDoc, update.data);
      }
    }
    // Apply first update of target session
    if (targetSession.updates.length > 0 && targetSession.updates[0]) {
      Y.applyUpdate(firstDoc, targetSession.updates[0].data);
    }

    // Build state at last update of session
    const lastDoc = new Y.Doc();
    // Apply all updates from previous sessions
    for (const session of sessions) {
      if (session.id === sessionId) break;
      for (const update of session.updates) {
        Y.applyUpdate(lastDoc, update.data);
      }
    }
    // Apply all updates from target session
    for (const update of targetSession.updates) {
      Y.applyUpdate(lastDoc, update.data);
    }

    // Extract preview text from documents
    const extractPreview = (doc: Y.Doc): string => {
      const content = doc.getXmlFragment('content');
      let text = '';
      content.forEach((item: Y.XmlText | Y.XmlElement) => {
        if (item instanceof Y.XmlText) {
          text += String(item.toString());
        } else if (item instanceof Y.XmlElement) {
          const extractTextFromElement = (elem: Y.XmlElement): string => {
            let elemText = '';
            elem.forEach((child: Y.XmlText | Y.XmlElement) => {
              if (child instanceof Y.XmlText) {
                elemText += String(child.toString());
              } else if (child instanceof Y.XmlElement) {
                elemText += extractTextFromElement(child);
              }
            });
            return elemText;
          };
          text += extractTextFromElement(item) + '\n';
        }
      });
      return text.slice(0, 200); // First 200 chars
    };

    return {
      firstPreview: extractPreview(firstDoc),
      lastPreview: extractPreview(lastDoc),
    };
  };
}

/**
 * Handler Types
 *
 * Shared types and interfaces for IPC handlers.
 */

import type { BrowserWindow } from 'electron';
import type { CRDTManager } from '../../crdt';
import type {
  Database,
  AppendLogManager,
  DeletionLogger,
  PollingGroupStatus,
} from '@notecove/shared';
import type { ConfigManager } from '../../config/manager';
import type { NoteMoveManager } from '../../note-move-manager';
import type { DiagnosticsManager } from '../../diagnostics-manager';
import type { BackupManager } from '../../backup-manager';
import type { SyncStatus } from '../types';
import type { OEmbedService } from '../../oembed';

/**
 * Callback type for getting deletion logger by SD
 */
export type GetDeletionLoggerFn = (sdId: string) => DeletionLogger | undefined;

/**
 * Callback type for getting sync status
 */
export type GetSyncStatusFn = () => SyncStatus;

/**
 * Callback type for user settings changes
 * Called when Username or UserHandle changes so profile presence can be updated
 */
export type OnUserSettingsChangedFn = (key: string, value: string) => Promise<void>;

/**
 * Callback type for stopping the web server when feature flag is disabled
 */
export type StopWebServerFn = () => Promise<void>;

/**
 * Callback type for broadcasting to web clients via WebSocket
 */
export type WebBroadcastCallback = (channel: string, ...args: unknown[]) => void;

/**
 * Callback type for getting polling group status
 */
export type GetPollingGroupStatusFn = () => PollingGroupStatus | null;

/**
 * Callback type for recording a recent edit to a note
 * This is used to add notes to the polling group for sync prioritization
 */
export type RecordRecentEditFn = (noteId: string, sdId: string) => void;

/**
 * User info for @-mentions autocomplete
 */
export interface MentionUser {
  profileId: string;
  handle: string; // @drew
  name: string; // Drew Colthorp
}

/**
 * Options for creating a new window
 */
export interface CreateWindowOptions {
  noteId?: string;
  minimal?: boolean;
  noteInfo?: boolean;
  storageInspector?: boolean;
  printPreview?: boolean;
  targetNoteId?: string;
  noteTitle?: string;
  parentWindow?: BrowserWindow;
  sdId?: string;
  sdPath?: string;
  sdName?: string;
}

/**
 * Function type for creating windows
 */
export type CreateWindowFn = (options?: CreateWindowOptions) => void;

/**
 * Callback when a storage directory is created
 */
export type OnStorageDirCreatedFn = (sdId: string, sdPath: string) => Promise<void>;

/**
 * Callback when a storage directory is deleted
 * Used to clean up watchers, sync state, and cached presence data
 */
export type OnStorageDirDeletedFn = (sdId: string) => Promise<void>;

/**
 * Dependencies required by IPC handlers
 */
export interface HandlerDependencies {
  crdtManager: CRDTManager;
  database: Database;
  configManager: ConfigManager;
  storageManager: AppendLogManager;
  noteMoveManager: NoteMoveManager;
  diagnosticsManager: DiagnosticsManager;
  backupManager: BackupManager;
  profileId: string;
  createWindowFn?: CreateWindowFn;
  onStorageDirCreated?: OnStorageDirCreatedFn;
  onStorageDirDeleted?: OnStorageDirDeletedFn;
  getDeletionLogger?: GetDeletionLoggerFn;
  getSyncStatus?: GetSyncStatusFn;
  onUserSettingsChanged?: OnUserSettingsChangedFn;
  stopWebServer?: StopWebServerFn;
  getPollingGroupStatus?: GetPollingGroupStatusFn;
  recordRecentEdit?: RecordRecentEditFn;
}

/**
 * Extended dependencies with runtime-initialized services
 *
 * These are created during IPCHandlers construction and passed to handler modules
 */
export interface HandlerContext extends HandlerDependencies {
  /**
   * Broadcast an event to all renderer windows and web clients
   */
  broadcastToAll: (channel: string, ...args: unknown[]) => void;

  /**
   * Discover an image across all registered storage directories
   */
  discoverImageAcrossSDs: (
    imageId: string,
    primarySdId: string
  ) => Promise<{
    sdId: string;
    sdPath: string;
    filename: string;
    mimeType: string;
    size: number;
  } | null>;

  /**
   * oEmbed service for link unfurling (optional - created lazily)
   */
  oembedService?: OEmbedService;
}

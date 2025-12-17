/**
 * Window Management
 * Handles window creation, restoration, and state management
 */

import { BrowserWindow, screen } from 'electron';
import { join } from 'path';
import { is } from '@electron-toolkit/utils';
import type { Database } from '@notecove/shared';
import { WindowStateManager } from './window-state-manager';
import * as fs from 'fs/promises';

export interface CreateWindowOptions {
  noteId?: string;
  minimal?: boolean;
  syncStatus?: boolean;
  noteInfo?: boolean;
  storageInspector?: boolean;
  sdPicker?: boolean;
  targetNoteId?: string;
  noteTitle?: string;
  parentWindow?: BrowserWindow;
  sdId?: string;
  sdPath?: string;
  sdName?: string;
  bounds?: { x: number; y: number; width: number; height: number };
  isMaximized?: boolean;
  isFullScreen?: boolean;
}

/**
 * Get the window title based on current profile
 */
export function getWindowTitle(isPackaged: boolean, selectedProfileName: string | null): string {
  const isDevBuild = !isPackaged;
  const devPrefix = isDevBuild ? '[DEV] ' : '';
  const profileSuffix = selectedProfileName ? ` - ${selectedProfileName}` : '';
  return `${devPrefix}NoteCove${profileSuffix}`;
}

/**
 * Create a new browser window with the given options
 */
export function createWindow(
  options: CreateWindowOptions | undefined,
  context: {
    isPackaged: boolean;
    selectedProfileName: string | null;
    windowStateManager: WindowStateManager | null;
    syncStatusWindow: BrowserWindow | null;
    mainWindow: BrowserWindow | null;
    allWindows: BrowserWindow[];
  }
): {
  window: BrowserWindow;
  windowId: string | undefined;
  shouldSetAsMain: boolean;
  shouldSetAsSyncStatus: boolean;
} {
  // If requesting sync status window and one already exists, just focus it
  if (options?.syncStatus && context.syncStatusWindow && !context.syncStatusWindow.isDestroyed()) {
    context.syncStatusWindow.focus();
    return {
      window: context.syncStatusWindow,
      windowId: undefined,
      shouldSetAsMain: false,
      shouldSetAsSyncStatus: false,
    };
  }

  // Determine window dimensions
  const defaultWidth = options?.storageInspector
    ? 1200
    : options?.sdPicker
      ? 500
      : options?.syncStatus || options?.noteInfo
        ? 900
        : options?.minimal
          ? 800
          : 1200;
  const defaultHeight = options?.storageInspector
    ? 800
    : options?.sdPicker
      ? 400
      : options?.syncStatus || options?.noteInfo
        ? 600
        : 800;

  // Determine window title
  const windowTitle = options?.storageInspector
    ? `Storage Inspector${options.sdName ? ` - ${options.sdName}` : ''}`
    : options?.sdPicker
      ? 'Select Storage Directory'
      : options?.noteInfo && options.noteTitle
        ? `Note Info - ${options.noteTitle}`
        : getWindowTitle(context.isPackaged, context.selectedProfileName);

  // Create the browser window with saved bounds or defaults
  const windowOptions: Electron.BrowserWindowConstructorOptions = {
    width: options?.bounds?.width ?? defaultWidth,
    height: options?.bounds?.height ?? defaultHeight,
    show: false,
    autoHideMenuBar: false,
    title: windowTitle,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false,
    },
  };

  // Set parent window for noteInfo windows (child window behavior)
  if (options?.noteInfo && options.parentWindow) {
    windowOptions.parent = options.parentWindow;
  }

  // Conditionally add x/y position (only if bounds provided)
  if (options?.bounds?.x !== undefined) {
    windowOptions.x = options.bounds.x;
  }
  if (options?.bounds?.y !== undefined) {
    windowOptions.y = options.bounds.y;
  }

  const newWindow = new BrowserWindow(windowOptions);

  // Determine window type for state tracking
  const windowType:
    | 'main'
    | 'minimal'
    | 'syncStatus'
    | 'noteInfo'
    | 'storageInspector'
    | 'sdPicker' = options?.syncStatus
    ? 'syncStatus'
    : options?.noteInfo
      ? 'noteInfo'
      : options?.storageInspector
        ? 'storageInspector'
        : options?.sdPicker
          ? 'sdPicker'
          : options?.minimal
            ? 'minimal'
            : 'main';

  // Register window with state manager (if available)
  let windowId: string | undefined;
  if (context.windowStateManager) {
    windowId = context.windowStateManager.registerWindow(
      newWindow,
      windowType,
      options?.noteId,
      options?.sdId
    );
  }

  newWindow.on('ready-to-show', () => {
    // Don't show window in test mode (headless E2E tests)
    if (process.env['NODE_ENV'] !== 'test') {
      // Apply maximized/fullscreen state before showing
      if (options?.isMaximized) {
        newWindow.maximize();
      }
      if (options?.isFullScreen) {
        newWindow.setFullScreen(true);
      }
      newWindow.show();
    }
  });

  newWindow.on('closed', () => {
    const index = context.allWindows.indexOf(newWindow);
    if (index > -1) {
      context.allWindows.splice(index, 1);
    }
    // Note: WindowStateManager automatically unregisters on 'closed' event
  });

  // Build URL with parameters
  const params = new URLSearchParams();
  if (windowId) {
    params.set('windowId', windowId);
  }
  if (options?.noteId) {
    params.set('noteId', options.noteId);
  }
  if (options?.minimal) {
    params.set('minimal', 'true');
  }
  if (options?.syncStatus) {
    params.set('syncStatus', 'true');
  }
  if (options?.noteInfo) {
    params.set('noteInfo', 'true');
  }
  if (options?.storageInspector) {
    params.set('storageInspector', 'true');
  }
  if (options?.sdPicker) {
    params.set('sdPicker', 'true');
  }
  if (options?.targetNoteId) {
    params.set('targetNoteId', options.targetNoteId);
  }
  if (options?.sdId) {
    params.set('sdId', options.sdId);
  }
  if (options?.sdPath) {
    params.set('sdPath', options.sdPath);
  }
  if (options?.sdName) {
    params.set('sdName', options.sdName);
  }

  const queryString = params.toString();
  const hash = queryString ? `?${queryString}` : '';

  // Load the renderer
  // In test mode, always use the built files, not the dev server
  if (process.env['NODE_ENV'] === 'test' || !is.dev || !process.env['ELECTRON_RENDERER_URL']) {
    void newWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: queryString });
  } else {
    const url = process.env['ELECTRON_RENDERER_URL'] + hash;
    void newWindow.loadURL(url);
  }

  // Determine if this should be the main window
  const shouldSetAsMain = context.mainWindow === null;
  const shouldSetAsSyncStatus = !!options?.syncStatus;

  return {
    window: newWindow,
    windowId,
    shouldSetAsMain,
    shouldSetAsSyncStatus,
  };
}

/**
 * Restore windows from saved state
 *
 * Loads saved window states and creates windows with their previous positions,
 * sizes, and states. Validates positions against current display configuration.
 *
 * @returns True if windows were restored, false if no saved state
 */
export async function restoreWindows(
  windowStateManager: WindowStateManager | null,
  database: Database | null,
  createWindowFn: (options?: CreateWindowOptions) => BrowserWindow
): Promise<boolean> {
  if (!windowStateManager) {
    console.log('[WindowState] No manager available, skipping restoration');
    return false;
  }

  if (!database) {
    console.log('[WindowState] No database available, skipping restoration');
    return false;
  }

  // Load saved state
  const savedStates = await windowStateManager.loadState();
  if (savedStates.length === 0) {
    console.log('[WindowState] No saved window states found');
    return false;
  }

  console.log(`[WindowState] Restoring ${savedStates.length} window(s)...`);

  // Get current display configuration for position validation
  const displays = screen.getAllDisplays();
  const primaryDisplay = screen.getPrimaryDisplay();
  const primaryBounds = primaryDisplay.bounds;

  let restoredCount = 0;

  // Restore each window
  for (const state of savedStates) {
    // Step 11: Validate SD exists and is accessible
    const sdValid = await windowStateManager.validateSDForRestore(
      state.sdId,
      database,
      (path: string) => fs.access(path)
    );

    if (!sdValid) {
      console.log(`[WindowState] Skipping window with invalid SD: ${state.sdId}`);
      continue;
    }

    // Step 10: Validate note exists and is not deleted
    const { noteId: validatedNoteId, sdId: validatedSdId } =
      await windowStateManager.validateNoteForRestore(state.noteId, state.sdId, database);

    // Validate position against current displays
    const validatedState = windowStateManager.validateWindowState(
      state,
      displays.map((d) => ({ bounds: d.bounds })),
      primaryBounds
    );

    // Determine window type options
    const minimal = state.type === 'minimal';
    const syncStatus = state.type === 'syncStatus';

    console.log(
      `[WindowState] Restoring ${state.type} window at (${validatedState.bounds.x}, ${validatedState.bounds.y})`
    );

    // Create window with restored state
    // Build options, only including noteId/sdId if defined
    const windowOpts: CreateWindowOptions = {
      minimal,
      syncStatus,
      bounds: validatedState.bounds,
      isMaximized: validatedState.isMaximized,
      isFullScreen: validatedState.isFullScreen,
    };
    if (validatedNoteId !== undefined) {
      windowOpts.noteId = validatedNoteId;
    }
    if (validatedSdId !== undefined) {
      windowOpts.sdId = validatedSdId;
    }
    createWindowFn(windowOpts);
    restoredCount++;
  }

  console.log(
    `[WindowState] Window restoration complete: ${restoredCount}/${savedStates.length} windows restored`
  );
  return restoredCount > 0;
}

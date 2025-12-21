/**
 * Window and Menu API: window, windowState, menu, shutdown
 */

import { ipcRenderer } from 'electron';

export const windowStateApi = {
  /**
   * Report the current note being viewed in this window.
   * Called when user navigates to a new note.
   */
  reportCurrentNote: (windowId: string, noteId: string, sdId?: string): Promise<void> =>
    ipcRenderer.invoke('windowState:reportCurrentNote', windowId, noteId, sdId) as Promise<void>,

  /**
   * Report the current editor state (scroll/cursor position).
   * Called periodically (debounced) and on beforeunload.
   */
  reportEditorState: (
    windowId: string,
    editorState: { scrollTop: number; cursorPosition: number }
  ): Promise<void> =>
    ipcRenderer.invoke('windowState:reportEditorState', windowId, editorState) as Promise<void>,

  /**
   * Get the saved window state for this window (used for restoration).
   * Returns the saved state including editor scroll/cursor position.
   */
  getSavedState: (
    windowId: string
  ): Promise<{
    noteId?: string;
    sdId?: string;
    editorState?: { scrollTop: number; cursorPosition: number };
  } | null> =>
    ipcRenderer.invoke('windowState:getSavedState', windowId) as Promise<{
      noteId?: string;
      sdId?: string;
      editorState?: { scrollTop: number; cursorPosition: number };
    } | null>,
};

export const windowApi = {
  /**
   * Open a Note Info window for the specified note.
   * Creates a new window that displays detailed information about the note.
   */
  openNoteInfo: (noteId: string): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('window:openNoteInfo', noteId) as Promise<{
      success: boolean;
      error?: string;
    }>,
  /**
   * Open a Storage Inspector window for the specified storage directory.
   * Creates a new window that displays storage directory contents and allows inspection.
   */
  openStorageInspector: (
    sdId: string,
    sdPath: string,
    sdName: string
  ): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('window:openStorageInspector', sdId, sdPath, sdName) as Promise<{
      success: boolean;
      error?: string;
    }>,
};

export const menuApi = {
  onNewNote: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:new-note', listener);
    return () => {
      ipcRenderer.removeListener('menu:new-note', listener);
    };
  },
  onNewFolder: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:new-folder', listener);
    return () => {
      ipcRenderer.removeListener('menu:new-folder', listener);
    };
  },
  onFind: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:find', listener);
    return () => {
      ipcRenderer.removeListener('menu:find', listener);
    };
  },
  onFindInNote: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:find-in-note', listener);
    return () => {
      ipcRenderer.removeListener('menu:find-in-note', listener);
    };
  },
  onToggleDarkMode: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:toggle-dark-mode', listener);
    return () => {
      ipcRenderer.removeListener('menu:toggle-dark-mode', listener);
    };
  },
  onToggleFolderPanel: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:toggle-folder-panel', listener);
    return () => {
      ipcRenderer.removeListener('menu:toggle-folder-panel', listener);
    };
  },
  onToggleTagsPanel: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:toggle-tags-panel', listener);
    return () => {
      ipcRenderer.removeListener('menu:toggle-tags-panel', listener);
    };
  },
  onCreateSnapshot: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:createSnapshot', listener);
    return () => {
      ipcRenderer.removeListener('menu:createSnapshot', listener);
    };
  },
  onViewHistory: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:viewHistory', listener);
    return () => {
      ipcRenderer.removeListener('menu:viewHistory', listener);
    };
  },
  onNoteInfo: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:noteInfo', listener);
    return () => {
      ipcRenderer.removeListener('menu:noteInfo', listener);
    };
  },
  onExportSelectedNotes: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:export-selected-notes', listener);
    return () => {
      ipcRenderer.removeListener('menu:export-selected-notes', listener);
    };
  },
  onExportAllNotes: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:export-all-notes', listener);
    return () => {
      ipcRenderer.removeListener('menu:export-all-notes', listener);
    };
  },
  onImportMarkdown: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:import-markdown', listener);
    return () => {
      ipcRenderer.removeListener('menu:import-markdown', listener);
    };
  },
  onReloadFromCRDTLogs: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:reloadFromCRDTLogs', listener);
    return () => {
      ipcRenderer.removeListener('menu:reloadFromCRDTLogs', listener);
    };
  },
  onReindexNotes: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:reindexNotes', listener);
    return () => {
      ipcRenderer.removeListener('menu:reindexNotes', listener);
    };
  },
  onStorageInspector: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('menu:storageInspector', listener);
    return () => {
      ipcRenderer.removeListener('menu:storageInspector', listener);
    };
  },
};

export const shutdownApi = {
  onProgress: (callback: (data: { current: number; total: number }) => void): (() => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      data: { current: number; total: number }
    ): void => {
      callback(data);
    };
    ipcRenderer.on('shutdown:progress', listener);
    return () => {
      ipcRenderer.removeListener('shutdown:progress', listener);
    };
  },
  onComplete: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on('shutdown:complete', listener);
    return () => {
      ipcRenderer.removeListener('shutdown:complete', listener);
    };
  },
};

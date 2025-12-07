/**
 * Tests for Browser API Stub
 */

import { browserApiStub, initBrowserApiStub } from '../browser-stub';

describe('Browser API Stub', () => {
  // Store original window.electronAPI
  const originalElectronAPI = (window as unknown as Record<string, unknown>)['electronAPI'];

  afterEach(() => {
    // Restore original state
    if (originalElectronAPI !== undefined) {
      (window as unknown as Record<string, unknown>)['electronAPI'] = originalElectronAPI;
    } else {
      delete (window as unknown as Record<string, unknown>)['electronAPI'];
    }
  });

  describe('browserApiStub', () => {
    it('should have platform set to browser', () => {
      expect(browserApiStub.platform).toBe('browser');
    });

    describe('note methods', () => {
      it('should throw not implemented error for note.load', () => {
        expect(() => browserApiStub.note.load('test')).toThrow('not yet implemented');
      });

      it('should throw not implemented error for note.create', () => {
        expect(() => browserApiStub.note.create('sd1', 'folder1', '')).toThrow(
          'not yet implemented'
        );
      });

      it('should throw not implemented error for note.delete', () => {
        expect(() => browserApiStub.note.delete('note1')).toThrow('not yet implemented');
      });

      it('should return no-op function for event subscriptions', () => {
        const unsubscribe = browserApiStub.note.onUpdated(() => {
          // No-op handler for testing
        });
        expect(typeof unsubscribe).toBe('function');
        // Should not throw when called
        expect(() => {
          unsubscribe();
        }).not.toThrow();
      });
    });

    describe('folder methods', () => {
      it('should throw not implemented error for folder.list', () => {
        expect(() => browserApiStub.folder.list('sd1')).toThrow('not yet implemented');
      });

      it('should throw not implemented error for folder.create', () => {
        expect(() => browserApiStub.folder.create('sd1', null, 'name')).toThrow(
          'not yet implemented'
        );
      });

      it('should return no-op function for folder event subscriptions', () => {
        const unsubscribe = browserApiStub.folder.onUpdated(() => {
          // No-op handler for testing
        });
        expect(typeof unsubscribe).toBe('function');
      });
    });

    describe('sd methods', () => {
      it('should throw not implemented error for sd.list', () => {
        expect(() => browserApiStub.sd.list()).toThrow('not yet implemented');
      });

      it('should throw not implemented error for sd.getActive', () => {
        expect(() => browserApiStub.sd.getActive()).toThrow('not yet implemented');
      });
    });

    describe('sync methods', () => {
      it('should throw not implemented error for sync.getStatus', () => {
        expect(() => browserApiStub.sync.getStatus()).toThrow('not yet implemented');
      });

      it('should return no-op function for sync event subscriptions', () => {
        const unsubscribe = browserApiStub.sync.onProgress(() => {
          // No-op handler for testing
        });
        expect(typeof unsubscribe).toBe('function');
      });
    });

    describe('history methods', () => {
      it('should throw not implemented error for history.getTimeline', () => {
        expect(() => browserApiStub.history.getTimeline('note1')).toThrow('not yet implemented');
      });
    });

    describe('tag methods', () => {
      it('should throw not implemented error for tag.getAll', () => {
        expect(() => browserApiStub.tag.getAll()).toThrow('not yet implemented');
      });
    });

    describe('link methods', () => {
      it('should throw not implemented error for link.getBacklinks', () => {
        expect(() => browserApiStub.link.getBacklinks('note1')).toThrow('not yet implemented');
      });
    });

    describe('config methods', () => {
      it('should throw not implemented error for config.getDatabasePath', () => {
        expect(() => browserApiStub.config.getDatabasePath()).toThrow('not yet implemented');
      });
    });

    describe('telemetry methods', () => {
      it('should throw not implemented error for telemetry.getSettings', () => {
        expect(() => browserApiStub.telemetry.getSettings()).toThrow('not yet implemented');
      });
    });

    describe('recovery methods', () => {
      it('should throw not implemented error for recovery.getStaleMoves', () => {
        expect(() => browserApiStub.recovery.getStaleMoves()).toThrow('not yet implemented');
      });
    });

    describe('diagnostics methods', () => {
      it('should throw not implemented error for diagnostics.getDuplicateNotes', () => {
        expect(() => browserApiStub.diagnostics.getDuplicateNotes()).toThrow('not yet implemented');
      });
    });

    describe('backup methods', () => {
      it('should throw not implemented error for backup.listBackups', () => {
        expect(() => browserApiStub.backup.listBackups()).toThrow('not yet implemented');
      });
    });

    describe('menu event subscriptions', () => {
      it('should return no-op function for menu event subscriptions', () => {
        const unsubscribe = browserApiStub.menu.onNewNote(() => {
          // No-op handler for testing
        });
        expect(typeof unsubscribe).toBe('function');
      });
    });

    describe('tools methods', () => {
      it('should throw not implemented error for tools.reindexNotes', () => {
        expect(() => browserApiStub.tools.reindexNotes()).toThrow('not yet implemented');
      });
    });

    describe('export methods', () => {
      it('should throw not implemented error for export.selectDirectory', () => {
        expect(() => browserApiStub.export.selectDirectory()).toThrow('not yet implemented');
      });
    });

    describe('webServer methods', () => {
      it('should throw not implemented error for webServer.start', () => {
        expect(() => browserApiStub.webServer.start()).toThrow('not yet implemented');
      });
    });

    describe('shell methods', () => {
      it('should throw not implemented error for shell.openExternal', () => {
        expect(() => browserApiStub.shell.openExternal('https://example.com')).toThrow(
          'not yet implemented'
        );
      });
    });

    describe('clipboard methods', () => {
      it('should throw not implemented error for clipboard.writeText', () => {
        expect(() => browserApiStub.clipboard.writeText('text')).toThrow('not yet implemented');
      });
    });

    describe('app methods', () => {
      it('should throw not implemented error for app.getInfo', () => {
        expect(() => browserApiStub.app.getInfo()).toThrow('not yet implemented');
      });
    });

    describe('testing methods', () => {
      it('should throw not implemented error for testing.createWindow', () => {
        expect(() => browserApiStub.testing.createWindow()).toThrow('not yet implemented');
      });
    });

    describe('appState methods', () => {
      it('should throw not implemented error for appState.get', () => {
        expect(() => browserApiStub.appState.get('key')).toThrow('not yet implemented');
      });
    });

    describe('shutdown event subscriptions', () => {
      it('should return no-op function for shutdown event subscriptions', () => {
        const unsubscribe = browserApiStub.shutdown.onProgress(() => {
          // No-op handler for testing
        });
        expect(typeof unsubscribe).toBe('function');
      });
    });
  });

  describe('initBrowserApiStub', () => {
    it('should install stub when electronAPI is undefined', () => {
      delete (window as unknown as Record<string, unknown>)['electronAPI'];
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      initBrowserApiStub();

      expect(window.electronAPI).toBe(browserApiStub);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Installing electronAPI stub')
      );

      consoleSpy.mockRestore();
    });

    it('should not overwrite existing electronAPI', () => {
      const existingApi = { platform: 'electron' };
      (window as unknown as Record<string, unknown>)['electronAPI'] = existingApi;

      initBrowserApiStub();

      expect(window.electronAPI).toBe(existingApi);
    });
  });
});

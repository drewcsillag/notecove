/**
 * File-based storage manager for NoteCove
 * MINIMAL VERSION - Only handles path configuration
 * All actual storage is done via CRDT (UpdateStore)
 */
export class FileStorage {
  constructor() {
    this.isElectron = window.electronAPI?.isElectron || false;
    this.notesPath = null;
    this.initialized = false;
  }

  /**
   * Initialize storage with notes directory
   * @param {string} notesPath - Path to notes directory
   */
  async initialize(notesPath = null) {
    try {
      if (this.isElectron) {
        // Use provided path or default to user documents
        this.notesPath = notesPath || await this.getDefaultNotesPath();
        console.log('FileStorage initialized with path:', this.notesPath);
      } else {
        // Web mode - use localStorage (already handled by NoteManager)
        this.notesPath = 'localStorage';
      }
      this.initialized = true;
      return true;
    } catch (error) {
      console.error('Failed to initialize storage:', error);
      return false;
    }
  }

  /**
   * Get default notes directory path
   */
  async getDefaultNotesPath() {
    if (!this.isElectron) return null;

    try {
      // Get notes path from settings (set by main process with --notes-path arg)
      let notesPath = await window.electronAPI.settings.get('notesPath');

      if (!notesPath) {
        // Fallback to default location
        const documentsPath = await window.electronAPI.settings.get('documentsPath');
        notesPath = `${documentsPath}/NoteCove`;
      }

      return notesPath;
    } catch (error) {
      console.error('Failed to get default notes path:', error);
      return './notes'; // Fallback to relative path
    }
  }
}

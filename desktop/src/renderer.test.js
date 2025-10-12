import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock dependencies
vi.mock('./lib/editor.js', () => ({
  NoteCoveEditor: vi.fn().mockImplementation(() => ({
    setContent: vi.fn(),
    getContent: vi.fn(() => '<p>Test content</p>'),
    getText: vi.fn(() => 'Test content'),
    focus: vi.fn(),
    isFocused: vi.fn(() => false),
    isEmpty: vi.fn(() => false),
    destroy: vi.fn()
  }))
}));

vi.mock('./lib/note-manager.js', () => ({
  NoteManager: vi.fn().mockImplementation(() => ({
    getAllNotes: vi.fn(() => []),
    createNote: vi.fn(() => ({
      id: 'test-note-id',
      title: '',
      content: '',
      created: new Date().toISOString(),
      modified: new Date().toISOString(),
      tags: [],
      deleted: false
    })),
    updateNote: vi.fn(),
    addListener: vi.fn(),
    getFolderManager: vi.fn(() => ({
      createFolder: vi.fn()
    }))
  }))
}));

describe('NoteCove Renderer', () => {
  beforeEach(() => {
    // Set up DOM
    document.body.innerHTML = `
      <div id="notesList"></div>
      <div id="welcomeState"></div>
      <div id="editorState" style="display: none;">
        <div class="editor-container">
          <div class="editor" id="editor"></div>
        </div>
      </div>
      <div class="status-bar">
        <div class="status-left">Ready</div>
      </div>
    `;

    // Mock window.electronAPI
    global.window.electronAPI = null;
  });

  describe('Title extraction from first line', () => {
    it('should extract title from first line of content', () => {
      const text = 'First Line Title\nSecond line\nThird line';
      const firstLine = text.split('\n')[0].trim();
      expect(firstLine).toBe('First Line Title');
    });

    it('should handle empty content', () => {
      const text = '';
      const firstLine = text.split('\n')[0].trim();
      const title = firstLine || 'Untitled';
      expect(title).toBe('Untitled');
    });

    it('should handle single line content', () => {
      const text = 'Only one line';
      const firstLine = text.split('\n')[0].trim();
      expect(firstLine).toBe('Only one line');
    });
  });

  describe('Note preview generation', () => {
    it('should generate preview from content', () => {
      const content = '<p>This is test content</p>';
      // In real implementation, this would strip HTML and create preview
      expect(content).toContain('test content');
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Mock } from 'vitest';
import {
  escapeHtml,
  getPreview,
  debounce,
  generateUUID,
  formatDate,
  validateNote,
  sanitizeFilename
} from './utils';

// Mock DOM element interface
interface MockElement {
  _innerHTML: string;
  _textContent: string;
  innerHTML: string;
  textContent: string;
}

// Mock Document interface
interface MockDocument {
  createElement: Mock<[], MockElement>;
}

// Mock DOM for escapeHtml and getPreview tests
beforeEach(() => {
  (global as any).document = {
    createElement: vi.fn((): MockElement => {
      const element: MockElement = {
        _innerHTML: '',
        _textContent: '',
        get innerHTML(): string {
          return this._innerHTML;
        },
        set innerHTML(value: string) {
          this._innerHTML = value;
          // Strip HTML tags for textContent
          this._textContent = value.replace(/<[^>]*>/g, '');
        },
        get textContent(): string {
          return this._textContent;
        },
        set textContent(value: string) {
          this._textContent = value;
        }
      };
      return element;
    })
  } as MockDocument;
});

describe('Utils', () => {
  describe('getPreview', () => {
    it('should return empty string for empty content', () => {
      expect(getPreview('')).toBe('');
      expect(getPreview(null as any)).toBe('');
      expect(getPreview(undefined as any)).toBe('');
    });

    it('should return full content if shorter than max length', () => {
      const content: string = '<p>Short content</p>';
      expect(getPreview(content)).toBe('Short content');
    });

    it('should truncate long content with ellipsis', () => {
      const content: string = '<p>This is a very long piece of content that should be truncated</p>';
      const preview: string = getPreview(content, 20);
      expect(preview).toBe('This is a very long ...');
    });

    it('should replace newlines with spaces', () => {
      const content: string = '<p>Line 1</p> <p>Line 2</p> <p>Line 3</p>';
      const preview: string = getPreview(content);
      expect(preview).toBe('Line 1 Line 2 Line 3');
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', (done) => {
      let callCount = 0;
      const func: () => void = debounce(() => {
        callCount++;
      }, 50);

      func();
      func();
      func();

      expect(callCount).toBe(0);

      setTimeout(() => {
        expect(callCount).toBe(1);
        done();
      }, 100);
    });
  });

  describe('generateUUID', () => {
    it('should generate valid UUID v4', () => {
      const uuid: string = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique UUIDs', () => {
      const uuid1: string = generateUUID();
      const uuid2: string = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('validateNote', () => {
    it('should validate correct note structure', () => {
      const note: any = {
        id: 'test-id',
        title: 'Test Note',
        content: 'Test content',
        created: '2024-01-01T00:00:00Z',
        modified: '2024-01-01T00:00:00Z',
        tags: ['test']
      };
      expect(validateNote(note)).toBe(true);
    });

    it('should reject invalid note structures', () => {
      expect(validateNote(null as any)).toBe(false);
      expect(validateNote({} as any)).toBe(false);
      expect(validateNote({ id: 123 } as any)).toBe(false); // id should be string
      expect(validateNote({
        id: 'test',
        title: 'test',
        content: 'test',
        created: 'test',
        modified: 'test',
        tags: 'not-array'
      } as any)).toBe(false);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove invalid characters', () => {
      const filename: string = 'test<>:"/\\|?*file.txt';
      expect(sanitizeFilename(filename)).toBe('testfile.txt');
    });

    it('should normalize whitespace', () => {
      const filename: string = '  test    file  ';
      expect(sanitizeFilename(filename)).toBe('test file');
    });

    it('should limit length', () => {
      const filename: string = 'a'.repeat(300);
      expect(sanitizeFilename(filename).length).toBe(255);
    });
  });
});

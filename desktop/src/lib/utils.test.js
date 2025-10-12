import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  escapeHtml,
  getPreview,
  debounce,
  generateUUID,
  formatDate,
  validateNote,
  sanitizeFilename
} from './utils.js';

// Mock DOM for escapeHtml test
beforeEach(() => {
  global.document = {
    createElement: vi.fn(() => ({
      textContent: '',
      innerHTML: ''
    }))
  };
});

describe('Utils', () => {
  describe('getPreview', () => {
    it('should return empty string for empty content', () => {
      expect(getPreview('')).toBe('');
      expect(getPreview(null)).toBe('');
      expect(getPreview(undefined)).toBe('');
    });

    it('should return full content if shorter than max length', () => {
      const content = 'Short content';
      expect(getPreview(content)).toBe(content);
    });

    it('should truncate long content with ellipsis', () => {
      const content = 'This is a very long piece of content that should be truncated';
      const preview = getPreview(content, 20);
      expect(preview).toBe('This is a very long ...');
    });

    it('should replace newlines with spaces', () => {
      const content = 'Line 1\nLine 2\nLine 3';
      const preview = getPreview(content);
      expect(preview).toBe('Line 1 Line 2 Line 3');
    });
  });

  describe('debounce', () => {
    it('should debounce function calls', (done) => {
      let callCount = 0;
      const func = debounce(() => {
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
      const uuid = generateUUID();
      expect(uuid).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('should generate unique UUIDs', () => {
      const uuid1 = generateUUID();
      const uuid2 = generateUUID();
      expect(uuid1).not.toBe(uuid2);
    });
  });

  describe('validateNote', () => {
    it('should validate correct note structure', () => {
      const note = {
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
      expect(validateNote(null)).toBe(false);
      expect(validateNote({})).toBe(false);
      expect(validateNote({ id: 123 })).toBe(false); // id should be string
      expect(validateNote({
        id: 'test',
        title: 'test',
        content: 'test',
        created: 'test',
        modified: 'test',
        tags: 'not-array'
      })).toBe(false);
    });
  });

  describe('sanitizeFilename', () => {
    it('should remove invalid characters', () => {
      const filename = 'test<>:"/\\|?*file.txt';
      expect(sanitizeFilename(filename)).toBe('testfile.txt');
    });

    it('should normalize whitespace', () => {
      const filename = '  test    file  ';
      expect(sanitizeFilename(filename)).toBe('test file');
    });

    it('should limit length', () => {
      const filename = 'a'.repeat(300);
      expect(sanitizeFilename(filename).length).toBe(255);
    });
  });
});
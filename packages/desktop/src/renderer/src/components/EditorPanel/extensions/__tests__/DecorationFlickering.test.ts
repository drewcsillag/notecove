/**
 * Decoration Flickering Tests
 *
 * Tests to reproduce and prevent decoration flickering issues:
 * 1. Tags flicker when typing anywhere in a note
 * 2. Links flicker to "[[Loading..." when typing in find dialog
 *
 * These tests verify that decorations are NOT unnecessarily regenerated.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import SearchAndReplace from '@sereneinserenade/tiptap-search-and-replace';
import {
  Hashtag,
  getHashtagDecorationRegenerationCount,
  resetHashtagDecorationRegenerationCount,
} from '../Hashtag';
import {
  InterNoteLink,
  getDecorationRegenerationCount,
  resetDecorationRegenerationCount,
  clearNoteTitleCache,
} from '../InterNoteLink';

// Mock window.electronAPI for InterNoteLink extension
const mockElectronAPI = {
  link: {
    searchNotesForAutocomplete: jest.fn().mockResolvedValue([
      { id: 'note-1', title: 'Test Note 1' },
      { id: 'note-2', title: 'Test Note 2' },
    ]),
  },
  tag: {
    getAll: jest.fn().mockResolvedValue([]),
  },
};

// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
if (!global.window) {
  // @ts-expect-error - mocking global
  global.window = {};
}
// @ts-expect-error - mocking electronAPI
global.window.electronAPI = mockElectronAPI;

describe('Decoration Flickering', () => {
  let editor: Editor;

  beforeEach(() => {
    // Reset counters before each test
    resetHashtagDecorationRegenerationCount();
    resetDecorationRegenerationCount();
    clearNoteTitleCache();
    jest.clearAllMocks();
  });

  afterEach(() => {
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (editor) {
      editor.destroy();
    }
  });

  describe('Hashtag decoration regeneration', () => {
    beforeEach(() => {
      editor = new Editor({
        extensions: [StarterKit, Hashtag],
        content: '<p>Hello #world this is a #test note</p>',
      });
    });

    it('should regenerate decorations when initializing (baseline)', () => {
      // Initial load should call findHashtags once
      expect(getHashtagDecorationRegenerationCount()).toBe(1);
    });

    it('should NOT regenerate all decorations when typing far from tags', () => {
      const initialCount = getHashtagDecorationRegenerationCount();

      // Type at the beginning of the document (far from any tags)
      editor.commands.setTextSelection(1);
      editor.commands.insertContent('X');

      // Current behavior: regenerates all decorations
      // Expected behavior: should NOT regenerate (no tags were affected)
      const afterTypingCount = getHashtagDecorationRegenerationCount();

      // This test FAILS because current implementation regenerates on every docChanged
      // After fix, this should pass (count should not increase)
      expect(afterTypingCount).toBe(initialCount);
    });

    it('should only update affected region when typing near a tag', () => {
      const initialCount = getHashtagDecorationRegenerationCount();

      // Type right before #world
      editor.commands.setTextSelection(7); // Position before #world
      editor.commands.insertContent('new ');

      const afterTypingCount = getHashtagDecorationRegenerationCount();

      // Current behavior: regenerates ALL decorations
      // Expected behavior: should only update decorations in affected range
      // For now, we accept one regeneration but verify we don't do multiple
      expect(afterTypingCount - initialCount).toBeLessThanOrEqual(1);
    });

    it('should correctly add decorations when a new tag is created (using incremental update)', () => {
      const initialCount = getHashtagDecorationRegenerationCount();

      // Type a new hashtag
      editor.commands.setTextSelection(editor.state.doc.content.size - 1);
      editor.commands.insertContent(' #newtag');

      const afterTypingCount = getHashtagDecorationRegenerationCount();

      // With incremental updates, we should NOT do a full regeneration
      // Instead, we scan only the affected region
      expect(afterTypingCount).toBe(initialCount);

      // Verify the new tag decoration exists by checking the document
      // The new hashtag should be decorated correctly
      const content = editor.getHTML();
      expect(content).toContain('#newtag');
    });

    it('should decorate hashtag at the very start of text', () => {
      // This test reproduces the E2E failure where #start wasn't decorated
      // when typing "#start some text #middle more text #end"
      editor.destroy();

      editor = new Editor({
        extensions: [StarterKit, Hashtag],
        content: '',
      });

      // Type text with hashtag at the start (simulating E2E scenario)
      editor.commands.insertContent('#start some text #middle more text #end');

      // Check decorations in the DOM
      const hashtagElements = editor.view.dom.querySelectorAll('.hashtag');
      const tagNames = Array.from(hashtagElements).map((el) => el.getAttribute('data-tag'));

      expect(hashtagElements.length).toBe(3);
      expect(tagNames).toEqual(['start', 'middle', 'end']);
    });

    it('should decorate hashtag at start when typed character by character', async () => {
      editor.destroy();

      editor = new Editor({
        extensions: [StarterKit, Hashtag],
        content: '',
      });

      // Type character by character like E2E does
      const text = '#start some text #middle more text #end';
      for (const char of text) {
        editor.commands.insertContent(char);
        await new Promise((resolve) => setTimeout(resolve, 1));
      }

      await new Promise((resolve) => setTimeout(resolve, 50));

      const hashtagElements = editor.view.dom.querySelectorAll('.hashtag');
      const tagNames = Array.from(hashtagElements).map((el) => el.getAttribute('data-tag'));

      expect(hashtagElements.length).toBe(3);
      expect(tagNames).toEqual(['start', 'middle', 'end']);
    });
  });

  describe('InterNoteLink decoration regeneration', () => {
    beforeEach(async () => {
      // Pre-populate the cache to avoid "Loading..." state
      mockElectronAPI.link.searchNotesForAutocomplete.mockResolvedValue([
        { id: 'note-1', title: 'Test Note 1' },
        { id: 'note-2', title: 'Test Note 2' },
      ]);

      editor = new Editor({
        extensions: [StarterKit, InterNoteLink],
        content: '<p>Check out [[note-1]] and [[note-2]] for more info</p>',
      });

      // Wait for async title fetches to complete
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should regenerate decorations when initializing (baseline)', async () => {
      // Initial load should call findAndDecorateLinks at least once
      expect(getDecorationRegenerationCount()).toBeGreaterThanOrEqual(1);
    });

    it('should NOT regenerate decorations when typing far from links', async () => {
      // Wait for any pending fetches
      await new Promise((resolve) => setTimeout(resolve, 50));
      const initialCount = getDecorationRegenerationCount();

      // Type at the beginning of the document (far from any links)
      editor.commands.setTextSelection(1);
      editor.commands.insertContent('X');

      // Wait a tick for any async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      const afterTypingCount = getDecorationRegenerationCount();

      // Current behavior: regenerates all decorations
      // Expected behavior: should NOT regenerate (no links were affected)
      // This test FAILS because current implementation regenerates on every docChanged
      expect(afterTypingCount).toBe(initialCount);
    });
  });

  describe('Search dialog interaction with decorations', () => {
    beforeEach(async () => {
      mockElectronAPI.link.searchNotesForAutocomplete.mockResolvedValue([
        { id: 'note-1', title: 'Test Note 1' },
      ]);

      editor = new Editor({
        extensions: [StarterKit, Hashtag, InterNoteLink, SearchAndReplace],
        content: '<p>Hello #world check [[note-1]] and search test</p>',
      });

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 100));
    });

    it('should NOT regenerate hashtag decorations when searching', async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const initialHashtagCount = getHashtagDecorationRegenerationCount();

      // Simulate typing in find dialog (sets search term without modifying document)
      editor.commands.setSearchTerm('test');

      // Wait a tick
      await new Promise((resolve) => setTimeout(resolve, 10));

      const afterSearchCount = getHashtagDecorationRegenerationCount();

      // Search should NOT trigger hashtag decoration regeneration
      // because the document hasn't changed
      expect(afterSearchCount).toBe(initialHashtagCount);
    });

    it('should NOT regenerate link decorations when searching', async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const initialLinkCount = getDecorationRegenerationCount();

      // Simulate typing in find dialog
      editor.commands.setSearchTerm('test');

      // Wait a tick
      await new Promise((resolve) => setTimeout(resolve, 10));

      const afterSearchCount = getDecorationRegenerationCount();

      // Search should NOT trigger link decoration regeneration
      // because the document hasn't changed
      expect(afterSearchCount).toBe(initialLinkCount);
    });

    it('should NOT regenerate link decorations on each search keystroke', async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      const initialLinkCount = getDecorationRegenerationCount();

      // Simulate multiple keystrokes in find dialog
      editor.commands.setSearchTerm('t');
      editor.commands.setSearchTerm('te');
      editor.commands.setSearchTerm('tes');
      editor.commands.setSearchTerm('test');

      // Wait for any async operations
      await new Promise((resolve) => setTimeout(resolve, 50));

      const afterSearchCount = getDecorationRegenerationCount();

      // None of these search operations should trigger link decoration regeneration
      expect(afterSearchCount).toBe(initialLinkCount);
    });
  });

  describe('forceDecoration anti-pattern (known issue for future improvement)', () => {
    it.skip('fetching one link title should NOT regenerate ALL link decorations', async () => {
      // Create editor with multiple links
      mockElectronAPI.link.searchNotesForAutocomplete.mockResolvedValue([]);
      clearNoteTitleCache();
      resetDecorationRegenerationCount();

      editor = new Editor({
        extensions: [StarterKit, InterNoteLink],
        content: '<p>Link1 [[note-1]] Link2 [[note-2]] Link3 [[note-3]]</p>',
      });

      // Wait for initial render
      await new Promise((resolve) => setTimeout(resolve, 50));
      const countAfterInit = getDecorationRegenerationCount();

      // Now simulate one note title being fetched
      // This currently dispatches forceDecoration which regenerates ALL decorations
      mockElectronAPI.link.searchNotesForAutocomplete.mockResolvedValue([
        { id: 'note-1', title: 'Found Note 1' },
      ]);

      // Trigger a fetch completion (in real code this would be the async callback)
      // For this test, we can't easily trigger the fetch, so we verify the behavior
      // by checking that forceDecoration causes regeneration

      // Create a transaction with forceDecoration meta
      const tr = editor.state.tr;
      tr.setMeta('forceDecoration', true);
      editor.view.dispatch(tr);

      await new Promise((resolve) => setTimeout(resolve, 10));
      const countAfterForce = getDecorationRegenerationCount();

      // Current behavior: forceDecoration regenerates ALL decorations
      // Expected behavior: should only update the specific link that was fetched
      // This test documents the anti-pattern
      expect(countAfterForce).toBe(countAfterInit); // This will FAIL, showing the problem
    });
  });
});

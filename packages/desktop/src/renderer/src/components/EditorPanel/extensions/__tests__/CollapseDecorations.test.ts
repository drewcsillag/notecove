/**
 * Tests for CollapseDecorations Plugin
 *
 * Tests for the decoration plugin that hides content under collapsed headings.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CollapsibleHeading } from '../CollapsibleHeading';
import { CollapseDecorations } from '../CollapseDecorations';

describe('CollapseDecorations Plugin', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit.configure({
          heading: false,
        }),
        CollapsibleHeading,
        CollapseDecorations,
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('hiding content under collapsed headings', () => {
    it('should hide paragraph after collapsed h2 until next h2', () => {
      editor.commands.setContent(`
        <h2 data-collapsed="true">Collapsed H2</h2>
        <p>This should be hidden</p>
        <h2>Next H2</h2>
        <p>This should be visible</p>
      `);

      const editorDOM = editor.view.dom;

      // The paragraph after collapsed h2 should have the hidden class
      const paragraphs = editorDOM.querySelectorAll('p');
      expect(paragraphs.length).toBe(2);

      // First paragraph should be hidden (after collapsed h2)
      expect(paragraphs[0]!.classList.contains('collapsed-content')).toBe(true);

      // Second paragraph should be visible (after non-collapsed h2)
      expect(paragraphs[1]!.classList.contains('collapsed-content')).toBe(false);
    });

    it('should hide content after collapsed h1 until next h1', () => {
      editor.commands.setContent(`
        <h1 data-collapsed="true">Collapsed H1</h1>
        <p>Hidden para 1</p>
        <h2>H2 also hidden</h2>
        <p>Hidden para 2</p>
        <h1>Next H1</h1>
        <p>Visible para</p>
      `);

      const editorDOM = editor.view.dom;

      // Content between collapsed h1 and next h1 should be hidden
      // The h2 "H2 also hidden" should also be hidden

      // Find all elements with collapsed-content class
      const hiddenElements = editorDOM.querySelectorAll('.collapsed-content');

      // Should have 3 hidden elements: para 1, h2, para 2
      expect(hiddenElements.length).toBe(3);
    });

    it('should hide nested headings when parent is collapsed', () => {
      editor.commands.setContent(`
        <h1 data-collapsed="true">Collapsed H1</h1>
        <p>Para under h1</p>
        <h2>H2 under collapsed h1</h2>
        <p>Para under h2</p>
        <h3>H3 under h2</h3>
        <p>Para under h3</p>
        <h1>Next H1 - visible</h1>
      `);

      const editorDOM = editor.view.dom;
      const hiddenElements = editorDOM.querySelectorAll('.collapsed-content');

      // Everything between first h1 and second h1 should be hidden (5 elements)
      expect(hiddenElements.length).toBe(5);
    });

    it('should handle multiple independent collapsed headings', () => {
      // Use inline HTML to avoid whitespace issues
      editor.commands.setContent(
        '<h2 data-collapsed="true">Collapsed A</h2>' +
          '<p>Hidden A</p>' +
          '<h2>Visible B</h2>' +
          '<p>Visible B content</p>' +
          '<h2 data-collapsed="true">Collapsed C</h2>' +
          '<p>Hidden C</p>' +
          '<h2>Visible D</h2>'
      );

      const editorDOM = editor.view.dom;

      // Find paragraphs with our specific text content
      const hiddenAPara = Array.from(editorDOM.querySelectorAll('p')).find(
        (p) => p.textContent === 'Hidden A'
      );
      const visibleBPara = Array.from(editorDOM.querySelectorAll('p')).find(
        (p) => p.textContent === 'Visible B content'
      );
      const hiddenCPara = Array.from(editorDOM.querySelectorAll('p')).find(
        (p) => p.textContent === 'Hidden C'
      );

      expect(hiddenAPara).toBeDefined();
      expect(visibleBPara).toBeDefined();
      expect(hiddenCPara).toBeDefined();

      // First para (after Collapsed A) should be hidden
      expect(hiddenAPara?.classList.contains('collapsed-content')).toBe(true);

      // Second para (after Visible B) should NOT be hidden
      expect(visibleBPara?.classList.contains('collapsed-content')).toBe(false);

      // Third para (after Collapsed C) should be hidden
      expect(hiddenCPara?.classList.contains('collapsed-content')).toBe(true);
    });

    it('should hide content to end of document if no terminating heading', () => {
      editor.commands.setContent(`
        <h2 data-collapsed="true">Collapsed</h2>
        <p>Para 1</p>
        <p>Para 2</p>
        <p>Para 3</p>
      `);

      const editorDOM = editor.view.dom;
      const hiddenElements = editorDOM.querySelectorAll('.collapsed-content');

      // All 3 paragraphs should be hidden
      expect(hiddenElements.length).toBe(3);
    });

    it('should not hide anything when heading is expanded', () => {
      editor.commands.setContent(`
        <h2>Expanded H2</h2>
        <p>Visible para 1</p>
        <p>Visible para 2</p>
        <h2>Another H2</h2>
        <p>Visible para 3</p>
      `);

      const editorDOM = editor.view.dom;
      const hiddenElements = editorDOM.querySelectorAll('.collapsed-content');

      // No elements should be hidden
      expect(hiddenElements.length).toBe(0);
    });

    it('should update decorations when collapse state changes', () => {
      editor.commands.setContent(`
        <h2>Heading</h2>
        <p>Content</p>
      `);

      const editorDOM = editor.view.dom;

      // Initially expanded - content visible
      let hiddenElements = editorDOM.querySelectorAll('.collapsed-content');
      expect(hiddenElements.length).toBe(0);

      // Collapse the heading
      editor.commands.focus('start');
      editor.commands.toggleHeadingCollapse();

      // Content should now be hidden
      hiddenElements = editorDOM.querySelectorAll('.collapsed-content');
      expect(hiddenElements.length).toBe(1);

      // Expand the heading
      editor.commands.toggleHeadingCollapse();

      // Content should be visible again
      hiddenElements = editorDOM.querySelectorAll('.collapsed-content');
      expect(hiddenElements.length).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle empty document', () => {
      editor.commands.setContent('');

      const editorDOM = editor.view.dom;
      const hiddenElements = editorDOM.querySelectorAll('.collapsed-content');
      expect(hiddenElements.length).toBe(0);
    });

    it('should handle document with only paragraphs (no headings)', () => {
      editor.commands.setContent('<p>Just a paragraph</p><p>Another one</p>');

      const editorDOM = editor.view.dom;
      const hiddenElements = editorDOM.querySelectorAll('.collapsed-content');
      expect(hiddenElements.length).toBe(0);
    });

    it('should handle collapsed heading with no content after it', () => {
      editor.commands.setContent('<h2 data-collapsed="true">Just a heading</h2>');

      const editorDOM = editor.view.dom;

      // When there's no content after a collapsed heading, there should be nothing to hide
      // Note: The heading itself is NOT hidden, only content AFTER it
      const hiddenElements = editorDOM.querySelectorAll('.collapsed-content');

      // If TipTap adds an empty paragraph after the heading, that might be hidden
      // Let's check what nodes we actually have
      const allNodes = editorDOM.querySelectorAll('.ProseMirror > *');

      // The only node should be the heading wrapper itself
      // If there are more nodes (like auto-added empty paragraph), adjust expectation
      if (allNodes.length === 1) {
        expect(hiddenElements.length).toBe(0);
      } else {
        // TipTap might add an empty paragraph after - that's OK to hide
        expect(hiddenElements.length).toBeLessThanOrEqual(1);
      }
    });

    it('should handle adjacent collapsed headings', () => {
      editor.commands.setContent(`
        <h2 data-collapsed="true">Collapsed 1</h2>
        <h2 data-collapsed="true">Collapsed 2</h2>
        <p>Hidden under Collapsed 2</p>
        <h2>Visible</h2>
      `);

      const editorDOM = editor.view.dom;

      // "Collapsed 2" heading terminates "Collapsed 1" (same level)
      // Only the paragraph after "Collapsed 2" should be hidden
      const hiddenElements = editorDOM.querySelectorAll('.collapsed-content');
      expect(hiddenElements.length).toBe(1);
    });
  });
});

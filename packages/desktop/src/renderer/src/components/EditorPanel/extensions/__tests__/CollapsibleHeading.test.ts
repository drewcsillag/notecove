/**
 * Tests for CollapsibleHeading Extension
 *
 * Tests for the collapsible heading feature that allows users to
 * collapse/expand content under headings.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { CollapsibleHeading } from '../CollapsibleHeading';

describe('CollapsibleHeading Extension', () => {
  let editor: Editor;

  beforeEach(() => {
    editor = new Editor({
      extensions: [
        StarterKit.configure({
          heading: false, // Disable default heading
        }),
        CollapsibleHeading,
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
  });

  describe('collapsed attribute', () => {
    it('should have collapsed attribute that defaults to false', () => {
      editor.commands.setContent('<h1>Test Heading</h1>');

      const heading = editor.state.doc.firstChild;
      expect(heading).not.toBeNull();
      expect(heading?.type.name).toBe('heading');
      expect(heading?.attrs['collapsed']).toBe(false);
    });

    it('should treat existing headings without collapsed attr as expanded', () => {
      // Simulate loading content that was created before collapse feature
      editor.commands.setContent('<h2>Old Heading</h2><p>Content</p>');

      const heading = editor.state.doc.firstChild;
      expect(heading?.attrs['collapsed']).toBe(false);
    });

    it('should preserve collapsed=true when set', () => {
      editor.commands.setContent('<h1 data-collapsed="true">Collapsed Heading</h1>');

      const heading = editor.state.doc.firstChild;
      expect(heading?.attrs['collapsed']).toBe(true);
    });

    it('should preserve collapsed=false when explicitly set', () => {
      editor.commands.setContent('<h1 data-collapsed="false">Expanded Heading</h1>');

      const heading = editor.state.doc.firstChild;
      expect(heading?.attrs['collapsed']).toBe(false);
    });
  });

  describe('split heading behavior', () => {
    it('should default collapsed to false for new headings', () => {
      // When creating a new heading programmatically, collapsed should default to false
      const headingType = editor.schema.nodes['heading']!;
      const newHeading = headingType.create({ level: 2 });

      expect(newHeading.attrs['collapsed']).toBe(false);
    });

    it('should not copy collapsed state when creating heading from collapsed one', () => {
      // Start with a collapsed heading
      editor.commands.setContent('<h1 data-collapsed="true">Original</h1>');
      const originalHeading = editor.state.doc.child(0);
      expect(originalHeading.attrs['collapsed']).toBe(true);

      // Create a new heading with same level - collapsed should NOT be copied
      const headingType = editor.schema.nodes['heading']!;
      const newHeading = headingType.create({ level: 1 });

      // New heading should have collapsed=false (default)
      expect(newHeading.attrs['collapsed']).toBe(false);
    });

    it('should keep original heading collapsed when converting to different level', () => {
      editor.commands.setContent('<h1 data-collapsed="true">Test</h1>');
      editor.commands.focus('start');

      // Change to h2 - should preserve collapsed
      editor.commands.setHeading({ level: 2 });

      const heading = editor.state.doc.firstChild;
      expect(heading?.attrs['level']).toBe(2);
      expect(heading?.attrs['collapsed']).toBe(true);
    });
  });

  describe('heading levels', () => {
    it('should support heading levels 1-3', () => {
      editor.commands.setContent('<h1>H1</h1><h2>H2</h2><h3>H3</h3>');

      expect(editor.state.doc.child(0).attrs['level']).toBe(1);
      expect(editor.state.doc.child(1).attrs['level']).toBe(2);
      expect(editor.state.doc.child(2).attrs['level']).toBe(3);
    });

    it('should preserve collapsed attribute across all heading levels', () => {
      editor.commands.setContent(`
        <h1 data-collapsed="true">H1</h1>
        <h2 data-collapsed="false">H2</h2>
        <h3 data-collapsed="true">H3</h3>
      `);

      expect(editor.state.doc.child(0).attrs['collapsed']).toBe(true);
      expect(editor.state.doc.child(1).attrs['collapsed']).toBe(false);
      expect(editor.state.doc.child(2).attrs['collapsed']).toBe(true);
    });
  });

  describe('existing heading commands', () => {
    it('should support setHeading command', () => {
      editor.commands.setContent('<p>Test</p>');
      editor.commands.focus('start');
      editor.commands.setHeading({ level: 2 });

      const heading = editor.state.doc.firstChild;
      expect(heading?.type.name).toBe('heading');
      expect(heading?.attrs['level']).toBe(2);
      expect(heading?.attrs['collapsed']).toBe(false);
    });

    it('should support toggleHeading command', () => {
      editor.commands.setContent('<p>Test</p>');
      editor.commands.focus('start');
      editor.commands.toggleHeading({ level: 1 });

      expect(editor.state.doc.firstChild?.type.name).toBe('heading');

      // Toggle back to paragraph
      editor.commands.toggleHeading({ level: 1 });
      expect(editor.state.doc.firstChild?.type.name).toBe('paragraph');
    });
  });

  describe('NodeView and toggle', () => {
    it('should render heading with toggle button', () => {
      editor.commands.setContent('<h1>Test Heading</h1>');

      // The NodeView should render a wrapper with a toggle button
      const editorDOM = editor.view.dom;
      const toggleButton = editorDOM.querySelector('.heading-collapse-toggle');

      expect(toggleButton).not.toBeNull();
    });

    it('should show expanded indicator when not collapsed', () => {
      editor.commands.setContent('<h1>Test Heading</h1>');

      const editorDOM = editor.view.dom;
      const headingWrapper = editorDOM.querySelector('.heading-wrapper');

      expect(headingWrapper?.getAttribute('data-collapsed')).toBe('false');
    });

    it('should show collapsed indicator when collapsed', () => {
      editor.commands.setContent('<h1 data-collapsed="true">Collapsed</h1>');

      const editorDOM = editor.view.dom;
      const headingWrapper = editorDOM.querySelector('.heading-wrapper');

      expect(headingWrapper?.getAttribute('data-collapsed')).toBe('true');
    });

    it('should toggle collapsed state when toggle button is clicked', () => {
      editor.commands.setContent('<h1>Test Heading</h1>');

      // Initially expanded
      expect(editor.state.doc.firstChild?.attrs['collapsed']).toBe(false);

      // Find and click the toggle button
      const editorDOM = editor.view.dom;
      const toggleButton = editorDOM.querySelector<HTMLElement>('.heading-collapse-toggle');
      expect(toggleButton).not.toBeNull();

      toggleButton!.click();

      // Should now be collapsed
      expect(editor.state.doc.firstChild?.attrs['collapsed']).toBe(true);
    });

    it('should expand when toggle clicked on collapsed heading', () => {
      editor.commands.setContent('<h1 data-collapsed="true">Collapsed</h1>');

      expect(editor.state.doc.firstChild?.attrs['collapsed']).toBe(true);

      const editorDOM = editor.view.dom;
      const toggleButton = editorDOM.querySelector<HTMLElement>('.heading-collapse-toggle');
      toggleButton!.click();

      expect(editor.state.doc.firstChild?.attrs['collapsed']).toBe(false);
    });

    it('should preserve heading level attribute in DOM', () => {
      editor.commands.setContent('<h2>H2 Heading</h2>');

      const editorDOM = editor.view.dom;
      const headingWrapper = editorDOM.querySelector('.heading-wrapper');

      expect(headingWrapper?.getAttribute('data-level')).toBe('2');
    });
  });

  describe('keyboard shortcuts', () => {
    it('should toggle collapse with Mod-. when cursor is in heading', () => {
      editor.commands.setContent('<h1>Test Heading</h1><p>Content</p>');

      // Initially expanded
      expect(editor.state.doc.firstChild?.attrs['collapsed']).toBe(false);

      // Focus in the heading
      editor.commands.focus('start');

      // Trigger Mod-. shortcut
      const handled = editor.commands.keyboardShortcut('Mod-.');

      expect(handled).toBe(true);
      expect(editor.state.doc.firstChild?.attrs['collapsed']).toBe(true);
    });

    it('should do nothing with Mod-. when cursor is not in heading', () => {
      editor.commands.setContent('<h1>Heading</h1><p>Paragraph</p>');

      // Initial state - heading is expanded
      const initialCollapsed = editor.state.doc.firstChild?.attrs['collapsed'];
      expect(initialCollapsed).toBe(false);

      // Focus in the paragraph (not the heading)
      editor.commands.setTextSelection(editor.state.doc.firstChild!.nodeSize + 2);

      // Trigger Mod-. shortcut
      editor.commands.keyboardShortcut('Mod-.');

      // The heading's collapsed state should NOT have changed
      expect(editor.state.doc.firstChild?.attrs['collapsed']).toBe(false);
    });

    it('should collapse all headings with Mod-Shift-. when some are expanded', () => {
      editor.commands.setContent(
        '<h1>H1</h1><p>P1</p><h2>H2</h2><p>P2</p><h1 data-collapsed="true">H1 collapsed</h1>'
      );

      // Some are expanded, some collapsed
      expect(editor.state.doc.child(0).attrs['collapsed']).toBe(false);
      expect(editor.state.doc.child(2).attrs['collapsed']).toBe(false);
      expect(editor.state.doc.child(4).attrs['collapsed']).toBe(true);

      editor.commands.focus('start');

      // Trigger Mod-Shift-. shortcut
      editor.commands.keyboardShortcut('Mod-Shift-.');

      // All should now be collapsed
      expect(editor.state.doc.child(0).attrs['collapsed']).toBe(true);
      expect(editor.state.doc.child(2).attrs['collapsed']).toBe(true);
      expect(editor.state.doc.child(4).attrs['collapsed']).toBe(true);
    });

    it('should expand all headings with Mod-Shift-. when all are collapsed', () => {
      editor.commands.setContent(
        '<h1 data-collapsed="true">H1</h1><p>P1</p>' + '<h2 data-collapsed="true">H2</h2><p>P2</p>'
      );

      // All collapsed
      expect(editor.state.doc.child(0).attrs['collapsed']).toBe(true);
      expect(editor.state.doc.child(2).attrs['collapsed']).toBe(true);

      editor.commands.focus('start');

      // Trigger Mod-Shift-. shortcut
      editor.commands.keyboardShortcut('Mod-Shift-.');

      // All should now be expanded
      expect(editor.state.doc.child(0).attrs['collapsed']).toBe(false);
      expect(editor.state.doc.child(2).attrs['collapsed']).toBe(false);
    });
  });

  describe('input rules', () => {
    // Note: Input rules are inherited from the base Heading extension.
    // Direct input rule testing requires simulating actual keystrokes,
    // which is complex in JSDOM. Instead, we verify the extension
    // properly extends Heading with the correct input rules config.

    it('should have input rules defined', () => {
      // The extension should have input rules from the parent Heading
      const extensions = editor.extensionManager.extensions;
      const headingExt = extensions.find((ext) => ext.name === 'heading');

      expect(headingExt).toBeDefined();
      // Input rules are defined at the extension level
      expect(headingExt?.options.levels).toEqual([1, 2, 3]);
    });

    it('should create heading via setHeading command with collapsed=false', () => {
      editor.commands.setContent('<p>Test</p>');
      editor.commands.focus('start');
      editor.commands.setHeading({ level: 1 });

      const firstNode = editor.state.doc.firstChild;
      expect(firstNode?.type.name).toBe('heading');
      expect(firstNode?.attrs['level']).toBe(1);
      expect(firstNode?.attrs['collapsed']).toBe(false);
    });
  });
});

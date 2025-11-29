/**
 * Unit tests for Undo/Redo functionality with TipTap + Yjs Collaboration
 *
 * These tests verify that the UndoManager is properly configured and working
 * without needing the full Electron app.
 */

import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Collaboration from '@tiptap/extension-collaboration';
import * as Y from 'yjs';
import { yUndoPluginKey } from 'y-prosemirror';

describe('TipTap Undo/Redo with Yjs Collaboration', () => {
  let editor: Editor;
  let yDoc: Y.Doc;

  beforeEach(() => {
    // Create a fresh Y.Doc for each test
    yDoc = new Y.Doc();

    // Create editor with same configuration as TipTapEditor.tsx
    editor = new Editor({
      extensions: [
        StarterKit.configure({
          history: false, // Disable default history - Collaboration has its own
        }),
        Collaboration.configure({
          document: yDoc,
          fragment: yDoc.getXmlFragment('content'),
        }),
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
    yDoc.destroy();
  });

  it('should have UndoManager available in plugin state', () => {
    const undoPluginState = yUndoPluginKey.getState(editor.state);

    expect(undoPluginState).toBeDefined();
    expect(undoPluginState?.undoManager).toBeDefined();
  });

  it('should have correct trackedOrigins (including ySyncPluginKey)', () => {
    const undoPluginState = yUndoPluginKey.getState(editor.state);
    const um = undoPluginState?.undoManager;

    expect(um).toBeDefined();
    if (um) {
      // Should have at least 2 tracked origins: the UndoManager itself and ySyncPluginKey
      console.log('trackedOrigins size:', um.trackedOrigins.size);
      console.log(
        'trackedOrigins:',
        Array.from(um.trackedOrigins).map((o) =>
          // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
          typeof o === 'object' ? o.constructor?.name || 'PluginKey' : String(o)
        )
      );

      expect(um.trackedOrigins.size).toBeGreaterThanOrEqual(2);
    }
  });

  it('should track typed content in undo stack', () => {
    const undoPluginState = yUndoPluginKey.getState(editor.state);
    const um = undoPluginState?.undoManager;

    expect(um).toBeDefined();
    if (!um) return;

    // Initial state - empty undo stack
    expect(um.undoStack.length).toBe(0);

    // Type some content
    editor.commands.insertContent('Hello');

    // Wait a tick for Yjs to process
    // The undo stack should have content now
    console.log('After insertContent - undoStack:', um.undoStack.length);
    expect(um.undoStack.length).toBeGreaterThan(0);
  });

  it('should undo typed content', () => {
    // Type some content
    editor.commands.insertContent('Hello World');

    // Get content before undo
    const contentBefore = editor.getText();
    console.log('Content before undo:', contentBefore);
    expect(contentBefore).toContain('Hello World');

    // Undo
    editor.commands.undo();

    // Get content after undo
    const contentAfter = editor.getText();
    console.log('Content after undo:', contentAfter);

    // Content should be different (empty or partial)
    expect(contentAfter).not.toBe(contentBefore);
  });

  it('should redo after undo', () => {
    // Type some content
    editor.commands.insertContent('Test');

    const contentOriginal = editor.getText();

    // Undo
    editor.commands.undo();
    const contentAfterUndo = editor.getText();
    expect(contentAfterUndo).not.toBe(contentOriginal);

    // Redo
    editor.commands.redo();
    const contentAfterRedo = editor.getText();

    // Should be back to original
    expect(contentAfterRedo).toBe(contentOriginal);
  });

  it('should report canUndo correctly', () => {
    // Initially no undo available
    expect(editor.can().undo()).toBe(false);

    // Type content
    editor.commands.insertContent('Test');

    // Now undo should be available
    expect(editor.can().undo()).toBe(true);

    // Undo
    editor.commands.undo();

    // After undoing everything, undo should not be available
    // (unless there's more history)
    console.log('canUndo after undo:', editor.can().undo());
  });

  it('should report canRedo correctly', () => {
    // Initially no redo available
    expect(editor.can().redo()).toBe(false);

    // Type content
    editor.commands.insertContent('Test');

    // Still no redo (haven't undone anything)
    expect(editor.can().redo()).toBe(false);

    // Undo
    editor.commands.undo();

    // Now redo should be available
    expect(editor.can().redo()).toBe(true);
  });

  it('should handle multiple undo/redo operations', () => {
    // Type multiple things with small delays
    editor.commands.insertContent('First');

    // Force capture by stopping
    const um = yUndoPluginKey.getState(editor.state)?.undoManager;
    um?.stopCapturing();

    editor.commands.insertContent(' Second');
    um?.stopCapturing();

    editor.commands.insertContent(' Third');
    um?.stopCapturing();

    const fullContent = editor.getText();
    console.log('Full content:', fullContent);
    expect(fullContent).toContain('First Second Third');

    // Undo once
    editor.commands.undo();
    const after1 = editor.getText();
    console.log('After 1st undo:', after1);

    // Undo twice
    editor.commands.undo();
    const after2 = editor.getText();
    console.log('After 2nd undo:', after2);

    // Undo three times
    editor.commands.undo();
    const after3 = editor.getText();
    console.log('After 3rd undo:', after3);

    // Each undo should have changed content
    expect(after1).not.toBe(fullContent);
    expect(after2).not.toBe(after1);
  });
});

describe('UndoManager with external Y.Doc updates', () => {
  let editor: Editor;
  let yDoc: Y.Doc;

  beforeEach(() => {
    yDoc = new Y.Doc();
    editor = new Editor({
      extensions: [
        StarterKit.configure({
          history: false,
        }),
        Collaboration.configure({
          document: yDoc,
          fragment: yDoc.getXmlFragment('content'),
        }),
      ],
      content: '',
    });
  });

  afterEach(() => {
    editor.destroy();
    yDoc.destroy();
  });

  it('should preserve undo stack when applying own update back', () => {
    const um = yUndoPluginKey.getState(editor.state)?.undoManager;
    expect(um).toBeDefined();
    if (!um) return;

    // Type content
    editor.commands.insertContent('Hello');
    const stackSizeAfterTyping = um.undoStack.length;
    console.log('Undo stack after typing:', stackSizeAfterTyping);

    // Capture current state
    const currentState = Y.encodeStateAsUpdate(yDoc);

    // Simulate receiving our own update back (like from main process bounce)
    // Apply with 'remote' origin like TipTapEditor does
    Y.applyUpdate(yDoc, currentState, 'remote');

    // Check undo stack is preserved
    const stackSizeAfterBounce = um.undoStack.length;
    console.log('Undo stack after bounce-back:', stackSizeAfterBounce);

    // The undo stack should still be intact
    expect(stackSizeAfterBounce).toBe(stackSizeAfterTyping);
  });

  it('should still allow undo after applying remote update', () => {
    // Type content
    editor.commands.insertContent('Original');
    const contentWithOriginal = editor.getText();

    // Simulate remote update coming in
    const currentState = Y.encodeStateAsUpdate(yDoc);
    Y.applyUpdate(yDoc, currentState, 'remote');

    // Should still be able to undo
    const canUndoAfterRemote = editor.can().undo();
    console.log('canUndo after remote update:', canUndoAfterRemote);

    if (canUndoAfterRemote) {
      editor.commands.undo();
      const contentAfterUndo = editor.getText();
      console.log('Content after undo:', contentAfterUndo);
      expect(contentAfterUndo).not.toBe(contentWithOriginal);
    } else {
      // This would indicate the bug
      console.error('BUG: Cannot undo after remote update!');
      expect(canUndoAfterRemote).toBe(true);
    }
  });
});

/**
 * These tests simulate the exact loading flow used in TipTapEditor.tsx:
 * 1. Create empty Y.Doc and editor
 * 2. Load initial state via Y.applyUpdate with 'load' origin
 * 3. Type content
 * 4. Verify undo/redo works
 *
 * Note: To create valid initial state, we need to use a separate editor instance
 * because raw Y.XmlText doesn't match the ProseMirror schema.
 */
describe('UndoManager with note loading flow (simulates TipTapEditor)', () => {
  /**
   * Helper to create initial state using a temporary editor
   * (this matches how notes are created/saved in the real app)
   */
  function createInitialState(content: string): Uint8Array {
    const tempDoc = new Y.Doc();
    const tempEditor = new Editor({
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({
          document: tempDoc,
          fragment: tempDoc.getXmlFragment('content'),
        }),
      ],
      content: '',
    });

    // Add content
    tempEditor.commands.insertContent(content);

    // Capture state
    const state = Y.encodeStateAsUpdate(tempDoc);

    // Cleanup
    tempEditor.destroy();
    tempDoc.destroy();

    return state;
  }

  /**
   * This test simulates the exact flow in TipTapEditor:
   * 1. Create fresh Y.Doc and editor (empty)
   * 2. Load note state via Y.applyUpdate(yDoc, state, 'load')
   * 3. Type content
   * 4. Try to undo
   */
  it('should track changes after loading initial state', () => {
    // Step 1: Create initial state (simulating note from main process)
    const initialState = createInitialState('Initial content from note');

    // Step 2: Create fresh Y.Doc for this "editor instance" (like TipTapEditor does)
    const yDoc = new Y.Doc();
    const editor = new Editor({
      extensions: [
        StarterKit.configure({
          history: false,
        }),
        Collaboration.configure({
          document: yDoc,
          fragment: yDoc.getXmlFragment('content'),
        }),
      ],
      content: '', // No initial content - let Yjs handle it
    });

    // Step 3: Load the initial state (exactly like TipTapEditor.tsx line 370)
    Y.applyUpdate(yDoc, initialState, 'load');

    // Check the UndoManager state after loading
    const um = yUndoPluginKey.getState(editor.state)?.undoManager;
    expect(um).toBeDefined();
    if (!um) {
      editor.destroy();
      yDoc.destroy();
      return;
    }

    console.log('After load - trackedOrigins size:', um.trackedOrigins.size);
    console.log(
      'After load - trackedOrigins:',
      Array.from(um.trackedOrigins).map((o) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
        typeof o === 'object' ? o.constructor?.name || 'object' : String(o)
      )
    );
    console.log('After load - undoStack:', um.undoStack.length);
    console.log('After load - canUndo:', editor.can().undo());

    // The initial load should NOT add to undo stack (since origin is 'load')
    // BUT it might if the origin 'load' is not excluded from tracked origins...
    // Let's see what happens
    const undoStackAfterLoad = um.undoStack.length;
    console.log('undoStack after load:', undoStackAfterLoad);

    // trackedOrigins should have 2 entries (ySyncPluginKey and UndoManager)
    expect(um.trackedOrigins.size).toBe(2);

    // Step 4: Type new content
    editor.commands.insertContent(' - Added by user');

    console.log('After typing - undoStack:', um.undoStack.length);
    console.log('After typing - canUndo:', editor.can().undo());

    // Should have content in undo stack now
    expect(um.undoStack.length).toBeGreaterThan(undoStackAfterLoad);
    expect(editor.can().undo()).toBe(true);

    // Step 5: Undo should work
    const contentBeforeUndo = editor.getText();
    console.log('Content before undo:', contentBeforeUndo);

    editor.commands.undo();

    const contentAfterUndo = editor.getText();
    console.log('Content after undo:', contentAfterUndo);

    expect(contentAfterUndo).not.toBe(contentBeforeUndo);

    // Cleanup
    editor.destroy();
    yDoc.destroy();
  });

  /**
   * Test undo works after MULTIPLE undos (the reported bug)
   */
  it('should support multiple undos after loading initial state', () => {
    // Create initial state
    const initialState = createInitialState('Initial');

    // Create editor
    const yDoc = new Y.Doc();
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({
          document: yDoc,
          fragment: yDoc.getXmlFragment('content'),
        }),
      ],
      content: '',
    });

    // Load initial state
    Y.applyUpdate(yDoc, initialState, 'load');

    const um = yUndoPluginKey.getState(editor.state)?.undoManager;
    expect(um).toBeDefined();
    if (!um) {
      editor.destroy();
      yDoc.destroy();
      return;
    }

    // Type multiple pieces of content with stopCapturing between them
    editor.commands.insertContent(' AAA');
    um.stopCapturing();

    editor.commands.insertContent(' BBB');
    um.stopCapturing();

    editor.commands.insertContent(' CCC');
    um.stopCapturing();

    const fullContent = editor.getText();
    console.log('Full content:', fullContent);
    console.log('Undo stack size:', um.undoStack.length);

    // First undo
    expect(editor.can().undo()).toBe(true);
    editor.commands.undo();
    const after1 = editor.getText();
    console.log('After 1st undo:', after1, 'canUndo:', editor.can().undo());

    // Second undo - THIS IS WHERE THE BUG MANIFESTS
    expect(editor.can().undo()).toBe(true);
    editor.commands.undo();
    const after2 = editor.getText();
    console.log('After 2nd undo:', after2, 'canUndo:', editor.can().undo());

    // Third undo
    expect(editor.can().undo()).toBe(true);
    editor.commands.undo();
    const after3 = editor.getText();
    console.log('After 3rd undo:', after3, 'canUndo:', editor.can().undo());

    // Each should be different
    expect(after1).not.toBe(fullContent);
    expect(after2).not.toBe(after1);
    expect(after3).not.toBe(after2);

    // Cleanup
    editor.destroy();
    yDoc.destroy();
  });

  /**
   * Test that bounce-back updates (our own update coming back from main process)
   * don't break the undo stack after loading
   */
  it('should preserve undo after loading + bounce-back', () => {
    // Create initial state
    const initialState = createInitialState('Initial');

    // Create editor
    const yDoc = new Y.Doc();
    const editor = new Editor({
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({
          document: yDoc,
          fragment: yDoc.getXmlFragment('content'),
        }),
      ],
      content: '',
    });

    // Load initial state
    Y.applyUpdate(yDoc, initialState, 'load');

    const um = yUndoPluginKey.getState(editor.state)?.undoManager;
    expect(um).toBeDefined();
    if (!um) {
      editor.destroy();
      yDoc.destroy();
      return;
    }

    // Type content
    editor.commands.insertContent(' typed');

    // Capture the current state (simulating what main process would broadcast back)
    const currentState = Y.encodeStateAsUpdate(yDoc);

    // In real app, we skip this bounce-back. But let's test what happens if we apply it:
    // Simulating: user typed -> sent to main -> main broadcasts to ALL windows including us
    // The update should NOT break undo (and ideally we skip it entirely)

    console.log('Before bounce-back - canUndo:', editor.can().undo());
    console.log('Before bounce-back - undoStack:', um.undoStack.length);

    // Apply bounce-back with 'remote' origin (like we do for external updates)
    Y.applyUpdate(yDoc, currentState, 'remote');

    console.log('After bounce-back - canUndo:', editor.can().undo());
    console.log('After bounce-back - undoStack:', um.undoStack.length);

    // Undo should still work
    expect(editor.can().undo()).toBe(true);

    editor.commands.undo();
    const afterUndo = editor.getText();
    console.log('After undo:', afterUndo);

    // Should have undone our typed content
    expect(afterUndo).not.toContain(' typed');

    // Cleanup
    editor.destroy();
    yDoc.destroy();
  });
});

/**
 * Test to simulate React StrictMode double-mount behavior
 * This is important because React 18's StrictMode mounts/unmounts/remounts components
 */
describe('UndoManager with React StrictMode simulation', () => {
  it('should maintain trackedOrigins after simulated destroy/recreate cycle', () => {
    const yDoc = new Y.Doc();

    // First mount
    const editor1 = new Editor({
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({
          document: yDoc,
          fragment: yDoc.getXmlFragment('content'),
        }),
      ],
      content: '',
    });

    const um1 = yUndoPluginKey.getState(editor1.state)?.undoManager;
    expect(um1).toBeDefined();
    console.log('After 1st mount - trackedOrigins size:', um1?.trackedOrigins.size);
    console.log(
      'After 1st mount - trackedOrigins:',
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      Array.from(um1?.trackedOrigins || []).map((o) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
        typeof o === 'object' ? o.constructor?.name || 'object' : String(o)
      )
    );

    // First unmount (StrictMode will do this immediately after mount)
    editor1.destroy();

    // Second mount (with same yDoc - like React would do)
    const editor2 = new Editor({
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({
          document: yDoc,
          fragment: yDoc.getXmlFragment('content'),
        }),
      ],
      content: '',
    });

    const um2 = yUndoPluginKey.getState(editor2.state)?.undoManager;
    expect(um2).toBeDefined();
    console.log('After 2nd mount - trackedOrigins size:', um2?.trackedOrigins.size);
    console.log(
      'After 2nd mount - trackedOrigins:',
      // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
      Array.from(um2?.trackedOrigins || []).map((o) =>
        // eslint-disable-next-line @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/prefer-nullish-coalescing
        typeof o === 'object' ? o.constructor?.name || 'object' : String(o)
      )
    );

    // The CRITICAL test: trackedOrigins should still have 2 entries
    expect(um2?.trackedOrigins.size).toBe(2);

    // Should be able to type and undo
    editor2.commands.insertContent('Hello');
    expect(editor2.can().undo()).toBe(true);

    editor2.destroy();
    yDoc.destroy();
  });

  it('should handle StrictMode with note loading flow', () => {
    // Create initial state
    const tempDoc = new Y.Doc();
    const tempEditor = new Editor({
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({
          document: tempDoc,
          fragment: tempDoc.getXmlFragment('content'),
        }),
      ],
      content: '',
    });
    tempEditor.commands.insertContent('Initial content');
    const initialState = Y.encodeStateAsUpdate(tempDoc);
    tempEditor.destroy();
    tempDoc.destroy();

    // Now simulate the real app flow with StrictMode
    const yDoc = new Y.Doc();

    // First mount
    const editor1 = new Editor({
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({
          document: yDoc,
          fragment: yDoc.getXmlFragment('content'),
        }),
      ],
      content: '',
    });

    // Load initial state
    Y.applyUpdate(yDoc, initialState, 'load');

    console.log('After 1st mount + load - canUndo:', editor1.can().undo());

    // First unmount (StrictMode)
    editor1.destroy();

    // Second mount (StrictMode re-mount)
    const editor2 = new Editor({
      extensions: [
        StarterKit.configure({ history: false }),
        Collaboration.configure({
          document: yDoc,
          fragment: yDoc.getXmlFragment('content'),
        }),
      ],
      content: '',
    });

    const um2 = yUndoPluginKey.getState(editor2.state)?.undoManager;
    console.log('After 2nd mount - trackedOrigins size:', um2?.trackedOrigins.size);
    console.log('After 2nd mount - undoStack:', um2?.undoStack.length);
    console.log('After 2nd mount - canUndo:', editor2.can().undo());

    // Type new content
    editor2.commands.insertContent(' - Added');
    console.log('After typing - undoStack:', um2?.undoStack.length);
    console.log('After typing - canUndo:', editor2.can().undo());

    // Should be able to undo
    expect(editor2.can().undo()).toBe(true);
    expect(um2?.trackedOrigins.size).toBe(2);

    editor2.destroy();
    yDoc.destroy();
  });
});

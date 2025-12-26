/**
 * Editor Context Menu Hook
 *
 * Handles the right-click context menu with Cut, Copy, Paste operations.
 * Manages clipboard serialization and deserialization for rich text.
 */

import { useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { DOMSerializer } from '@tiptap/pm/model';
import { sanitizeClipboardHtml } from '../../utils/clipboard-sanitizer';

/**
 * Context menu state - includes position and selection bounds
 * Selection bounds are captured when menu opens since editor loses focus
 */
export interface ContextMenuState {
  x: number;
  y: number;
  from: number;
  to: number;
}

/**
 * Return value from the useEditorContextMenu hook
 */
export interface UseEditorContextMenuReturn {
  /** Current context menu state (null if closed) */
  contextMenu: ContextMenuState | null;
  /** Handler for the contextmenu event */
  handleContextMenu: (e: React.MouseEvent) => void;
  /** Close the context menu */
  handleClose: () => void;
  /** Cut operation */
  handleCut: () => Promise<void>;
  /** Copy operation */
  handleCopy: () => Promise<void>;
  /** Paste operation (with HTML support) */
  handlePaste: () => Promise<void>;
  /** Paste as plain text operation */
  handlePasteAsPlainText: () => Promise<void>;
}

/**
 * Serialize a selection range to HTML and plain text for clipboard operations
 */
function serializeSelectionToClipboard(
  editor: Editor,
  from: number,
  to: number
): { html: string; plainText: string } {
  const slice = editor.state.doc.slice(from, to);
  const fragment = DOMSerializer.fromSchema(editor.schema).serializeFragment(slice.content);
  const div = document.createElement('div');
  div.appendChild(fragment);
  const html = div.innerHTML;
  const plainText = editor.state.doc.textBetween(from, to);
  return { html, plainText };
}

/**
 * Write content to clipboard with both HTML and plain text formats
 */
async function writeToClipboard(html: string, plainText: string): Promise<void> {
  await navigator.clipboard.write([
    new ClipboardItem({
      'text/html': new Blob([html], { type: 'text/html' }),
      'text/plain': new Blob([plainText], { type: 'text/plain' }),
    }),
  ]);
}

/**
 * Helper to read blob as text (for clipboard reading)
 */
function readBlobAsText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(reader.result as string);
    };
    reader.onerror = () => {
      reject(new Error(reader.error?.message ?? 'Failed to read blob'));
    };
    reader.readAsText(blob);
  });
}

/**
 * Hook to handle context menu interactions in the editor.
 *
 * Manages:
 * - Context menu state (position and selection bounds)
 * - Cut/Copy/Paste operations with rich text support
 * - Paste as plain text
 *
 * @param editor - TipTap editor instance
 * @returns Context menu state and handlers
 */
export function useEditorContextMenu(editor: Editor | null): UseEditorContextMenuReturn {
  // Context menu state - includes selection bounds for clipboard operations
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);

  /**
   * Handle context menu open
   * Shows custom context menu with Cut, Copy, Paste options
   * Captures selection bounds for clipboard operations since focus is lost when menu opens
   */
  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      // Capture selection bounds - needed because editor loses focus when menu opens
      const { from, to } = editor?.state.selection ?? { from: 0, to: 0 };
      setContextMenu({ x: e.clientX, y: e.clientY, from, to });
    },
    [editor]
  );

  /**
   * Handle context menu close
   */
  const handleClose = useCallback(() => {
    setContextMenu(null);
  }, []);

  /**
   * Handle context menu Cut operation
   */
  const handleCut = useCallback(async () => {
    if (!editor || !contextMenu) return;

    const { from, to } = contextMenu;
    if (from === to) {
      // Nothing selected
      handleClose();
      return;
    }

    try {
      const { html, plainText } = serializeSelectionToClipboard(editor, from, to);
      await writeToClipboard(html, plainText);
      // Focus editor, restore selection, and delete
      editor.chain().focus().setTextSelection({ from, to }).deleteSelection().run();
      console.log('[useEditorContextMenu] Cut operation completed');
    } catch (err) {
      console.error('[useEditorContextMenu] Cut failed:', err);
    }

    handleClose();
  }, [editor, contextMenu, handleClose]);

  /**
   * Handle context menu Copy operation
   */
  const handleCopy = useCallback(async () => {
    if (!editor || !contextMenu) return;

    const { from, to } = contextMenu;
    if (from === to) {
      // Nothing selected
      handleClose();
      return;
    }

    try {
      const { html, plainText } = serializeSelectionToClipboard(editor, from, to);
      await writeToClipboard(html, plainText);
      console.log('[useEditorContextMenu] Copy operation completed');
    } catch (err) {
      console.error('[useEditorContextMenu] Copy failed:', err);
    }

    handleClose();
  }, [editor, contextMenu, handleClose]);

  /**
   * Handle context menu Paste operation
   */
  const handlePaste = useCallback(async () => {
    if (!editor || !contextMenu) return;

    const { from, to } = contextMenu;

    try {
      const items = await navigator.clipboard.read();
      let pasted = false;

      for (const item of items) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          const rawHtml = await readBlobAsText(blob);
          // Sanitize HTML to remove <meta charset>, <style>, and other unwanted elements
          const html = sanitizeClipboardHtml(rawHtml);
          // Focus editor, set position (delete selection if any), and insert
          if (from !== to) {
            editor.chain().focus().setTextSelection({ from, to }).deleteSelection().run();
          }
          editor.chain().focus().setTextSelection(from).insertContent(html).run();
          pasted = true;
          break;
        }
      }

      if (!pasted) {
        // Fallback to plain text
        const text = await navigator.clipboard.readText();
        if (from !== to) {
          editor.chain().focus().setTextSelection({ from, to }).deleteSelection().run();
        }
        editor.chain().focus().setTextSelection(from).insertContent(text).run();
      }

      console.log('[useEditorContextMenu] Paste operation completed');
    } catch (err) {
      console.error('[useEditorContextMenu] Paste failed:', err);
    }

    handleClose();
  }, [editor, contextMenu, handleClose]);

  /**
   * Handle context menu Paste Without Formatting operation
   * Pastes clipboard content as plain text, stripping all HTML formatting
   */
  const handlePasteAsPlainText = useCallback(async () => {
    if (!editor || !contextMenu) return;

    const { from, to } = contextMenu;

    try {
      const text = await navigator.clipboard.readText();
      // Focus editor, set position (delete selection if any), and insert
      if (from !== to) {
        editor.chain().focus().setTextSelection({ from, to }).deleteSelection().run();
      }
      editor.chain().focus().setTextSelection(from).insertContent(text).run();
      console.log('[useEditorContextMenu] Paste without formatting completed');
    } catch (err) {
      console.error('[useEditorContextMenu] Paste without formatting failed:', err);
    }

    handleClose();
  }, [editor, contextMenu, handleClose]);

  return {
    contextMenu,
    handleContextMenu,
    handleClose,
    handleCut,
    handleCopy,
    handlePaste,
    handlePasteAsPlainText,
  };
}

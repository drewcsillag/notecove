/**
 * Editor Images Hook
 *
 * Handles image drag-and-drop and keyboard shortcuts for image insertion.
 */

import { useEffect, type RefObject } from 'react';
import type { Editor } from '@tiptap/react';

/**
 * Map of file extensions to MIME types for image files.
 * Used when file.type is empty (common when dropping files from Finder on macOS).
 */
const EXTENSION_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  heif: 'image/heif',
};

/**
 * Get MIME type from filename extension.
 * Returns null if extension is not a supported image type.
 */
function getMimeTypeFromFilename(filename: string): string | null {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return null;
  const extension = filename.slice(lastDotIndex + 1).toLowerCase();
  return EXTENSION_TO_MIME[extension] ?? null;
}

/**
 * Check if a file is an image, using both file.type and filename extension.
 * Returns the MIME type if it's an image, or null otherwise.
 */
function getImageMimeType(file: File): string | null {
  // First try the file's MIME type
  if (file.type.startsWith('image/')) {
    return file.type;
  }
  // Fall back to inferring from extension (common when dropping from Finder)
  return getMimeTypeFromFilename(file.name);
}

/**
 * Hook to handle image insertion via drag-and-drop and keyboard shortcuts.
 *
 * Features:
 * - DOM-level drop handler for image files (handles drops on container too)
 * - Keyboard shortcut Cmd+Shift+M / Ctrl+Shift+M for file picker
 * - Supports multiple image formats including HEIC
 * - Automatically saves images to active SD and inserts nodes
 *
 * @param editor - TipTap editor instance
 * @param editorContainerRef - Ref to the scrollable editor container (drop zone)
 */
export function useEditorImages(
  editor: Editor | null,
  editorContainerRef: RefObject<HTMLDivElement>
): void {
  // DOM-level drop handler for image files
  // We handle drops at the document level because:
  // 1. ProseMirror's handleDrop prop doesn't get triggered by synthetic events
  // 2. Native file drops from Finder often land on container elements, not the editor itself
  // We check if the drop is within the editor container and handle it accordingly.
  // If dropped in the container but below the editor content, append to the end.
  useEffect(() => {
    if (!editor) return;

    // Reference to the editor DOM and container
    const editorDom = editor.view.dom;
    const dropZone = editorContainerRef.current; // The scrollable container with the editor

    const handleDocumentDrop = async (event: DragEvent) => {
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) return;

      // Check if the drop target is within the drop zone (editor container)
      const target = event.target as HTMLElement;
      const isInDropZone = dropZone?.contains(target);
      const isDirectlyOnEditor = editorDom.contains(target);

      console.log(
        '[useEditorImages] Document drop - target:',
        target,
        'isInDropZone:',
        isInDropZone,
        'isDirectlyOnEditor:',
        isDirectlyOnEditor
      );

      if (!isInDropZone) {
        console.log('[useEditorImages] Drop not in drop zone, ignoring');
        return;
      }

      // Determine where to insert: at cursor if on editor, at end if on container
      const insertAtEnd = !isDirectlyOnEditor;
      console.log('[useEditorImages] Insert at end:', insertAtEnd);

      // Check both files and items (items works better in some contexts like tests)
      const files = dataTransfer.files;
      const items = dataTransfer.items;

      // Debug logging
      console.log('[useEditorImages] Drop event - files:', files.length, 'items:', items.length);
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f) {
          console.log(
            `[useEditorImages] File ${i}: name="${f.name}" type="${f.type}" size=${f.size}`
          );
        }
      }

      // Collect files to process (with their MIME types)
      // We use getImageMimeType which checks both file.type and filename extension,
      // since files dropped from Finder on macOS often have empty file.type
      const imageFiles: { file: File; mimeType: string }[] = [];

      // First try files (preferred for native drops)
      if (files.length > 0) {
        for (const file of files) {
          const mimeType = getImageMimeType(file);
          if (mimeType) {
            imageFiles.push({ file, mimeType });
          }
        }
      }

      // If no files found, try items (works better in synthetic events)
      if (imageFiles.length === 0 && items.length > 0) {
        for (const item of items) {
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
              const mimeType = getImageMimeType(file);
              if (mimeType) {
                imageFiles.push({ file, mimeType });
              }
            }
          }
        }
      }

      if (imageFiles.length === 0) return;

      // Prevent default drop handling
      event.preventDefault();
      event.stopPropagation();

      // Process each image file
      for (const { file, mimeType } of imageFiles) {
        console.log(
          '[useEditorImages] DOM drop handler: Image detected, type:',
          mimeType,
          'name:',
          file.name
        );

        try {
          // Read as ArrayBuffer and save via IPC
          const buffer = await file.arrayBuffer();

          // Get the active SD to save the image in
          const sdId = await window.electronAPI.sd.getActive();
          if (!sdId) {
            console.error('[useEditorImages] No active SD, cannot save dropped image');
            return;
          }

          const data = new Uint8Array(buffer);

          console.log(
            '[useEditorImages] Saving dropped image, size:',
            data.length,
            'type:',
            mimeType
          );

          // Save the image via IPC (returns {imageId, filename})
          const result = await window.electronAPI.image.save(sdId, data, mimeType);
          console.log('[useEditorImages] Dropped image saved with ID:', result.imageId);

          // Insert the image node
          const { state, dispatch } = editor.view;
          const imageNode = state.schema.nodes['notecoveImage'];
          if (imageNode) {
            const node = imageNode.create({
              imageId: result.imageId,
              sdId,
            });

            let tr;
            if (insertAtEnd) {
              // Insert at the end of the document
              const endPos = state.doc.content.size;
              tr = state.tr.insert(endPos, node);
              console.log('[useEditorImages] Inserting image at end, position:', endPos);
            } else {
              // Insert at current cursor position
              tr = state.tr.replaceSelectionWith(node);
              console.log('[useEditorImages] Inserting image at cursor');
            }
            dispatch(tr);
            console.log('[useEditorImages] Dropped image node inserted');
          }
        } catch (err) {
          console.error('[useEditorImages] Failed to save dropped image:', err);
        }
      }
    };

    // Wrap the async handler
    const wrappedDropHandler = (event: Event) => {
      void handleDocumentDrop(event as DragEvent);
    };

    // IMPORTANT: dragover must call preventDefault() for drop to fire
    // We handle this at document level and check if over the drop zone
    const handleDragOver = (event: DragEvent) => {
      // Check if the drag contains files that might be images
      const hasFiles = event.dataTransfer?.types.includes('Files');
      if (!hasFiles) return;

      // Check if over the drop zone (editor container)
      const target = event.target as HTMLElement;
      const isInDropZone = dropZone?.contains(target);

      if (isInDropZone) {
        event.preventDefault();
        // Set dropEffect to show the user they can drop here
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
      }
    };

    // Listen at document level to catch drops that land on container elements
    document.addEventListener('drop', wrappedDropHandler);
    document.addEventListener('dragover', handleDragOver);

    return () => {
      document.removeEventListener('drop', wrappedDropHandler);
      document.removeEventListener('dragover', handleDragOver);
    };
  }, [editor, editorContainerRef]);

  // Keyboard shortcut for inserting images via file picker (Cmd+Shift+M / Ctrl+Shift+M)
  // Note: "M" for Media - avoids conflict with Cmd+Shift+I which is Note Info
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = async (event: KeyboardEvent) => {
      // Check for Cmd+Shift+M (Mac) or Ctrl+Shift+M (Windows/Linux)
      // eslint-disable-next-line @typescript-eslint/prefer-includes, @typescript-eslint/no-deprecated
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      if (modifier && event.shiftKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        event.stopPropagation();

        try {
          // Get the active SD
          const sdId = await window.electronAPI.sd.getActive();
          if (!sdId) {
            console.error('[useEditorImages] No active SD, cannot pick images');
            return;
          }

          // Open file picker and save selected images
          const imageIds = await window.electronAPI.image.pickAndSave(sdId);

          if (imageIds.length === 0) {
            // User canceled or no valid images selected
            return;
          }

          // Insert image nodes for each saved image
          const { state, dispatch } = editor.view;
          const imageNode = state.schema.nodes['notecoveImage'];
          if (!imageNode) return;

          let { tr } = state;
          for (const imageId of imageIds) {
            const node = imageNode.create({ imageId, sdId });
            tr = tr.replaceSelectionWith(node);
          }
          dispatch(tr);

          console.log('[useEditorImages] Inserted', imageIds.length, 'images from file picker');
        } catch (err) {
          console.error('[useEditorImages] Failed to pick and insert images:', err);
        }
      }
    };

    // Add listener to the editor DOM element
    const editorDom = editor.view.dom;
    const wrappedHandler = (event: Event) => {
      void handleKeyDown(event as KeyboardEvent);
    };
    editorDom.addEventListener('keydown', wrappedHandler);

    return () => {
      editorDom.removeEventListener('keydown', wrappedHandler);
    };
  }, [editor]);
}

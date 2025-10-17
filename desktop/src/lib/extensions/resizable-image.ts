import Image from '@tiptap/extension-image';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import type { AttachmentManager } from '../attachment-manager';

type HandlePosition = 'nw' | 'ne' | 'sw' | 'se';

export interface ResizableImageOptions {
  attachmentManager?: AttachmentManager;
  currentNoteId?: () => string | null;
}

/**
 * Custom Image extension with resize handles that maintain aspect ratio
 * Supports both base64 images (legacy) and attachment references (new)
 */
export const ResizableImage = Image.extend<ResizableImageOptions>({
  name: 'image',

  addOptions() {
    return {
      ...this.parent?.(),
      attachmentManager: undefined,
      currentNoteId: () => null,
    };
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      // src attribute - optional when attachmentId is present
      src: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('src'),
        renderHTML: (attributes: { src?: string | null }) => {
          if (!attributes.src) {
            return {};
          }
          return {
            src: attributes.src,
          };
        },
      },
      // Attachment ID - if present, load image from attachments folder
      attachmentId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-attachment-id'),
        renderHTML: (attributes: { attachmentId?: string | null }) => {
          if (!attributes.attachmentId) {
            return {};
          }
          return {
            'data-attachment-id': attributes.attachmentId,
          };
        },
      },
      width: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('width'),
        renderHTML: (attributes: { width?: number | null }) => {
          if (!attributes.width) {
            return {};
          }
          return {
            width: attributes.width,
          };
        },
      },
      height: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('height'),
        renderHTML: (attributes: { height?: number | null }) => {
          if (!attributes.height) {
            return {};
          }
          return {
            height: attributes.height,
          };
        },
      },
    };
  },

  addNodeView() {
    return ({ node, getPos, editor }) => {
      const container = document.createElement('div');
      container.classList.add('image-container');

      const img = document.createElement('img');
      img.alt = node.attrs.alt || '';
      img.title = node.attrs.title || '';

      // Load image source - either from attachment or direct src
      const loadImageSrc = async () => {
        const { attachmentId, src } = node.attrs;
        const attachmentManager = this.options.attachmentManager;
        const getCurrentNoteId = this.options.currentNoteId;

        // Priority 1: Load from attachment if attachmentId is present
        if (attachmentId && attachmentManager && getCurrentNoteId) {
          const noteId = getCurrentNoteId();
          console.log(`[ResizableImage] Loading attachment ${attachmentId} for note ${noteId}`);
          if (noteId) {
            try {
              const dataURL = await attachmentManager.loadAttachmentAsDataURL(noteId, attachmentId);
              if (dataURL) {
                console.log(`[ResizableImage] Successfully loaded attachment ${attachmentId}, size: ${dataURL.length} bytes`);
                img.src = dataURL;
                return;
              } else {
                console.warn(`[ResizableImage] Attachment not found: ${attachmentId} for note ${noteId}`);
              }
            } catch (err) {
              console.error(`[ResizableImage] Failed to load attachment ${attachmentId} for note ${noteId}:`, err);
            }
          } else {
            console.warn(`[ResizableImage] noteId is null, cannot load attachment ${attachmentId}`);
          }
        } else {
          console.log(`[ResizableImage] Missing dependencies:`, {
            hasAttachmentId: !!attachmentId,
            hasAttachmentManager: !!attachmentManager,
            hasGetCurrentNoteId: !!getCurrentNoteId
          });
        }

        // Priority 2: Use direct src (base64 or URL) - backward compatibility
        if (src) {
          img.src = src;
        } else {
          // No src and attachment failed to load - show placeholder
          img.src = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect fill="%23ddd" width="200" height="200"/><text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="%23999">Image not found</text></svg>';
        }
      };

      // Load image source asynchronously
      loadImageSrc();

      // Apply stored dimensions
      if (node.attrs.width) {
        img.width = node.attrs.width;
      }
      if (node.attrs.height) {
        img.height = node.attrs.height;
      }

      // Create resize handles for all 4 corners
      const handles: HTMLDivElement[] = (['nw', 'ne', 'sw', 'se'] as HandlePosition[]).map(position => {
        const handle = document.createElement('div');
        handle.classList.add('image-resize-handle', `handle-${position}`);
        handle.contentEditable = 'false';
        handle.dataset.position = position;
        return handle;
      });

      let isResizing = false;
      let startX = 0;
      let startY = 0;
      let startWidth = 0;
      let startHeight = 0;
      let aspectRatio = 1;
      let currentHandle: HandlePosition | null = null;

      // Load image to get natural dimensions and set initial size
      img.onload = () => {
        aspectRatio = img.naturalWidth / img.naturalHeight;

        // IMPORTANT: Check CURRENT node attributes each time onload fires
        // Not the captured value from when NodeView was created!
        // This prevents auto-sizing from overwriting user resizes when NodeView recreates
        if (typeof getPos !== 'function') return;

        const pos = getPos();
        const currentNode = editor.state.doc.nodeAt(pos);
        const hasExistingDimensions = currentNode?.attrs?.width || currentNode?.attrs?.height;

        // Only auto-size if this is a brand new image without dimensions
        if (!hasExistingDimensions) {
          // Set initial size to natural size or max 600px width
          const maxWidth = 600;
          if (img.naturalWidth > maxWidth) {
            const newWidth = maxWidth;
            const newHeight = Math.round(maxWidth / aspectRatio);
            img.width = newWidth;
            img.height = newHeight;

            // Immediately save the dimensions
            editor.commands.command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, {
                ...currentNode!.attrs,
                width: newWidth,
                height: newHeight,
              });
              return true;
            });
          } else {
            img.width = img.naturalWidth;
            img.height = img.naturalHeight;
          }
        }
      };

      // Show handles when clicking on image
      const showHandles = () => {
        container.classList.add('selected');
      };

      const hideHandles = (e: MouseEvent) => {
        if (!container.contains(e.target as Node)) {
          container.classList.remove('selected');
        }
      };

      img.addEventListener('click', (e: MouseEvent) => {
        e.stopPropagation();
        showHandles();
      });

      document.addEventListener('click', hideHandles);

      const handleMouseDown = (e: MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();

        isResizing = true;
        currentHandle = (e.target as HTMLElement).dataset.position as HandlePosition;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = img.width;
        startHeight = img.height;
        aspectRatio = startWidth / startHeight;

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        container.classList.add('resizing');
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isResizing) return;

        let deltaX = e.clientX - startX;
        let deltaY = e.clientY - startY;

        // Adjust delta based on which corner is being dragged
        if (currentHandle === 'nw') {
          deltaX = -deltaX;
          deltaY = -deltaY;
        } else if (currentHandle === 'ne') {
          deltaY = -deltaY;
        } else if (currentHandle === 'sw') {
          deltaX = -deltaX;
        }
        // se is default (positive deltas)

        // Use the larger delta to maintain aspect ratio
        const delta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY * aspectRatio;

        const newWidth = Math.max(100, startWidth + delta); // Min width 100px
        const newHeight = Math.round(newWidth / aspectRatio);

        img.width = newWidth;
        img.height = newHeight;
      };

      const handleMouseUp = () => {
        if (!isResizing) return;

        isResizing = false;
        currentHandle = null;
        container.classList.remove('resizing');

        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);

        // Update node attributes with new dimensions
        const newWidth = img.width;
        const newHeight = img.height;

        if (typeof getPos === 'function') {
          const pos = getPos();

          // First select the node, then update its attributes
          editor.chain()
            .setNodeSelection(pos)
            .updateAttributes('image', {
              width: newWidth,
              height: newHeight,
            })
            .run();
        }
      };

      // Add event listeners to all handles
      handles.forEach(handle => {
        handle.addEventListener('mousedown', handleMouseDown);
      });

      container.appendChild(img);
      handles.forEach(handle => container.appendChild(handle));

      return {
        dom: container,
        update: (updatedNode: ProseMirrorNode) => {
          if (updatedNode.type !== this.type) {
            return false;
          }

          img.alt = updatedNode.attrs.alt || '';
          img.title = updatedNode.attrs.title || '';

          // Reload image source (may have changed from attachment to base64 or vice versa)
          const reloadImageSrc = async () => {
            const { attachmentId, src } = updatedNode.attrs;
            const attachmentManager = this.options.attachmentManager;
            const getCurrentNoteId = this.options.currentNoteId;

            if (attachmentId && attachmentManager && getCurrentNoteId) {
              const noteId = getCurrentNoteId();
              if (noteId) {
                try {
                  const dataURL = await attachmentManager.loadAttachmentAsDataURL(noteId, attachmentId);
                  if (dataURL) {
                    img.src = dataURL;
                  } else {
                    if (src) img.src = src;
                  }
                } catch (err) {
                  console.error(`[ResizableImage] Failed to reload attachment ${attachmentId}:`, err);
                  if (src) img.src = src;
                }
              }
            } else if (src) {
              img.src = src;
            }
          };

          reloadImageSrc();

          if (updatedNode.attrs.width) {
            img.width = updatedNode.attrs.width;
          }
          if (updatedNode.attrs.height) {
            img.height = updatedNode.attrs.height;
          }

          return true;
        },
        destroy() {
          handles.forEach(handle => {
            handle.removeEventListener('mousedown', handleMouseDown);
          });
          document.removeEventListener('click', hideHandles);
        },
      };
    };
  },
});

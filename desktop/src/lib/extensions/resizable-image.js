import Image from '@tiptap/extension-image';
import { mergeAttributes } from '@tiptap/core';

/**
 * Custom Image extension with resize handles that maintain aspect ratio
 */
export const ResizableImage = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: element => element.getAttribute('width'),
        renderHTML: attributes => {
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
        parseHTML: element => element.getAttribute('height'),
        renderHTML: attributes => {
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
      img.src = node.attrs.src;
      img.alt = node.attrs.alt || '';
      img.title = node.attrs.title || '';

      // Apply stored dimensions
      if (node.attrs.width) {
        img.width = node.attrs.width;
      }
      if (node.attrs.height) {
        img.height = node.attrs.height;
      }

      // Create resize handles for all 4 corners
      const handles = ['nw', 'ne', 'sw', 'se'].map(position => {
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
      let currentHandle = null;

      // Load image to get natural dimensions and set initial size
      img.onload = () => {
        aspectRatio = img.naturalWidth / img.naturalHeight;

        if (!node.attrs.width && !node.attrs.height) {
          // Set initial size to natural size or max 600px width
          const maxWidth = 600;
          if (img.naturalWidth > maxWidth) {
            const newWidth = maxWidth;
            const newHeight = Math.round(maxWidth / aspectRatio);
            img.width = newWidth;
            img.height = newHeight;

            // Immediately save the dimensions
            if (typeof getPos === 'function') {
              editor.commands.command(({ tr }) => {
                const pos = getPos();
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  width: newWidth,
                  height: newHeight,
                });
                return true;
              });
            }
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

      const hideHandles = (e) => {
        if (!container.contains(e.target)) {
          container.classList.remove('selected');
        }
      };

      img.addEventListener('click', (e) => {
        e.stopPropagation();
        showHandles();
      });

      document.addEventListener('click', hideHandles);

      const handleMouseDown = (e) => {
        e.preventDefault();
        e.stopPropagation();

        isResizing = true;
        currentHandle = e.target.dataset.position;
        startX = e.clientX;
        startY = e.clientY;
        startWidth = img.width;
        startHeight = img.height;
        aspectRatio = startWidth / startHeight;

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('mouseup', handleMouseUp);

        container.classList.add('resizing');
      };

      const handleMouseMove = (e) => {
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
          editor.commands.command(({ tr }) => {
            const pos = getPos();
            tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              width: newWidth,
              height: newHeight,
            });
            return true;
          });
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
        update: (updatedNode) => {
          if (updatedNode.type !== this.type) {
            return false;
          }

          img.src = updatedNode.attrs.src;
          img.alt = updatedNode.attrs.alt || '';
          img.title = updatedNode.attrs.title || '';

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

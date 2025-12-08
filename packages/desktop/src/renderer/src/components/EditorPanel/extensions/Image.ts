/**
 * NotecoveImage - TipTap Image Extension
 *
 * A block node extension for displaying images stored in sync directories.
 * Images are stored externally in the media/ folder and referenced by imageId.
 *
 * Features:
 * - Fetches image data via IPC for display
 * - Shows loading placeholder while fetching
 * - Shows broken image icon if fetch fails
 * - Supports alignment, width, alt text, and captions
 * - Dev-mode tooltip showing image metadata
 *
 * @see plans/add-images/PLAN-PHASE-1.md
 */

import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';

// Debug logging enabled in development mode
// Check for Vite's import.meta.env or fallback to process.env for Jest
const DEBUG: boolean =
  typeof window !== 'undefined' &&
  // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
  (window as any).__NOTECOVE_DEV_MODE__ === true;

/**
 * Log debug messages for image operations
 */
function debugLog(message: string, ...args: unknown[]): void {
  if (DEBUG) {
    console.log(`[NotecoveImage] ${message}`, ...args);
  }
}

/**
 * Format file size for display
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Image node attributes
 */
export interface ImageNodeAttrs {
  /** Reference to image in media folder (UUID) */
  imageId: string | null;
  /** Sync directory ID */
  sdId: string | null;
  /** Alt text for accessibility */
  alt: string;
  /** Caption text displayed below image */
  caption: string;
  /** Alignment: left, center, or right */
  alignment: 'left' | 'center' | 'right';
  /** Display width (percentage or px, e.g., '50%' or '300px') */
  width: string | null;
  /** Optional link URL when image is clicked */
  linkHref: string | null;
}

/**
 * Extension options
 */
export interface NotecoveImageOptions {
  /** HTML attributes to add to the wrapper element */
  HTMLAttributes: Record<string, unknown>;
}

// Extend TipTap's Commands interface
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    notecoveImage: {
      /**
       * Insert an image at the current position
       */
      insertImage: (attrs: Partial<ImageNodeAttrs>) => ReturnType;
      /**
       * Update the attributes of the selected image
       */
      updateImage: (attrs: Partial<ImageNodeAttrs>) => ReturnType;
    };
  }
}

// Cache for loaded image data URLs to avoid re-fetching
const imageDataCache = new Map<string, string>();

/**
 * Clear the image data cache (useful when images are updated)
 */
export function clearImageCache(): void {
  imageDataCache.clear();
}

/**
 * Remove a specific image from the cache
 */
export function removeFromImageCache(imageId: string): void {
  imageDataCache.delete(imageId);
}

/**
 * NotecoveImage Extension
 *
 * Block node for displaying images from sync directories.
 */
export const NotecoveImage = Node.create<NotecoveImageOptions>({
  name: 'notecoveImage',

  group: 'block',

  atom: true, // Treated as a single unit, not editable content

  draggable: true, // Can be dragged to reorder

  addOptions() {
    return {
      HTMLAttributes: {},
    };
  },

  addAttributes() {
    return {
      imageId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-image-id'),
        renderHTML: (attributes: ImageNodeAttrs) => {
          if (!attributes.imageId) return {};
          return { 'data-image-id': attributes.imageId };
        },
      },
      sdId: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-sd-id'),
        renderHTML: (attributes: ImageNodeAttrs) => {
          if (!attributes.sdId) return {};
          return { 'data-sd-id': attributes.sdId };
        },
      },
      alt: {
        default: '',
        parseHTML: (element) => {
          const img = element.querySelector('img');
          return img?.getAttribute('alt') ?? '';
        },
        renderHTML: (attributes: ImageNodeAttrs) => {
          return { alt: attributes.alt };
        },
      },
      caption: {
        default: '',
        parseHTML: (element) => {
          const figcaption = element.querySelector('figcaption');
          return figcaption?.textContent ?? '';
        },
        renderHTML: (attributes: ImageNodeAttrs) => {
          if (!attributes.caption) return {};
          return { 'data-caption': attributes.caption };
        },
      },
      alignment: {
        default: 'center' as const,
        parseHTML: (element) => {
          const alignment = element.getAttribute('data-alignment');
          if (alignment === 'left' || alignment === 'right') return alignment;
          return 'center';
        },
        renderHTML: (attributes: ImageNodeAttrs) => {
          return { 'data-alignment': attributes.alignment };
        },
      },
      width: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-width'),
        renderHTML: (attributes: ImageNodeAttrs) => {
          if (!attributes.width) return {};
          return { 'data-width': attributes.width };
        },
      },
      linkHref: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-link-href'),
        renderHTML: (attributes: ImageNodeAttrs) => {
          if (!attributes.linkHref) return {};
          return { 'data-link-href': attributes.linkHref };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'figure.notecove-image',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    // Static HTML representation (for copy/paste, export, etc.)
    // The actual rendering is done by addNodeView
    const attrs = HTMLAttributes as ImageNodeAttrs;
    return [
      'figure',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        class: 'notecove-image',
      }),
      ['img', { alt: attrs.alt }],
      attrs.caption
        ? ['figcaption', {}, attrs.caption]
        : ['figcaption', { style: 'display: none' }],
    ];
  },

  addCommands() {
    return {
      insertImage:
        (attrs) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs,
          });
        },
      updateImage:
        (attrs) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attrs);
        },
    };
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      // Create the DOM structure
      const wrapper = document.createElement('figure');
      wrapper.className = 'notecove-image';
      wrapper.contentEditable = 'false';

      const imageContainer = document.createElement('div');
      imageContainer.className = 'notecove-image-container';

      const img = document.createElement('img');
      img.className = 'notecove-image-element';

      const loadingPlaceholder = document.createElement('div');
      loadingPlaceholder.className = 'notecove-image-loading';
      loadingPlaceholder.innerHTML = `
        <svg class="notecove-image-spinner" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <circle class="notecove-spinner-circle" cx="12" cy="12" r="10" fill="none" stroke-width="2"/>
        </svg>
        <span>Loading image...</span>
      `;

      const errorPlaceholder = document.createElement('div');
      errorPlaceholder.className = 'notecove-image-error';
      errorPlaceholder.innerHTML = `
        <svg class="notecove-image-broken" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/>
          <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span>Image not found</span>
      `;
      errorPlaceholder.style.display = 'none';

      const caption = document.createElement('figcaption');
      caption.className = 'notecove-image-caption';

      // Dev-mode tooltip for debugging
      let devTooltip: HTMLDivElement | null = null;
      if (DEBUG) {
        devTooltip = document.createElement('div');
        devTooltip.className = 'notecove-image-dev-tooltip';
        devTooltip.style.display = 'none';
        imageContainer.appendChild(devTooltip);
      }

      imageContainer.appendChild(loadingPlaceholder);
      imageContainer.appendChild(errorPlaceholder);
      imageContainer.appendChild(img);
      wrapper.appendChild(imageContainer);
      wrapper.appendChild(caption);

      // Apply HTML attributes
      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          wrapper.setAttribute(key, String(value));
        }
      });

      // Track metadata for dev tooltip
      let imageMetadata: {
        id: string;
        width: number | null;
        height: number | null;
        size: number;
        mimeType: string;
      } | null = null;

      /**
       * Update the visual state based on node attributes
       */
      const updateVisualState = async (nodeAttrs: ImageNodeAttrs): Promise<void> => {
        const { imageId, sdId, alt, caption: captionText, alignment, width } = nodeAttrs;

        // Update alignment
        wrapper.dataset['alignment'] = alignment;

        // Update width
        if (width) {
          img.style.width = width;
          imageContainer.style.width = width;
        } else {
          img.style.width = '';
          imageContainer.style.width = '';
        }

        // Update alt text
        img.alt = alt || '';

        // Update caption
        if (captionText) {
          caption.textContent = captionText;
          caption.style.display = '';
        } else {
          caption.textContent = '';
          caption.style.display = 'none';
        }

        // Load image if we have imageId and sdId
        if (imageId && sdId) {
          const cacheKey = `${sdId}:${imageId}`;

          // Check cache first
          const cachedData = imageDataCache.get(cacheKey);
          if (cachedData) {
            debugLog('Image loaded from cache:', { imageId, sdId });
            loadingPlaceholder.style.display = 'none';
            errorPlaceholder.style.display = 'none';
            img.src = cachedData;
            img.style.display = '';
            return;
          }

          // Show loading state
          loadingPlaceholder.style.display = '';
          errorPlaceholder.style.display = 'none';
          img.style.display = 'none';

          debugLog('Loading image:', { imageId, sdId });

          try {
            // Fetch image data and metadata in parallel
            const [dataUrl, metadata] = await Promise.all([
              window.electronAPI.image.getDataUrl(sdId, imageId),
              DEBUG ? window.electronAPI.image.getMetadata(imageId) : Promise.resolve(null),
            ]);

            if (dataUrl) {
              // Cache the result
              imageDataCache.set(cacheKey, dataUrl);

              // Store metadata for dev tooltip
              if (metadata) {
                imageMetadata = {
                  id: metadata.id,
                  width: metadata.width,
                  height: metadata.height,
                  size: metadata.size,
                  mimeType: metadata.mimeType,
                };
                debugLog('Image loaded successfully:', {
                  imageId,
                  dimensions:
                    metadata.width && metadata.height
                      ? `${metadata.width}x${metadata.height}`
                      : 'unknown',
                  size: formatFileSize(metadata.size),
                  mimeType: metadata.mimeType,
                });
              }

              // Display the image
              loadingPlaceholder.style.display = 'none';
              img.src = dataUrl;
              img.style.display = '';
            } else {
              // Image not found
              debugLog('Image not found:', { imageId, sdId });
              loadingPlaceholder.style.display = 'none';
              errorPlaceholder.style.display = '';
              img.style.display = 'none';
            }
          } catch (error) {
            console.error('[NotecoveImage] Failed to load image:', error);
            loadingPlaceholder.style.display = 'none';
            errorPlaceholder.style.display = '';
            img.style.display = 'none';
          }
        } else {
          // No imageId/sdId - show error state
          debugLog('Image missing imageId or sdId:', { imageId, sdId });
          loadingPlaceholder.style.display = 'none';
          errorPlaceholder.style.display = '';
          img.style.display = 'none';
        }
      };

      // Dev-mode tooltip handlers
      const showDevTooltip = (): void => {
        if (!devTooltip || !imageMetadata) return;

        const dimensions =
          imageMetadata.width && imageMetadata.height
            ? `${imageMetadata.width} × ${imageMetadata.height}`
            : 'Dimensions unknown';

        devTooltip.innerHTML = `
          <div class="notecove-dev-tooltip-row"><strong>ID:</strong> ${imageMetadata.id}</div>
          <div class="notecove-dev-tooltip-row"><strong>Size:</strong> ${formatFileSize(imageMetadata.size)}</div>
          <div class="notecove-dev-tooltip-row"><strong>Dimensions:</strong> ${dimensions}</div>
          <div class="notecove-dev-tooltip-row"><strong>Type:</strong> ${imageMetadata.mimeType}</div>
        `;
        devTooltip.style.display = '';
      };

      const hideDevTooltip = (): void => {
        if (devTooltip) {
          devTooltip.style.display = 'none';
        }
      };

      // Add hover listeners for dev tooltip
      if (DEBUG) {
        imageContainer.addEventListener('mouseenter', showDevTooltip);
        imageContainer.addEventListener('mouseleave', hideDevTooltip);
      }

      // Initial load
      void updateVisualState(node.attrs as ImageNodeAttrs);

      // Handle selection styling
      const handleSelection = (): void => {
        if (typeof getPos !== 'function') return;
        const pos = getPos();
        if (typeof pos !== 'number') return;

        const { from, to } = editor.state.selection;
        const isSelected = from <= pos && pos < to;
        wrapper.classList.toggle('ProseMirror-selectednode', isSelected);
      };

      // Listen for selection changes
      editor.on('selectionUpdate', handleSelection);

      return {
        dom: wrapper,
        // No contentDOM since this is an atom node

        update: (updatedNode: ProseMirrorNode) => {
          if (updatedNode.type !== this.type) return false;
          void updateVisualState(updatedNode.attrs as ImageNodeAttrs);
          return true;
        },

        selectNode: () => {
          wrapper.classList.add('ProseMirror-selectednode');
        },

        deselectNode: () => {
          wrapper.classList.remove('ProseMirror-selectednode');
        },

        destroy: () => {
          editor.off('selectionUpdate', handleSelection);
          if (DEBUG) {
            imageContainer.removeEventListener('mouseenter', showDevTooltip);
            imageContainer.removeEventListener('mouseleave', hideDevTooltip);
          }
        },
      };
    };
  },
});

export default NotecoveImage;

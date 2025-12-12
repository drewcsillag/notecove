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

import { Node, mergeAttributes, InputRule } from '@tiptap/core';
import type { Node as ProseMirrorNode } from '@tiptap/pm/model';
import { openLightbox } from '../ImageLightbox';
import { openImageContextMenu } from '../ImageContextMenu';

/**
 * Regex pattern for markdown image syntax: ![alt](url) followed by space
 * Captures:
 * - Group 1: Alt text (anything except [ and ])
 * - Group 2: URL (http://, https://, or file://)
 */
const MARKDOWN_IMAGE_REGEX = /!\[([^[\]]*)\]\((https?:\/\/[^\s<>)]+|file:\/\/[^\s<>)]+)\) $/;

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
  /** Display mode: block (standalone) or inline (within text flow) */
  display: 'block' | 'inline';
  /** Enable text wrapping around the image (only for left/right aligned block images) */
  wrap: boolean;
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

// Cache for thumbnail data URLs (separate from full images)
const thumbnailCache = new Map<string, string>();

/**
 * Clear the image data cache (useful when images are updated)
 */
export function clearImageCache(): void {
  imageDataCache.clear();
  thumbnailCache.clear();
}

/**
 * Remove a specific image from the cache
 */
export function removeFromImageCache(imageId: string): void {
  imageDataCache.delete(imageId);
  // Also remove from thumbnail cache (need to check all keys)
  for (const key of thumbnailCache.keys()) {
    if (key.endsWith(`:${imageId}`)) {
      thumbnailCache.delete(key);
    }
  }
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
      display: {
        default: 'block' as const,
        parseHTML: (element) => {
          const display = element.getAttribute('data-display');
          if (display === 'inline') return 'inline';
          return 'block';
        },
        renderHTML: (attributes: ImageNodeAttrs) => {
          return { 'data-display': attributes.display };
        },
      },
      wrap: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-wrap') === 'true',
        renderHTML: (attributes: ImageNodeAttrs) => {
          if (!attributes.wrap) return {};
          return { 'data-wrap': 'true' };
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

  addInputRules() {
    const editor = this.editor;
    const imageNodeType = this.type;

    // Input rule for markdown image syntax: ![alt](url) followed by space
    const markdownImageRule = new InputRule({
      find: MARKDOWN_IMAGE_REGEX,
      handler: ({ state, range, match }) => {
        const altText = match[1] ?? '';
        const url = match[2];

        if (!url) {
          debugLog('Invalid markdown image match, missing URL');
          return null;
        }

        debugLog(`Markdown image detected: alt="${altText}", url="${url}"`);

        // Delete the markdown syntax immediately
        const tr = state.tr.delete(range.from, range.to);
        editor.view.dispatch(tr);

        // Start the async download and insertion
        void (async () => {
          try {
            // Get active SD
            const sdId = await window.electronAPI.sd.getActive();
            if (!sdId) {
              console.error('[NotecoveImage] No active storage directory');
              return;
            }

            debugLog('Downloading image from URL:', url);

            // Download and save the image
            const imageId = await window.electronAPI.image.downloadAndSave(sdId, url);

            debugLog('Image downloaded successfully:', { imageId, altText });

            // Insert the image node at the current cursor position
            const insertTr = editor.state.tr;
            const node = imageNodeType.create({
              imageId,
              sdId,
              alt: altText,
            });

            // Insert at current selection
            const pos = editor.state.selection.from;
            insertTr.insert(pos, node);
            editor.view.dispatch(insertTr);
          } catch (error) {
            console.error('[NotecoveImage] Failed to download image:', error);
            // TODO: Show toast notification to user
          }
        })();

        return null;
      },
    });

    return [markdownImageRule];
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
      loadingPlaceholder.style.display = 'none';

      const errorPlaceholder = document.createElement('div');
      errorPlaceholder.className = 'notecove-image-error';
      errorPlaceholder.title =
        'This image may still be syncing from another device, or was deleted.';
      errorPlaceholder.innerHTML = `
        <svg class="notecove-image-broken" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z" fill="currentColor"/>
          <line x1="4" y1="4" x2="20" y2="20" stroke="currentColor" stroke-width="2"/>
        </svg>
        <span>Image not found</span>
        <span class="notecove-image-error-id"></span>
      `;
      errorPlaceholder.style.display = 'none';

      // Lazy loading placeholder (shown before image enters viewport)
      const lazyPlaceholder = document.createElement('div');
      lazyPlaceholder.className = 'notecove-image-lazy-placeholder';
      lazyPlaceholder.innerHTML = `
        <svg class="notecove-image-placeholder-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" fill="none" stroke="currentColor" stroke-width="1.5"/>
          <circle cx="8.5" cy="8.5" r="1.5" fill="currentColor"/>
          <path d="M21 15l-5-5L5 21" stroke="currentColor" stroke-width="1.5" fill="none"/>
        </svg>
      `;
      lazyPlaceholder.style.display = '';

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

      // Resize handles container
      const resizeHandlesContainer = document.createElement('div');
      resizeHandlesContainer.className = 'notecove-image-resize-handles';

      // Create corner resize handles
      const corners = ['nw', 'ne', 'sw', 'se'] as const;
      const resizeHandles: Record<string, HTMLDivElement> = {};
      corners.forEach((corner) => {
        const handle = document.createElement('div');
        handle.className = `notecove-image-resize-handle notecove-image-resize-handle--${corner}`;
        handle.dataset['corner'] = corner;
        resizeHandles[corner] = handle;
        resizeHandlesContainer.appendChild(handle);
      });

      // Resize dimension tooltip
      const resizeTooltip = document.createElement('div');
      resizeTooltip.className = 'notecove-image-resize-tooltip';
      resizeTooltip.style.display = 'none';

      imageContainer.appendChild(lazyPlaceholder);
      imageContainer.appendChild(loadingPlaceholder);
      imageContainer.appendChild(errorPlaceholder);
      imageContainer.appendChild(img);
      imageContainer.appendChild(resizeHandlesContainer);
      imageContainer.appendChild(resizeTooltip);
      wrapper.appendChild(imageContainer);
      wrapper.appendChild(caption);

      // Track whether image has been loaded (for lazy loading)
      let hasLoadedImage = false;
      let intersectionObserver: IntersectionObserver | null = null;

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
       * Actually load the image (called when visible via IntersectionObserver)
       */
      const loadImage = async (imageId: string, sdId: string): Promise<void> => {
        if (hasLoadedImage) return;

        const cacheKey = `${sdId}:${imageId}`;

        // Check thumbnail cache first
        const cachedThumbnail = thumbnailCache.get(cacheKey);
        if (cachedThumbnail) {
          debugLog('Thumbnail loaded from cache:', { imageId, sdId });
          lazyPlaceholder.style.display = 'none';
          loadingPlaceholder.style.display = 'none';
          errorPlaceholder.style.display = 'none';
          img.src = cachedThumbnail;
          img.style.display = '';
          img.classList.add('notecove-image--fade-in');
          hasLoadedImage = true;
          return;
        }

        // Show loading state (hide lazy placeholder)
        lazyPlaceholder.style.display = 'none';
        loadingPlaceholder.style.display = '';
        errorPlaceholder.style.display = 'none';
        img.style.display = 'none';

        debugLog('Loading thumbnail:', { imageId, sdId });

        try {
          // Try to get thumbnail first (preferred for display)
          // Fetch thumbnail and metadata in parallel
          const [thumbnailDataUrl, metadata] = await Promise.all([
            window.electronAPI.thumbnail.getDataUrl(sdId, imageId),
            DEBUG ? window.electronAPI.image.getMetadata(imageId) : Promise.resolve(null),
          ]);

          if (thumbnailDataUrl) {
            // Cache the thumbnail
            thumbnailCache.set(cacheKey, thumbnailDataUrl);

            // Store metadata for dev tooltip
            if (metadata) {
              imageMetadata = {
                id: metadata.id,
                width: metadata.width,
                height: metadata.height,
                size: metadata.size,
                mimeType: metadata.mimeType,
              };
              debugLog('Thumbnail loaded successfully:', {
                imageId,
                dimensions:
                  metadata.width && metadata.height
                    ? `${metadata.width}x${metadata.height}`
                    : 'unknown',
                size: formatFileSize(metadata.size),
                mimeType: metadata.mimeType,
              });
            }

            // Display the thumbnail
            loadingPlaceholder.style.display = 'none';
            img.src = thumbnailDataUrl;
            img.style.display = '';
            img.classList.add('notecove-image--fade-in');
            hasLoadedImage = true;
          } else {
            // Thumbnail not available, try full image as fallback
            debugLog('Thumbnail not found, falling back to full image:', { imageId, sdId });
            const fullDataUrl = await window.electronAPI.image.getDataUrl(sdId, imageId);

            if (fullDataUrl) {
              // Cache to full image cache (not thumbnail cache)
              imageDataCache.set(cacheKey, fullDataUrl);
              loadingPlaceholder.style.display = 'none';
              img.src = fullDataUrl;
              img.style.display = '';
              img.classList.add('notecove-image--fade-in');
              hasLoadedImage = true;
            } else {
              // Image not found
              debugLog('Image not found:', { imageId, sdId });
              loadingPlaceholder.style.display = 'none';
              const errorIdSpan = errorPlaceholder.querySelector('.notecove-image-error-id');
              if (errorIdSpan) errorIdSpan.textContent = imageId;
              errorPlaceholder.style.display = '';
              img.style.display = 'none';
              hasLoadedImage = true; // Don't retry
            }
          }
        } catch (error) {
          console.error('[NotecoveImage] Failed to load image:', error);
          loadingPlaceholder.style.display = 'none';
          const errorIdSpan = errorPlaceholder.querySelector('.notecove-image-error-id');
          if (errorIdSpan) errorIdSpan.textContent = imageId;
          errorPlaceholder.style.display = '';
          img.style.display = 'none';
          hasLoadedImage = true; // Don't retry on error
        }

        // Stop observing once loaded
        if (intersectionObserver) {
          intersectionObserver.disconnect();
          intersectionObserver = null;
        }
      };

      /**
       * Update the visual state based on node attributes
       */
      const updateVisualState = (nodeAttrs: ImageNodeAttrs): void => {
        const {
          imageId,
          sdId,
          alt,
          caption: captionText,
          alignment,
          width,
          display,
          linkHref,
          wrap,
        } = nodeAttrs;

        // Update display mode
        wrapper.dataset['display'] = display;
        wrapper.classList.toggle('notecove-image--inline', display === 'inline');
        wrapper.classList.toggle('notecove-image--block', display === 'block');

        // Update alignment classes
        wrapper.dataset['alignment'] = alignment;
        wrapper.classList.toggle('notecove-image--align-left', alignment === 'left');
        wrapper.classList.toggle('notecove-image--align-center', alignment === 'center');
        wrapper.classList.toggle('notecove-image--align-right', alignment === 'right');

        // Update wrap mode (only applies to block images with left/right alignment)
        // Wrap doesn't make sense for center alignment (can't flow text around centered content)
        const shouldWrap = wrap && display === 'block' && alignment !== 'center';
        wrapper.classList.toggle('notecove-image--wrap', shouldWrap);

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

        // Update caption (hidden in inline mode)
        if (captionText && display === 'block') {
          caption.textContent = captionText;
          caption.style.display = '';
        } else {
          caption.textContent = '';
          caption.style.display = 'none';
        }

        // Update link indicator
        wrapper.classList.toggle('notecove-image--linked', !!linkHref);
        if (linkHref) {
          wrapper.dataset['linkHref'] = linkHref;
        } else {
          delete wrapper.dataset['linkHref'];
        }

        // Set up lazy loading if we have imageId and sdId
        if (imageId && sdId) {
          // If already loaded, just update visual state (don't reload)
          if (hasLoadedImage) {
            return;
          }

          // Set up IntersectionObserver for lazy loading
          if (!intersectionObserver) {
            intersectionObserver = new IntersectionObserver(
              (entries) => {
                entries.forEach((entry) => {
                  if (entry.isIntersecting && imageId && sdId) {
                    void loadImage(imageId, sdId);
                  }
                });
              },
              {
                rootMargin: '100px', // Start loading 100px before visible
                threshold: 0,
              }
            );
            intersectionObserver.observe(wrapper);
          }

          // Show lazy placeholder (not loading spinner)
          lazyPlaceholder.style.display = '';
          loadingPlaceholder.style.display = 'none';
          errorPlaceholder.style.display = 'none';
          img.style.display = 'none';
        } else {
          // No imageId/sdId - show error state
          debugLog('Image missing imageId or sdId:', { imageId, sdId });
          lazyPlaceholder.style.display = 'none';
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

      // ===== Resize handling =====
      let isResizing = false;
      let resizeStartX = 0;
      let resizeStartY = 0;
      let resizeStartWidth = 0;
      let resizeStartHeight = 0;
      let resizeCorner = '';
      let aspectRatio = 1;

      const startResize = (e: MouseEvent): void => {
        const target = e.target as HTMLElement;
        if (!target.classList.contains('notecove-image-resize-handle')) return;

        e.preventDefault();
        e.stopPropagation();

        isResizing = true;
        resizeCorner = target.dataset['corner'] ?? '';
        resizeStartX = e.clientX;
        resizeStartY = e.clientY;

        // Get current image dimensions
        const rect = img.getBoundingClientRect();
        resizeStartWidth = rect.width;
        resizeStartHeight = rect.height;
        aspectRatio = resizeStartWidth / resizeStartHeight;

        // Show resize tooltip
        resizeTooltip.style.display = '';
        updateResizeTooltip(resizeStartWidth, resizeStartHeight);

        // Add class to indicate resizing
        wrapper.classList.add('notecove-image--resizing');

        // Add document-level listeners
        document.addEventListener('mousemove', handleResize);
        document.addEventListener('mouseup', endResize);
      };

      const updateResizeTooltip = (width: number, height: number): void => {
        resizeTooltip.textContent = `${Math.round(width)} × ${Math.round(height)}`;
      };

      const handleResize = (e: MouseEvent): void => {
        if (!isResizing) return;

        const deltaX = e.clientX - resizeStartX;
        const deltaY = e.clientY - resizeStartY;

        // Calculate new dimensions based on corner being dragged
        let newWidth = resizeStartWidth;
        let newHeight = resizeStartHeight;

        // Calculate the primary change (most significant movement)
        const maintainAspect = !e.shiftKey;

        if (resizeCorner === 'se') {
          // Southeast: both dimensions increase with positive deltas
          newWidth = resizeStartWidth + deltaX;
          if (maintainAspect) {
            newHeight = newWidth / aspectRatio;
          } else {
            newHeight = resizeStartHeight + deltaY;
          }
        } else if (resizeCorner === 'sw') {
          // Southwest: width decreases with positive deltaX, height increases with positive deltaY
          newWidth = resizeStartWidth - deltaX;
          if (maintainAspect) {
            newHeight = newWidth / aspectRatio;
          } else {
            newHeight = resizeStartHeight + deltaY;
          }
        } else if (resizeCorner === 'ne') {
          // Northeast: width increases, height decreases
          newWidth = resizeStartWidth + deltaX;
          if (maintainAspect) {
            newHeight = newWidth / aspectRatio;
          } else {
            newHeight = resizeStartHeight - deltaY;
          }
        } else if (resizeCorner === 'nw') {
          // Northwest: both dimensions decrease with positive deltas
          newWidth = resizeStartWidth - deltaX;
          if (maintainAspect) {
            newHeight = newWidth / aspectRatio;
          } else {
            newHeight = resizeStartHeight - deltaY;
          }
        }

        // Enforce minimum size
        const minSize = 50;
        newWidth = Math.max(minSize, newWidth);
        newHeight = Math.max(minSize, newHeight);

        // Apply the preview dimensions
        img.style.width = `${newWidth}px`;
        img.style.height = maintainAspect ? 'auto' : `${newHeight}px`;
        imageContainer.style.width = `${newWidth}px`;

        updateResizeTooltip(newWidth, maintainAspect ? newWidth / aspectRatio : newHeight);
      };

      const endResize = (_e: MouseEvent): void => {
        if (!isResizing) return;

        isResizing = false;
        wrapper.classList.remove('notecove-image--resizing');
        resizeTooltip.style.display = 'none';

        // Remove document-level listeners
        document.removeEventListener('mousemove', handleResize);
        document.removeEventListener('mouseup', endResize);

        // Get the final width
        const finalWidth = img.getBoundingClientRect().width;

        // Get container width to calculate percentage
        const containerWidth = wrapper.parentElement?.clientWidth ?? 800;
        const widthPercentage = Math.round((finalWidth / containerWidth) * 100);

        // Update the node's width attribute
        if (typeof getPos === 'function') {
          const pos = getPos();
          if (typeof pos === 'number') {
            const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
              ...node.attrs,
              width: `${widthPercentage}%`,
            });
            editor.view.dispatch(tr);
            debugLog('Image resized to:', `${widthPercentage}%`);
          }
        }
      };

      // Add mousedown listeners to resize handles
      Object.values(resizeHandles).forEach((handle) => {
        handle.addEventListener('mousedown', startResize);
      });

      // Click handler - opens link URL or lightbox
      const handleImageClick = (e: MouseEvent): void => {
        // Don't handle if clicking on a resize handle
        if ((e.target as HTMLElement).classList.contains('notecove-image-resize-handle')) {
          return;
        }

        // Don't handle during resize
        if (isResizing) {
          return;
        }

        const attrs = node.attrs as ImageNodeAttrs;
        if (!attrs.imageId || !attrs.sdId) return;

        // If image has a link and Cmd/Ctrl is NOT pressed, open the link
        // Cmd/Ctrl+click opens lightbox even for linked images
        if (attrs.linkHref && !e.metaKey && !e.ctrlKey) {
          e.preventDefault();
          window.open(attrs.linkHref, '_blank', 'noopener,noreferrer');
          return;
        }

        // Open lightbox (default behavior or Cmd/Ctrl+click for linked images)
        // Gather all images in the document for navigation
        const allImages: { imageId: string; sdId: string; alt?: string }[] = [];
        editor.state.doc.descendants((n) => {
          if (n.type.name === 'notecoveImage') {
            const nodeAttrs = n.attrs as ImageNodeAttrs;
            if (nodeAttrs.imageId && nodeAttrs.sdId) {
              allImages.push({
                imageId: nodeAttrs.imageId,
                sdId: nodeAttrs.sdId,
                alt: nodeAttrs.alt,
              });
            }
          }
        });

        openLightbox({
          imageId: attrs.imageId,
          sdId: attrs.sdId,
          alt: attrs.alt,
          allImages: allImages.length > 1 ? allImages : undefined,
        });
      };

      img.addEventListener('click', handleImageClick);
      img.style.cursor = 'pointer';

      // Right-click handler for context menu
      const handleContextMenu = (e: MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();

        // Get current node position and attributes from the editor state
        if (typeof getPos !== 'function') return;
        const pos = getPos();
        if (typeof pos !== 'number') return;

        // Get the current node from the editor state (not the stale closure)
        const currentNode = editor.state.doc.nodeAt(pos);
        if (currentNode?.type.name !== 'notecoveImage') return;

        const attrs = currentNode.attrs as ImageNodeAttrs;
        if (!attrs.imageId || !attrs.sdId) return;

        openImageContextMenu({
          imageId: attrs.imageId,
          sdId: attrs.sdId,
          x: e.clientX,
          y: e.clientY,
          attrs: attrs,
          onUpdateAttrs: (newAttrs) => {
            // Re-fetch position in case document changed
            const currentPos = getPos();
            if (typeof currentPos !== 'number') return;

            // Get current node again to merge with latest attrs
            const nodeAtPos = editor.state.doc.nodeAt(currentPos);
            if (!nodeAtPos) return;

            const tr = editor.state.tr.setNodeMarkup(currentPos, undefined, {
              ...nodeAtPos.attrs,
              ...newAttrs,
            });
            editor.view.dispatch(tr);
          },
          onDelete: () => {
            const currentPos = getPos();
            if (typeof currentPos !== 'number') return;
            const nodeAtPos = editor.state.doc.nodeAt(currentPos);
            if (!nodeAtPos) return;
            const tr = editor.state.tr.delete(currentPos, currentPos + nodeAtPos.nodeSize);
            editor.view.dispatch(tr);
          },
          onReload: () => {
            if (!attrs.imageId || !attrs.sdId) return;

            // Clear caches for this image
            const cacheKey = `${attrs.sdId}:${attrs.imageId}`;
            thumbnailCache.delete(cacheKey);
            imageDataCache.delete(cacheKey);

            // Reset load state
            hasLoadedImage = false;

            // Reset visual state
            img.src = '';
            img.style.display = 'none';
            img.classList.remove('notecove-image--fade-in');
            loadingPlaceholder.style.display = 'none';
            errorPlaceholder.style.display = 'none';
            lazyPlaceholder.style.display = '';

            // Re-trigger lazy loading
            if (intersectionObserver) {
              intersectionObserver.observe(wrapper);
            } else {
              // Immediate load if no observer
              void loadImage(attrs.imageId, attrs.sdId);
            }
          },
        });
      };

      wrapper.addEventListener('contextmenu', handleContextMenu);

      // Double-click handler to open in external app
      const handleDoubleClick = (e: MouseEvent): void => {
        e.preventDefault();
        e.stopPropagation();

        const attrs = node.attrs as ImageNodeAttrs;
        const { imageId, sdId } = attrs;
        if (!imageId || !sdId) return;

        void (async () => {
          try {
            await window.electronAPI.image.openExternal(sdId, imageId);
          } catch (error) {
            console.error('[NotecoveImage] Failed to open image externally:', error);
          }
        })();
      };

      img.addEventListener('dblclick', handleDoubleClick);

      // Initial setup (lazy loading will load when visible)
      updateVisualState(node.attrs as ImageNodeAttrs);

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

      // Subscribe to image availability events (for when synced images arrive)
      // Note: Defensive check even though types say it's always present - could be browser mode
      let cleanupImageAvailable: (() => void) | null = null;
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
      if (window.electronAPI?.image.onAvailable) {
        cleanupImageAvailable = window.electronAPI.image.onAvailable((event) => {
          // Get fresh node attrs (they may have changed)
          if (typeof getPos !== 'function') return;
          const pos = getPos();
          if (typeof pos !== 'number') return;
          const currentNode = editor.state.doc.nodeAt(pos);
          if (!currentNode) return;
          const attrs = currentNode.attrs as ImageNodeAttrs;

          // Check if this event matches our image
          if (event.imageId === attrs.imageId && event.sdId === attrs.sdId) {
            debugLog('Image became available via sync:', event);

            // Only reload if currently showing error placeholder
            if (errorPlaceholder.style.display !== 'none') {
              // Reset state so image can be reloaded
              hasLoadedImage = false;
              errorPlaceholder.style.display = 'none';

              // Clear any cached data for this image so we fetch fresh
              const cacheKey = `${attrs.sdId}:${attrs.imageId}`;
              thumbnailCache.delete(cacheKey);
              imageDataCache.delete(cacheKey);

              // Re-trigger load
              void loadImage(attrs.imageId, attrs.sdId);
            }
          }
        });
      }

      return {
        dom: wrapper,
        // No contentDOM since this is an atom node

        update: (updatedNode: ProseMirrorNode) => {
          if (updatedNode.type !== this.type) return false;
          updateVisualState(updatedNode.attrs as ImageNodeAttrs);
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
          // Clean up IntersectionObserver
          if (intersectionObserver) {
            intersectionObserver.disconnect();
            intersectionObserver = null;
          }
          // Clean up resize listeners
          Object.values(resizeHandles).forEach((handle) => {
            handle.removeEventListener('mousedown', startResize);
          });
          document.removeEventListener('mousemove', handleResize);
          document.removeEventListener('mouseup', endResize);
          // Clean up click listener
          img.removeEventListener('click', handleImageClick);
          // Clean up context menu listener
          wrapper.removeEventListener('contextmenu', handleContextMenu);
          // Clean up double-click listener
          img.removeEventListener('dblclick', handleDoubleClick);
          // Clean up image availability listener
          if (cleanupImageAvailable) {
            cleanupImageAvailable();
          }
        },
      };
    };
  },
});

export default NotecoveImage;

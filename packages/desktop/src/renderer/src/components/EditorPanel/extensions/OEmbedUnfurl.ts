/**
 * OEmbedUnfurl - TipTap Node Extension
 *
 * A block node extension for displaying rich oEmbed unfurl cards.
 * oEmbed data is stored in the node attributes (syncs via CRDT).
 *
 * @see plans/oembed-link-unfurling/PLAN-PHASE-3.md
 */

import { Node, mergeAttributes } from '@tiptap/core';
import type { Node as ProseMirrorNode, Mark } from '@tiptap/pm/model';
import type { OEmbedErrorType } from '@notecove/shared';
import { getCurrentLinkDisplayPreference } from '../../../contexts/LinkDisplayPreferenceContext';

/**
 * OEmbedUnfurl node attributes
 *
 * oEmbed data is stored directly in the node for offline access and sync.
 */
export interface OEmbedUnfurlAttrs {
  /** The URL being unfurled */
  url: string;
  /** oEmbed type: photo, video, link, rich */
  oembedType: string | null;
  /** Page title */
  title: string | null;
  /** Page description */
  description: string | null;
  /** Thumbnail URL */
  thumbnailUrl: string | null;
  /** Provider name (e.g., "YouTube") */
  providerName: string | null;
  /** Provider URL */
  providerUrl: string | null;
  /** Author name */
  authorName: string | null;
  /** Embedded HTML (for video/rich types) */
  html: string | null;
  /** Content width */
  width: number | null;
  /** Content height */
  height: number | null;
  /** Timestamp when data was fetched */
  fetchedAt: number | null;
  /** Whether fetch is in progress */
  isLoading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Error type for programmatic handling */
  errorType: OEmbedErrorType | null;
}

/**
 * Extension options
 */
export interface OEmbedUnfurlOptions {
  /** HTML attributes to add to the wrapper element */
  HTMLAttributes: Record<string, unknown>;
}

// Extend TipTap's Commands interface
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    oembedUnfurl: {
      /**
       * Insert an unfurl block at the current position
       */
      insertUnfurl: (url: string) => ReturnType;
      /**
       * Update the attributes of the selected unfurl
       */
      updateUnfurl: (attrs: Partial<OEmbedUnfurlAttrs>) => ReturnType;
      /**
       * Delete the selected unfurl block
       */
      deleteUnfurl: () => ReturnType;
    };
  }
}

/**
 * OEmbedUnfurl Extension
 *
 * Block node for displaying rich link previews.
 */
export const OEmbedUnfurl = Node.create<OEmbedUnfurlOptions>({
  name: 'oembedUnfurl',

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
      url: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-url') ?? '',
        renderHTML: (attributes: OEmbedUnfurlAttrs) => ({
          'data-url': attributes.url,
        }),
      },
      oembedType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-oembed-type'),
        renderHTML: (attributes: OEmbedUnfurlAttrs) => {
          if (!attributes.oembedType) return {};
          return { 'data-oembed-type': attributes.oembedType };
        },
      },
      title: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-title'),
        renderHTML: (attributes: OEmbedUnfurlAttrs) => {
          if (!attributes.title) return {};
          return { 'data-title': attributes.title };
        },
      },
      description: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-description'),
        renderHTML: (attributes: OEmbedUnfurlAttrs) => {
          if (!attributes.description) return {};
          return { 'data-description': attributes.description };
        },
      },
      thumbnailUrl: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-thumbnail-url'),
        renderHTML: (attributes: OEmbedUnfurlAttrs) => {
          if (!attributes.thumbnailUrl) return {};
          return { 'data-thumbnail-url': attributes.thumbnailUrl };
        },
      },
      providerName: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-provider-name'),
        renderHTML: (attributes: OEmbedUnfurlAttrs) => {
          if (!attributes.providerName) return {};
          return { 'data-provider-name': attributes.providerName };
        },
      },
      providerUrl: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-provider-url'),
        renderHTML: (attributes: OEmbedUnfurlAttrs) => {
          if (!attributes.providerUrl) return {};
          return { 'data-provider-url': attributes.providerUrl };
        },
      },
      authorName: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-author-name'),
        renderHTML: (attributes: OEmbedUnfurlAttrs) => {
          if (!attributes.authorName) return {};
          return { 'data-author-name': attributes.authorName };
        },
      },
      html: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-html'),
        renderHTML: (attributes: OEmbedUnfurlAttrs) => {
          if (!attributes.html) return {};
          return { 'data-html': attributes.html };
        },
      },
      width: {
        default: null,
        parseHTML: (element) => {
          const val = element.getAttribute('data-width');
          return val ? parseInt(val, 10) : null;
        },
        renderHTML: (attributes: OEmbedUnfurlAttrs) => {
          if (attributes.width === null) return {};
          return { 'data-width': String(attributes.width) };
        },
      },
      height: {
        default: null,
        parseHTML: (element) => {
          const val = element.getAttribute('data-height');
          return val ? parseInt(val, 10) : null;
        },
        renderHTML: (attributes: OEmbedUnfurlAttrs) => {
          if (attributes.height === null) return {};
          return { 'data-height': String(attributes.height) };
        },
      },
      fetchedAt: {
        default: null,
        parseHTML: (element) => {
          const val = element.getAttribute('data-fetched-at');
          return val ? parseInt(val, 10) : null;
        },
        renderHTML: (attributes: OEmbedUnfurlAttrs) => {
          if (attributes.fetchedAt === null) return {};
          return { 'data-fetched-at': String(attributes.fetchedAt) };
        },
      },
      isLoading: {
        default: false,
        parseHTML: (element) => element.getAttribute('data-loading') === 'true',
        renderHTML: (attributes: OEmbedUnfurlAttrs) => {
          if (!attributes.isLoading) return {};
          return { 'data-loading': 'true' };
        },
      },
      error: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-error'),
        renderHTML: (attributes: OEmbedUnfurlAttrs) => {
          if (!attributes.error) return {};
          return { 'data-error': attributes.error };
        },
      },
      errorType: {
        default: null,
        parseHTML: (element) => element.getAttribute('data-error-type') as OEmbedErrorType | null,
        renderHTML: (attributes: OEmbedUnfurlAttrs) => {
          if (!attributes.errorType) return {};
          return { 'data-error-type': attributes.errorType };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-oembed-unfurl]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-oembed-unfurl': '',
      }),
    ];
  },

  addCommands() {
    return {
      insertUnfurl:
        (url: string) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              url,
              isLoading: true,
            },
          });
        },
      updateUnfurl:
        (attrs) =>
        ({ commands }) => {
          return commands.updateAttributes(this.name, attrs);
        },
      deleteUnfurl:
        () =>
        ({ commands }) => {
          return commands.deleteNode(this.name);
        },
    };
  },

  addNodeView() {
    return ({ node, HTMLAttributes, getPos, editor }) => {
      // Create the DOM structure
      const wrapper = document.createElement('div');
      wrapper.className = 'oembed-unfurl-wrapper';
      wrapper.contentEditable = 'false';

      // Container for React component
      const container = document.createElement('div');
      container.className = 'oembed-unfurl-container';
      wrapper.appendChild(container);

      // Track React root for cleanup
      let reactRoot: { unmount: () => void; render: (element: React.ReactNode) => void } | null =
        null;

      // Apply HTML attributes
      Object.entries(HTMLAttributes).forEach(([key, value]) => {
        if (value !== null && value !== undefined) {
          wrapper.setAttribute(key, String(value));
        }
      });

      /**
       * Render the React component
       */
      const renderReactComponent = (attrs: OEmbedUnfurlAttrs): void => {
        // In secure mode, hide the unfurl block completely
        if (getCurrentLinkDisplayPreference() === 'secure') {
          wrapper.style.display = 'none';
          return;
        }
        wrapper.style.display = '';

        void import('react-dom/client').then(({ createRoot }) => {
          void Promise.all([
            import('../UnfurlCard'),
            import('../VideoEmbed'),
            import('../RichEmbed'),
            import('../utils/providerEmbed'),
          ]).then(
            ([
              { UnfurlCard },
              { VideoEmbed },
              { RichEmbed },
              { getProviderEmbed, isAllowedRichProvider },
            ]) => {
              // Clean up existing root
              if (reactRoot) {
                reactRoot.unmount();
              }

              reactRoot = createRoot(container);

              // Check if data is stale (older than 30 days)
              const isStale =
                attrs.fetchedAt !== null && Date.now() - attrs.fetchedAt > 30 * 24 * 60 * 60 * 1000;

              // Determine if we have data
              const hasData = attrs.title !== null || attrs.fetchedAt !== null;

              // Check for video/rich embed
              // Build a partial oEmbed-like object for provider detection
              const providerEmbed = getProviderEmbed(
                attrs.url,
                attrs.oembedType && !attrs.isLoading
                  ? {
                      type: attrs.oembedType as 'video' | 'rich' | 'link' | 'photo',
                      version: '1.0' as const,
                      ...(attrs.title ? { title: attrs.title } : {}),
                      ...(attrs.html ? { html: attrs.html } : {}),
                      ...(attrs.width ? { width: attrs.width } : {}),
                      ...(attrs.height ? { height: attrs.height } : {}),
                      ...(attrs.providerName ? { provider_name: attrs.providerName } : {}),
                      ...(attrs.providerUrl ? { provider_url: attrs.providerUrl } : {}),
                      ...(attrs.thumbnailUrl ? { thumbnail_url: attrs.thumbnailUrl } : {}),
                    }
                  : null
              );

              // Handle refresh
              const handleRefresh = (): void => {
                if (typeof getPos !== 'function') return;
                const pos = getPos();
                if (typeof pos !== 'number') return;

                // Set loading state
                const tr = editor.state.tr.setNodeMarkup(pos, undefined, {
                  ...attrs,
                  isLoading: true,
                  error: null,
                  errorType: null,
                });
                editor.view.dispatch(tr);

                // Fetch new data
                void window.electronAPI.oembed.refresh(attrs.url).then((result) => {
                  const currentPos = getPos();
                  if (typeof currentPos !== 'number') return;

                  if (result.success && result.data) {
                    const updateTr = editor.state.tr.setNodeMarkup(currentPos, undefined, {
                      ...attrs,
                      oembedType: result.data.type,
                      title: result.data.title ?? null,
                      description: result.data.author_name ?? null,
                      thumbnailUrl: result.data.thumbnail_url ?? null,
                      providerName: result.data.provider_name ?? null,
                      providerUrl: result.data.provider_url ?? null,
                      authorName: result.data.author_name ?? null,
                      html: 'html' in result.data ? result.data.html : null,
                      width: 'width' in result.data ? result.data.width : null,
                      height: 'height' in result.data ? result.data.height : null,
                      fetchedAt: Date.now(),
                      isLoading: false,
                      error: null,
                      errorType: null,
                    });
                    editor.view.dispatch(updateTr);
                  } else {
                    const errorTr = editor.state.tr.setNodeMarkup(currentPos, undefined, {
                      ...attrs,
                      isLoading: false,
                      error: result.error ?? 'Failed to fetch preview',
                      errorType: result.errorType ?? null,
                    });
                    editor.view.dispatch(errorTr);
                  }
                });
              };

              // Handle delete
              const handleDelete = (): void => {
                if (typeof getPos !== 'function') return;
                const pos = getPos();
                if (typeof pos !== 'number') return;

                const tr = editor.state.tr.delete(pos, pos + node.nodeSize);
                editor.view.dispatch(tr);
              };

              // Handle convert to chip
              const handleConvertToChip = (): void => {
                if (typeof getPos !== 'function') return;
                const unfurlPos = getPos();
                if (typeof unfurlPos !== 'number') return;

                // Find the link with matching URL in the paragraph before the unfurl
                // We only want to update THIS specific link, not all links with the same URL
                let linkFrom: number | null = null;
                let linkTo: number | null = null;
                let linkMark: Mark | null = null;

                // Search the node before the unfurl (should be the paragraph)
                if (unfurlPos > 0) {
                  const beforePos = unfurlPos - 1;
                  const $beforePos = editor.state.doc.resolve(beforePos);
                  const parentNode = $beforePos.node($beforePos.depth);
                  const parentStart = $beforePos.start($beforePos.depth);

                  // Search within this paragraph for the link
                  parentNode.descendants((node, offset) => {
                    if (linkFrom !== null) return false; // Already found
                    if (!node.isText) return true;

                    const mark = node.marks.find((m) => m.type.name === 'link');
                    if (mark && mark.attrs['href'] === attrs.url) {
                      linkFrom = parentStart + offset;
                      linkTo = linkFrom + node.nodeSize;
                      linkMark = mark;
                      return false; // Stop searching
                    }
                    return true;
                  });
                }

                let tr = editor.state.tr;

                // Update only the specific link if found
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- values set in callback
                if (linkFrom !== null && linkTo !== null && linkMark !== null) {
                  // Cast is safe - we just checked linkMark !== null, but TypeScript
                  // can't narrow through closure assignments
                  const mark = linkMark as Mark;
                  const newMark = mark.type.create({
                    ...mark.attrs,
                    displayMode: 'chip',
                  });
                  tr = tr.removeMark(linkFrom, linkTo, mark.type);
                  tr = tr.addMark(linkFrom, linkTo, newMark);
                }

                // Delete the unfurl block
                const currentUnfurlPos = getPos();
                if (typeof currentUnfurlPos === 'number') {
                  const currentNode = editor.state.doc.nodeAt(currentUnfurlPos);
                  if (currentNode?.type.name === 'oembedUnfurl') {
                    tr = tr.delete(currentUnfurlPos, currentUnfurlPos + currentNode.nodeSize);
                  }
                }

                editor.view.dispatch(tr);
              };

              // Handle convert to plain link
              const handleConvertToPlainLink = (): void => {
                if (typeof getPos !== 'function') return;
                const unfurlPos = getPos();
                if (typeof unfurlPos !== 'number') return;

                // Find the link in the paragraph BEFORE this unfurl block (not all links with same URL)
                let linkFrom: number | null = null;
                let linkTo: number | null = null;
                let linkMark: Mark | null = null;

                // Search the node before the unfurl (should be the paragraph containing the link)
                if (unfurlPos > 0) {
                  const beforePos = unfurlPos - 1;
                  const $beforePos = editor.state.doc.resolve(beforePos);
                  const parentNode = $beforePos.node($beforePos.depth);
                  const parentStart = $beforePos.start($beforePos.depth);

                  // Search within this paragraph for the link with matching URL
                  parentNode.descendants((node, offset) => {
                    if (linkFrom !== null) return false; // Already found
                    if (!node.isText) return true;

                    const mark = node.marks.find((m) => m.type.name === 'link');
                    if (mark && mark.attrs['href'] === attrs.url) {
                      linkFrom = parentStart + offset;
                      linkTo = linkFrom + node.nodeSize;
                      linkMark = mark;
                      return false; // Stop searching
                    }
                    return true;
                  });
                }

                let tr = editor.state.tr;

                // Update only the specific link if found
                // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- values set in callback
                if (linkFrom !== null && linkTo !== null && linkMark !== null) {
                  // Cast is safe - we just checked linkMark !== null, but TypeScript
                  // can't narrow through closure assignments
                  const mark = linkMark as Mark;
                  const newMark = mark.type.create({
                    ...mark.attrs,
                    displayMode: 'link',
                  });
                  tr = tr.removeMark(linkFrom, linkTo, mark.type);
                  tr = tr.addMark(linkFrom, linkTo, newMark);
                }

                // Delete the unfurl block
                const currentUnfurlPos = getPos();
                if (typeof currentUnfurlPos === 'number') {
                  const currentNode = editor.state.doc.nodeAt(currentUnfurlPos);
                  if (currentNode?.type.name === 'oembedUnfurl') {
                    tr = tr.delete(currentUnfurlPos, currentUnfurlPos + currentNode.nodeSize);
                  }
                }

                editor.view.dispatch(tr);
              };

              // Render with React 18 createRoot
              void import('react').then(({ createElement }) => {
                const isSelected = wrapper.classList.contains('ProseMirror-selectednode');

                // Choose component based on embed type
                let component: React.ReactNode;

                if (attrs.isLoading || attrs.error || !providerEmbed) {
                  // Show UnfurlCard for loading, error, or link/photo types
                  component = createElement(UnfurlCard, {
                    url: attrs.url,
                    title: attrs.title,
                    description: attrs.description,
                    thumbnailUrl: attrs.thumbnailUrl,
                    providerName: attrs.providerName,
                    hasData,
                    isStale,
                    isLoading: attrs.isLoading,
                    error: attrs.error,
                    errorType: attrs.errorType,
                    selected: isSelected,
                    onRefresh: handleRefresh,
                    onDelete: handleDelete,
                    onConvertToChip: handleConvertToChip,
                    onConvertToPlainLink: handleConvertToPlainLink,
                  });
                } else if (providerEmbed.type === 'video' && providerEmbed.embedUrl) {
                  // Video embed with URL
                  component = createElement(VideoEmbed, {
                    embedUrl: providerEmbed.embedUrl,
                    originalUrl: attrs.url,
                    title: attrs.title,
                    providerName: providerEmbed.provider ?? attrs.providerName,
                    thumbnailUrl: attrs.thumbnailUrl,
                    aspectRatio: providerEmbed.aspectRatio,
                    selected: isSelected,
                    onRefresh: handleRefresh,
                    onDelete: handleDelete,
                    onConvertToChip: handleConvertToChip,
                    onConvertToPlainLink: handleConvertToPlainLink,
                  });
                } else if (providerEmbed.type === 'rich' && providerEmbed.embedHtml) {
                  // Rich HTML embed - check if provider is allowed first
                  if (isAllowedRichProvider(attrs.providerUrl ?? undefined)) {
                    component = createElement(RichEmbed, {
                      html: providerEmbed.embedHtml,
                      originalUrl: attrs.url,
                      providerUrl: attrs.providerUrl,
                      providerName: providerEmbed.provider ?? attrs.providerName,
                      title: attrs.title,
                      width: attrs.width,
                      height: attrs.height,
                      selected: isSelected,
                      onRefresh: handleRefresh,
                      onDelete: handleDelete,
                      onConvertToChip: handleConvertToChip,
                      onConvertToPlainLink: handleConvertToPlainLink,
                    });
                  } else {
                    // Disallowed provider, fallback to UnfurlCard
                    component = createElement(UnfurlCard, {
                      url: attrs.url,
                      title: attrs.title,
                      description: attrs.description,
                      thumbnailUrl: attrs.thumbnailUrl,
                      providerName: attrs.providerName,
                      hasData,
                      isStale,
                      isLoading: false,
                      errorType: null,
                      selected: isSelected,
                      onRefresh: handleRefresh,
                      onDelete: handleDelete,
                      onConvertToChip: handleConvertToChip,
                      onConvertToPlainLink: handleConvertToPlainLink,
                    });
                  }
                } else if (providerEmbed.type === 'video' && providerEmbed.embedHtml) {
                  // Video with HTML (from oEmbed response)
                  component = createElement(RichEmbed, {
                    html: providerEmbed.embedHtml,
                    originalUrl: attrs.url,
                    providerUrl: attrs.providerUrl,
                    providerName: providerEmbed.provider ?? attrs.providerName,
                    title: attrs.title,
                    width: attrs.width,
                    height: attrs.height,
                    selected: isSelected,
                    onRefresh: handleRefresh,
                    onDelete: handleDelete,
                    onConvertToChip: handleConvertToChip,
                    onConvertToPlainLink: handleConvertToPlainLink,
                  });
                } else {
                  // Fallback to UnfurlCard
                  component = createElement(UnfurlCard, {
                    url: attrs.url,
                    title: attrs.title,
                    description: attrs.description,
                    thumbnailUrl: attrs.thumbnailUrl,
                    providerName: attrs.providerName,
                    hasData,
                    isStale,
                    isLoading: attrs.isLoading,
                    error: attrs.error,
                    errorType: attrs.errorType,
                    selected: isSelected,
                    onRefresh: handleRefresh,
                    onDelete: handleDelete,
                    onConvertToChip: handleConvertToChip,
                    onConvertToPlainLink: handleConvertToPlainLink,
                  });
                }

                reactRoot?.render(component);
              });
            }
          );
        });
      };

      /**
       * Check if an error type indicates oEmbed is definitively unavailable
       * (not a transient error that might resolve on retry)
       */
      const shouldAutoConvertToPlainLink = (
        errorType: OEmbedErrorType | null | undefined
      ): boolean => {
        return errorType === 'NOT_FOUND' || errorType === 'INVALID_RESPONSE';
      };

      /**
       * Convert the unfurl to a plain link (when oEmbed is unavailable)
       */
      const convertToPlainLink = (unfurlPos: number, url: string): void => {
        // Find the link in the paragraph BEFORE this unfurl block
        let linkFrom: number | null = null;
        let linkTo: number | null = null;
        let linkMark: Mark | null = null;

        if (unfurlPos > 0) {
          const beforePos = unfurlPos - 1;
          const $beforePos = editor.state.doc.resolve(beforePos);
          const parentNode = $beforePos.node($beforePos.depth);
          const parentStart = $beforePos.start($beforePos.depth);

          parentNode.descendants((node, offset) => {
            if (linkFrom !== null) return false;
            if (!node.isText) return true;

            const mark = node.marks.find((m) => m.type.name === 'link');
            if (mark?.attrs['href'] === url) {
              linkFrom = parentStart + offset;
              linkTo = linkFrom + node.nodeSize;
              linkMark = mark;
              return false;
            }
            return true;
          });
        }

        let tr = editor.state.tr;

        // Update the link to plain link mode
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- values set in callback
        if (linkFrom !== null && linkTo !== null && linkMark !== null) {
          const mark = linkMark as Mark;
          const newMark = mark.type.create({
            ...mark.attrs,
            displayMode: 'link',
          });
          tr = tr.removeMark(linkFrom, linkTo, mark.type);
          tr = tr.addMark(linkFrom, linkTo, newMark);
        }

        // Delete the unfurl block
        const currentNode = editor.state.doc.nodeAt(unfurlPos);
        if (currentNode?.type.name === 'oembedUnfurl') {
          tr = tr.delete(unfurlPos, unfurlPos + currentNode.nodeSize);
        }

        editor.view.dispatch(tr);
      };

      /**
       * Fetch oEmbed data for a URL
       */
      const fetchOEmbedData = async (attrs: OEmbedUnfurlAttrs): Promise<void> => {
        if (typeof getPos !== 'function') return;
        const pos = getPos();
        if (typeof pos !== 'number') return;

        try {
          const result = await window.electronAPI.oembed.unfurl(attrs.url);

          const currentPos = getPos();
          if (typeof currentPos !== 'number') return;

          if (result.success && result.data) {
            const tr = editor.state.tr.setNodeMarkup(currentPos, undefined, {
              ...attrs,
              oembedType: result.data.type,
              title: result.data.title ?? null,
              description: result.data.author_name ?? null,
              thumbnailUrl: result.data.thumbnail_url ?? null,
              providerName: result.data.provider_name ?? null,
              providerUrl: result.data.provider_url ?? null,
              authorName: result.data.author_name ?? null,
              html: 'html' in result.data ? result.data.html : null,
              width: 'width' in result.data ? result.data.width : null,
              height: 'height' in result.data ? result.data.height : null,
              fetchedAt: Date.now(),
              isLoading: false,
              error: null,
              errorType: null,
            });
            editor.view.dispatch(tr);
          } else {
            // If oEmbed is definitively unavailable, auto-convert to plain link
            const errorType = result.errorType as OEmbedErrorType | undefined;
            if (shouldAutoConvertToPlainLink(errorType)) {
              convertToPlainLink(currentPos, attrs.url);
            } else {
              // For retryable errors, show error state with retry option
              const tr = editor.state.tr.setNodeMarkup(currentPos, undefined, {
                ...attrs,
                isLoading: false,
                error: result.error ?? 'Failed to fetch preview',
                errorType: result.errorType ?? null,
              });
              editor.view.dispatch(tr);
            }
          }
        } catch (err) {
          const currentPos = getPos();
          if (typeof currentPos !== 'number') return;

          // Network errors are retryable, so show error state
          const tr = editor.state.tr.setNodeMarkup(currentPos, undefined, {
            ...attrs,
            isLoading: false,
            error: err instanceof Error ? err.message : 'Unknown error',
            errorType: 'NETWORK_ERROR' as OEmbedErrorType,
          });
          editor.view.dispatch(tr);
        }
      };

      // Initial render
      const attrs = node.attrs as OEmbedUnfurlAttrs;
      renderReactComponent(attrs);

      // If loading and no data, fetch the data
      if (attrs.isLoading && !attrs.title && !attrs.fetchedAt) {
        void fetchOEmbedData(attrs);
      }

      // Handle selection styling
      const handleSelection = (): void => {
        if (typeof getPos !== 'function') return;
        const pos = getPos();
        if (typeof pos !== 'number') return;

        const { from, to } = editor.state.selection;
        const isSelected = from <= pos && pos < to;
        const wasSelected = wrapper.classList.contains('ProseMirror-selectednode');

        if (isSelected !== wasSelected) {
          wrapper.classList.toggle('ProseMirror-selectednode', isSelected);
          // Re-render to update selected state in React component
          const currentNode = editor.state.doc.nodeAt(pos);
          if (currentNode) {
            renderReactComponent(currentNode.attrs as OEmbedUnfurlAttrs);
          }
        }
      };

      // Listen for selection changes
      editor.on('selectionUpdate', handleSelection);

      return {
        dom: wrapper,

        update: (updatedNode: ProseMirrorNode) => {
          if (updatedNode.type.name !== this.name) return false;
          renderReactComponent(updatedNode.attrs as OEmbedUnfurlAttrs);
          return true;
        },

        selectNode: () => {
          wrapper.classList.add('ProseMirror-selectednode');
          const pos = typeof getPos === 'function' ? getPos() : null;
          if (typeof pos === 'number') {
            const currentNode = editor.state.doc.nodeAt(pos);
            if (currentNode) {
              renderReactComponent(currentNode.attrs as OEmbedUnfurlAttrs);
            }
          }
        },

        deselectNode: () => {
          wrapper.classList.remove('ProseMirror-selectednode');
          const pos = typeof getPos === 'function' ? getPos() : null;
          if (typeof pos === 'number') {
            const currentNode = editor.state.doc.nodeAt(pos);
            if (currentNode) {
              renderReactComponent(currentNode.attrs as OEmbedUnfurlAttrs);
            }
          }
        },

        destroy: () => {
          editor.off('selectionUpdate', handleSelection);
          if (reactRoot) {
            reactRoot.unmount();
            reactRoot = null;
          }
        },
      };
    };
  },
});

export default OEmbedUnfurl;

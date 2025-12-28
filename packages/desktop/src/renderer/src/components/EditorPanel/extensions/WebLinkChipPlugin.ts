/**
 * WebLink Chip Decoration Plugin
 *
 * ProseMirror plugin that renders web links as chips based on context.
 * Links in headings, lists, blockquotes, and multi-link paragraphs
 * are displayed as compact chips instead of inline text links.
 */

import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import type { EditorView } from '@tiptap/pm/view';
import type { EditorState } from '@tiptap/pm/state';
import type { Node as PMNode, Mark } from '@tiptap/pm/model';
import { getEffectiveDisplayMode, type LinkDisplayMode } from '../utils/linkContext';
import type { WebLinkDisplayMode } from './WebLink';
import { dispatchChipHoverEnter, dispatchChipHoverLeave } from '../useChipHoverPreview';

/**
 * Plugin key for the chip decoration plugin
 */
export const webLinkChipPluginKey = new PluginKey<DecorationSet>('webLinkChips');

/**
 * Cache for favicon URLs (domain -> base64 data URL)
 * This is populated asynchronously via IPC
 */
const faviconCache = new Map<string, string | null>();

/**
 * Cache for link metadata (url -> { title, description })
 * Populated from oEmbed data
 */
const linkMetadataCache = new Map<string, { title?: string; description?: string }>();

/**
 * Module-level reference to the current EditorView
 * Used to trigger re-renders when favicons are fetched asynchronously
 */
let currentEditorView: EditorView | null = null;

/**
 * Set of URLs currently being fetched (to prevent duplicate fetches)
 */
const pendingFetches = new Set<string>();

/**
 * Fetch oEmbed data for a URL and update the metadata cache
 */
async function fetchLinkMetadata(url: string): Promise<void> {
  // Skip if already fetching or cached
  if (pendingFetches.has(url) || linkMetadataCache.has(url)) {
    return;
  }

  pendingFetches.add(url);

  try {
    const domain = extractDomain(url);

    // Fetch oEmbed metadata and favicon in parallel
    const [oembedResult, faviconResult] = await Promise.all([
      window.electronAPI.oembed.unfurl(url),
      window.electronAPI.oembed.getFavicon(domain),
    ]);

    // Store metadata
    const metadata: { title?: string; description?: string } = {};
    if (oembedResult.success && oembedResult.data) {
      if (oembedResult.data.title) {
        metadata.title = oembedResult.data.title;
      }
    }
    linkMetadataCache.set(url, metadata);

    // Store favicon
    if (faviconResult) {
      faviconCache.set(domain, faviconResult);
    }

    // Trigger view refresh
    if (currentEditorView && !currentEditorView.isDestroyed) {
      const tr = currentEditorView.state.tr.setMeta(webLinkChipPluginKey, { refresh: true });
      currentEditorView.dispatch(tr);
    }
  } catch {
    // Cache empty result to prevent retrying
    linkMetadataCache.set(url, {});
  } finally {
    pendingFetches.delete(url);
  }
}

/**
 * Extract domain from a URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    const match = /^https?:\/\/([^/]+)/.exec(url);
    return match?.[1]?.replace(/^www\./, '') ?? url;
  }
}

/**
 * Create a chip DOM element for a link
 */
function createChipElement(href: string, _displayMode: LinkDisplayMode): HTMLElement {
  const domain = extractDomain(href);
  const cached = linkMetadataCache.get(href);
  // Use full title if available, otherwise show the full URL
  // No truncation - CSS will handle overflow with ellipsis if needed
  const displayText = cached?.title ?? href;
  const favicon = faviconCache.get(domain);

  // Trigger async fetch for oEmbed data if not cached
  if (!cached) {
    void fetchLinkMetadata(href);
  }

  // Create the chip container
  const chip = document.createElement('span');
  chip.className = 'link-chip';
  chip.setAttribute('data-url', href);
  chip.setAttribute('title', href);
  chip.setAttribute('role', 'link');
  chip.setAttribute('tabindex', '0');

  // Add favicon or default icon
  if (favicon) {
    const img = document.createElement('img');
    img.src = favicon;
    img.alt = '';
    img.className = 'link-chip-favicon';
    img.setAttribute('aria-hidden', 'true');
    chip.appendChild(img);
  } else {
    // Default link icon SVG
    const icon = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    icon.setAttribute('class', 'link-chip-icon');
    icon.setAttribute('viewBox', '0 0 24 24');
    icon.setAttribute('fill', 'none');
    icon.setAttribute('stroke', 'currentColor');
    icon.setAttribute('stroke-width', '2');
    icon.setAttribute('stroke-linecap', 'round');
    icon.setAttribute('stroke-linejoin', 'round');

    const path1 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path1.setAttribute('d', 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71');
    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path2.setAttribute('d', 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71');

    icon.appendChild(path1);
    icon.appendChild(path2);
    chip.appendChild(icon);

    // TODO: Favicon fetch is disabled because Electron blocks renderer fetch to external URLs.
    // In the future, we should route favicon fetching through IPC to the main process.
    // For now, just show the default link icon.
    // if (!faviconCache.has(domain)) {
    //   faviconCache.set(domain, null);
    //   void fetchFavicon(domain);
    // }
  }

  // Add title text
  const titleSpan = document.createElement('span');
  titleSpan.className = 'link-chip-title';
  titleSpan.textContent = displayText;
  chip.appendChild(titleSpan);

  // Handle click - open link in browser
  chip.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void window.electronAPI.shell.openExternal(href);
  });

  // Handle keyboard navigation
  chip.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      void window.electronAPI.shell.openExternal(href);
    }
  });

  // Handle hover - show preview card
  chip.addEventListener('mouseenter', () => {
    dispatchChipHoverEnter(href, chip);
  });

  chip.addEventListener('mouseleave', () => {
    dispatchChipHoverLeave(href, chip);
  });

  return chip;
}

// NOTE: fetchFavicon via direct fetch is disabled because Electron blocks renderer
// fetch to external URLs (net::ERR_FAILED). Favicons are now fetched via the oEmbed
// service which runs in the main process.

/**
 * Find all links that should be displayed as chips and create decorations
 */
function findChipDecorations(state: EditorState): DecorationSet {
  const decorations: Decoration[] = [];

  state.doc.descendants((node: PMNode, pos: number) => {
    // Only process text nodes with marks
    if (!node.isText) {
      return true;
    }

    // Find link marks on this node
    const linkMark = node.marks.find((mark: Mark) => mark.type.name === 'link');
    if (!linkMark) {
      return true;
    }

    // Get the href and displayMode from the mark
    const href = linkMark.attrs['href'] as string;
    const userPreference =
      (linkMark.attrs['displayMode'] as WebLinkDisplayMode | undefined) ?? 'auto';

    // Determine effective display mode based on context
    const effectiveMode = getEffectiveDisplayMode(state, pos, userPreference);

    // Only create chip decoration if mode is 'chip'
    if (effectiveMode === 'chip') {
      const nodeEnd = pos + node.nodeSize;

      // Add inline decoration to hide the original link text
      decorations.push(
        Decoration.inline(pos, nodeEnd, {
          class: 'web-link-hidden',
        })
      );

      // Add widget decoration to render the chip after the hidden text
      decorations.push(
        Decoration.widget(
          nodeEnd,
          () => createChipElement(href, effectiveMode),
          { side: 1 } // Place after the position
        )
      );
    }

    return true;
  });

  return DecorationSet.create(state.doc, decorations);
}

/**
 * Create the WebLink chip decoration plugin
 */
export function createWebLinkChipPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: webLinkChipPluginKey,

    state: {
      init(_, state) {
        return findChipDecorations(state);
      },
      apply(tr, oldDecorationSet, _oldState, newState) {
        // Check if this is a refresh request
        const meta = tr.getMeta(webLinkChipPluginKey) as { refresh?: boolean } | undefined;
        if (meta?.refresh) {
          return findChipDecorations(newState);
        }

        // If document changed, recalculate decorations
        if (tr.docChanged) {
          return findChipDecorations(newState);
        }

        // Map existing decorations through the transaction
        return oldDecorationSet.map(tr.mapping, tr.doc);
      },
    },

    props: {
      decorations(state) {
        return this.getState(state);
      },
    },

    view(editorView) {
      // Store reference to view for async favicon updates
      currentEditorView = editorView;
      return {
        update(view) {
          // Update the module-level view reference
          currentEditorView = view;
        },
        destroy() {
          // Clear the view reference on destroy
          currentEditorView = null;
        },
      };
    },
  });
}

/**
 * Clear all caches (useful for testing or when data becomes stale)
 */
export function clearWebLinkChipCaches(): void {
  faviconCache.clear();
  linkMetadataCache.clear();
}

/**
 * Update link metadata cache (called when oEmbed data is fetched)
 */
export function updateLinkMetadata(
  url: string,
  metadata: { title?: string; description?: string }
): void {
  linkMetadataCache.set(url, metadata);
}

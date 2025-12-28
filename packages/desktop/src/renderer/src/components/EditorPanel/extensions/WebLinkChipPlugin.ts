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
import { getCurrentLinkDisplayPreference } from '../../../contexts/LinkDisplayPreferenceContext';
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
 * Cache for link metadata (url -> { title, description, hasOEmbed })
 * Populated from oEmbed data.
 * hasOEmbed indicates whether the URL supports oEmbed (has title or was successfully scraped)
 */
const linkMetadataCache = new Map<
  string,
  { title?: string; description?: string; hasOEmbed: boolean }
>();

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
  // Skip if in secure mode (no network requests allowed)
  if (getCurrentLinkDisplayPreference() === 'secure') {
    return;
  }

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

    // Store metadata - hasOEmbed is true if we got a title
    // Note: description is not a standard oEmbed field, but we added it to our types
    const data = oembedResult.data;
    const hasOEmbed = oembedResult.success && data?.title !== undefined;

    const metadata: { title?: string; description?: string; hasOEmbed: boolean } = {
      hasOEmbed,
    };

    if (oembedResult.success && data) {
      if (data.title) {
        metadata.title = data.title;
      }
      // Use provider_name as a fallback for description if available
      if (data.provider_name) {
        metadata.description = data.provider_name;
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
    // Cache result indicating no oEmbed support
    linkMetadataCache.set(url, { hasOEmbed: false });
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
 * Create a copy button SVG element for chips
 */
function createCopyButton(href: string): HTMLElement {
  const button = document.createElement('button');
  button.className = 'link-chip-copy';
  button.setAttribute('aria-label', 'Copy URL');
  button.setAttribute('title', 'Copy URL');
  button.setAttribute('type', 'button');

  // Copy icon SVG (content_copy icon)
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  const rect1 = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
  rect1.setAttribute('x', '9');
  rect1.setAttribute('y', '9');
  rect1.setAttribute('width', '13');
  rect1.setAttribute('height', '13');
  rect1.setAttribute('rx', '2');
  rect1.setAttribute('ry', '2');

  const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  path.setAttribute('d', 'M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1');

  svg.appendChild(rect1);
  svg.appendChild(path);
  button.appendChild(svg);

  // Handle click - copy URL
  button.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
    void window.electronAPI.clipboard.writeText(href);

    // Show feedback by changing button color temporarily
    button.classList.add('link-chip-copy--copied');
    setTimeout(() => {
      button.classList.remove('link-chip-copy--copied');
    }, 1500);
  });

  return button;
}

/**
 * Create a chip DOM element for a link
 * @param href - The URL of the link
 * @param _displayMode - The display mode (unused but kept for API compatibility)
 * @param linkFrom - The start position of the link in the document
 * @param linkTo - The end position of the link in the document
 */
function createChipElement(
  href: string,
  _displayMode: LinkDisplayMode,
  linkFrom: number,
  linkTo: number
): HTMLElement {
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
  chip.setAttribute('data-link-from', String(linkFrom));
  chip.setAttribute('data-link-to', String(linkTo));
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
  }

  // Add title text
  const titleSpan = document.createElement('span');
  titleSpan.className = 'link-chip-title';
  titleSpan.textContent = displayText;
  chip.appendChild(titleSpan);

  // Add copy button (visible on hover via CSS)
  const copyButton = createCopyButton(href);
  chip.appendChild(copyButton);

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
 * Check if a URL has oEmbed metadata available.
 * Returns true if we know the URL supports oEmbed, false if we know it doesn't,
 * or undefined if we haven't fetched yet (triggering a fetch).
 */
function checkOEmbedAvailable(url: string): boolean | undefined {
  const cached = linkMetadataCache.get(url);
  if (cached !== undefined) {
    return cached.hasOEmbed;
  }
  // Trigger fetch and return undefined (will check again after fetch completes)
  void fetchLinkMetadata(url);
  return undefined;
}

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

    // Handle chip mode
    if (effectiveMode === 'chip') {
      // Trigger oEmbed fetch if not cached (for title/favicon)
      // But show chip immediately regardless of oEmbed status
      checkOEmbedAvailable(href);

      const nodeEnd = pos + node.nodeSize;

      // Add inline decoration to hide the original link text
      decorations.push(
        Decoration.inline(pos, nodeEnd, {
          class: 'web-link-hidden',
        })
      );

      // Add widget decoration to render the chip after the hidden text
      // Pass pos and nodeEnd so the chip knows which specific link it represents
      const chipFrom = pos;
      const chipTo = nodeEnd;
      decorations.push(
        Decoration.widget(
          nodeEnd,
          () => createChipElement(href, effectiveMode, chipFrom, chipTo),
          { side: 1 } // Place after the position
        )
      );
    }

    // Handle unfurl mode - hide the link text (the unfurl block is rendered separately)
    if (effectiveMode === 'unfurl') {
      const nodeEnd = pos + node.nodeSize;

      // Add inline decoration to hide the original link text
      decorations.push(
        Decoration.inline(pos, nodeEnd, {
          class: 'web-link-hidden',
        })
      );
      // No widget - the OEmbedUnfurl node handles the visual representation
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
  metadata: { title?: string; description?: string; hasOEmbed?: boolean }
): void {
  const entry: { title?: string; description?: string; hasOEmbed: boolean } = {
    hasOEmbed: metadata.hasOEmbed ?? metadata.title !== undefined,
  };
  if (metadata.title !== undefined) {
    entry.title = metadata.title;
  }
  if (metadata.description !== undefined) {
    entry.description = metadata.description;
  }
  linkMetadataCache.set(url, entry);
}

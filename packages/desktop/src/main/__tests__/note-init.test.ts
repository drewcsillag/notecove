/**
 * Tests for note-init module
 *
 * Tests the welcome note initialization, especially secure mode
 * for paranoid profiles.
 */

import * as Y from 'yjs';
import { populateWelcomeContent } from '../note-init';

// Mock the app module for getResourcePath
jest.mock('electron', () => ({
  app: {
    getAppPath: () => '/Users/drew/devel/notecove/packages/desktop',
    isPackaged: false,
  },
}));

describe('note-init', () => {
  describe('populateWelcomeContent', () => {
    /**
     * Helper to extract all node types from a Y.XmlFragment
     */
    function extractNodeTypes(fragment: Y.XmlFragment): string[] {
      const types: string[] = [];

      function traverse(node: Y.XmlFragment | Y.XmlElement | Y.XmlText): void {
        if (node instanceof Y.XmlElement) {
          types.push(node.nodeName);
          // Traverse children
          for (let i = 0; i < node.length; i++) {
            const child = node.get(i);
            if (child instanceof Y.XmlElement || child instanceof Y.XmlText) {
              traverse(child);
            }
          }
        } else if (node instanceof Y.XmlFragment) {
          // Traverse fragment children
          for (let i = 0; i < node.length; i++) {
            const child = node.get(i);
            if (child instanceof Y.XmlElement || child instanceof Y.XmlText) {
              traverse(child);
            }
          }
        }
      }

      traverse(fragment);
      return types;
    }

    /**
     * Helper to check if any links have displayMode set
     */
    function hasLinksWithDisplayMode(fragment: Y.XmlFragment): boolean {
      let hasDisplayMode = false;

      function traverse(node: Y.XmlFragment | Y.XmlElement | Y.XmlText): void {
        if (node instanceof Y.XmlElement) {
          // Check for link marks on text nodes
          const attrs = node.getAttributes();
          if (attrs['displayMode'] === 'chip' || attrs['displayMode'] === 'unfurl') {
            hasDisplayMode = true;
          }

          // Traverse children
          for (let i = 0; i < node.length; i++) {
            const child = node.get(i);
            if (child instanceof Y.XmlElement) {
              traverse(child);
            } else if (child instanceof Y.XmlText) {
              // Check marks on text
              const delta = child.toDelta();
              for (const op of delta) {
                if (
                  op.attributes?.link?.displayMode === 'chip' ||
                  op.attributes?.link?.displayMode === 'unfurl'
                ) {
                  hasDisplayMode = true;
                }
              }
            }
          }
        } else if (node instanceof Y.XmlFragment) {
          for (let i = 0; i < node.length; i++) {
            const child = node.get(i);
            if (child instanceof Y.XmlElement || child instanceof Y.XmlText) {
              traverse(child);
            }
          }
        }
      }

      traverse(fragment);
      return hasDisplayMode;
    }

    it('should load welcome content in normal mode with display modes preserved', async () => {
      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');

      await populateWelcomeContent(fragment, false);

      // Should have content
      expect(fragment.length).toBeGreaterThan(0);

      // Should have chip/unfurl display modes (the welcome.md has them)
      // Note: The welcome.md has {.chip} and {.unfurl} links
      const hasDisplayModes = hasLinksWithDisplayMode(fragment);
      expect(hasDisplayModes).toBe(true);
    });

    it('should load welcome content in secure mode without chip/unfurl display modes', async () => {
      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');

      await populateWelcomeContent(fragment, true);

      // Should have content
      expect(fragment.length).toBeGreaterThan(0);

      // Should NOT have chip/unfurl display modes (secure mode strips them)
      const hasDisplayModes = hasLinksWithDisplayMode(fragment);
      expect(hasDisplayModes).toBe(false);
    });

    it('should not create oembedUnfurl block nodes in secure mode', async () => {
      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');

      await populateWelcomeContent(fragment, true);

      // Should have content
      expect(fragment.length).toBeGreaterThan(0);

      // Should NOT have oembedUnfurl nodes (secure mode prevents them)
      const nodeTypes = extractNodeTypes(fragment);
      expect(nodeTypes).not.toContain('oembedUnfurl');
    });

    it('should create oembedUnfurl block nodes in normal mode', async () => {
      const doc = new Y.Doc();
      const fragment = doc.getXmlFragment('content');

      await populateWelcomeContent(fragment, false);

      // Should have content
      expect(fragment.length).toBeGreaterThan(0);

      // Should have oembedUnfurl nodes (normal mode preserves them)
      // The welcome.md has a {.unfurl} link that creates this node
      const nodeTypes = extractNodeTypes(fragment);
      expect(nodeTypes).toContain('oembedUnfurl');
    });
  });
});

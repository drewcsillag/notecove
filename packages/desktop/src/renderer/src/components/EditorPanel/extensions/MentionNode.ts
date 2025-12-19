/**
 * MentionNode TipTap Extension
 *
 * An atomic inline node for user mentions. Cannot place cursor inside.
 * Stores profileId, handle, and displayName as attributes.
 * Text content includes both handle and name for searchability.
 * Renders as a chip showing only the display name.
 */

import { Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface MentionNodeAttributes {
  profileId: string;
  handle: string;
  displayName: string;
}

export interface MentionNodeOptions {
  HTMLAttributes: Record<string, unknown>;
  renderLabel: (attrs: MentionNodeAttributes) => string;
  /** Callback when a mention is clicked */
  onMentionClick?: (attrs: MentionNodeAttributes, element: HTMLElement) => void;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    mentionNode: {
      /**
       * Insert a mention node
       */
      insertMention: (attrs: MentionNodeAttributes) => ReturnType;
    };
  }
}

export const MentionNode = Node.create<MentionNodeOptions>({
  name: 'mentionNode',

  // Inline node that sits within text
  group: 'inline',
  inline: true,

  // Atomic: treated as a single unit, can't place cursor inside
  atom: true,

  // Selectable and draggable
  selectable: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'mention-chip',
      },
      renderLabel: (attrs: MentionNodeAttributes) => attrs.displayName,
    };
  },

  addAttributes() {
    return {
      profileId: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-profile-id'),
        renderHTML: (attributes) => ({
          'data-profile-id': attributes['profileId'] as string,
        }),
      },
      handle: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-handle'),
        renderHTML: (attributes) => ({
          'data-handle': attributes['handle'] as string,
        }),
      },
      displayName: {
        default: '',
        parseHTML: (element) => element.getAttribute('data-display-name'),
        renderHTML: (attributes) => ({
          'data-display-name': attributes['displayName'] as string,
        }),
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-mention-node]',
      },
    ];
  },

  renderHTML({ HTMLAttributes, node }) {
    // The text content includes both handle and display name for searchability
    // But only the display name is visible (handle is hidden via CSS)
    const handle = node.attrs['handle'] as string;
    const displayName = node.attrs['displayName'] as string;

    return [
      'span',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-mention-node': '',
      }),
      // Hidden handle for search
      ['span', { class: 'mention-handle-hidden' }, `${handle} `],
      // Visible display name
      ['span', { class: 'mention-display-name' }, displayName],
    ];
  },

  renderText({ node }) {
    // For clipboard/plaintext: include both handle and name
    return `${node.attrs['handle'] as string} ${node.attrs['displayName'] as string}`;
  },

  addCommands() {
    return {
      insertMention:
        (attrs) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs,
            })
            .insertContent(' ')
            .run();
        },
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;

    return [
      new Plugin({
        key: new PluginKey('mentionNodeClick'),
        props: {
          handleClick(_view, _pos, event) {
            // Check if click is on a mention node
            const target = event.target as HTMLElement;
            const mentionEl = target.closest('[data-mention-node]') as HTMLElement | null;

            if (mentionEl && options.onMentionClick) {
              const profileId = mentionEl.getAttribute('data-profile-id') || '';
              const handle = mentionEl.getAttribute('data-handle') || '';
              const displayName = mentionEl.getAttribute('data-display-name') || '';

              options.onMentionClick(
                { profileId, handle, displayName },
                mentionEl
              );
              return true;
            }
            return false;
          },
        },
      }),
    ];
  },
});

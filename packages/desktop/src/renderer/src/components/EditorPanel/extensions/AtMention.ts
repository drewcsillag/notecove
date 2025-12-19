/**
 * AtMention TipTap Extension
 *
 * Provides @-mention autocomplete for:
 * - Date keywords: @today, @yesterday, @tomorrow, @date
 * - User mentions: @username (from profile presence)
 *
 * Uses TipTap's suggestion API for autocomplete functionality.
 */

import { Extension } from '@tiptap/react';
import { PluginKey } from '@tiptap/pm/state';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import { AtSuggestionList, type AtSuggestionListRef } from '../AtSuggestionList';
import type { SuggestionOptions } from '@tiptap/suggestion';
import tippy from 'tippy.js';
import type { Instance as TippyInstance } from 'tippy.js';
import { format, subDays, addDays } from 'date-fns';

/**
 * Item types for the suggestion list
 */
export type AtSuggestionItemType = 'date' | 'user' | 'hint';

export interface DateKeywordItem {
  id: string;
  type: 'date';
  label: string;
  description: string;
}

export interface UserItem {
  id: string;
  type: 'user';
  profileId: string;
  handle: string;
  displayName: string;
}

export interface HintItem {
  id: string;
  type: 'hint';
  message: string;
}

export type AtSuggestionItem = DateKeywordItem | UserItem | HintItem;

/**
 * Date keywords available for autocomplete
 */
const DATE_KEYWORDS: DateKeywordItem[] = [
  { id: 'today', type: 'date', label: 'Today', description: "Insert today's date" },
  { id: 'yesterday', type: 'date', label: 'Yesterday', description: "Insert yesterday's date" },
  { id: 'tomorrow', type: 'date', label: 'Tomorrow', description: "Insert tomorrow's date" },
  { id: 'date', type: 'date', label: 'Date...', description: 'Pick a date from calendar' },
];

/**
 * Get date keywords filtered by query
 */
export function getDateKeywords(query: string): DateKeywordItem[] {
  const q = query.toLowerCase();
  return DATE_KEYWORDS.filter((k) => k.id.toLowerCase().startsWith(q));
}

/**
 * Resolve a date keyword to a formatted date string
 * Returns null for 'date' keyword (requires picker) or unknown keywords
 */
export function resolveDateKeyword(keyword: string): string | null {
  const today = new Date();

  switch (keyword.toLowerCase()) {
    case 'today':
      return format(today, 'yyyy-MM-dd');
    case 'yesterday':
      return format(subDays(today, 1), 'yyyy-MM-dd');
    case 'tomorrow':
      return format(addDays(today, 1), 'yyyy-MM-dd');
    case 'date':
      // Requires date picker - return null to signal this
      return null;
    default:
      return null;
  }
}

export interface AtMentionOptions {
  HTMLAttributes: Record<string, unknown>;
  suggestion: Omit<SuggestionOptions, 'editor'>;
}

export const AtMention = Extension.create<AtMentionOptions>({
  name: 'atMention',

  addOptions() {
    return {
      HTMLAttributes: {},
      suggestion: {
        char: '@',
        pluginKey: new PluginKey('atMentionSuggestion'),
        command: ({ editor, range, props }) => {
          const item = props as AtSuggestionItem;

          if (item.type === 'date') {
            const dateStr = resolveDateKeyword(item.id);

            if (dateStr) {
              // Insert the resolved date
              editor.chain().focus().deleteRange(range).insertContent(`${dateStr} `).run();
            } else if (item.id === 'date') {
              // Date picker will be implemented in Phase 3
              // For now, insert today's date as a placeholder
              const today = format(new Date(), 'yyyy-MM-dd');
              editor.chain().focus().deleteRange(range).insertContent(`${today} `).run();
              console.log('[AtMention] Date picker will be implemented in Phase 3');
            }
          } else if (item.type === 'user') {
            // Insert mention node
            editor
              .chain()
              .focus()
              .deleteRange(range)
              .insertMention({
                profileId: item.profileId,
                handle: item.handle,
                displayName: item.displayName,
              })
              .run();
          }
        },
        items: async ({ query }): Promise<AtSuggestionItem[]> => {
          const items: AtSuggestionItem[] = [];

          // Add filtered date keywords
          const dateKeywords = getDateKeywords(query);
          items.push(...dateKeywords);

          // Fetch users from profile presence
          try {
            const users = await window.electronAPI.mention.getUsers();
            const q = query.toLowerCase();

            // Filter users by query (handle or display name) and exclude those without handles
            const filteredUsers = users
              .filter((user) => {
                // Exclude users without handles
                if (!user.handle || user.handle.trim() === '') {
                  return false;
                }
                // If no query, include all users with handles
                if (!q) {
                  return true;
                }
                // Filter by handle (without @) or name
                const handleWithoutAt = user.handle.replace(/^@/, '').toLowerCase();
                const nameLower = user.name.toLowerCase();
                return handleWithoutAt.includes(q) || nameLower.includes(q);
              })
              .slice(0, 5); // Limit to 5 users

            // Convert to UserItem format
            for (const user of filteredUsers) {
              items.push({
                id: `user-${user.profileId}`,
                type: 'user',
                profileId: user.profileId,
                handle: user.handle,
                displayName: user.name,
              });
            }

            // Check if current user is missing from results (no handle set)
            // We need to check if any user in the original list has no handle
            // and add a hint for the current user
            const currentUserMissingHandle = users.some(
              (u) => !u.handle || u.handle.trim() === ''
            );
            if (currentUserMissingHandle && items.filter((i) => i.type === 'user').length === 0) {
              // Only show hint if no other users are shown
              items.push({
                id: 'hint-no-handle',
                type: 'hint',
                message: 'Set your @handle in Settings to be mentionable',
              });
            }
          } catch (error) {
            console.error('[AtMention] Failed to fetch users:', error);
          }

          return items;
        },
        render: () => {
          let component: ReactRenderer | undefined;
          let popup: TippyInstance[] | undefined;

          return {
            onStart: (props) => {
              component = new ReactRenderer(AtSuggestionList, {
                props,
                editor: props.editor,
              });

              if (!props.clientRect) {
                return;
              }

              popup = tippy('body', {
                getReferenceClientRect: props.clientRect as () => DOMRect,
                appendTo: () => document.body,
                content: component.element,
                showOnCreate: true,
                interactive: true,
                trigger: 'manual',
                placement: 'bottom-start',
              });
            },

            onUpdate(props) {
              component?.updateProps(props);

              if (!props.clientRect) {
                return;
              }

              popup?.[0]?.setProps({
                getReferenceClientRect: props.clientRect as () => DOMRect,
              });
            },

            onKeyDown(props) {
              if (props.event.key === 'Escape') {
                popup?.[0]?.hide();
                return true;
              }

              return (
                (component?.ref as AtSuggestionListRef | undefined)?.onKeyDown(props) ?? false
              );
            },

            onExit() {
              popup?.[0]?.destroy();
              component?.destroy();
            },
          };
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      // Suggestion plugin for autocomplete
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

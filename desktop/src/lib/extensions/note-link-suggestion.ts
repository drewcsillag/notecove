import { Suggestion, SuggestionOptions, SuggestionProps } from '@tiptap/suggestion';
import tippy, { Instance as TippyInstance, Props as TippyProps } from 'tippy.js';
import { PluginKey } from '@tiptap/pm/state';

export interface NoteSuggestion {
  id: string;
  title: string;
}

export interface NoteLinkSuggestionOptions {
  /**
   * Function to search for notes matching the query
   * @param query - The search string (text after [[)
   * @returns Array of matching notes
   */
  searchNotes: (query: string) => NoteSuggestion[];

  /**
   * Callback when a note is selected from the dropdown
   * @param note - The selected note
   */
  onSelect?: (note: NoteSuggestion) => void;
}

export const NoteLinkSuggestionPluginKey = new PluginKey('noteLinkSuggestion');

/**
 * Create suggestion configuration for note link autocomplete
 */
export function createNoteLinkSuggestion(
  options: NoteLinkSuggestionOptions
): Omit<SuggestionOptions, 'editor'> {
  return {
    pluginKey: NoteLinkSuggestionPluginKey,

    // Match [[ followed by any text
    char: '[[',

    // Allow spaces in note titles
    allowSpaces: true,

    // Start showing suggestions immediately after [[
    startOfLine: false,

    // Search for matching notes
    items: ({ query }: { query: string }) => {
      return options.searchNotes(query);
    },

    // Render the dropdown UI
    render: () => {
      let component: SuggestionDropdown;
      let popup: TippyInstance[];

      return {
        onStart: (props: SuggestionProps) => {
          component = new SuggestionDropdown({
            items: props.items,
            command: props.command,
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
            theme: 'note-link-suggestion',
            maxWidth: 400,
          });
        },

        onUpdate(props: SuggestionProps) {
          component.updateProps({
            items: props.items,
            command: props.command,
          });

          if (!props.clientRect) {
            return;
          }

          popup[0]?.setProps({
            getReferenceClientRect: props.clientRect as () => DOMRect,
          });
        },

        onKeyDown(props: { event: KeyboardEvent }) {
          if (props.event.key === 'Escape') {
            popup[0]?.hide();
            return true;
          }

          return component.onKeyDown(props.event);
        },

        onExit() {
          popup[0]?.destroy();
          component.destroy();
        },
      };
    },

    // When item is selected, insert note link
    command: ({ editor, range, props }) => {
      const note = props as NoteSuggestion;

      // Replace [[query with the note title and apply noteLink mark
      // We need to get the current selection position after deleting the range
      const from = range.from;

      editor
        .chain()
        .focus()
        .deleteRange(range)
        .insertContentAt(from, note.title, {
          updateSelection: false,
        })
        .setTextSelection({ from, to: from + note.title.length })
        .setMark('noteLink', {
          title: note.title,
          noteId: note.id,
        })
        .setTextSelection(from + note.title.length)
        .run();

      // Call optional callback
      if (options.onSelect) {
        options.onSelect(note);
      }
    },
  };
}

/**
 * Dropdown component for note suggestions
 */
class SuggestionDropdown {
  public element: HTMLElement;
  private items: NoteSuggestion[];
  private command: (props: any) => void;
  private selectedIndex: number = 0;

  constructor(props: { items: NoteSuggestion[]; command: (props: any) => void }) {
    this.items = props.items;
    this.command = props.command;
    this.element = this.createElement();
    this.render();
  }

  private createElement(): HTMLElement {
    const el = document.createElement('div');
    el.className = 'note-link-suggestions';
    return el;
  }

  updateProps(props: { items: NoteSuggestion[]; command: (props: any) => void }) {
    this.items = props.items;
    this.command = props.command;
    this.selectedIndex = 0;
    this.render();
  }

  private render() {
    if (this.items.length === 0) {
      this.element.innerHTML = `
        <div class="note-link-suggestion-item note-link-suggestion-empty">
          No notes found
        </div>
      `;
      return;
    }

    this.element.innerHTML = this.items
      .map((item, index) => {
        const isSelected = index === this.selectedIndex;
        return `
          <div
            class="note-link-suggestion-item ${isSelected ? 'is-selected' : ''}"
            data-index="${index}"
          >
            <span class="note-link-suggestion-title">${this.escapeHtml(item.title)}</span>
          </div>
        `;
      })
      .join('');

    // Add click handlers
    this.element.querySelectorAll('.note-link-suggestion-item').forEach((el, index) => {
      el.addEventListener('click', () => {
        this.selectItem(index);
      });
    });
  }

  onKeyDown(event: KeyboardEvent): boolean {
    if (event.key === 'ArrowUp') {
      this.selectPrevious();
      return true;
    }

    if (event.key === 'ArrowDown') {
      this.selectNext();
      return true;
    }

    if (event.key === 'Enter' || event.key === 'Tab') {
      this.selectItem(this.selectedIndex);
      return true;
    }

    return false;
  }

  private selectNext() {
    this.selectedIndex = (this.selectedIndex + 1) % this.items.length;
    this.render();
  }

  private selectPrevious() {
    this.selectedIndex = (this.selectedIndex - 1 + this.items.length) % this.items.length;
    this.render();
  }

  private selectItem(index: number) {
    const item = this.items[index];
    if (item) {
      this.command(item);
    }
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  destroy() {
    this.element.remove();
  }
}

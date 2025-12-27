/**
 * Editor Extensions Configuration
 *
 * Configures all TipTap extensions for the editor.
 * Extracted from TipTapEditor.tsx for maintainability.
 */

import StarterKit from '@tiptap/starter-kit';
import { BulletList, OrderedList } from '@tiptap/extension-list';
import Collaboration from '@tiptap/extension-collaboration';
import SearchAndReplace from '@sereneinserenade/tiptap-search-and-replace';
import * as Y from 'yjs';
import { Hashtag } from './extensions/Hashtag';
import { AtMention } from './extensions/AtMention';
import { MentionNode, type MentionNodeAttributes } from './extensions/MentionNode';
import { DateChip } from './extensions/DateChip';
import { InterNoteLink } from './extensions/InterNoteLink';
import { TriStateTaskItem } from './extensions/TriStateTaskItem';
import { WebLink } from './extensions/WebLink';
import { CommentMark } from './extensions/CommentMark';
import { NotecoveImage } from './extensions/Image';
import {
  NotecoveTable,
  NotecoveTableRow,
  NotecoveTableHeader,
  NotecoveTableCell,
} from './extensions/Table';
import { TabIndent } from './extensions/TabIndent';
import { NotecoveListItem } from './extensions/NotecoveListItem';
import { MoveBlock } from './extensions/MoveBlock';
import { NotecoveCodeBlock } from './extensions/CodeBlockLowlight';

/**
 * Callbacks interface for extension events.
 * These are passed from the component to configure extension behavior.
 */
export interface EditorExtensionCallbacks {
  /** Called when a mention chip is clicked */
  onMentionClick: (attrs: MentionNodeAttributes, element: HTMLElement) => void;
  /** Called when a date chip is clicked */
  onDateClick: (date: string, from: number, to: number) => void;
  /** Called when an inter-note link is clicked */
  onLinkClick: (noteId: string) => void;
  /** Called when an inter-note link is double-clicked */
  onLinkDoubleClick: (noteId: string) => void;
  /** Called when a comment highlight is clicked */
  onCommentClick: (threadId: string) => void;
}

/**
 * Creates the extensions array for the TipTap editor.
 *
 * @param yDoc - The Yjs document for collaboration
 * @param callbacks - Event callbacks for extension interactions
 * @returns Array of configured TipTap extensions
 */
export function getEditorExtensions(yDoc: Y.Doc, callbacks: EditorExtensionCallbacks) {
  return [
    // Use StarterKit but exclude UndoRedo and built-in lists
    // (we'll add custom list extensions that support taskItem)
    StarterKit.configure({
      undoRedo: false, // Collaboration extension handles undo/redo
      bulletList: false, // Use custom version that accepts taskItem
      orderedList: false, // Use custom version that accepts taskItem
      listItem: false, // Use NotecoveListItem with cursor-position-aware Tab
      codeBlock: false, // Use NotecoveCodeBlock with syntax highlighting
      link: false, // Use custom WebLink extension
    }),
    // Add syntax-highlighted code blocks
    NotecoveCodeBlock,
    // Custom BulletList that accepts both listItem and taskItem
    BulletList.extend({
      content: '(listItem | taskItem)+',
    }),
    // Custom OrderedList that accepts both listItem and taskItem
    OrderedList.extend({
      content: '(listItem | taskItem)+',
    }),
    // Custom ListItem with cursor-position-aware Tab/Shift-Tab
    NotecoveListItem,
    // Note: Underline is now included in StarterKit v3
    // Add tri-state task item extension (list-based checkboxes)
    TriStateTaskItem.configure({
      nested: true, // Allow nesting for sub-tasks
    }),
    // Add Hashtag extension for #tag support
    Hashtag,
    // Add AtMention extension for @date and @mention support
    AtMention,
    // Add MentionNode for inline user mention chips
    MentionNode.configure({
      onMentionClick: callbacks.onMentionClick,
    }),
    // Add DateChip extension for YYYY-MM-DD date styling
    DateChip.configure({
      onDateClick: callbacks.onDateClick,
    }),
    // Add InterNoteLink extension for [[note-id]] support
    InterNoteLink.configure({
      onLinkClick: callbacks.onLinkClick,
      onLinkDoubleClick: callbacks.onLinkDoubleClick,
    }),
    // Add SearchAndReplace extension for in-note search
    SearchAndReplace,
    // Add WebLink extension for http/https links
    WebLink,
    // Add CommentMark extension for highlighting commented text
    CommentMark.configure({
      onCommentClick: callbacks.onCommentClick,
    }),
    // Add NotecoveImage extension for image display
    NotecoveImage,
    // Add Table extensions for table support
    NotecoveTable,
    NotecoveTableRow,
    NotecoveTableHeader,
    NotecoveTableCell,
    // Add MoveBlock extension for Alt-Up/Alt-Down to move blocks
    MoveBlock,
    // Collaboration extension binds TipTap to Yjs
    // Use 'content' fragment to match NoteDoc structure
    Collaboration.configure({
      document: yDoc,
      fragment: yDoc.getXmlFragment('content'),
    }),
    // TabIndent handles Tab key for inserting tab characters
    // Must be last so other extensions (Table, ListItem, TaskItem) can handle Tab first
    TabIndent,
  ];
}

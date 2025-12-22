/**
 * TipTap Editor Component
 *
 * Rich text editor using TipTap with Yjs collaboration support.
 * Syncs with main process CRDT via IPC.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import BulletList from '@tiptap/extension-bullet-list';
import OrderedList from '@tiptap/extension-ordered-list';
import Collaboration from '@tiptap/extension-collaboration';
import Underline from '@tiptap/extension-underline';
import SearchAndReplace from '@sereneinserenade/tiptap-search-and-replace';
import {
  Box,
  useTheme,
  Chip,
  Fade,
  CircularProgress,
  Menu,
  MenuItem,
  Divider,
  Typography,
  Popper,
  Paper,
  List,
  ListItemButton,
  ListItemText,
  ClickAwayListener,
} from '@mui/material';
import SyncIcon from '@mui/icons-material/Sync';
import * as Y from 'yjs';
import { yUndoPluginKey } from 'y-prosemirror';
import { EditorToolbar } from './EditorToolbar';
import { Hashtag } from './extensions/Hashtag';
import { AtMention } from './extensions/AtMention';
import { MentionNode, type MentionNodeAttributes } from './extensions/MentionNode';
import { DateChip } from './extensions/DateChip';
import { DatePickerDialog } from './DatePickerDialog';
import { MentionPopover } from './MentionPopover';
import { InterNoteLink, clearNoteTitleCache } from './extensions/InterNoteLink';
import { TriStateTaskItem } from './extensions/TriStateTaskItem';
import { WebLink, setWebLinkCallbacks } from './extensions/WebLink';
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
import { getCodeBlockStyles } from './codeBlockTheme';
import { ImageLightbox } from './ImageLightbox';
import { ImageContextMenu } from './ImageContextMenu';
import { TableSizePickerDialog } from './TableSizePickerDialog';
import { SearchPanel } from './SearchPanel';
import { LinkPopover } from './LinkPopover';
import { LinkInputPopover } from './LinkInputPopover';
import { TextAndUrlInputPopover } from './TextAndUrlInputPopover';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { useWindowState } from '../../hooks/useWindowState';
import { detectUrlFromSelection } from '@notecove/shared';

/**
 * Map of file extensions to MIME types for image files.
 * Used when file.type is empty (common when dropping files from Finder on macOS).
 */
const EXTENSION_TO_MIME: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  heic: 'image/heic',
  heif: 'image/heif',
};

/**
 * Get MIME type from filename extension.
 * Returns null if extension is not a supported image type.
 */
function getMimeTypeFromFilename(filename: string): string | null {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return null;
  const extension = filename.slice(lastDotIndex + 1).toLowerCase();
  return EXTENSION_TO_MIME[extension] ?? null;
}

/**
 * Check if a file is an image, using both file.type and filename extension.
 * Returns the MIME type if it's an image, or null otherwise.
 */
function getImageMimeType(file: File): string | null {
  // First try the file's MIME type
  if (file.type.startsWith('image/')) {
    return file.type;
  }
  // Fall back to inferring from extension (common when dropping from Finder)
  return getMimeTypeFromFilename(file.name);
}

/**
 * User profile for comment authorship
 */
interface UserProfile {
  profileId: string;
  username: string;
  handle: string;
}

export interface TipTapEditorProps {
  noteId: string | null;
  readOnly?: boolean;
  isNewlyCreated?: boolean;
  onNoteLoaded?: () => void;
  onTitleChange?: (noteId: string, title: string, contentText: string) => void;
  showSearchPanel?: boolean;
  onSearchPanelClose?: () => void;
  onNavigateToNote?: (noteId: string) => void;
  /** Lifted search term state for retention across panel open/close */
  searchTerm?: string;
  /** Callback to update the lifted search term state */
  onSearchTermChange?: (term: string) => void;
  /** Currently selected comment thread ID (for highlighting) */
  selectedThreadId?: string | null;
  /** Callback when a comment mark is clicked */
  onCommentClick?: (threadId: string) => void;
  /** Callback to add a comment on the current selection */
  onAddComment?: (selection: { from: number; to: number; text: string; threadId: string }) => void;
  /** Callback when "view comments" button is clicked (opens panel without thread selection) */
  onViewComments?: () => void;
}

export const TipTapEditor: React.FC<TipTapEditorProps> = ({
  noteId,
  readOnly = false,
  isNewlyCreated = false,
  onNoteLoaded,
  onTitleChange,
  showSearchPanel = false,
  onSearchPanelClose,
  onNavigateToNote,
  searchTerm = '',
  onSearchTermChange,
  selectedThreadId: _selectedThreadId, // Future: Could highlight the selected thread's mark in editor
  onCommentClick,
  onAddComment,
  onViewComments,
}) => {
  const theme = useTheme();
  const [yDoc] = useState(() => new Y.Doc());
  // Show sync indicator when external updates arrive
  const [showSyncIndicator, setShowSyncIndicator] = useState(false);
  // Track whether text is selected (for enabling comment button)
  const [hasTextSelection, setHasTextSelection] = useState(false);
  // Track open (unresolved) comment count for badge
  const [openCommentCount, setOpenCommentCount] = useState(0);
  // Current user profile for comment authorship
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const syncIndicatorTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Loading state - start with loading=true to prevent title extraction before note loads
  // Use both state (for rendering) and ref (for callbacks that need synchronous access)
  const [isLoading, setIsLoading] = useState(true);
  const isLoadingRef = useRef(true);
  const noteIdRef = useRef<string | null>(noteId);
  const titleUpdateTimerRef = useRef<NodeJS.Timeout | null>(null);
  const updateHandlerRef = useRef<((update: Uint8Array, origin: unknown) => void) | null>(null);
  // Track updates we've sent to main process so we can skip them when they bounce back
  const pendingUpdatesRef = useRef<Set<string>>(new Set());
  // Track if we should focus the editor after loading completes (for newly created notes)
  const shouldFocusAfterLoadRef = useRef(false);
  // Track if we've already scheduled/attempted focus (to prevent cancellation)
  const focusAttemptedRef = useRef(false);
  // Cache the active SD for synchronous access in transformPasted
  const activeSdIdRef = useRef<string | null>(null);
  // Link popover state (for viewing/editing existing links)
  const [linkPopoverData, setLinkPopoverData] = useState<{
    href: string;
    element: HTMLElement;
    from: number;
    to: number;
  } | null>(null);
  const linkPopoverRef = useRef<TippyInstance | null>(null);

  // Link input popover state (for creating new links with selection)
  const [linkInputPopoverData, setLinkInputPopoverData] = useState<{
    element: HTMLElement;
    selectionFrom: number;
    selectionTo: number;
    initialUrl?: string;
  } | null>(null);
  const linkInputPopoverRef = useRef<TippyInstance | null>(null);

  // Text+URL input popover state (for creating new links without selection)
  const [textAndUrlPopoverData, setTextAndUrlPopoverData] = useState<{
    element: HTMLElement;
    insertPosition: number;
  } | null>(null);
  const textAndUrlPopoverRef = useRef<TippyInstance | null>(null);

  // Table size picker state
  const [tableSizePickerAnchor, setTableSizePickerAnchor] = useState<HTMLElement | null>(null);

  // Date picker dialog state (for clicking date chips or selecting @date)
  const [datePickerState, setDatePickerState] = useState<{
    open: boolean;
    anchorEl: HTMLElement | null;
    initialDate: string | null;
    from: number;
    to: number;
  }>({
    open: false,
    anchorEl: null,
    initialDate: null,
    from: 0,
    to: 0,
  });

  // Mention popover state (for clicking mention chips)
  const [mentionPopoverState, setMentionPopoverState] = useState<{
    open: boolean;
    anchorEl: HTMLElement | null;
    attrs: MentionNodeAttributes | null;
  }>({
    open: false,
    anchorEl: null,
    attrs: null,
  });

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  // Overlapping comments popover state
  const [overlapPopover, setOverlapPopover] = useState<{
    anchorEl: HTMLElement;
    threadIds: string[];
  } | null>(null);

  // Ref to store the Cmd+K handler (updated when editor is available)
  const handleCmdKRef = useRef<((element: HTMLElement) => void) | null>(null);

  // Ref for the scrollable editor container (for scroll position tracking)
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  // Window state hook for session restoration
  const {
    windowId,
    reportCurrentNote,
    reportScrollPosition,
    reportCursorPosition,
    getSavedState,
    reportFinalState,
  } = useWindowState();

  // Track saved state for restoration after note loads
  const savedStateRef = useRef<{ scrollTop: number; cursorPosition: number } | null>(null);
  const hasRestoredStateRef = useRef(false);

  // Set up WebLink callbacks
  // This must be done before useEditor to ensure callbacks are available
  useEffect(() => {
    setWebLinkCallbacks({
      onSingleClick: (href: string, element: HTMLElement, from: number, to: number) => {
        console.log(
          '[WebLink] Single-click callback, showing popover for:',
          href,
          'at',
          from,
          '-',
          to
        );
        setLinkPopoverData({ href, element, from, to });
      },
      onCmdK: () => {
        console.log('[WebLink] Cmd+K pressed');
        // Find the ProseMirror element to anchor the popover
        const proseMirrorEl = document.querySelector<HTMLElement>('.ProseMirror');
        if (!proseMirrorEl) return;

        // Call the handler if it's set
        if (handleCmdKRef.current) {
          handleCmdKRef.current(proseMirrorEl);
        }
      },
    });
  }, []);

  // Fetch current user profile on mount for comment authorship
  useEffect(() => {
    window.electronAPI.user
      .getCurrentProfile()
      .then((profile) => {
        setUserProfile(profile);
      })
      .catch((err) => {
        console.error('[TipTapEditor] Failed to get user profile:', err);
        // Use fallback values if profile fetch fails
        setUserProfile({
          profileId: 'unknown',
          username: 'Anonymous',
          handle: '@anonymous',
        });
      });
  }, []);

  // Listen for date picker requests from AtMention extension (@date keyword)
  useEffect(() => {
    const handleShowDatePicker = (event: CustomEvent<{ from: number; to: number }>) => {
      const { from, to } = event.detail;
      console.log('[TipTapEditor] Date picker requested at', from, '-', to);

      // Find the ProseMirror element to anchor the popover
      const proseMirrorEl = document.querySelector<HTMLElement>('.ProseMirror');
      if (!proseMirrorEl) return;

      setDatePickerState({
        open: true,
        anchorEl: proseMirrorEl,
        initialDate: null, // No initial date for new date picker
        from,
        to,
      });
    };

    window.addEventListener('notecove:showDatePicker', handleShowDatePicker as EventListener);
    return () => {
      window.removeEventListener('notecove:showDatePicker', handleShowDatePicker as EventListener);
    };
  }, []);

  const editor = useEditor({
    extensions: [
      // Use StarterKit but exclude History and built-in lists
      // (we'll add custom list extensions that support taskItem)
      StarterKit.configure({
        history: false, // Collaboration extension handles undo/redo
        bulletList: false, // Use custom version that accepts taskItem
        orderedList: false, // Use custom version that accepts taskItem
        listItem: false, // Use NotecoveListItem with cursor-position-aware Tab
        codeBlock: false, // Use NotecoveCodeBlock with syntax highlighting
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
      // Add Underline extension (not in StarterKit)
      Underline,
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
        onMentionClick: (attrs: MentionNodeAttributes, element: HTMLElement) => {
          console.log('[MentionNode] Clicked mention:', attrs);
          setMentionPopoverState({
            open: true,
            anchorEl: element,
            attrs,
          });
        },
      }),
      // Add DateChip extension for YYYY-MM-DD date styling
      DateChip.configure({
        onDateClick: (date: string, from: number, to: number) => {
          console.log('[DateChip] Clicked date:', date, 'at', from, '-', to);
          // Find the date chip element that was clicked
          const dateChipEl = document.querySelector<HTMLElement>(
            `.date-chip[data-date="${date}"][data-from="${from}"]`
          );
          if (dateChipEl) {
            setDatePickerState({
              open: true,
              anchorEl: dateChipEl,
              initialDate: date,
              from,
              to,
            });
          }
        },
      }),
      // Add InterNoteLink extension for [[note-id]] support
      InterNoteLink.configure({
        onLinkClick: (linkNoteId: string) => {
          // Single click: Navigate to note in same window
          console.log('[InterNoteLink] Single click on note:', linkNoteId);
          if (onNavigateToNote) {
            onNavigateToNote(linkNoteId);
          }
        },
        onLinkDoubleClick: (linkNoteId: string) => {
          // Double click: Open note in new window (minimal layout)
          console.log('[InterNoteLink] Double click on note:', linkNoteId);
          void window.electronAPI.testing
            .createWindow({
              noteId: linkNoteId,
              minimal: true,
            })
            .then(() => {
              console.log('[InterNoteLink] New window created for note:', linkNoteId);
            })
            .catch((err) => {
              console.error('[InterNoteLink] Failed to create new window:', err);
            });
        },
      }),
      // Add SearchAndReplace extension for in-note search
      SearchAndReplace,
      // Add WebLink extension for http/https links
      WebLink,
      // Add CommentMark extension for highlighting commented text
      CommentMark.configure({
        onCommentClick: (threadId) => {
          onCommentClick?.(threadId);
        },
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
    ],
    // Don't set initial content - let Yjs/Collaboration handle it from loaded state
    // Setting content here causes onUpdate to fire before note loads
    // Disable editing while loading or if readOnly
    editable: !readOnly && !isLoading,
    editorProps: {
      attributes: {
        class: 'prose prose-sm sm:prose lg:prose-lg xl:prose-2xl mx-auto focus:outline-none',
      },
      // Handle paste from clipboard (markdown tables and images)
      handlePaste: (view, event, _slice) => {
        const clipboardData = event.clipboardData;
        if (!clipboardData) return false;

        // TODO: Add markdown table paste handling in Phase 7 (Copy/Paste)
        // For now, markdown tables can be created via the toolbar button

        const items = clipboardData.items;

        // Look for image data in clipboard
        for (const item of items) {
          if (item.type.startsWith('image/')) {
            // IMPORTANT: Capture MIME type synchronously before any async operations.
            // The clipboard DataTransferItem becomes invalid after the event handler returns,
            // so item.type would be empty if read inside an async callback.
            const mimeType = item.type;
            console.log('[TipTapEditor] Image paste detected, type:', mimeType);

            // Get the image as a blob
            const blob = item.getAsFile();
            if (!blob) {
              console.log('[TipTapEditor] Could not get blob from clipboard item');
              continue;
            }

            // Read as ArrayBuffer and save via IPC
            blob
              .arrayBuffer()
              .then(async (buffer) => {
                // Get the active SD to save the image in
                const sdId = await window.electronAPI.sd.getActive();
                if (!sdId) {
                  console.error('[TipTapEditor] No active SD, cannot save image');
                  return;
                }

                const data = new Uint8Array(buffer);

                console.log('[TipTapEditor] Saving image, size:', data.length, 'type:', mimeType);

                // Save the image via IPC (returns {imageId, filename})
                const result = await window.electronAPI.image.save(sdId, data, mimeType);
                console.log('[TipTapEditor] Image saved with ID:', result.imageId);

                // Insert the image node at current cursor position
                const { state } = view;
                const imageNode = state.schema.nodes['notecoveImage'];
                if (imageNode) {
                  const node = imageNode.create({
                    imageId: result.imageId,
                    sdId,
                  });
                  const tr = state.tr.replaceSelectionWith(node);
                  view.dispatch(tr);
                  console.log('[TipTapEditor] Image node inserted');
                }
              })
              .catch((err) => {
                console.error('[TipTapEditor] Failed to save pasted image:', err);
              });

            // Prevent default paste handling for this image
            event.preventDefault();
            return true;
          }
        }

        // Let other handlers process non-image paste
        return false;
      },
      // Note: Image drop is handled by a DOM-level event listener in a useEffect
      // below. ProseMirror's handleDrop prop doesn't get triggered by synthetic
      // events (from tests), so we use the DOM listener which works for both.

      // Custom clipboard text serializer to fix newline handling when copying
      // Default TipTap behavior adds too many newlines within lists.
      // We want:
      // - Paragraphs separated by blank lines (double newline) to preserve that spacing
      // - List items separated by single newlines (not double)
      // - List markers (-, 1., [ ], etc.) preserved
      clipboardTextSerializer: (slice) => {
        const results: string[] = [];

        // Helper to get text content from a node
        const getTextContent = (node: typeof slice.content.firstChild): string => {
          if (!node) return '';
          if (node.isText) return node.text ?? '';

          let text = '';
          node.forEach((child) => {
            text += getTextContent(child);
          });
          return text;
        };

        // Helper to process list items - returns array of item texts with markers
        const processListItems = (
          listNode: typeof slice.content.firstChild,
          listType: string
        ): string[] => {
          const items: string[] = [];
          let index = 1;
          listNode?.forEach((item) => {
            const text = getTextContent(item).trim();
            if (text) {
              // Add appropriate marker based on list type and item state
              if (listType === 'orderedList') {
                items.push(`${index}. ${text}`);
                index++;
              } else if (listType === 'taskList' || item.type.name === 'taskItem') {
                // Check task item state
                const checked = item.attrs['checked'] as string | undefined;
                const marker = checked === 'checked' ? '[x]' : checked === 'nope' ? '[-]' : '[ ]';
                items.push(`${marker} ${text}`);
              } else {
                // bulletList
                items.push(`- ${text}`);
              }
            }
          });
          return items;
        };

        // Process each top-level node
        slice.content.forEach((node) => {
          const nodeType = node.type.name;

          // Handle lists specially - join items with single newlines
          if (nodeType === 'bulletList' || nodeType === 'orderedList' || nodeType === 'taskList') {
            const items = processListItems(node, nodeType);
            if (items.length > 0) {
              results.push(items.join('\n'));
            }
          } else {
            // For paragraphs, headings, etc - get text content
            const text = getTextContent(node).trim();
            if (text) {
              results.push(text);
            }
          }
        });

        // Join top-level blocks with double newlines to preserve paragraph spacing
        return results.join('\n\n');
      },
      // Transform pasted content to handle cross-SD image copying
      // When content with images is pasted from another SD, copy the image files
      // and update the sdId attribute to point to the current SD.
      transformPasted: (slice) => {
        const targetSdId = activeSdIdRef.current;

        // If we don't have a cached target SD, just return the slice unchanged
        // The image will try to load from its original SD (may still work)
        if (!targetSdId) {
          return slice;
        }

        // Helper to recursively transform image nodes to update sdId
        // Also triggers background copy operations for cross-SD images
        const transformNode = (
          node: typeof slice.content.firstChild
        ): typeof slice.content.firstChild => {
          if (!node) return node;

          if (node.type.name === 'notecoveImage') {
            const sourceSdId = node.attrs['sdId'] as string | undefined;
            const imageId = node.attrs['imageId'] as string | undefined;

            if (sourceSdId && imageId && sourceSdId !== targetSdId) {
              // Trigger async copy in background
              console.log(
                `[TipTapEditor] Cross-SD paste: copying image ${imageId} from ${sourceSdId} to ${targetSdId}`
              );
              window.electronAPI.image
                .copyToSD(sourceSdId, targetSdId, imageId)
                .then((result) => {
                  if (result.success) {
                    console.log(
                      `[TipTapEditor] Image ${imageId} copied successfully`,
                      result.alreadyExists ? '(already existed)' : ''
                    );
                  } else {
                    console.error(`[TipTapEditor] Failed to copy image ${imageId}:`, result.error);
                  }
                })
                .catch((err) => {
                  console.error(`[TipTapEditor] Error copying image ${imageId}:`, err);
                });

              // Create new node with updated sdId
              return node.type.create(
                { ...node.attrs, sdId: targetSdId },
                node.content,
                node.marks
              );
            }
          }

          // For other nodes, recursively transform children
          if (node.content.size > 0) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const newContent: any[] = [];
            let hasChanges = false;
            node.content.forEach((child) => {
              const newChild = transformNode(child);
              if (newChild !== child) {
                hasChanges = true;
              }
              newContent.push(newChild);
            });

            // Only create new node if children changed
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated in forEach
            if (hasChanges) {
              // Use ProseMirror's Fragment.from to create a new fragment
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const Fragment = (node.content as any).constructor;

              const newFragment = Fragment.fromArray(newContent) as typeof node.content;
              return node.copy(newFragment);
            }
          }
          return node;
        };

        // Transform the slice
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const newContent: any[] = [];
        let hasChanges = false;
        slice.content.forEach((node) => {
          const newNode = transformNode(node);
          if (newNode !== node) {
            hasChanges = true;
          }
          newContent.push(newNode);
        });

        // Return transformed slice if there were changes
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- mutated in forEach
        if (hasChanges) {
          // Use ProseMirror's Fragment.from to create a new fragment
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const Fragment = (slice.content as any).constructor;

          const newFragment = Fragment.fromArray(newContent) as typeof slice.content;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-return
          return new (slice.constructor as any)(newFragment, slice.openStart, slice.openEnd);
        }

        return slice;
      },
    },
    // Track content changes for title extraction
    onUpdate: ({ editor }) => {
      // Don't extract title while loading a note
      if (isLoadingRef.current) {
        console.log('[TipTapEditor] onUpdate fired but loading flag is set, skipping');
        return;
      }

      // Don't extract title if no note is selected
      if (!noteIdRef.current) {
        console.log('[TipTapEditor] onUpdate fired but no noteId, skipping');
        return;
      }

      // Don't extract title if editor is read-only (e.g., for deleted notes)
      if (readOnly) {
        return;
      }

      // Extract title from first line and debounce the update
      const firstLine = editor.state.doc.firstChild;
      if (firstLine && onTitleChange) {
        const titleText = firstLine.textContent.trim();
        console.log(
          `[TipTapEditor] onUpdate extracting title for note ${noteIdRef.current}: "${titleText}"`
        );

        // Clear existing timer
        if (titleUpdateTimerRef.current) {
          clearTimeout(titleUpdateTimerRef.current);
        }

        // Capture the noteId NOW, before debounce delay
        const capturedNoteId = noteIdRef.current;

        // Debounce title update by 300ms for snappy updates
        titleUpdateTimerRef.current = setTimeout(() => {
          // Extract full text content for FTS5 indexing
          // Manually extract with block separators to preserve word boundaries
          let text = '';
          editor.state.doc.descendants((node) => {
            if (node.isText) {
              text += node.text ?? '';
            } else if (node.isBlock && text.length > 0 && !text.endsWith('\n')) {
              // Add newline between blocks for proper snippet generation
              text += '\n';
            }
            return true;
          });

          console.log(
            `[TipTapEditor] Sending title update for note ${capturedNoteId}: "${titleText || 'Untitled'}"`
          );
          // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
          onTitleChange?.(capturedNoteId, titleText || 'Untitled', text.trim());
        }, 300);
      }
    },
    // Track selection changes for enabling comment button
    onSelectionUpdate: ({ editor }) => {
      const { empty } = editor.state.selection;
      setHasTextSelection(!empty);
    },
  });

  // Fix: Ensure UndoManager is properly configured after React StrictMode double-mount
  // React StrictMode unmounts and remounts components, which can break the TipTap
  // Collaboration extension's UndoManager in two ways:
  // 1. The UndoManager may lose itself from trackedOrigins
  // 2. The UndoManager's afterTransactionHandler may be unregistered from the Y.Doc
  useEffect(() => {
    if (editor) {
      const undoPluginState = yUndoPluginKey.getState(editor.state);
      if (undoPluginState?.undoManager) {
        const um = undoPluginState.undoManager;

        // Fix 1: If the UndoManager doesn't have itself in trackedOrigins, add it
        if (!um.trackedOrigins.has(um)) {
          um.trackedOrigins.add(um);
        }

        // Fix 2: If the UndoManager's handler is not registered on Y.Doc, re-register it
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const umAny = um as any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const yDocAny = yDoc as any;

        const observers = yDocAny._observers?.get('afterTransaction');

        const hasUmHandler = observers?.has(umAny.afterTransactionHandler) ?? false;

        if (!hasUmHandler && umAny.afterTransactionHandler) {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
          yDoc.on('afterTransaction', umAny.afterTransactionHandler);
        }
      }
    }
  }, [editor, yDoc]);

  // Note: Paste detection for URL linkification of selected text is implemented
  // but currently disabled due to testing limitations with Playwright/Electron.
  // The keydown handler approach (catching Cmd+V) was attempted but couldn't be
  // properly tested because Playwright's keyboard simulation bypasses DOM events
  // when Electron's menu accelerators handle the shortcut.
  // TODO: Re-enable paste detection when a testable solution is found.

  // Cache the active SD when the note changes
  // This enables synchronous access in transformPasted for cross-SD image copying
  useEffect(() => {
    if (noteId) {
      window.electronAPI.sd
        .getActive()
        .then((sdId) => {
          activeSdIdRef.current = sdId;
        })
        .catch(() => {
          activeSdIdRef.current = null;
        });
    } else {
      activeSdIdRef.current = null;
    }
  }, [noteId]);

  // Keep noteIdRef in sync with noteId prop and handle note deselection
  useEffect(() => {
    const previousNoteId = noteIdRef.current;

    if (previousNoteId !== noteId) {
      // If we're deselecting a note (changing from a valid ID to null or different ID),
      // immediately save the current editor content
      if (previousNoteId && editor && onTitleChange) {
        // Don't save if the note is still loading
        if (isLoadingRef.current) {
          console.log(
            `[TipTapEditor] Skipping save during deselection - note ${previousNoteId} still loading`
          );
          noteIdRef.current = noteId;
          return;
        }

        // Clear any pending debounced update
        if (titleUpdateTimerRef.current) {
          clearTimeout(titleUpdateTimerRef.current);
          titleUpdateTimerRef.current = null;
        }

        // Extract and save title immediately
        const firstLine = editor.state.doc.firstChild;
        if (firstLine) {
          const titleText = firstLine.textContent.trim();
          let text = '';
          editor.state.doc.descendants((node) => {
            if (node.isText) {
              text += node.text ?? '';
            } else if (node.isBlock && text.length > 0 && !text.endsWith('\n')) {
              text += '\n';
            }
            return true;
          });
          onTitleChange(previousNoteId, titleText || 'Untitled', text.trim());
        }
      }

      noteIdRef.current = noteId;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noteId]); // editor and onTitleChange intentionally excluded to avoid re-running on every editor update

  // Cleanup on unmount - save any pending changes before destroying editor
  useEffect(() => {
    return () => {
      // Save current editor content before unmounting
      // IMPORTANT: Only save if note was fully loaded to prevent data corruption
      if (noteId && editor && onTitleChange && !isLoadingRef.current) {
        const firstLine = editor.state.doc.firstChild;
        if (firstLine) {
          const titleText = firstLine.textContent.trim();
          let text = '';
          editor.state.doc.descendants((node) => {
            if (node.isText) {
              text += node.text ?? '';
            } else if (node.isBlock && text.length > 0 && !text.endsWith('\n')) {
              text += '\n';
            }
            return true;
          });
          console.log(
            `[TipTapEditor] Unmount: Saving note ${noteId} with title: "${titleText || 'Untitled'}"`
          );
          onTitleChange(noteId, titleText || 'Untitled', text.trim());
        }
      } else if (noteId && isLoadingRef.current) {
        console.log(
          `[TipTapEditor] Unmount: Skipping save for note ${noteId} - still loading (preventing data corruption)`
        );
      }

      if (titleUpdateTimerRef.current) {
        clearTimeout(titleUpdateTimerRef.current);
      }
      editor?.destroy();
      yDoc.destroy();
    };
  }, [editor, yDoc, noteId, onTitleChange]);

  // Send Yjs updates to main process for persistence and cross-window sync
  useEffect(() => {
    if (!editor || !noteId) return;

    // Send updates to main process (but not updates from network/load)
    const updateHandler = (update: Uint8Array, origin: unknown) => {
      // Skip updates that we applied from external sources (origin will be set)
      if (origin === 'remote' || origin === 'load') {
        console.log(`[TipTapEditor] Skipping update with origin: ${origin}`);
        return;
      }

      // Create a hash of the update to track it
      const updateHash = Array.from(update.slice(0, 32))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');
      pendingUpdatesRef.current.add(updateHash);

      // Clean up old hashes after a short delay (in case update never comes back)
      setTimeout(() => {
        pendingUpdatesRef.current.delete(updateHash);
      }, 5000);

      console.log(
        `[TipTapEditor] Sending update to main process for note ${noteId}, size: ${update.length} bytes, hash: ${updateHash.substring(0, 16)}...`
      );
      // Send update to main process for persistence and distribution to other windows
      window.electronAPI.note.applyUpdate(noteId, update).catch((error: Error) => {
        console.error(`Failed to apply update for note ${noteId}:`, error);
      });
    };

    // Store reference to handler so we can temporarily disable it during loading
    updateHandlerRef.current = updateHandler;

    yDoc.on('update', updateHandler);

    return () => {
      yDoc.off('update', updateHandler);
      updateHandlerRef.current = null;
    };
  }, [editor, yDoc, noteId]);

  // Handle note loading/unloading with IPC
  useEffect(() => {
    if (!noteId || !editor) {
      return;
    }

    let isActive = true;

    // Helper to set loading state (both ref and state)
    const setLoadingState = (loading: boolean) => {
      isLoadingRef.current = loading;
      setIsLoading(loading);
    };

    // Load note from main process
    const loadNote = async () => {
      try {
        setLoadingState(true);
        console.log(`[TipTapEditor] Loading note ${noteId}`);

        // Clear the title cache to ensure we fetch fresh titles
        clearNoteTitleCache();

        // Tell main process to load this note
        await window.electronAPI.note.load(noteId);

        // Get the current state from main process
        const state = await window.electronAPI.note.getState(noteId);
        console.log(`[TipTapEditor] Got state from main process, size: ${state.length} bytes`);

        if (!isActive) {
          return;
        }

        // Apply the state to our local Yjs document with 'load' origin
        // Since this editor instance is created fresh for each note (via key prop),
        // the yDoc is empty and we don't need to clear it first
        Y.applyUpdate(yDoc, state, 'load');
        console.log(`[TipTapEditor] Applied state to yDoc`);

        // Check if this is a newly created note and set up initial formatting
        // Only apply H1 formatting to notes that were just created, not existing empty notes
        if (isNewlyCreated) {
          console.log(`[TipTapEditor] Setting up newly created note with H1 formatting`);

          // For new notes, clear any default content and set H1 format
          editor.commands.setContent('');
          editor.commands.setHeading({ level: 1 });

          // Mark that we should focus after loading completes
          // Using ref because isNewlyCreated will be cleared by onNoteLoaded
          shouldFocusAfterLoadRef.current = true;
          focusAttemptedRef.current = false; // Reset so we can attempt focus
        }

        // IMPORTANT: Clear loading flag AFTER all content manipulation to prevent
        // spurious title updates from setContent/setHeading operations
        setLoadingState(false);

        // Enable editing now that loading is complete
        editor.setEditable(!readOnly);

        // Notify parent that note has been loaded
        onNoteLoaded?.();
      } catch (error) {
        console.error(`Failed to load note ${noteId}:`, error);
        setLoadingState(false);
        editor.setEditable(!readOnly);
      }
    };

    void loadNote();

    // Set up listener for updates from other windows in same process
    const handleNoteUpdate = (updatedNoteId: string, update: Uint8Array) => {
      if (updatedNoteId !== noteId) {
        return;
      }

      // Check if this is our own update bouncing back
      const updateHash = Array.from(update.slice(0, 32))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      if (pendingUpdatesRef.current.has(updateHash)) {
        // This is our own update, skip it to preserve undo stack
        console.log(
          `[TipTapEditor] Skipping own update bounce-back, hash: ${updateHash.substring(0, 16)}...`
        );
        pendingUpdatesRef.current.delete(updateHash);
        return;
      }

      // Apply update from other window to our local Y.Doc with 'remote' origin
      // This will automatically update the editor via the Collaboration extension
      console.log(
        `[TipTapEditor] Applying remote update with ${update.length} bytes, hash: ${updateHash.substring(0, 16)}...`
      );
      Y.applyUpdate(yDoc, update, 'remote');
    };

    const cleanupNoteUpdate = window.electronAPI.note.onUpdated(handleNoteUpdate);

    // Set up listener for updates from other instances (via activity sync)
    // Note: We don't need to do anything here - the main process will broadcast
    // note:updated events when it loads updates from disk, which handleNoteUpdate
    // will receive and process normally.
    const handleExternalUpdate = (data: { operation: string; noteIds: string[] }) => {
      console.log(
        `[TipTapEditor] onExternalUpdate received:`,
        data.operation,
        data.noteIds,
        `this note: ${noteId}, included: ${data.noteIds.includes(noteId)}`
      );

      if (data.noteIds.includes(noteId)) {
        // Just show sync indicator - updates will come via note:updated
        if (syncIndicatorTimerRef.current) {
          clearTimeout(syncIndicatorTimerRef.current);
        }
        setShowSyncIndicator(true);
        syncIndicatorTimerRef.current = setTimeout(() => {
          setShowSyncIndicator(false);
        }, 2000);
      }
    };

    const cleanupExternalUpdate = window.electronAPI.note.onExternalUpdate(handleExternalUpdate);

    return () => {
      isActive = false;
      cleanupNoteUpdate();
      cleanupExternalUpdate();
      // Clean up sync indicator timer
      if (syncIndicatorTimerRef.current) {
        clearTimeout(syncIndicatorTimerRef.current);
      }
      // Tell main process we're done with this note
      void window.electronAPI.note.unload(noteId);
    };
  }, [noteId, editor, yDoc, isNewlyCreated, onNoteLoaded, readOnly]);

  // Focus editor after loading completes for newly created notes
  // This is separate from the loading effect because isNewlyCreated changes
  // during loading (cleared by onNoteLoaded), causing the loading effect to re-run.
  // Using refs ensures we capture the "should focus" intent before it's cleared,
  // and only attempt focus once per new note.
  useEffect(() => {
    if (!isLoading && editor && shouldFocusAfterLoadRef.current && !focusAttemptedRef.current) {
      focusAttemptedRef.current = true;

      // Delay focus to ensure React has finished rendering
      // Query DOM directly since editor reference may be stale after remounts
      setTimeout(() => {
        const proseMirrorEl = document.querySelector<HTMLElement>('.ProseMirror');
        proseMirrorEl?.focus();
        shouldFocusAfterLoadRef.current = false;
      }, 100);
    }
  }, [isLoading, editor]);

  // Report current note to window state manager when note changes
  useEffect(() => {
    if (noteId && windowId) {
      // Get sdId from metadata if available (could enhance later)
      reportCurrentNote(noteId);
    }
  }, [noteId, windowId, reportCurrentNote]);

  // Load saved state when note loads (for session restoration)
  useEffect(() => {
    if (!noteId || isLoading) return;

    // Only attempt restoration once per note load
    if (hasRestoredStateRef.current) return;
    hasRestoredStateRef.current = true;

    const loadSavedState = async () => {
      const savedState = await getSavedState();
      if (savedState) {
        savedStateRef.current = savedState;
        console.log('[TipTapEditor] Loaded saved state for restoration:', savedState);
      }
    };

    void loadSavedState();
  }, [noteId, isLoading, getSavedState]);

  // Restore scroll and cursor position after note content is ready
  useEffect(() => {
    if (!editor || isLoading || !savedStateRef.current) return;

    const savedState = savedStateRef.current;

    // Small delay to ensure DOM is ready
    const timer = setTimeout(() => {
      // Restore scroll position
      if (editorContainerRef.current && savedState.scrollTop > 0) {
        console.log('[TipTapEditor] Restoring scroll position:', savedState.scrollTop);
        editorContainerRef.current.scrollTop = savedState.scrollTop;
      }

      // Restore cursor position
      if (savedState.cursorPosition > 0) {
        try {
          const docLength = editor.state.doc.content.size;
          const safePosition = Math.min(savedState.cursorPosition, docLength - 1);
          if (safePosition > 0) {
            console.log('[TipTapEditor] Restoring cursor position:', safePosition);
            editor.commands.setTextSelection(safePosition);
          }
        } catch (error) {
          console.warn('[TipTapEditor] Failed to restore cursor position:', error);
        }
      }

      // Clear saved state after restoration
      savedStateRef.current = null;
    }, 150); // Delay to ensure content is rendered

    return () => {
      clearTimeout(timer);
    };
  }, [editor, isLoading]);

  // Track scroll position changes
  useEffect(() => {
    const container = editorContainerRef.current;
    if (!container) return;

    const handleScroll = () => {
      reportScrollPosition(container.scrollTop);
    };

    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScroll);
    };
  }, [reportScrollPosition]);

  // Track cursor position changes
  useEffect(() => {
    if (!editor) return;

    const handleSelectionUpdate = () => {
      const { from } = editor.state.selection;
      reportCursorPosition(from);
    };

    editor.on('selectionUpdate', handleSelectionUpdate);
    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
    };
  }, [editor, reportCursorPosition]);

  // Report final state on unmount
  useEffect(() => {
    const containerRef = editorContainerRef.current;
    return () => {
      if (containerRef && editor) {
        const scrollTop = containerRef.scrollTop;
        const cursorPosition = editor.state.selection.from;
        reportFinalState(scrollTop, cursorPosition);
      }
    };
  }, [editor, reportFinalState]);

  // Reset restoration flag when note changes
  useEffect(() => {
    hasRestoredStateRef.current = false;
    savedStateRef.current = null;
  }, [noteId]);

  // DOM-level drop handler for image files
  // We handle drops at the document level because:
  // 1. ProseMirror's handleDrop prop doesn't get triggered by synthetic events
  // 2. Native file drops from Finder often land on container elements, not the editor itself
  // We check if the drop is within the editor container and handle it accordingly.
  // If dropped in the container but below the editor content, append to the end.
  useEffect(() => {
    if (!editor) return;

    // Reference to the editor DOM and container
    const editorDom = editor.view.dom;
    const dropZone = editorContainerRef.current; // The scrollable container with the editor

    const handleDocumentDrop = async (event: DragEvent) => {
      const dataTransfer = event.dataTransfer;
      if (!dataTransfer) return;

      // Check if the drop target is within the drop zone (editor container)
      const target = event.target as HTMLElement;
      const isInDropZone = dropZone?.contains(target);
      const isDirectlyOnEditor = editorDom.contains(target);

      console.log(
        '[TipTapEditor] Document drop - target:',
        target,
        'isInDropZone:',
        isInDropZone,
        'isDirectlyOnEditor:',
        isDirectlyOnEditor
      );

      if (!isInDropZone) {
        console.log('[TipTapEditor] Drop not in drop zone, ignoring');
        return;
      }

      // Determine where to insert: at cursor if on editor, at end if on container
      const insertAtEnd = !isDirectlyOnEditor;
      console.log('[TipTapEditor] Insert at end:', insertAtEnd);

      // Check both files and items (items works better in some contexts like tests)
      const files = dataTransfer.files;
      const items = dataTransfer.items;

      // Debug logging
      console.log('[TipTapEditor] Drop event - files:', files.length, 'items:', items.length);
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (f) {
          console.log(`[TipTapEditor] File ${i}: name="${f.name}" type="${f.type}" size=${f.size}`);
        }
      }

      // Collect files to process (with their MIME types)
      // We use getImageMimeType which checks both file.type and filename extension,
      // since files dropped from Finder on macOS often have empty file.type
      const imageFiles: { file: File; mimeType: string }[] = [];

      // First try files (preferred for native drops)
      if (files.length > 0) {
        for (const file of files) {
          const mimeType = getImageMimeType(file);
          if (mimeType) {
            imageFiles.push({ file, mimeType });
          }
        }
      }

      // If no files found, try items (works better in synthetic events)
      if (imageFiles.length === 0 && items.length > 0) {
        for (const item of items) {
          if (item.kind === 'file') {
            const file = item.getAsFile();
            if (file) {
              const mimeType = getImageMimeType(file);
              if (mimeType) {
                imageFiles.push({ file, mimeType });
              }
            }
          }
        }
      }

      if (imageFiles.length === 0) return;

      // Prevent default drop handling
      event.preventDefault();
      event.stopPropagation();

      // Process each image file
      for (const { file, mimeType } of imageFiles) {
        console.log(
          '[TipTapEditor] DOM drop handler: Image detected, type:',
          mimeType,
          'name:',
          file.name
        );

        try {
          // Read as ArrayBuffer and save via IPC
          const buffer = await file.arrayBuffer();

          // Get the active SD to save the image in
          const sdId = await window.electronAPI.sd.getActive();
          if (!sdId) {
            console.error('[TipTapEditor] No active SD, cannot save dropped image');
            return;
          }

          const data = new Uint8Array(buffer);

          console.log('[TipTapEditor] Saving dropped image, size:', data.length, 'type:', mimeType);

          // Save the image via IPC (returns {imageId, filename})
          const result = await window.electronAPI.image.save(sdId, data, mimeType);
          console.log('[TipTapEditor] Dropped image saved with ID:', result.imageId);

          // Insert the image node
          const { state, dispatch } = editor.view;
          const imageNode = state.schema.nodes['notecoveImage'];
          if (imageNode) {
            const node = imageNode.create({
              imageId: result.imageId,
              sdId,
            });

            let tr;
            if (insertAtEnd) {
              // Insert at the end of the document
              const endPos = state.doc.content.size;
              tr = state.tr.insert(endPos, node);
              console.log('[TipTapEditor] Inserting image at end, position:', endPos);
            } else {
              // Insert at current cursor position
              tr = state.tr.replaceSelectionWith(node);
              console.log('[TipTapEditor] Inserting image at cursor');
            }
            dispatch(tr);
            console.log('[TipTapEditor] Dropped image node inserted');
          }
        } catch (err) {
          console.error('[TipTapEditor] Failed to save dropped image:', err);
        }
      }
    };

    // Wrap the async handler
    const wrappedDropHandler = (event: Event) => {
      void handleDocumentDrop(event as DragEvent);
    };

    // IMPORTANT: dragover must call preventDefault() for drop to fire
    // We handle this at document level and check if over the drop zone
    const handleDragOver = (event: DragEvent) => {
      // Check if the drag contains files that might be images
      const hasFiles = event.dataTransfer?.types.includes('Files');
      if (!hasFiles) return;

      // Check if over the drop zone (editor container)
      const target = event.target as HTMLElement;
      const isInDropZone = dropZone?.contains(target);

      if (isInDropZone) {
        event.preventDefault();
        // Set dropEffect to show the user they can drop here
        if (event.dataTransfer) {
          event.dataTransfer.dropEffect = 'copy';
        }
      }
    };

    // Listen at document level to catch drops that land on container elements
    document.addEventListener('drop', wrappedDropHandler);
    document.addEventListener('dragover', handleDragOver);

    return () => {
      document.removeEventListener('drop', wrappedDropHandler);
      document.removeEventListener('dragover', handleDragOver);
    };
  }, [editor]);

  // Keyboard shortcut for inserting images via file picker (Cmd+Shift+M / Ctrl+Shift+M)
  // Note: "M" for Media - avoids conflict with Cmd+Shift+I which is Note Info
  useEffect(() => {
    if (!editor) return;

    const handleKeyDown = async (event: KeyboardEvent) => {
      // Check for Cmd+Shift+M (Mac) or Ctrl+Shift+M (Windows/Linux)
      // eslint-disable-next-line @typescript-eslint/prefer-includes, @typescript-eslint/no-deprecated
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      if (modifier && event.shiftKey && event.key.toLowerCase() === 'm') {
        event.preventDefault();
        event.stopPropagation();

        try {
          // Get the active SD
          const sdId = await window.electronAPI.sd.getActive();
          if (!sdId) {
            console.error('[TipTapEditor] No active SD, cannot pick images');
            return;
          }

          // Open file picker and save selected images
          const imageIds = await window.electronAPI.image.pickAndSave(sdId);

          if (imageIds.length === 0) {
            // User canceled or no valid images selected
            return;
          }

          // Insert image nodes for each saved image
          const { state, dispatch } = editor.view;
          const imageNode = state.schema.nodes['notecoveImage'];
          if (!imageNode) return;

          let { tr } = state;
          for (const imageId of imageIds) {
            const node = imageNode.create({ imageId, sdId });
            tr = tr.replaceSelectionWith(node);
          }
          dispatch(tr);

          console.log('[TipTapEditor] Inserted', imageIds.length, 'images from file picker');
        } catch (err) {
          console.error('[TipTapEditor] Failed to pick and insert images:', err);
        }
      }
    };

    // Add listener to the editor DOM element
    const editorDom = editor.view.dom;
    const wrappedHandler = (event: Event) => {
      void handleKeyDown(event as KeyboardEvent);
    };
    editorDom.addEventListener('keydown', wrappedHandler);

    return () => {
      editorDom.removeEventListener('keydown', wrappedHandler);
    };
  }, [editor]);

  // Click handler for comment highlights
  // When a comment mark is clicked, check for overlapping comments and show popover if multiple
  useEffect(() => {
    if (!editor || !onCommentClick) return;

    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      const commentHighlight = target.closest('.comment-highlight');
      if (commentHighlight) {
        // Collect all thread IDs from this element and its ancestors
        const threadIds: string[] = [];
        let current: Element | null = commentHighlight;

        while (current) {
          if (current.classList.contains('comment-highlight')) {
            const threadId = current.getAttribute('data-thread-id');
            if (threadId && !threadIds.includes(threadId)) {
              threadIds.push(threadId);
            }
          }
          current = current.parentElement?.closest('.comment-highlight') ?? null;
        }

        if (threadIds.length === 0) {
          return;
        }

        if (threadIds.length === 1 && threadIds[0]) {
          // Single comment - select it directly
          console.log('[TipTapEditor] Comment highlight clicked, threadId:', threadIds[0]);
          onCommentClick(threadIds[0]);
        } else if (threadIds.length > 1) {
          // Multiple overlapping comments - show popover
          console.log('[TipTapEditor] Overlapping comments clicked:', threadIds);
          setOverlapPopover({
            anchorEl: commentHighlight as HTMLElement,
            threadIds,
          });
        }
      }
    };

    const editorDom = editor.view.dom;
    editorDom.addEventListener('click', handleClick);

    return () => {
      editorDom.removeEventListener('click', handleClick);
    };
  }, [editor, onCommentClick]);

  // Create a comment on the current selection
  // This function is used by both the keyboard shortcut and toolbar button
  const handleAddCommentOnSelection = useCallback(async () => {
    if (!editor || !noteId || !userProfile) return;

    // Get current selection
    const { from, to, empty } = editor.state.selection;

    if (empty) {
      console.log('[TipTapEditor] Cannot add comment: no selection');
      return;
    }

    // Get selected text
    const text = editor.state.doc.textBetween(from, to, ' ');
    console.log('[TipTapEditor] Adding comment for selection:', { from, to, text });

    try {
      // Encode positions as simple Uint8Array for now
      // Future enhancement: Use Yjs RelativePosition for anchors that survive text edits
      const anchorStart = new Uint8Array(new Uint32Array([from]).buffer);
      const anchorEnd = new Uint8Array(new Uint32Array([to]).buffer);

      // Create the comment thread via IPC
      const result = await window.electronAPI.comment.addThread(noteId, {
        noteId,
        anchorStart,
        anchorEnd,
        authorId: userProfile.profileId,
        authorName: userProfile.username || 'Anonymous',
        authorHandle: userProfile.handle || '@anonymous',
        content: '', // Empty content - user will fill in via panel
        originalText: text,
        created: Date.now(),
        modified: Date.now(),
        resolved: false,
      });

      if (!result.success || !result.threadId) {
        console.error('[TipTapEditor] Failed to create comment thread:', result.error);
        return;
      }

      console.log('[TipTapEditor] Comment thread created:', result.threadId);

      // Apply the comment mark to the selection
      editor.chain().focus().setTextSelection({ from, to }).setCommentMark(result.threadId).run();

      console.log('[TipTapEditor] Comment mark applied');

      // Notify parent about the new comment (to open panel, select thread, etc.)
      onAddComment?.({ from, to, text, threadId: result.threadId });
    } catch (err) {
      console.error('[TipTapEditor] Failed to create comment thread:', err);
    }
  }, [editor, noteId, onAddComment, userProfile]);

  // Keyboard shortcut for adding comments (Cmd+Alt+M / Ctrl+Alt+M like Google Docs)
  useEffect(() => {
    if (!editor || !noteId) return;

    const handleKeyDown = async (event: KeyboardEvent) => {
      // Check for Cmd+Alt+M (Mac) or Ctrl+Alt+M (Windows/Linux)
      // eslint-disable-next-line @typescript-eslint/prefer-includes, @typescript-eslint/no-deprecated
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifier = isMac ? event.metaKey : event.ctrlKey;

      // Use event.code instead of event.key because Alt/Option modifies the character on Mac
      if (modifier && event.altKey && event.code === 'KeyM') {
        event.preventDefault();
        event.stopPropagation();
        await handleAddCommentOnSelection();
      }
    };

    const editorDom = editor.view.dom;
    const wrappedHandler = (event: Event) => {
      void handleKeyDown(event as KeyboardEvent);
    };
    editorDom.addEventListener('keydown', wrappedHandler);

    return () => {
      editorDom.removeEventListener('keydown', wrappedHandler);
    };
  }, [editor, noteId, handleAddCommentOnSelection]);

  // Handler for the comment toolbar button
  const handleCommentButtonClick = () => {
    void handleAddCommentOnSelection();
  };

  // Keyboard shortcut for moving blocks (Alt+Up / Alt+Down)
  // This DOM-level handler is needed because on Mac, Option+Arrow keys are intercepted
  // by the browser for paragraph navigation before TipTap's keyboard shortcuts fire.
  // Using event.code instead of event.key ensures reliable detection on Mac.
  useEffect(() => {
    if (!editor) return;

    const handleMoveBlockKeyDown = (event: KeyboardEvent) => {
      // Only handle Alt+ArrowUp/Down (no other modifiers like Cmd/Ctrl/Shift)
      if (!event.altKey || event.metaKey || event.ctrlKey || event.shiftKey) {
        return;
      }

      if (event.code === 'ArrowUp') {
        const success = editor.commands.moveBlockUp();
        if (success) {
          event.preventDefault();
          event.stopPropagation();
        }
      } else if (event.code === 'ArrowDown') {
        const success = editor.commands.moveBlockDown();
        if (success) {
          event.preventDefault();
          event.stopPropagation();
        }
      }
    };

    const editorDom = editor.view.dom;
    editorDom.addEventListener('keydown', handleMoveBlockKeyDown);

    return () => {
      editorDom.removeEventListener('keydown', handleMoveBlockKeyDown);
    };
  }, [editor]);

  // Load and track open comment count for toolbar badge
  useEffect(() => {
    if (!noteId) {
      setOpenCommentCount(0);
      return;
    }

    // Load initial count
    const loadCommentCount = async () => {
      try {
        const threads = await window.electronAPI.comment.getThreads(noteId);
        const openCount = threads.filter((t) => !t.resolved).length;
        setOpenCommentCount(openCount);
      } catch (error) {
        console.error('Failed to load comment count:', error);
      }
    };
    void loadCommentCount();

    // Subscribe to thread changes
    const unsubAdded = window.electronAPI.comment.onThreadAdded((addedNoteId) => {
      if (addedNoteId === noteId) {
        void loadCommentCount();
      }
    });
    const unsubUpdated = window.electronAPI.comment.onThreadUpdated((updatedNoteId) => {
      if (updatedNoteId === noteId) {
        void loadCommentCount();
      }
    });
    const unsubDeleted = window.electronAPI.comment.onThreadDeleted((deletedNoteId, threadId) => {
      if (deletedNoteId === noteId) {
        void loadCommentCount();
        // Remove the comment mark from the editor
        if (editor) {
          editor.commands.removeCommentMarkById(threadId);
        }
      }
    });

    return () => {
      unsubAdded();
      unsubUpdated();
      unsubDeleted();
    };
  }, [noteId, editor]);

  // Manage link popover using tippy.js
  useEffect(() => {
    // Clean up existing popover
    if (linkPopoverRef.current) {
      linkPopoverRef.current.destroy();
      linkPopoverRef.current = null;
    }

    // If no data, nothing to show
    if (!linkPopoverData) {
      return;
    }

    // Create a container for the React component
    const container = document.createElement('div');

    // Create the popover using tippy.js
    const instance = tippy(linkPopoverData.element, {
      content: container,
      trigger: 'manual',
      interactive: true,
      placement: 'bottom-start',
      appendTo: () => document.body,
      onHide: () => {
        setLinkPopoverData(null);
      },
      onClickOutside: () => {
        instance.hide();
      },
    });

    // Capture current values for use in callbacks
    // (linkPopoverData is guaranteed non-null at this point, and we check editor below)
    const { href, from, to } = linkPopoverData;

    // If editor is not available, don't render edit/remove options
    if (!editor) {
      return;
    }
    const currentEditor = editor;

    // Render the React component into the container
    // Using ReactDOM.createRoot for React 18
    void import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(container);
      root.render(
        <LinkPopover
          href={href}
          onClose={() => {
            instance.hide();
            setLinkPopoverData(null);
          }}
          onEdit={(newHref: string) => {
            console.log('[TipTapEditor] Editing link, new href:', newHref);
            // Select the link range and update the href
            currentEditor
              .chain()
              .focus()
              .setTextSelection({ from, to })
              .extendMarkRange('link')
              .setLink({ href: newHref })
              .run();
          }}
          onRemove={() => {
            console.log('[TipTapEditor] Removing link at:', from, '-', to);
            // Select the link range and remove the link mark
            currentEditor
              .chain()
              .focus()
              .setTextSelection({ from, to })
              .extendMarkRange('link')
              .unsetLink()
              .run();
          }}
        />
      );
    });

    // Show the popover
    instance.show();
    linkPopoverRef.current = instance;

    // Cleanup on unmount
    return () => {
      if (linkPopoverRef.current) {
        linkPopoverRef.current.destroy();
        linkPopoverRef.current = null;
      }
    };
  }, [linkPopoverData, editor]);

  // Manage link input popover (for creating new links)
  useEffect(() => {
    // Clean up existing popover
    if (linkInputPopoverRef.current) {
      linkInputPopoverRef.current.destroy();
      linkInputPopoverRef.current = null;
    }

    // If no data, nothing to show
    if (!linkInputPopoverData || !editor) {
      return;
    }

    // Create a container for the React component
    const container = document.createElement('div');

    // Capture current values
    const { element, selectionFrom, selectionTo, initialUrl } = linkInputPopoverData;

    // Create the popover using tippy.js
    const instance = tippy(element, {
      content: container,
      trigger: 'manual',
      interactive: true,
      placement: 'bottom-start',
      appendTo: () => document.body,
      onHide: () => {
        setLinkInputPopoverData(null);
      },
      onClickOutside: () => {
        instance.hide();
      },
    });

    // Render the React component into the container
    void import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(container);
      root.render(
        <LinkInputPopover
          {...(initialUrl ? { initialUrl } : {})}
          onSubmit={(url: string) => {
            console.log('[TipTapEditor] Creating link with URL:', url);
            // Select the original selection and apply link
            editor
              .chain()
              .focus()
              .setTextSelection({ from: selectionFrom, to: selectionTo })
              .setLink({ href: url })
              .run();
            instance.hide();
            setLinkInputPopoverData(null);
          }}
          onCancel={() => {
            instance.hide();
            setLinkInputPopoverData(null);
          }}
        />
      );
    });

    // Show the popover
    instance.show();
    linkInputPopoverRef.current = instance;

    // Cleanup on unmount
    return () => {
      if (linkInputPopoverRef.current) {
        linkInputPopoverRef.current.destroy();
        linkInputPopoverRef.current = null;
      }
    };
  }, [linkInputPopoverData, editor]);

  // Manage text+URL input popover (for creating new links without selection)
  useEffect(() => {
    // Clean up existing popover
    if (textAndUrlPopoverRef.current) {
      textAndUrlPopoverRef.current.destroy();
      textAndUrlPopoverRef.current = null;
    }

    // If no data, nothing to show
    if (!textAndUrlPopoverData || !editor) {
      return;
    }

    // Create a container for the React component
    const container = document.createElement('div');

    // Capture current values
    const { element, insertPosition } = textAndUrlPopoverData;

    // Create the popover using tippy.js
    const instance = tippy(element, {
      content: container,
      trigger: 'manual',
      interactive: true,
      placement: 'bottom-start',
      appendTo: () => document.body,
      onHide: () => {
        setTextAndUrlPopoverData(null);
      },
      onClickOutside: () => {
        instance.hide();
      },
    });

    // Render the React component into the container
    void import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(container);
      root.render(
        <TextAndUrlInputPopover
          onSubmit={(text: string, url: string) => {
            console.log('[TipTapEditor] Creating link with text and URL:', { text, url });
            // Insert text with link mark at the cursor position
            editor
              .chain()
              .focus()
              .insertContentAt(insertPosition, {
                type: 'text',
                text,
                marks: [{ type: 'link', attrs: { href: url } }],
              })
              .run();
            instance.hide();
            setTextAndUrlPopoverData(null);
          }}
          onCancel={() => {
            instance.hide();
            setTextAndUrlPopoverData(null);
          }}
        />
      );
    });

    // Show the popover
    instance.show();
    textAndUrlPopoverRef.current = instance;

    // Cleanup on unmount
    return () => {
      if (textAndUrlPopoverRef.current) {
        textAndUrlPopoverRef.current.destroy();
        textAndUrlPopoverRef.current = null;
      }
    };
  }, [textAndUrlPopoverData, editor]);

  /**
   * Handle link button click from toolbar
   * - If cursor is in existing link: show edit popover
   * - If text is selected: show URL input popover
   */
  const handleLinkButtonClick = (buttonElement: HTMLElement) => {
    if (!editor) return;

    // Check if cursor is in an existing link
    if (editor.isActive('link')) {
      // Get link mark attributes
      const { href } = editor.getAttributes('link') as { href: string };
      const { from, to } = editor.state.selection;

      console.log('[TipTapEditor] Link button clicked while in link:', href);

      // Show the edit popover
      setLinkPopoverData({
        href,
        element: buttonElement,
        from,
        to,
      });
      return;
    }

    // Check if there's a text selection
    const { from, to } = editor.state.selection;
    if (from !== to) {
      // Get selected text and check if it looks like a URL
      const selectedText = editor.state.doc.textBetween(from, to);
      const detectedUrl = detectUrlFromSelection(selectedText);

      console.log(
        '[TipTapEditor] Link button clicked with selection:',
        from,
        '-',
        to,
        'detected URL:',
        detectedUrl
      );

      // Show URL input popover
      setLinkInputPopoverData(
        detectedUrl
          ? {
              element: buttonElement,
              selectionFrom: from,
              selectionTo: to,
              initialUrl: detectedUrl,
            }
          : {
              element: buttonElement,
              selectionFrom: from,
              selectionTo: to,
            }
      );
      return;
    }

    // No selection and not in link - show text+URL dialog
    console.log('[TipTapEditor] Link button clicked with no selection, showing text+URL dialog');
    setTextAndUrlPopoverData({
      element: buttonElement,
      insertPosition: from,
    });
  };

  /**
   * Handle image button click from toolbar
   * Opens file picker and inserts selected images
   */
  const handleImageButtonClick = async () => {
    if (!editor) return;

    try {
      // Get the active SD
      const sdId = await window.electronAPI.sd.getActive();
      if (!sdId) {
        console.error('[TipTapEditor] No active SD, cannot pick images');
        return;
      }

      // Open file picker and save selected images
      const imageIds = await window.electronAPI.image.pickAndSave(sdId);

      if (imageIds.length === 0) {
        // User canceled or no valid images selected
        return;
      }

      // Insert image nodes for each saved image
      const { state, dispatch } = editor.view;
      const imageNode = state.schema.nodes['notecoveImage'];
      if (!imageNode) return;

      let { tr } = state;
      for (const imageId of imageIds) {
        const node = imageNode.create({ imageId, sdId });
        tr = tr.replaceSelectionWith(node);
      }
      dispatch(tr);

      console.log('[TipTapEditor] Inserted', imageIds.length, 'images from toolbar button');
    } catch (err) {
      console.error('[TipTapEditor] Failed to pick and insert images:', err);
    }
  };

  /**
   * Handle table button click from toolbar
   * Opens the table size picker dialog
   */
  const handleTableButtonClick = (buttonElement: HTMLElement) => {
    setTableSizePickerAnchor(buttonElement);
  };

  /**
   * Handle table size selection from picker
   * Inserts a table with the selected dimensions
   */
  const handleTableSizeSelect = (rows: number, cols: number) => {
    if (!editor) return;

    console.log('[TipTapEditor] Inserting table with dimensions:', rows, 'x', cols);
    editor.chain().focus().insertTable({ rows, cols, withHeaderRow: true }).run();
  };

  /**
   * Handle date selection from date picker dialog
   * Replaces the date text at the stored position
   */
  const handleDateSelect = (newDate: string) => {
    if (!editor) return;

    const { from, to } = datePickerState;
    console.log('[TipTapEditor] Replacing date at', from, '-', to, 'with', newDate);

    // Replace the date text in the editor
    editor.chain().focus().deleteRange({ from, to }).insertContentAt(from, newDate).run();

    // Close the dialog
    setDatePickerState((prev) => ({ ...prev, open: false }));
  };

  /**
   * Handle date picker dialog close (cancelled)
   */
  const handleDatePickerClose = () => {
    setDatePickerState((prev) => ({ ...prev, open: false }));
  };

  /**
   * Handle mention popover close
   */
  const handleMentionPopoverClose = () => {
    setMentionPopoverState((prev) => ({ ...prev, open: false }));
  };

  /**
   * Handle search for notes mentioning a person from mention popover
   * Dispatches a custom event that NotesListPanel can listen to
   */
  const handleSearchMentions = (_handle: string, displayName: string) => {
    // Search for the display name (more likely to find matches)
    const searchQuery = displayName;
    console.log('[TipTapEditor] Search for notes mentioning:', searchQuery);

    // Dispatch custom event for NotesListPanel to handle
    const event = new CustomEvent('notecove:searchNotes', {
      detail: { query: searchQuery },
    });
    window.dispatchEvent(event);

    handleMentionPopoverClose();
  };

  /**
   * Handle context menu open
   * Shows custom context menu with Cut, Copy, Paste, and Add Comment options
   */
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  /**
   * Handle context menu close
   */
  const handleContextMenuClose = () => {
    setContextMenu(null);
  };

  /**
   * Handle Cmd+K keyboard shortcut
   * Similar to handleLinkButtonClick but triggered from keyboard
   */
  const handleCmdK = (anchorElement: HTMLElement) => {
    if (!editor) return;

    // Check if cursor is in an existing link
    if (editor.isActive('link')) {
      const { href } = editor.getAttributes('link') as { href: string };
      const { from, to } = editor.state.selection;

      console.log('[TipTapEditor] Cmd+K pressed while in link:', href);

      setLinkPopoverData({
        href,
        element: anchorElement,
        from,
        to,
      });
      return;
    }

    // Check if there's a text selection
    const { from, to } = editor.state.selection;
    if (from !== to) {
      // Get selected text and check if it looks like a URL
      const selectedText = editor.state.doc.textBetween(from, to);
      const detectedUrl = detectUrlFromSelection(selectedText);

      console.log(
        '[TipTapEditor] Cmd+K pressed with selection:',
        from,
        '-',
        to,
        'detected URL:',
        detectedUrl
      );

      setLinkInputPopoverData(
        detectedUrl
          ? {
              element: anchorElement,
              selectionFrom: from,
              selectionTo: to,
              initialUrl: detectedUrl,
            }
          : {
              element: anchorElement,
              selectionFrom: from,
              selectionTo: to,
            }
      );
      return;
    }

    // No selection and not in link - show text+URL dialog
    console.log('[TipTapEditor] Cmd+K pressed with no selection, showing text+URL dialog');
    setTextAndUrlPopoverData({
      element: anchorElement,
      insertPosition: from,
    });
  };

  // Update handleCmdKRef when editor is available
  useEffect(() => {
    if (editor) {
      handleCmdKRef.current = handleCmdK;
    }
    return () => {
      handleCmdKRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- handleCmdK is intentionally captured via ref pattern
  }, [editor]);

  return (
    <Box
      sx={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        '& .ProseMirror': {
          minHeight: '100%',
          outline: 'none',
          // Preserve tab characters and multiple spaces while still allowing text wrap
          whiteSpace: 'pre-wrap',
          '& h1': {
            fontSize: '2em',
            fontWeight: 600,
            marginTop: 2,
            marginBottom: 1,
          },
          '& h2': {
            fontSize: '1.5em',
            fontWeight: 600,
            marginTop: 1.5,
            marginBottom: 0.75,
          },
          '& h3': {
            fontSize: '1.25em',
            fontWeight: 600,
            marginTop: 1.25,
            marginBottom: 0.5,
          },
          '& p': {
            marginBottom: 0,
            marginTop: 0,
          },
          '& ul, & ol': {
            paddingLeft: 2,
            marginBottom: 1,
          },
          // Inline code (not in code blocks)
          '& code': {
            backgroundColor: 'action.hover',
            padding: '2px 4px',
            borderRadius: 0.5,
            fontSize: '0.9em',
          },
          // Code block styles with syntax highlighting (One Dark/One Light theme)
          ...getCodeBlockStyles(theme.palette.mode === 'dark'),
          '& blockquote': {
            borderLeft: '4px solid',
            borderColor: 'primary.main',
            paddingLeft: 2,
            marginLeft: 0,
            fontStyle: 'italic',
            color: 'text.secondary',
          },
          // Hashtag styling
          '& .hashtag': {
            color: theme.palette.primary.main,
            fontWeight: 500,
            cursor: 'pointer',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            },
          },
          // Date chip styling (YYYY-MM-DD dates)
          // Uses normal text color but with chip background
          '& .date-chip': {
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
            color: theme.palette.text.primary,
            padding: '2px 6px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'background-color 0.15s ease',
            '&:hover': {
              backgroundColor:
                theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
            },
          },
          // Mention chip styling (user @mentions)
          '& .mention-chip': {
            backgroundColor:
              theme.palette.mode === 'dark'
                ? 'rgba(144, 202, 249, 0.16)'
                : 'rgba(25, 118, 210, 0.08)',
            color: theme.palette.text.primary,
            padding: '2px 6px',
            borderRadius: '4px',
            cursor: 'pointer',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            transition: 'background-color 0.15s ease',
            '&:hover': {
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? 'rgba(144, 202, 249, 0.24)'
                  : 'rgba(25, 118, 210, 0.16)',
            },
            // Hide the handle prefix, show only display name
            '& .mention-handle-hidden': {
              display: 'none',
            },
          },
          // Comment highlight styling
          '& .comment-highlight': {
            backgroundColor:
              theme.palette.mode === 'dark'
                ? 'rgba(255, 213, 79, 0.25)'
                : 'rgba(255, 213, 79, 0.4)',
            borderBottom: `2px solid ${theme.palette.warning.main}`,
            cursor: 'pointer',
            transition: 'background-color 0.2s ease',
            '&:hover': {
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? 'rgba(255, 213, 79, 0.35)'
                  : 'rgba(255, 213, 79, 0.5)',
            },
            // Active/selected comment
            '&.comment-active': {
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? 'rgba(255, 213, 79, 0.45)'
                  : 'rgba(255, 213, 79, 0.6)',
            },
            // Overlapping comments - nested highlights get progressively darker
            '& .comment-highlight': {
              backgroundColor:
                theme.palette.mode === 'dark'
                  ? 'rgba(255, 193, 7, 0.35)'
                  : 'rgba(255, 193, 7, 0.5)',
              // Third level overlap (rare but possible)
              '& .comment-highlight': {
                backgroundColor:
                  theme.palette.mode === 'dark'
                    ? 'rgba(255, 160, 0, 0.45)'
                    : 'rgba(255, 160, 0, 0.6)',
              },
            },
          },
          // Inter-note link styling (complementary to tags - use secondary color)
          '& .inter-note-link': {
            color: theme.palette.secondary.main,
            fontWeight: 500,
            cursor: 'pointer',
            textDecoration: 'none',
            borderBottom: `1px dotted ${theme.palette.secondary.main}`,
            '&:hover': {
              textDecoration: 'underline',
              borderBottomStyle: 'solid',
            },
          },
          // Broken inter-note link styling (note doesn't exist or is deleted)
          '& .inter-note-link-broken': {
            color: theme.palette.error.main,
            fontWeight: 500,
            cursor: 'not-allowed',
            textDecoration: 'line-through',
            borderBottom: `1px dotted ${theme.palette.error.main}`,
          },
          // Hide the original [[note-id]] text when displaying title
          '& .inter-note-link-hidden': {
            display: 'none',
          },
          // Web link styling (external http/https links)
          // Blue and underlined to distinguish from internal links (which are dotted)
          '& a.web-link': {
            color: theme.palette.info.main,
            textDecoration: 'underline',
            cursor: 'pointer',
            '&:hover': {
              color: theme.palette.info.dark,
              textDecoration: 'underline',
            },
            '&:visited': {
              color: theme.palette.info.main,
            },
          },
          // NotecoveImage styling - all images are block-level and centered
          '& figure.notecove-image': {
            margin: '16px 0',
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            width: '100%',
            // Selected state
            '&.ProseMirror-selectednode': {
              outline: `2px solid ${theme.palette.primary.main}`,
              outlineOffset: '4px',
              borderRadius: '4px',
            },
          },
          '& .notecove-image-container': {
            position: 'relative',
            display: 'inline-flex',
            justifyContent: 'center',
            alignItems: 'center',
            minHeight: '100px',
            minWidth: '100px',
            backgroundColor: theme.palette.action.hover,
            borderRadius: '4px',
            overflow: 'hidden',
          },
          '& .notecove-image-element': {
            maxWidth: '100%',
            height: 'auto',
            display: 'block',
            borderRadius: '4px',
          },
          '& .notecove-image-loading': {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '24px',
            color: theme.palette.text.secondary,
            fontSize: '0.875rem',
          },
          '& .notecove-image-spinner': {
            width: '24px',
            height: '24px',
            animation: 'notecove-spin 1s linear infinite',
          },
          '& .notecove-spinner-circle': {
            stroke: theme.palette.primary.main,
            strokeLinecap: 'round',
            strokeDasharray: '50 50',
          },
          '@keyframes notecove-spin': {
            from: { transform: 'rotate(0deg)' },
            to: { transform: 'rotate(360deg)' },
          },
          '& .notecove-image-error': {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '24px',
            color: theme.palette.error.main,
            fontSize: '0.875rem',
          },
          '& .notecove-image-broken': {
            width: '32px',
            height: '32px',
            color: theme.palette.error.main,
          },
          '& .notecove-image-error-id': {
            fontSize: '0.75rem',
            fontFamily: 'monospace',
            color: theme.palette.text.disabled,
            marginTop: '4px',
          },
          '& .notecove-image-caption': {
            marginTop: '8px',
            fontSize: '0.875rem',
            color: theme.palette.text.secondary,
            fontStyle: 'italic',
            textAlign: 'center',
            maxWidth: '100%',
          },
          // Dev-mode tooltip (only visible in development)
          '& .notecove-image-dev-tooltip': {
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            padding: '8px 12px',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#fff',
            fontSize: '11px',
            fontFamily: 'monospace',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            pointerEvents: 'none',
            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
          },
          '& .notecove-dev-tooltip-row': {
            padding: '2px 0',
            '& strong': {
              color: '#8be9fd',
              marginRight: '8px',
            },
          },
          // Resize handles container - only visible when image is selected
          '& .notecove-image-resize-handles': {
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            pointerEvents: 'none',
            opacity: 0,
            transition: 'opacity 0.15s ease',
          },
          // Show resize handles when image is selected
          '& figure.notecove-image.ProseMirror-selectednode .notecove-image-resize-handles': {
            opacity: 1,
          },
          // Individual resize handle
          '& .notecove-image-resize-handle': {
            position: 'absolute',
            width: '12px',
            height: '12px',
            backgroundColor: theme.palette.primary.main,
            border: `2px solid ${theme.palette.background.paper}`,
            borderRadius: '2px',
            pointerEvents: 'auto',
            boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
            transition: 'transform 0.1s ease',
            '&:hover': {
              transform: 'scale(1.2)',
            },
          },
          // Corner positions
          '& .notecove-image-resize-handle--nw': {
            top: '-6px',
            left: '-6px',
            cursor: 'nw-resize',
          },
          '& .notecove-image-resize-handle--ne': {
            top: '-6px',
            right: '-6px',
            cursor: 'ne-resize',
          },
          '& .notecove-image-resize-handle--sw': {
            bottom: '-6px',
            left: '-6px',
            cursor: 'sw-resize',
          },
          '& .notecove-image-resize-handle--se': {
            bottom: '-6px',
            right: '-6px',
            cursor: 'se-resize',
          },
          // Resize dimension tooltip
          '& .notecove-image-resize-tooltip': {
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            marginBottom: '8px',
            padding: '4px 8px',
            backgroundColor: 'rgba(0, 0, 0, 0.85)',
            color: '#fff',
            fontSize: '12px',
            fontFamily: 'monospace',
            borderRadius: '4px',
            whiteSpace: 'nowrap',
            zIndex: 1001,
            pointerEvents: 'none',
          },
          // Resizing state - show cursor and prevent selection
          '& figure.notecove-image--resizing': {
            userSelect: 'none',
            cursor: 'nw-resize',
            '& *': {
              cursor: 'inherit',
            },
          },
          // Linked image indicator - subtle border and link icon
          '& figure.notecove-image--linked': {
            '& .notecove-image-container': {
              position: 'relative',
              '&::after': {
                content: '"\\1F517"', // Link emoji
                position: 'absolute',
                top: '8px',
                right: '8px',
                fontSize: '16px',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                borderRadius: '4px',
                padding: '2px 6px',
                opacity: 0.8,
                pointerEvents: 'none',
              },
            },
            '& .notecove-image-element': {
              outline: `2px solid ${theme.palette.info.main}`,
              outlineOffset: '-2px',
            },
          },
          // Table styling
          '& table': {
            borderCollapse: 'collapse',
            width: '100%',
            margin: '16px 0',
            tableLayout: 'fixed',
            overflow: 'hidden',
            borderRadius: '4px',
            border: `1px solid ${theme.palette.divider}`,
          },
          '& table td, & table th': {
            border: `1px solid ${theme.palette.divider}`,
            padding: '8px 12px',
            textAlign: 'left',
            verticalAlign: 'top',
            position: 'relative',
            minWidth: '50px',
            boxSizing: 'border-box',
            '& > p': {
              margin: 0,
            },
          },
          '& table th': {
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
            fontWeight: 600,
          },
          '& table tr:hover': {
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
          },
          // Selected cell styling
          '& table .selectedCell': {
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(25, 118, 210, 0.2)' : 'rgba(25, 118, 210, 0.1)',
          },
          '& table .selectedCell::after': {
            content: '""',
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            border: `2px solid ${theme.palette.primary.main}`,
            pointerEvents: 'none',
          },
          // Column resize handle styling
          '& .column-resize-handle': {
            position: 'absolute',
            right: '-2px',
            top: 0,
            bottom: 0,
            width: '4px',
            backgroundColor: theme.palette.primary.main,
            cursor: 'col-resize',
            zIndex: 20,
          },
          // Table selected state
          '& table.ProseMirror-selectednode': {
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '2px',
          },
          // Resize cursor when dragging
          '&.resize-cursor': {
            cursor: 'col-resize',
          },
          // Search result highlighting
          '& .search-result': {
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(255, 235, 59, 0.3)' : 'rgba(255, 235, 59, 0.5)',
            borderRadius: '2px',
          },
          '& .search-result-current': {
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(255, 152, 0, 0.5)' : 'rgba(255, 152, 0, 0.7)',
            outline: `2px solid ${theme.palette.primary.main}`,
            outlineOffset: '1px',
          },
          // Task item styling (list-based checkboxes)
          // The checkbox is positioned to the left of content
          // Content aligns with body text (task item pulls back to cancel list indentation)
          '& li[data-type="taskItem"]': {
            display: 'flex',
            alignItems: 'flex-start',
            listStyle: 'none',
            position: 'relative',
            // Pull back to cancel list padding, so content aligns with body text
            // Lists have paddingLeft: 2 (16px), so we offset by -16px
            marginLeft: -2, // MUI spacing: -16px
            // Add padding on left for the checkbox
            paddingLeft: '28px', // 18px checkbox + 10px gap

            // Checkbox wrapper - positioned absolutely in the padding area
            '& .task-checkbox-wrapper': {
              position: 'absolute',
              left: 0,
              top: '2px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              userSelect: 'none',
            },

            // Checkbox element
            '& .task-checkbox': {
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '18px',
              height: '18px',
              border: `2px solid ${theme.palette.text.secondary}`,
              borderRadius: '3px',
              fontSize: '12px',
              fontWeight: 700,
              lineHeight: 1,
              transition: 'all 0.15s ease',
            },

            // Task content area
            '& .task-content': {
              flex: 1,
              minWidth: 0,
            },

            // Unchecked state - empty checkbox
            '&[data-checked="unchecked"]': {
              '& .task-checkbox': {
                backgroundColor: 'transparent',
              },
              '& .task-content': {
                textDecoration: 'none',
                opacity: 1,
              },
            },

            // Checked state - green checkbox with checkmark, strikethrough text
            '&[data-checked="checked"]': {
              '& .task-checkbox': {
                backgroundColor: theme.palette.success.main,
                borderColor: theme.palette.success.main,
                color: '#ffffff',
              },
              '& .task-content': {
                textDecoration: 'line-through',
                opacity: 0.6,
                color: theme.palette.text.secondary,
              },
            },

            // Nope state - red checkbox with X, strikethrough text
            '&[data-checked="nope"]': {
              '& .task-checkbox': {
                backgroundColor: theme.palette.error.main,
                borderColor: theme.palette.error.main,
                color: '#ffffff',
              },
              '& .task-content': {
                textDecoration: 'line-through',
                opacity: 0.6,
                color: theme.palette.text.secondary,
              },
            },
          },
        },
      }}
    >
      <EditorToolbar
        editor={editor}
        onLinkButtonClick={handleLinkButtonClick}
        onImageButtonClick={() => void handleImageButtonClick()}
        onTableButtonClick={handleTableButtonClick}
        onCommentButtonClick={handleCommentButtonClick}
        {...(onViewComments && { onViewCommentsClick: onViewComments })}
        hasTextSelection={hasTextSelection}
        commentCount={openCommentCount}
      />
      {/* Sync indicator - shows briefly when external updates arrive */}
      <Fade in={showSyncIndicator}>
        <Chip
          icon={<SyncIcon sx={{ fontSize: '0.9rem' }} />}
          label="Synced"
          size="small"
          color="primary"
          variant="outlined"
          sx={{
            position: 'absolute',
            top: 48, // Below toolbar
            right: 8,
            zIndex: 10,
            fontSize: '0.75rem',
            height: 24,
          }}
        />
      </Fade>
      {/* Loading overlay - shows spinner while note is loading */}
      <Fade in={isLoading}>
        <Box
          sx={{
            position: 'absolute',
            top: 48, // Below toolbar
            left: 0,
            right: 0,
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor:
              theme.palette.mode === 'dark' ? 'rgba(0, 0, 0, 0.7)' : 'rgba(255, 255, 255, 0.8)',
            zIndex: 5,
          }}
        >
          <CircularProgress size={40} />
        </Box>
      </Fade>
      <Box
        ref={editorContainerRef}
        sx={{ flex: 1, overflow: 'auto', padding: 2, cursor: isLoading ? 'wait' : 'text' }}
        onClick={(e) => {
          // Only handle clicks on the Box itself (empty space), not on the editor content
          // Don't allow focus while loading
          if (e.target === e.currentTarget && editor && !isLoading) {
            // Focus the editor and move cursor to the end
            editor.commands.focus('end');
          }
        }}
        onContextMenu={handleContextMenu}
      >
        <EditorContent editor={editor} />
      </Box>
      {showSearchPanel && onSearchPanelClose && onSearchTermChange && (
        <SearchPanel
          editor={editor}
          onClose={onSearchPanelClose}
          searchTerm={searchTerm}
          onSearchTermChange={onSearchTermChange}
        />
      )}
      {/* Image lightbox - renders via portal */}
      <ImageLightbox />
      {/* Image context menu */}
      <ImageContextMenu />
      {/* Table size picker dialog */}
      <TableSizePickerDialog
        open={Boolean(tableSizePickerAnchor)}
        anchorEl={tableSizePickerAnchor}
        onClose={() => {
          setTableSizePickerAnchor(null);
        }}
        onSelect={handleTableSizeSelect}
      />
      {/* Date picker dialog for editing dates */}
      <DatePickerDialog
        open={datePickerState.open}
        anchorEl={datePickerState.anchorEl}
        initialDate={datePickerState.initialDate}
        onSelect={handleDateSelect}
        onClose={handleDatePickerClose}
      />
      {/* Mention popover for user mentions */}
      {mentionPopoverState.open && mentionPopoverState.anchorEl && mentionPopoverState.attrs && (
        <Popper
          open
          anchorEl={mentionPopoverState.anchorEl}
          placement="bottom-start"
          style={{ zIndex: 1400 }}
        >
          <ClickAwayListener onClickAway={handleMentionPopoverClose}>
            <Box>
              <MentionPopover
                profileId={mentionPopoverState.attrs.profileId}
                handle={mentionPopoverState.attrs.handle}
                displayName={mentionPopoverState.attrs.displayName}
                onSearchMentions={handleSearchMentions}
                onClose={handleMentionPopoverClose}
              />
            </Box>
          </ClickAwayListener>
        </Popper>
      )}
      {/* Overlapping comments selection popover */}
      {overlapPopover && (
        <Popper
          open
          anchorEl={overlapPopover.anchorEl}
          placement="bottom-start"
          style={{ zIndex: 1400 }}
        >
          <ClickAwayListener
            onClickAway={() => {
              setOverlapPopover(null);
            }}
          >
            <Paper elevation={8} sx={{ minWidth: 180 }}>
              <Typography
                variant="caption"
                sx={{ px: 1.5, py: 0.75, display: 'block', color: 'text.secondary' }}
              >
                Select a comment:
              </Typography>
              <Divider />
              <List dense sx={{ py: 0.5 }}>
                {overlapPopover.threadIds.map((threadId, index) => (
                  <ListItemButton
                    key={threadId}
                    onClick={() => {
                      onCommentClick?.(threadId);
                      setOverlapPopover(null);
                    }}
                    sx={{ py: 0.5 }}
                  >
                    <ListItemText
                      primary={`Comment ${index + 1}`}
                      secondary={`Thread: ${threadId.slice(0, 8)}...`}
                      primaryTypographyProps={{ variant: 'body2' }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                  </ListItemButton>
                ))}
              </List>
            </Paper>
          </ClickAwayListener>
        </Popper>
      )}
      {/* Editor context menu */}
      {contextMenu !== null && (
        <Menu
          open
          onClose={handleContextMenuClose}
          anchorReference="anchorPosition"
          anchorPosition={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <MenuItem
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-deprecated
              document.execCommand('cut');
              handleContextMenuClose();
            }}
          >
            Cut
          </MenuItem>
          <MenuItem
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-deprecated
              document.execCommand('copy');
              handleContextMenuClose();
            }}
          >
            Copy
          </MenuItem>
          <MenuItem
            onClick={() => {
              // eslint-disable-next-line @typescript-eslint/no-deprecated
              document.execCommand('paste');
              handleContextMenuClose();
            }}
          >
            Paste
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              handleContextMenuClose();
              void handleAddCommentOnSelection();
            }}
            disabled={!hasTextSelection}
          >
            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>Add Comment</span>
              <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                ⌘⌥M
              </Typography>
            </Box>
          </MenuItem>
        </Menu>
      )}
    </Box>
  );
};

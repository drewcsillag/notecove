/**
 * TipTap Editor Component
 *
 * Rich text editor using TipTap with Yjs collaboration support.
 * Syncs with main process CRDT via IPC.
 */

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access */

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
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
import { DOMSerializer } from '@tiptap/pm/model';
import { EditorToolbar } from './EditorToolbar';
import { type MentionNodeAttributes } from './extensions/MentionNode';
import { DatePickerDialog } from './DatePickerDialog';
import { MentionPopover } from './MentionPopover';
// clearNoteTitleCache and prefetchNoteTitles are used by useNoteSync
import { setWebLinkCallbacks } from './extensions/WebLink';
import { getTipTapEditorStyles } from './tipTapEditorStyles';
import { getEditorExtensions, type EditorExtensionCallbacks } from './getEditorExtensions';
import { useNoteSync, type UseNoteSyncRefs, type UseNoteSyncState } from './useNoteSync';
import { useEditorStateRestoration } from './useEditorStateRestoration';
import { useEditorImages } from './useEditorImages';
import { useEditorComments, type CommentCallbacks } from './useEditorComments';
import { ImageLightbox } from './ImageLightbox';
import { ImageContextMenu } from './ImageContextMenu';
import { TableSizePickerDialog } from './TableSizePickerDialog';
import { SearchPanel } from './SearchPanel';
import { LinkPopover } from './LinkPopover';
import { LinkInputPopover } from './LinkInputPopover';
import { TextAndUrlInputPopover } from './TextAndUrlInputPopover';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
// useWindowState and useNoteScrollPosition are used by useEditorStateRestoration
import { detectUrlFromSelection } from '@notecove/shared';
import { sanitizeClipboardHtml } from '../../utils/clipboard-sanitizer';

// MIME type helpers are in useEditorImages.ts

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
  // Track whether text is selected (for enabling comment button)
  const [hasTextSelection, setHasTextSelection] = useState(false);
  // Current user profile for comment authorship (loaded via effect, passed to useEditorComments)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const syncIndicatorTimerRef = useRef<NodeJS.Timeout | null>(null);
  // Loading state - start with loading=true to prevent title extraction before note loads
  // Use both state (for rendering) and ref (for callbacks that need synchronous access)
  const [isLoading, setIsLoading] = useState(true);
  const isLoadingRef = useRef(true);
  const noteIdRef = useRef<string | null>(noteId);
  // Track which note has been successfully loaded to skip redundant loads
  const loadedNoteIdRef = useRef<string | null>(null);
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

  // Context menu state - includes selection bounds for clipboard operations
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    from: number;
    to: number;
  } | null>(null);

  // Note: overlapPopover state is owned by useEditorComments

  // Ref to store the Cmd+K handler (updated when editor is available)
  const handleCmdKRef = useRef<((element: HTMLElement) => void) | null>(null);

  // Ref for the scrollable editor container (for scroll position tracking)
  const editorContainerRef = useRef<HTMLDivElement | null>(null);

  // Note: Window state and scroll position persistence are handled by useEditorStateRestoration

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

  // Memoize extension callbacks to prevent recreation on every render
  const extensionCallbacks = useMemo<EditorExtensionCallbacks>(
    () => ({
      onMentionClick: (attrs: MentionNodeAttributes, element: HTMLElement) => {
        console.log('[MentionNode] Clicked mention:', attrs);
        setMentionPopoverState({
          open: true,
          anchorEl: element,
          attrs,
        });
      },
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
      onCommentClick: (threadId: string) => {
        onCommentClick?.(threadId);
      },
    }),
    [onNavigateToNote, onCommentClick]
  );

  // Get configured extensions using the callbacks
  const extensions = useMemo(
    () => getEditorExtensions(yDoc, extensionCallbacks),
    [yDoc, extensionCallbacks]
  );

  const editor = useEditor({
    extensions,
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

  // Create refs and state objects for useNoteSync
  const noteSyncRefs: UseNoteSyncRefs = useMemo(
    () => ({
      isLoadingRef,
      loadedNoteIdRef,
      updateHandlerRef,
      pendingUpdatesRef,
      syncIndicatorTimerRef,
      shouldFocusAfterLoadRef,
      focusAttemptedRef,
    }),
    [] // Refs are stable, so empty deps is fine
  );

  const noteSyncState: UseNoteSyncState = useMemo(
    () => ({ isLoading, setIsLoading }),
    [isLoading]
  );

  // Use the note sync hook for loading, updating, and syncing notes
  const noteSyncOptions = useMemo(
    () => ({
      isNewlyCreated,
      readOnly,
      ...(onNoteLoaded && { onNoteLoaded }),
    }),
    [isNewlyCreated, readOnly, onNoteLoaded]
  );
  const { showSyncIndicator } = useNoteSync(
    noteId,
    editor,
    yDoc,
    noteSyncRefs,
    noteSyncState,
    noteSyncOptions
  );

  // Handle scroll/cursor state restoration and persistence
  useEditorStateRestoration(noteId, editor, isLoading, editorContainerRef);

  // Handle image drag-and-drop and keyboard shortcuts
  useEditorImages(editor, editorContainerRef);

  // Handle comment interactions
  const commentCallbacks: CommentCallbacks = useMemo(
    () => ({
      ...(onCommentClick && { onCommentClick }),
      ...(onAddComment && { onAddComment }),
    }),
    [onCommentClick, onAddComment]
  );
  const { openCommentCount, overlapPopover, closeOverlapPopover, handleCommentButtonClick } =
    useEditorComments(noteId, editor, userProfile, commentCallbacks);

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

  // Note: Yjs updates, note loading/unloading, and focus-after-load are handled by useNoteSync
  // Note: Scroll/cursor state restoration and persistence are handled by useEditorStateRestoration
  // Note: Image drag-and-drop and keyboard shortcuts are handled by useEditorImages
  // Note: Comment handling is handled by useEditorComments

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
   * Captures selection bounds for clipboard operations since focus is lost when menu opens
   */
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    // Capture selection bounds - needed because editor loses focus when menu opens
    const { from, to } = editor?.state.selection ?? { from: 0, to: 0 };
    setContextMenu({ x: e.clientX, y: e.clientY, from, to });
  };

  /**
   * Serialize a selection range to HTML and plain text for clipboard operations
   */
  const serializeSelectionToClipboard = (
    from: number,
    to: number
  ): { html: string; plainText: string } => {
    if (!editor) return { html: '', plainText: '' };

    const slice = editor.state.doc.slice(from, to);
    const fragment = DOMSerializer.fromSchema(editor.schema).serializeFragment(slice.content);
    const div = document.createElement('div');
    div.appendChild(fragment);
    const html = div.innerHTML;
    const plainText = editor.state.doc.textBetween(from, to);
    return { html, plainText };
  };

  /**
   * Write content to clipboard with both HTML and plain text formats
   */
  const writeToClipboard = async (html: string, plainText: string): Promise<void> => {
    await navigator.clipboard.write([
      new ClipboardItem({
        'text/html': new Blob([html], { type: 'text/html' }),
        'text/plain': new Blob([plainText], { type: 'text/plain' }),
      }),
    ]);
  };

  /**
   * Helper to read blob as text (for clipboard reading)
   */
  const readBlobAsText = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        resolve(reader.result as string);
      };
      reader.onerror = () => {
        reject(new Error(reader.error?.message ?? 'Failed to read blob'));
      };
      reader.readAsText(blob);
    });
  };

  /**
   * Handle context menu Cut operation
   */
  const handleContextMenuCut = async () => {
    if (!editor || !contextMenu) return;

    const { from, to } = contextMenu;
    if (from === to) {
      // Nothing selected
      handleContextMenuClose();
      return;
    }

    try {
      const { html, plainText } = serializeSelectionToClipboard(from, to);
      await writeToClipboard(html, plainText);
      // Focus editor, restore selection, and delete
      editor.chain().focus().setTextSelection({ from, to }).deleteSelection().run();
      console.log('[TipTapEditor] Cut operation completed');
    } catch (err) {
      console.error('[TipTapEditor] Cut failed:', err);
    }

    handleContextMenuClose();
  };

  /**
   * Handle context menu Copy operation
   */
  const handleContextMenuCopy = async () => {
    if (!editor || !contextMenu) return;

    const { from, to } = contextMenu;
    if (from === to) {
      // Nothing selected
      handleContextMenuClose();
      return;
    }

    try {
      const { html, plainText } = serializeSelectionToClipboard(from, to);
      await writeToClipboard(html, plainText);
      console.log('[TipTapEditor] Copy operation completed');
    } catch (err) {
      console.error('[TipTapEditor] Copy failed:', err);
    }

    handleContextMenuClose();
  };

  /**
   * Handle context menu Paste operation
   */
  const handleContextMenuPaste = async () => {
    if (!editor || !contextMenu) return;

    const { from, to } = contextMenu;

    try {
      const items = await navigator.clipboard.read();
      let pasted = false;

      for (const item of items) {
        if (item.types.includes('text/html')) {
          const blob = await item.getType('text/html');
          const rawHtml = await readBlobAsText(blob);
          // Sanitize HTML to remove <meta charset>, <style>, and other unwanted elements
          const html = sanitizeClipboardHtml(rawHtml);
          // Focus editor, set position (delete selection if any), and insert
          if (from !== to) {
            editor.chain().focus().setTextSelection({ from, to }).deleteSelection().run();
          }
          editor.chain().focus().setTextSelection(from).insertContent(html).run();
          pasted = true;
          break;
        }
      }

      if (!pasted) {
        // Fallback to plain text
        const text = await navigator.clipboard.readText();
        if (from !== to) {
          editor.chain().focus().setTextSelection({ from, to }).deleteSelection().run();
        }
        editor.chain().focus().setTextSelection(from).insertContent(text).run();
      }

      console.log('[TipTapEditor] Paste operation completed');
    } catch (err) {
      console.error('[TipTapEditor] Paste failed:', err);
      // Show toast notification for paste failures
      // TODO: Integrate with app's toast system when available
    }

    handleContextMenuClose();
  };

  /**
   * Handle context menu Paste Without Formatting operation
   * Pastes clipboard content as plain text, stripping all HTML formatting
   */
  const handleContextMenuPasteAsPlainText = async () => {
    if (!editor || !contextMenu) return;

    const { from, to } = contextMenu;

    try {
      const text = await navigator.clipboard.readText();
      // Focus editor, set position (delete selection if any), and insert
      if (from !== to) {
        editor.chain().focus().setTextSelection({ from, to }).deleteSelection().run();
      }
      editor.chain().focus().setTextSelection(from).insertContent(text).run();
      console.log('[TipTapEditor] Paste without formatting completed');
    } catch (err) {
      console.error('[TipTapEditor] Paste without formatting failed:', err);
    }

    handleContextMenuClose();
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
    <Box sx={getTipTapEditorStyles(theme)}>
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
          <ClickAwayListener onClickAway={closeOverlapPopover}>
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
                      closeOverlapPopover();
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
          <MenuItem onClick={() => void handleContextMenuCut()}>Cut</MenuItem>
          <MenuItem onClick={() => void handleContextMenuCopy()}>Copy</MenuItem>
          <MenuItem onClick={() => void handleContextMenuPaste()}>Paste</MenuItem>
          <MenuItem onClick={() => void handleContextMenuPasteAsPlainText()}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%' }}>
              <span>Paste without formatting</span>
              <Typography variant="caption" sx={{ ml: 2, color: 'text.secondary' }}>
                ⇧⌘V
              </Typography>
            </Box>
          </MenuItem>
          <Divider />
          <MenuItem
            onClick={() => {
              handleContextMenuClose();
              handleCommentButtonClick();
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

/**
 * Editor Link Popovers Hook
 *
 * Manages link-related popovers:
 * - LinkPopover: For viewing/editing/removing existing links
 * - LinkInputPopover: For adding URL to selected text
 * - TextAndUrlInputPopover: For creating new links with text and URL
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import type { Editor } from '@tiptap/react';
import { detectUrlFromSelection } from '@notecove/shared';
import { createFloatingPopup, type FloatingPopup } from './extensions/utils/floating-popup';
import { LinkPopover } from './LinkPopover';
import { LinkInputPopover } from './LinkInputPopover';
import { TextAndUrlInputPopover } from './TextAndUrlInputPopover';
import { getCurrentLinkDisplayPreference } from '../../contexts/LinkDisplayPreferenceContext';
import { detectLinkContext, countLinksInParagraph } from './utils/linkContext';

/**
 * State for the link view/edit popover (shown when clicking existing links)
 */
export interface LinkPopoverData {
  href: string;
  element: HTMLElement;
  from: number;
  to: number;
}

/**
 * State for the URL input popover (shown when adding link to selection)
 */
export interface LinkInputPopoverData {
  element: HTMLElement;
  selectionFrom: number;
  selectionTo: number;
  initialUrl?: string;
}

/**
 * State for the text+URL input popover (shown when creating link without selection)
 */
export interface TextAndUrlPopoverData {
  element: HTMLElement;
  insertPosition: number;
}

/**
 * Return value from the useEditorLinkPopovers hook
 */
export interface UseEditorLinkPopoversReturn {
  /** Set link popover data (used by WebLink extension callbacks) */
  setLinkPopoverData: React.Dispatch<React.SetStateAction<LinkPopoverData | null>>;
  /** Ref to the Cmd+K handler (used by WebLink extension callbacks) */
  handleCmdKRef: React.MutableRefObject<((element: HTMLElement) => void) | null>;
  /** Handler for the link toolbar button */
  handleLinkButtonClick: (buttonElement: HTMLElement) => void;
}

/**
 * Hook to manage link-related popovers in the editor.
 *
 * Manages:
 * - LinkPopover for viewing/editing existing links (via Floating UI)
 * - LinkInputPopover for adding URL to selected text
 * - TextAndUrlInputPopover for creating new links
 * - Keyboard shortcut (Cmd+K) via ref pattern
 *
 * @param editor - TipTap editor instance
 * @returns Link popover state and handlers
 */
export function useEditorLinkPopovers(editor: Editor | null): UseEditorLinkPopoversReturn {
  // Link popover state (for viewing/editing existing links)
  const [linkPopoverData, setLinkPopoverData] = useState<LinkPopoverData | null>(null);
  const linkPopoverRef = useRef<FloatingPopup | null>(null);

  // Link input popover state (for creating new links with selection)
  const [linkInputPopoverData, setLinkInputPopoverData] = useState<LinkInputPopoverData | null>(
    null
  );
  const linkInputPopoverRef = useRef<FloatingPopup | null>(null);

  // Text+URL input popover state (for creating new links without selection)
  const [textAndUrlPopoverData, setTextAndUrlPopoverData] = useState<TextAndUrlPopoverData | null>(
    null
  );
  const textAndUrlPopoverRef = useRef<FloatingPopup | null>(null);

  // Ref to store the Cmd+K handler (updated when editor is available)
  const handleCmdKRef = useRef<((element: HTMLElement) => void) | null>(null);

  // Manage link popover using Floating UI
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

    // Capture current values for use in callbacks
    const { href, from, to, element } = linkPopoverData;

    // If editor is not available, don't render edit/remove options
    if (!editor) {
      return;
    }
    const currentEditor = editor;

    // Create close handler
    const closePopover = (): void => {
      linkPopoverRef.current?.destroy();
      linkPopoverRef.current = null;
      setLinkPopoverData(null);
    };

    // Create the popover using Floating UI
    const popup = createFloatingPopup({
      getReferenceClientRect: () => element.getBoundingClientRect(),
      content: container,
      onClickOutside: closePopover,
    });
    linkPopoverRef.current = popup;

    // Check if we should show convert buttons (not in secure mode)
    const globalPreference = getCurrentLinkDisplayPreference();
    const showConvertButtons = globalPreference !== 'secure';

    // Render the React component into the container
    void import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(container);
      root.render(
        <LinkPopover
          href={href}
          onClose={closePopover}
          onEdit={(newHref: string) => {
            console.log('[useEditorLinkPopovers] Editing link, new href:', newHref);
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
            console.log('[useEditorLinkPopovers] Removing link at:', from, '-', to);
            // Select the link range and remove the link mark
            currentEditor
              .chain()
              .focus()
              .setTextSelection({ from, to })
              .extendMarkRange('link')
              .unsetLink()
              .run();
          }}
          showConvertButtons={showConvertButtons}
          onConvertToChip={() => {
            console.log('[useEditorLinkPopovers] Converting to chip:', from, '-', to);
            // Update the link mark's displayMode to 'chip'
            // We need to use the ProseMirror API directly since TipTap's setLink
            // doesn't know about our custom displayMode attribute
            const { state, dispatch } = currentEditor.view;
            const linkMarkType = state.schema.marks['link'];
            if (!linkMarkType) return;

            // Create a new mark with displayMode: 'chip'
            const newMark = linkMarkType.create({ href, displayMode: 'chip' });

            // Remove old link mark and add new one
            let tr = state.tr;
            tr = tr.removeMark(from, to, linkMarkType);
            tr = tr.addMark(from, to, newMark);
            dispatch(tr);
            currentEditor.commands.focus();
          }}
          onConvertToUnfurl={() => {
            console.log('[useEditorLinkPopovers] Converting to unfurl:', from, '-', to);
            const { state, dispatch } = currentEditor.view;
            const linkMarkType = state.schema.marks['link'];
            if (!linkMarkType) return;

            // Check context - only expand if in paragraph with single link
            const context = detectLinkContext(state, from);
            if (context !== 'paragraph') {
              console.log('[useEditorLinkPopovers] Not in paragraph, cannot convert to unfurl');
              return;
            }

            const linkCount = countLinksInParagraph(state, from);
            if (linkCount !== 1) {
              console.log(
                '[useEditorLinkPopovers] Multiple links in paragraph, cannot convert to unfurl'
              );
              return;
            }

            // Get paragraph end to insert unfurl block after it
            const $pos = state.doc.resolve(from);
            const paragraphEnd = $pos.end($pos.depth);

            let tr = state.tr;

            // Insert unfurl block after paragraph
            const unfurlType = state.schema.nodes['oembedUnfurl'];
            if (unfurlType) {
              const unfurlNode = unfurlType.create({
                url: href,
                isLoading: true,
              });
              tr = tr.insert(paragraphEnd + 1, unfurlNode);
            }

            // Update the link mark's displayMode to 'unfurl'
            const newMark = linkMarkType.create({ href, displayMode: 'unfurl' });
            tr = tr.removeMark(from, to, linkMarkType);
            tr = tr.addMark(from, to, newMark);

            dispatch(tr);
            currentEditor.commands.focus();
          }}
        />
      );
    });

    // Cleanup on unmount
    return () => {
      if (linkPopoverRef.current) {
        linkPopoverRef.current.destroy();
        linkPopoverRef.current = null;
      }
    };
  }, [linkPopoverData, editor]);

  // Manage link input popover (for creating new links with selection)
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

    // Create close handler
    const closePopover = (): void => {
      linkInputPopoverRef.current?.destroy();
      linkInputPopoverRef.current = null;
      setLinkInputPopoverData(null);
    };

    // Create the popover using Floating UI
    const popup = createFloatingPopup({
      getReferenceClientRect: () => element.getBoundingClientRect(),
      content: container,
      onClickOutside: closePopover,
    });
    linkInputPopoverRef.current = popup;

    // Render the React component into the container
    void import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(container);
      root.render(
        <LinkInputPopover
          {...(initialUrl ? { initialUrl } : {})}
          onSubmit={(url: string) => {
            console.log('[useEditorLinkPopovers] Creating link with URL:', url);
            // Select the original selection and apply link
            editor
              .chain()
              .focus()
              .setTextSelection({ from: selectionFrom, to: selectionTo })
              .setLink({ href: url })
              .run();
            closePopover();
          }}
          onCancel={closePopover}
        />
      );
    });

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

    // Create close handler
    const closePopover = (): void => {
      textAndUrlPopoverRef.current?.destroy();
      textAndUrlPopoverRef.current = null;
      setTextAndUrlPopoverData(null);
    };

    // Create the popover using Floating UI
    const popup = createFloatingPopup({
      getReferenceClientRect: () => element.getBoundingClientRect(),
      content: container,
      onClickOutside: closePopover,
    });
    textAndUrlPopoverRef.current = popup;

    // Render the React component into the container
    void import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(container);
      root.render(
        <TextAndUrlInputPopover
          onSubmit={(text: string, url: string) => {
            console.log('[useEditorLinkPopovers] Creating link with text and URL:', { text, url });
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
            closePopover();
          }}
          onCancel={closePopover}
        />
      );
    });

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
   * - No selection: show text+URL dialog
   */
  const handleLinkButtonClick = useCallback(
    (buttonElement: HTMLElement) => {
      if (!editor) return;

      // Check if cursor is in an existing link
      if (editor.isActive('link')) {
        // Get link mark attributes
        const { href } = editor.getAttributes('link') as { href: string };
        const { from, to } = editor.state.selection;

        console.log('[useEditorLinkPopovers] Link button clicked while in link:', href);

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
          '[useEditorLinkPopovers] Link button clicked with selection:',
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
      console.log(
        '[useEditorLinkPopovers] Link button clicked with no selection, showing text+URL dialog'
      );
      setTextAndUrlPopoverData({
        element: buttonElement,
        insertPosition: from,
      });
    },
    [editor]
  );

  /**
   * Handle Cmd+K keyboard shortcut
   * Similar to handleLinkButtonClick but triggered from keyboard
   */
  const handleCmdK = useCallback(
    (anchorElement: HTMLElement) => {
      if (!editor) return;

      // Check if cursor is in an existing link
      if (editor.isActive('link')) {
        const { href } = editor.getAttributes('link') as { href: string };
        const { from, to } = editor.state.selection;

        console.log('[useEditorLinkPopovers] Cmd+K pressed while in link:', href);

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
          '[useEditorLinkPopovers] Cmd+K pressed with selection:',
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
      console.log(
        '[useEditorLinkPopovers] Cmd+K pressed with no selection, showing text+URL dialog'
      );
      setTextAndUrlPopoverData({
        element: anchorElement,
        insertPosition: from,
      });
    },
    [editor]
  );

  // Update handleCmdKRef when editor is available
  useEffect(() => {
    if (editor) {
      handleCmdKRef.current = handleCmdK;
    }
    return () => {
      handleCmdKRef.current = null;
    };
  }, [editor, handleCmdK]);

  return {
    setLinkPopoverData,
    handleCmdKRef,
    handleLinkButtonClick,
  };
}

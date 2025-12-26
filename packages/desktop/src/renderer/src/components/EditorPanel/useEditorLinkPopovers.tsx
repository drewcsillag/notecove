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
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import { detectUrlFromSelection } from '@notecove/shared';
import { LinkPopover } from './LinkPopover';
import { LinkInputPopover } from './LinkInputPopover';
import { TextAndUrlInputPopover } from './TextAndUrlInputPopover';

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
 * - LinkPopover for viewing/editing existing links (via tippy.js)
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
  const linkPopoverRef = useRef<TippyInstance | null>(null);

  // Link input popover state (for creating new links with selection)
  const [linkInputPopoverData, setLinkInputPopoverData] = useState<LinkInputPopoverData | null>(
    null
  );
  const linkInputPopoverRef = useRef<TippyInstance | null>(null);

  // Text+URL input popover state (for creating new links without selection)
  const [textAndUrlPopoverData, setTextAndUrlPopoverData] = useState<TextAndUrlPopoverData | null>(
    null
  );
  const textAndUrlPopoverRef = useRef<TippyInstance | null>(null);

  // Ref to store the Cmd+K handler (updated when editor is available)
  const handleCmdKRef = useRef<((element: HTMLElement) => void) | null>(null);

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
    const { href, from, to } = linkPopoverData;

    // If editor is not available, don't render edit/remove options
    if (!editor) {
      return;
    }
    const currentEditor = editor;

    // Render the React component into the container
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
            console.log('[useEditorLinkPopovers] Creating link with URL:', url);
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

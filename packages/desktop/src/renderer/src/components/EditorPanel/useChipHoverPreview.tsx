/**
 * Chip Hover Preview Hook
 *
 * Manages the hover preview card for link chips.
 * Shows a preview card when hovering over a chip with delay logic.
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { createFloatingPopup, type FloatingPopup } from './extensions/utils/floating-popup';
import { LinkPreviewCard, type LinkPreviewData } from './LinkPreviewCard';

/**
 * Show delay before showing the preview (ms)
 */
const SHOW_DELAY_MS = 300;

/**
 * Hide grace period - how long to wait before hiding when mouse leaves (ms)
 * Needs to be long enough to bridge the gap between chip and popup
 */
const HIDE_GRACE_MS = 300;

/**
 * State for the hover preview
 */
interface ChipHoverState {
  url: string;
  element: HTMLElement;
  previewData?: LinkPreviewData;
  isLoading: boolean;
  error?: string;
}

/**
 * Custom event detail for chip hover events
 */
export interface ChipHoverEventDetail {
  url: string;
  element: HTMLElement;
}

/**
 * Event name for chip hover enter
 */
export const CHIP_HOVER_ENTER_EVENT = 'chip-hover-enter';

/**
 * Event name for chip hover leave
 */
export const CHIP_HOVER_LEAVE_EVENT = 'chip-hover-leave';

/**
 * Event name for expand chip to unfurl card
 */
export const CHIP_EXPAND_TO_CARD_EVENT = 'chip-expand-to-card';

/**
 * Event detail for expand to card event
 */
export interface ChipExpandToCardEventDetail {
  url: string;
}

/**
 * Dispatch a chip hover enter event
 */
export function dispatchChipHoverEnter(url: string, element: HTMLElement): void {
  const event = new CustomEvent<ChipHoverEventDetail>(CHIP_HOVER_ENTER_EVENT, {
    detail: { url, element },
    bubbles: true,
  });
  element.dispatchEvent(event);
}

/**
 * Dispatch a chip hover leave event
 */
export function dispatchChipHoverLeave(url: string, element: HTMLElement): void {
  const event = new CustomEvent<ChipHoverEventDetail>(CHIP_HOVER_LEAVE_EVENT, {
    detail: { url, element },
    bubbles: true,
  });
  element.dispatchEvent(event);
}

/**
 * Hook to manage chip hover previews
 */
export function useChipHoverPreview(): void {
  const [hoverState, setHoverState] = useState<ChipHoverState | null>(null);
  const popupRef = useRef<FloatingPopup | null>(null);
  const showTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  // Clear any pending timeouts
  const clearTimeouts = useCallback(() => {
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
      hideTimeoutRef.current = null;
    }
  }, []);

  // Fetch preview data for a URL
  const fetchPreviewData = useCallback(async (url: string): Promise<LinkPreviewData | null> => {
    try {
      const result = await window.electronAPI.oembed.unfurl(url);
      if (result.success && result.data) {
        // Only include defined values to avoid undefined in optional properties
        const data: LinkPreviewData = {};
        if (result.data.title) data.title = result.data.title;
        if (result.data.author_name) data.description = result.data.author_name;
        if (result.data.provider_name) data.providerName = result.data.provider_name;
        if (result.data.thumbnail_url) data.thumbnailUrl = result.data.thumbnail_url;
        return data;
      }
      return null;
    } catch (error) {
      console.warn('[ChipHoverPreview] Failed to fetch preview data:', error);
      return null;
    }
  }, []);

  // Handle hover enter
  const handleHoverEnter = useCallback(
    (event: Event) => {
      const customEvent = event as CustomEvent<ChipHoverEventDetail>;
      const { url, element } = customEvent.detail;

      // Clear any pending hide timeout
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }

      // If already showing this URL, do nothing
      if (currentUrlRef.current === url && popupRef.current) {
        return;
      }

      // If showing a different URL, close it first
      if (popupRef.current && currentUrlRef.current !== url) {
        popupRef.current.destroy();
        popupRef.current = null;
      }

      // Clear any pending show timeout
      if (showTimeoutRef.current) {
        clearTimeout(showTimeoutRef.current);
      }

      // Set timeout to show the preview
      showTimeoutRef.current = setTimeout(() => {
        currentUrlRef.current = url;
        setHoverState({
          url,
          element,
          isLoading: true,
        });

        // Fetch preview data
        void fetchPreviewData(url).then((previewData) => {
          setHoverState((prev) => {
            if (prev?.url !== url) return prev;
            // Use spread to conditionally include previewData
            return {
              ...prev,
              ...(previewData ? { previewData } : {}),
              isLoading: false,
            };
          });
        });
      }, SHOW_DELAY_MS);
    },
    [fetchPreviewData]
  );

  // Handle hover leave
  const handleHoverLeave = useCallback((_event: Event) => {
    // Clear any pending show timeout
    if (showTimeoutRef.current) {
      clearTimeout(showTimeoutRef.current);
      showTimeoutRef.current = null;
    }

    // Set timeout to hide with grace period
    hideTimeoutRef.current = setTimeout(() => {
      if (popupRef.current) {
        popupRef.current.destroy();
        popupRef.current = null;
      }
      currentUrlRef.current = null;
      setHoverState(null);
    }, HIDE_GRACE_MS);
  }, []);

  // Listen for chip hover events
  useEffect(() => {
    document.addEventListener(CHIP_HOVER_ENTER_EVENT, handleHoverEnter);
    document.addEventListener(CHIP_HOVER_LEAVE_EVENT, handleHoverLeave);

    return () => {
      document.removeEventListener(CHIP_HOVER_ENTER_EVENT, handleHoverEnter);
      document.removeEventListener(CHIP_HOVER_LEAVE_EVENT, handleHoverLeave);
      clearTimeouts();
      if (popupRef.current) {
        popupRef.current.destroy();
        popupRef.current = null;
      }
    };
  }, [handleHoverEnter, handleHoverLeave, clearTimeouts]);

  // Manage the floating popup
  useEffect(() => {
    // Clean up existing popup
    if (popupRef.current) {
      popupRef.current.destroy();
      popupRef.current = null;
    }

    // If no hover state, nothing to show
    if (!hoverState) {
      return;
    }

    const { url, element, previewData, isLoading, error } = hoverState;

    // Create a container for the React component
    const container = document.createElement('div');

    // Create close handler
    const closePopup = (): void => {
      clearTimeouts();
      if (popupRef.current) {
        popupRef.current.destroy();
        popupRef.current = null;
      }
      currentUrlRef.current = null;
      setHoverState(null);
    };

    // Create the popup using Floating UI
    // Use small offset to minimize gap between chip and popup
    const popup = createFloatingPopup({
      getReferenceClientRect: () => element.getBoundingClientRect(),
      content: container,
      placement: 'bottom-start',
      offsetDistance: 4,
    });
    popupRef.current = popup;

    // Handle mouse enter on the popup itself (extend grace period)
    const handlePopupMouseEnter = (): void => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
        hideTimeoutRef.current = null;
      }
    };

    // Handle mouse leave on the popup (start hide timer)
    const handlePopupMouseLeave = (): void => {
      hideTimeoutRef.current = setTimeout(() => {
        closePopup();
      }, HIDE_GRACE_MS);
    };

    container.addEventListener('mouseenter', handlePopupMouseEnter);
    container.addEventListener('mouseleave', handlePopupMouseLeave);

    // Handle expand to card
    const handleExpandToCard = (): void => {
      // Dispatch custom event for the editor to handle
      const event = new CustomEvent<ChipExpandToCardEventDetail>(CHIP_EXPAND_TO_CARD_EVENT, {
        detail: { url },
        bubbles: true,
      });
      document.dispatchEvent(event);
      // Close the popup after dispatching
      closePopup();
    };

    // Render the React component into the container
    void import('react-dom/client').then(({ createRoot }) => {
      const root = createRoot(container);

      // Handle refresh callback
      const handleRefresh = (): void => {
        setHoverState((prev) => (prev ? { ...prev, isLoading: true } : null));
        void window.electronAPI.oembed.refresh(url).then((result) => {
          if (result.success && result.data) {
            // Build previewData with only defined values
            const newPreviewData: LinkPreviewData = {};
            if (result.data.title) newPreviewData.title = result.data.title;
            if (result.data.author_name) newPreviewData.description = result.data.author_name;
            if (result.data.provider_name) newPreviewData.providerName = result.data.provider_name;
            if (result.data.thumbnail_url) newPreviewData.thumbnailUrl = result.data.thumbnail_url;
            setHoverState((prev) =>
              prev
                ? {
                    ...prev,
                    previewData: newPreviewData,
                    isLoading: false,
                  }
                : null
            );
          } else {
            setHoverState((prev) =>
              prev
                ? { ...prev, isLoading: false, ...(result.error ? { error: result.error } : {}) }
                : null
            );
          }
        });
      };

      root.render(
        <LinkPreviewCard
          url={url}
          {...(previewData ? { previewData } : {})}
          isLoading={isLoading}
          {...(error ? { error } : {})}
          showExpandOption={true}
          onExpandToCard={handleExpandToCard}
          onRefresh={handleRefresh}
        />
      );
    });

    // Cleanup on unmount
    return () => {
      container.removeEventListener('mouseenter', handlePopupMouseEnter);
      container.removeEventListener('mouseleave', handlePopupMouseLeave);
      if (popupRef.current) {
        popupRef.current.destroy();
        popupRef.current = null;
      }
    };
  }, [hoverState, clearTimeouts]);
}

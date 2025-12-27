/**
 * Floating Popup Utility
 *
 * A reusable utility for creating positioned popups using @floating-ui/dom.
 * Replaces tippy.js for suggestion autocomplete popovers.
 *
 * This provides a simpler API that matches our use case:
 * - Show a popup element positioned relative to a reference element or virtual element
 * - Update position when content changes
 * - Hide and destroy cleanly
 */

import { computePosition, flip, shift, offset, type VirtualElement } from '@floating-ui/dom';

export interface FloatingPopupOptions {
  /** The element to position relative to, or a function that returns a ClientRect */
  getReferenceClientRect: () => DOMRect | null;
  /** The popup content element */
  content: HTMLElement;
  /** Offset from the reference element (default: 8) */
  offsetDistance?: number;
  /** Placement preference (default: 'bottom-start') */
  placement?: 'bottom-start' | 'bottom-end' | 'top-start' | 'top-end';
}

export interface FloatingPopup {
  /** Update the popup position */
  update: () => Promise<void>;
  /** Update the reference element getter */
  setReferenceClientRect: (getReferenceClientRect: () => DOMRect | null) => void;
  /** Show the popup */
  show: () => void;
  /** Hide the popup (but don't destroy) */
  hide: () => void;
  /** Destroy the popup and clean up */
  destroy: () => void;
}

/**
 * Create a floating popup positioned relative to a reference element.
 *
 * Usage:
 * ```ts
 * const popup = createFloatingPopup({
 *   getReferenceClientRect: () => someElement.getBoundingClientRect(),
 *   content: myPopupElement,
 * });
 *
 * popup.show();
 * popup.update(); // Call when content changes
 * popup.destroy(); // Clean up when done
 * ```
 */
export function createFloatingPopup(options: FloatingPopupOptions): FloatingPopup {
  const { content, offsetDistance = 8, placement = 'bottom-start' } = options;
  let getReferenceClientRect = options.getReferenceClientRect;

  // Create a wrapper element that will be positioned
  const wrapper = document.createElement('div');
  wrapper.className = 'floating-popup-wrapper';
  wrapper.style.cssText = `
    position: fixed;
    z-index: 9999;
    top: 0;
    left: 0;
    display: none;
  `;
  wrapper.appendChild(content);
  document.body.appendChild(wrapper);

  // Create a virtual element for Floating UI
  const virtualElement: VirtualElement = {
    getBoundingClientRect: () => {
      const rect = getReferenceClientRect();
      if (!rect) {
        // Return a zero-size rect at origin if no reference
        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
          width: 0,
          height: 0,
        };
      }
      return rect;
    },
  };

  let isVisible = false;

  const updatePosition = async (): Promise<void> => {
    if (!isVisible) return;

    const { x, y } = await computePosition(virtualElement, wrapper, {
      placement,
      middleware: [
        offset(offsetDistance),
        flip({
          fallbackPlacements: ['top-start', 'bottom-end', 'top-end'],
        }),
        shift({ padding: 8 }),
      ],
    });

    Object.assign(wrapper.style, {
      left: `${x}px`,
      top: `${y}px`,
    });
  };

  const show = (): void => {
    wrapper.style.display = 'block';
    isVisible = true;
    void updatePosition();
  };

  const hide = (): void => {
    wrapper.style.display = 'none';
    isVisible = false;
  };

  const destroy = (): void => {
    hide();
    wrapper.remove();
  };

  const setReferenceClientRect = (newGetReferenceClientRect: () => DOMRect | null): void => {
    getReferenceClientRect = newGetReferenceClientRect;
    if (isVisible) {
      void updatePosition();
    }
  };

  // Show immediately
  show();

  return {
    update: updatePosition,
    setReferenceClientRect,
    show,
    hide,
    destroy,
  };
}

/**
 * CSS styles for the floating popup wrapper.
 * Add this to your global styles or inject it once.
 */
export const floatingPopupStyles = `
.floating-popup-wrapper {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  border-radius: 8px;
  overflow: hidden;
}
`;

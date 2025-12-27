/**
 * Mock for @floating-ui/dom
 * Used in tests where we don't need actual floating UI positioning
 */

export const computePosition = jest.fn().mockResolvedValue({
  x: 0,
  y: 0,
  placement: 'bottom',
  strategy: 'absolute',
  middlewareData: {},
});

export const flip = jest.fn().mockReturnValue({ name: 'flip' });
export const shift = jest.fn().mockReturnValue({ name: 'shift' });
export const offset = jest.fn().mockReturnValue({ name: 'offset' });

export type VirtualElement = {
  getBoundingClientRect: () => DOMRect;
};

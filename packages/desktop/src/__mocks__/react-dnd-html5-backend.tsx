/**
 * Mock for react-dnd-html5-backend
 */

export const HTML5Backend = {};

// Mock getEmptyImage - returns a transparent 1x1 pixel image
export const getEmptyImage = (): HTMLImageElement => {
  const img = new Image();
  img.src = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';
  return img;
};

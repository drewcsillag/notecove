/**
 * Mock for react-dnd
 */
import * as React from 'react';

export const DndProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  return React.createElement('div', { 'data-testid': 'dnd-provider' }, children);
};

export const useDrag = () => [{ isDragging: false }, () => null, () => null];
export const useDrop = () => [{}, () => null];
export const useDragLayer = () => ({
  item: null,
  itemType: null,
  currentOffset: null,
  isDragging: false,
});

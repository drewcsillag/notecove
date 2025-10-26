/**
 * Mock for react-dnd
 */
import * as React from 'react';

export const DndProvider = ({ children }: { children: React.ReactNode }): React.ReactElement => {
  return React.createElement('div', { 'data-testid': 'dnd-provider' }, children);
};

export const useDrag = () => [{}, () => null];
export const useDrop = () => [{}, () => null];

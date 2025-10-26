/**
 * Mock for react-dnd
 */
import React from 'react';

export const DndProvider = ({ children }: { children: React.ReactNode }) => {
  return <div data-testid="dnd-provider">{children}</div>;
};

export const useDrag = () => [{}, () => null];
export const useDrop = () => [{}, () => null];

/**
 * Mock for @minoru/react-dnd-treeview
 */
import React from 'react';

export interface NodeModel<T = unknown> {
  id: string | number;
  parent: string | number;
  text?: string;
  droppable?: boolean;
  data?: T;
}

export interface DropOptions<T = unknown> {
  dragSourceId: string | number;
  dropTargetId: string | number;
  dragSource: NodeModel<T>;
  dropTarget: NodeModel<T> | undefined;
  destinationIndex?: number;
  relativeIndex?: number;
}

export const Tree = ({ treeData }: { treeData?: NodeModel[] }): JSX.Element => {
  if (!treeData) return React.createElement('div', { 'data-testid': 'tree-mock' }, 'Loading...');
  return React.createElement(
    'div',
    { 'data-testid': 'tree-mock' },
    treeData.map((node) => node.text).join(', ')
  );
};

export const getBackendOptions = () => ({});
export const MultiBackend = () => null;

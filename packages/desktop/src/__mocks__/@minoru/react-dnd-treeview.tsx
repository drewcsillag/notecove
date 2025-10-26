/**
 * Mock for @minoru/react-dnd-treeview
 */
import * as React from 'react';

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

export const Tree = ({
  tree,
  treeData,
}: {
  tree?: NodeModel[];
  treeData?: NodeModel[];
}): React.ReactElement => {
  // Support both 'tree' and 'treeData' props
  const nodes = tree ?? treeData;

  if (!nodes) {
    return React.createElement('div', { 'data-testid': 'tree-mock' }, 'Loading...');
  }

  // Render each node as a div with its text so tests can find them
  return React.createElement(
    'div',
    { 'data-testid': 'tree-mock' },
    nodes.map((node, index) =>
      React.createElement('div', { key: index }, node.text ?? String(node.id))
    )
  );
};

export const getBackendOptions = () => ({});
export const MultiBackend = () => null;

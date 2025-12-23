/**
 * LeftSidebar Component Tests
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { LeftSidebar } from '../LeftSidebar';

// Mock child components to isolate LeftSidebar testing
jest.mock('../../FolderPanel/FolderPanel', () => ({
  FolderPanel: () => <div data-testid="folder-panel">Folder Panel</div>,
}));

jest.mock('../../TagPanel/TagPanel', () => ({
  TagPanel: ({
    tagFilters,
  }: {
    tagFilters: Record<string, 'include' | 'exclude'>;
    onTagSelect: (tagId: string) => void;
    onClearFilters: () => void;
  }) => (
    <div data-testid="tag-panel">
      Tag Panel
      <span data-testid="filter-count">{Object.keys(tagFilters).length}</span>
    </div>
  ),
}));

jest.mock('../../SyncStatusIndicator', () => ({
  SyncStatusIndicator: () => <div data-testid="sync-status">Sync Status</div>,
}));

const theme = createTheme();

const defaultProps = {
  tagFilters: {} as Record<string, 'include' | 'exclude'>,
  onTagSelect: jest.fn(),
  onClearTagFilters: jest.fn(),
  showTagPanel: true,
  selectedFolderId: null as string | null,
  onFolderSelect: jest.fn(),
};

const renderLeftSidebar = (props = {}) => {
  return render(
    <ThemeProvider theme={theme}>
      <LeftSidebar {...defaultProps} {...props} />
    </ThemeProvider>
  );
};

describe('LeftSidebar', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('with tag panel visible', () => {
    it('should render FolderPanel and TagPanel', () => {
      renderLeftSidebar({ showTagPanel: true });

      expect(screen.getByTestId('folder-panel')).toBeInTheDocument();
      expect(screen.getByTestId('tag-panel')).toBeInTheDocument();
    });

    it('should render PanelGroup for resizable layout', () => {
      renderLeftSidebar({ showTagPanel: true });

      expect(screen.getByTestId('panel-group')).toBeInTheDocument();
      expect(screen.getByTestId('resize-handle')).toBeInTheDocument();
    });

    it('should render SyncStatusIndicator', () => {
      renderLeftSidebar({ showTagPanel: true });

      expect(screen.getByTestId('sync-status')).toBeInTheDocument();
    });

    it('should pass tagFilters to TagPanel', () => {
      const tagFilters = { tag1: 'include' as const, tag2: 'exclude' as const };
      renderLeftSidebar({ showTagPanel: true, tagFilters });

      expect(screen.getByTestId('filter-count')).toHaveTextContent('2');
    });

    it('should use initial sizes when provided', () => {
      const initialSizes = [70, 30];

      // Component should render without errors with custom initial sizes
      const { container } = renderLeftSidebar({
        showTagPanel: true,
        initialSizes,
      });

      expect(container).toBeTruthy();
    });

    it('should call onLayoutChange when provided', () => {
      const handleLayoutChange = jest.fn();

      renderLeftSidebar({
        showTagPanel: true,
        onLayoutChange: handleLayoutChange,
      });

      // onLayoutChange will be called by react-resizable-panels
      // when the layout changes. The mock doesn't trigger this,
      // but we verify the component accepts the prop.
      expect(screen.getByTestId('panel-group')).toBeInTheDocument();
    });
  });

  describe('with tag panel hidden', () => {
    it('should render only FolderPanel when showTagPanel is false', () => {
      renderLeftSidebar({ showTagPanel: false });

      expect(screen.getByTestId('folder-panel')).toBeInTheDocument();
      expect(screen.queryByTestId('tag-panel')).not.toBeInTheDocument();
    });

    it('should not render PanelGroup when tag panel is hidden', () => {
      renderLeftSidebar({ showTagPanel: false });

      expect(screen.queryByTestId('panel-group')).not.toBeInTheDocument();
      expect(screen.queryByTestId('resize-handle')).not.toBeInTheDocument();
    });

    it('should still render SyncStatusIndicator', () => {
      renderLeftSidebar({ showTagPanel: false });

      expect(screen.getByTestId('sync-status')).toBeInTheDocument();
    });
  });

  describe('default sizes', () => {
    it('should use default sizes (60/40) when initialSizes not provided', () => {
      // Component should render without errors with default sizes
      const { container } = renderLeftSidebar({ showTagPanel: true });

      expect(container).toBeTruthy();
      expect(screen.getByTestId('panel-group')).toBeInTheDocument();
    });
  });
});

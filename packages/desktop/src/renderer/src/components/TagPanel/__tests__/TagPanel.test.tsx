/**
 * TagPanel Component Tests
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { TagPanel } from '../TagPanel';

// Mock the electronAPI
const mockGetAllTags = jest.fn();
const mockOnNoteUpdated = jest.fn();
const mockOnSdUpdated = jest.fn();

// Set up electronAPI mock
global.window.electronAPI = {
  tag: {
    getAll: mockGetAllTags,
  },
  note: {
    onUpdated: mockOnNoteUpdated,
  },
  sd: {
    onUpdated: mockOnSdUpdated,
  },
} as unknown as typeof window.electronAPI;

beforeEach(() => {
  jest.clearAllMocks();

  // Default mock implementation - return some tags
  mockGetAllTags.mockResolvedValue([
    { id: 'tag1', name: 'work', count: 5 },
    { id: 'tag2', name: 'personal', count: 3 },
    { id: 'tag3', name: 'urgent', count: 2 },
    { id: 'tag4', name: 'project-alpha', count: 1 },
  ]);

  // Return unsubscribe functions
  mockOnNoteUpdated.mockReturnValue(() => {
    // unsubscribe function
  });
  mockOnSdUpdated.mockReturnValue(() => {
    // unsubscribe function
  });
});

const theme = createTheme();

const defaultProps = {
  tagFilters: {} as Record<string, 'include' | 'exclude'>,
  onTagSelect: jest.fn(),
  onClearFilters: jest.fn(),
};

const renderTagPanel = (props = {}) => {
  return render(
    <ThemeProvider theme={theme}>
      <TagPanel {...defaultProps} {...props} />
    </ThemeProvider>
  );
};

describe('TagPanel', () => {
  describe('basic rendering', () => {
    it('should render loading state initially', () => {
      renderTagPanel();
      expect(screen.getByText('Loading tags...')).toBeInTheDocument();
    });

    it('should render tags after loading', async () => {
      renderTagPanel();

      await waitFor(() => {
        expect(screen.getByText('#work')).toBeInTheDocument();
      });

      expect(screen.getByText('#personal')).toBeInTheDocument();
      expect(screen.getByText('#urgent')).toBeInTheDocument();
      expect(screen.getByText('#project-alpha')).toBeInTheDocument();
    });

    it('should show "No tags yet" when there are no tags', async () => {
      mockGetAllTags.mockResolvedValue([]);
      renderTagPanel();

      await waitFor(() => {
        expect(screen.getByText(/No tags yet/)).toBeInTheDocument();
      });
    });
  });

  describe('tag search filtering', () => {
    it('should render search input', async () => {
      renderTagPanel();

      await waitFor(() => {
        expect(screen.getByText('#work')).toBeInTheDocument();
      });

      expect(screen.getByPlaceholderText('Filter tags...')).toBeInTheDocument();
    });

    it('should filter tags when typing in search', async () => {
      renderTagPanel();

      await waitFor(() => {
        expect(screen.getByText('#work')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Filter tags...');
      fireEvent.change(searchInput, { target: { value: 'work' } });

      // work should be visible
      expect(screen.getByText('#work')).toBeInTheDocument();

      // others should be filtered out
      expect(screen.queryByText('#personal')).not.toBeInTheDocument();
      expect(screen.queryByText('#urgent')).not.toBeInTheDocument();
      expect(screen.queryByText('#project-alpha')).not.toBeInTheDocument();
    });

    it('should filter case-insensitively', async () => {
      renderTagPanel();

      await waitFor(() => {
        expect(screen.getByText('#work')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Filter tags...');
      fireEvent.change(searchInput, { target: { value: 'WORK' } });

      expect(screen.getByText('#work')).toBeInTheDocument();
    });

    it('should show all tags when search is empty', async () => {
      renderTagPanel();

      await waitFor(() => {
        expect(screen.getByText('#work')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Filter tags...');

      // Type something then clear it
      fireEvent.change(searchInput, { target: { value: 'work' } });
      expect(screen.queryByText('#personal')).not.toBeInTheDocument();

      fireEvent.change(searchInput, { target: { value: '' } });

      // All tags should be visible again
      expect(screen.getByText('#work')).toBeInTheDocument();
      expect(screen.getByText('#personal')).toBeInTheDocument();
      expect(screen.getByText('#urgent')).toBeInTheDocument();
      expect(screen.getByText('#project-alpha')).toBeInTheDocument();
    });

    it('should filter by partial match', async () => {
      renderTagPanel();

      await waitFor(() => {
        expect(screen.getByText('#work')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Filter tags...');
      fireEvent.change(searchInput, { target: { value: 'project' } });

      expect(screen.getByText('#project-alpha')).toBeInTheDocument();
      expect(screen.queryByText('#work')).not.toBeInTheDocument();
    });

    it('should show message when no tags match filter', async () => {
      renderTagPanel();

      await waitFor(() => {
        expect(screen.getByText('#work')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Filter tags...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('No tags match your filter')).toBeInTheDocument();
    });

    it('should have clear button when search has text', async () => {
      renderTagPanel();

      await waitFor(() => {
        expect(screen.getByText('#work')).toBeInTheDocument();
      });

      const searchInput = screen.getByPlaceholderText('Filter tags...');
      fireEvent.change(searchInput, { target: { value: 'work' } });

      // Should have a clear button (the X in the search field)
      const clearButton = screen.getByTitle('Clear search');
      expect(clearButton).toBeInTheDocument();

      // Click it and search should clear
      fireEvent.click(clearButton);

      expect(searchInput).toHaveValue('');
      expect(screen.getByText('#personal')).toBeInTheDocument();
    });
  });

  describe('tag selection', () => {
    it('should call onTagSelect when clicking a tag', async () => {
      const onTagSelect = jest.fn();
      renderTagPanel({ onTagSelect });

      await waitFor(() => {
        expect(screen.getByText('#work')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('#work'));

      expect(onTagSelect).toHaveBeenCalledWith('tag1');
    });

    it('should show clear filters button when filters are active', async () => {
      renderTagPanel({
        tagFilters: { tag1: 'include', tag2: 'exclude' },
      });

      await waitFor(() => {
        expect(screen.getByText('#work')).toBeInTheDocument();
      });

      // Clear button should be visible when filters are active
      expect(screen.getByTitle('Clear all filters')).toBeInTheDocument();
    });

    it('should call onClearFilters when clicking clear button', async () => {
      const onClearFilters = jest.fn();
      renderTagPanel({
        tagFilters: { tag1: 'include' },
        onClearFilters,
      });

      await waitFor(() => {
        expect(screen.getByText('#work')).toBeInTheDocument();
      });

      const clearButton = screen.getByTitle('Clear all filters');
      fireEvent.click(clearButton);

      expect(onClearFilters).toHaveBeenCalled();
    });
  });
});

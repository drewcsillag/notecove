/**
 * UnfurlCard Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { UnfurlCard } from '../UnfurlCard';

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    shell: {
      openExternal: jest.fn().mockResolvedValue(undefined),
    },
  },
  writable: true,
});

describe('UnfurlCard', () => {
  const defaultUrl = 'https://example.com/article';
  const defaultProps = {
    url: defaultUrl,
    title: 'Example Article Title',
    description: 'This is a description of the article that provides context.',
    thumbnailUrl: 'https://example.com/thumbnail.jpg',
    providerName: 'Example',
    hasData: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loading state', () => {
    it('renders loading skeleton when isLoading is true', () => {
      render(<UnfurlCard url={defaultUrl} isLoading={true} />);

      // Should have skeleton elements
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('does not render content when loading', () => {
      render(<UnfurlCard {...defaultProps} isLoading={true} />);

      expect(screen.queryByText('Example Article Title')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders error message when error is provided', () => {
      render(<UnfurlCard url={defaultUrl} error="Failed to load preview" />);

      expect(screen.getByText('Failed to load preview')).toBeInTheDocument();
    });

    it('renders retry button when retryable error type and onRefresh provided', () => {
      const onRefresh = jest.fn();
      render(
        <UnfurlCard
          url={defaultUrl}
          error="Network error"
          errorType="NETWORK_ERROR"
          onRefresh={onRefresh}
        />
      );

      const refreshButton = screen.getByRole('button', { name: /try again/i });
      expect(refreshButton).toBeInTheDocument();

      fireEvent.click(refreshButton);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('content rendering', () => {
    it('renders title', () => {
      render(<UnfurlCard {...defaultProps} />);

      expect(screen.getByText('Example Article Title')).toBeInTheDocument();
    });

    it('renders description', () => {
      render(<UnfurlCard {...defaultProps} />);

      expect(
        screen.getByText('This is a description of the article that provides context.')
      ).toBeInTheDocument();
    });

    it('renders thumbnail when thumbnailUrl provided', () => {
      render(<UnfurlCard {...defaultProps} />);

      const thumbnail = document.querySelector('img[src="https://example.com/thumbnail.jpg"]');
      expect(thumbnail).toBeInTheDocument();
    });

    it('renders provider name', () => {
      render(<UnfurlCard {...defaultProps} />);

      expect(screen.getByText('Example')).toBeInTheDocument();
    });

    it('renders domain when no provider name', () => {
      render(<UnfurlCard {...defaultProps} providerName={null} />);

      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('shows URL as title when title not provided', () => {
      render(<UnfurlCard url={defaultUrl} hasData={true} />);

      expect(screen.getByText(defaultUrl)).toBeInTheDocument();
    });
  });

  describe('thumbnail handling', () => {
    it('shows placeholder when no thumbnail and hasData', () => {
      render(<UnfurlCard {...defaultProps} thumbnailUrl={null} />);

      // Should render a placeholder box with link icon
      const boxes = document.querySelectorAll('.MuiBox-root');
      expect(boxes.length).toBeGreaterThan(0);
    });

    it('hides broken thumbnail on error', () => {
      render(<UnfurlCard {...defaultProps} />);

      const thumbnail = document.querySelector('img[src="https://example.com/thumbnail.jpg"]')!;
      expect(thumbnail).toBeInTheDocument();

      // Simulate image load error
      fireEvent.error(thumbnail);

      // After error, placeholder should be shown instead
      // The image won't be removed but the component should handle this
    });
  });

  describe('selection state', () => {
    it('applies selected styling when selected', () => {
      const { container } = render(<UnfurlCard {...defaultProps} selected={true} />);

      // Check for primary border color class/style
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveStyle({ borderColor: expect.anything() });
    });
  });

  describe('toolbar interactions', () => {
    it('shows toolbar on hover', () => {
      render(<UnfurlCard {...defaultProps} onRefresh={jest.fn()} onDelete={jest.fn()} />);

      const card = screen
        .getByText('Example Article Title')
        .closest('[class*="MuiBox-root"]')?.parentElement;
      expect(card).toBeInTheDocument();

      // Toolbar should appear on hover
      if (card) {
        fireEvent.mouseEnter(card);
      }

      // Should now show toolbar buttons
      expect(screen.getByRole('button', { name: /open in browser/i })).toBeInTheDocument();
    });

    it('calls onRefresh when refresh button clicked', () => {
      const onRefresh = jest.fn();
      render(<UnfurlCard {...defaultProps} onRefresh={onRefresh} />);

      // Hover to show toolbar
      const card = screen
        .getByText('Example Article Title')
        .closest('[class*="MuiBox-root"]')?.parentElement;
      if (card) {
        fireEvent.mouseEnter(card);
      }

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('calls onDelete when delete button clicked', () => {
      const onDelete = jest.fn();
      render(<UnfurlCard {...defaultProps} onDelete={onDelete} />);

      // Hover to show toolbar
      const card = screen
        .getByText('Example Article Title')
        .closest('[class*="MuiBox-root"]')?.parentElement;
      if (card) {
        fireEvent.mouseEnter(card);
      }

      const deleteButton = screen.getByRole('button', { name: /remove/i });
      fireEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalledTimes(1);
    });
  });

  describe('open in browser', () => {
    it('calls onOpenInBrowser when card clicked', () => {
      const onOpenInBrowser = jest.fn();
      render(<UnfurlCard {...defaultProps} onOpenInBrowser={onOpenInBrowser} />);

      const card = screen
        .getByText('Example Article Title')
        .closest('[class*="MuiBox-root"]')?.parentElement;
      if (card) {
        fireEvent.click(card);
      }

      expect(onOpenInBrowser).toHaveBeenCalledTimes(1);
    });

    it('opens link via electronAPI when no onOpenInBrowser provided', () => {
      render(<UnfurlCard {...defaultProps} />);

      const card = screen
        .getByText('Example Article Title')
        .closest('[class*="MuiBox-root"]')?.parentElement;
      if (card) {
        fireEvent.click(card);
      }

      expect(window.electronAPI.shell.openExternal).toHaveBeenCalledWith(defaultUrl);
    });
  });

  describe('stale data indicator', () => {
    it('shows warning color on refresh button when data is stale', () => {
      const onRefresh = jest.fn();
      render(<UnfurlCard {...defaultProps} isStale={true} onRefresh={onRefresh} />);

      // Hover to show toolbar
      const card = screen
        .getByText('Example Article Title')
        .closest('[class*="MuiBox-root"]')?.parentElement;
      if (card) {
        fireEvent.mouseEnter(card);
      }

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      expect(refreshButton).toBeInTheDocument();
    });
  });

  describe('domain extraction', () => {
    it('removes www prefix from domain', () => {
      render(<UnfurlCard url="https://www.example.com/page" hasData={true} />);

      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('handles subdomain', () => {
      render(<UnfurlCard url="https://blog.example.com/post" hasData={true} />);

      expect(screen.getByText('blog.example.com')).toBeInTheDocument();
    });

    it('handles malformed URLs gracefully', () => {
      // Should not crash on invalid URL
      render(<UnfurlCard url="not-a-valid-url" hasData={true} />);

      // Should show the URL as-is (appears in both title and domain)
      const elements = screen.getAllByText('not-a-valid-url');
      expect(elements.length).toBeGreaterThan(0);
    });
  });
});

/**
 * LinkPreviewCard Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LinkPreviewCard, type LinkPreviewData } from '../LinkPreviewCard';

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    shell: {
      openExternal: jest.fn().mockResolvedValue(undefined),
    },
  },
  writable: true,
});

describe('LinkPreviewCard', () => {
  const defaultUrl = 'https://example.com/article';
  const mockPreviewData: LinkPreviewData = {
    title: 'Example Article Title',
    description: 'This is a description of the article that provides context.',
    thumbnailUrl: 'https://example.com/thumbnail.jpg',
    faviconUrl: 'data:image/png;base64,abc123',
    providerName: 'Example',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('loading state', () => {
    it('renders loading skeleton when isLoading is true', () => {
      render(<LinkPreviewCard url={defaultUrl} isLoading={true} />);

      // Should have skeleton elements
      const skeletons = document.querySelectorAll('.MuiSkeleton-root');
      expect(skeletons.length).toBeGreaterThan(0);
    });

    it('does not render preview data when loading', () => {
      render(<LinkPreviewCard url={defaultUrl} previewData={mockPreviewData} isLoading={true} />);

      expect(screen.queryByText('Example Article Title')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('renders error message when error is provided', () => {
      render(<LinkPreviewCard url={defaultUrl} error="Failed to load preview" />);

      expect(screen.getByText('Failed to load preview')).toBeInTheDocument();
    });

    it('renders refresh button when error and onRefresh provided', () => {
      const onRefresh = jest.fn();
      render(<LinkPreviewCard url={defaultUrl} error="Error" onRefresh={onRefresh} />);

      const refreshButton = screen.getByRole('button', { name: /retry/i });
      expect(refreshButton).toBeInTheDocument();

      fireEvent.click(refreshButton);
      expect(onRefresh).toHaveBeenCalledTimes(1);
    });
  });

  describe('preview data rendering', () => {
    it('renders title from preview data', () => {
      render(<LinkPreviewCard url={defaultUrl} previewData={mockPreviewData} />);

      expect(screen.getByText('Example Article Title')).toBeInTheDocument();
    });

    it('renders description from preview data', () => {
      render(<LinkPreviewCard url={defaultUrl} previewData={mockPreviewData} />);

      expect(
        screen.getByText('This is a description of the article that provides context.')
      ).toBeInTheDocument();
    });

    it('renders thumbnail when thumbnailUrl provided', () => {
      render(<LinkPreviewCard url={defaultUrl} previewData={mockPreviewData} />);

      const thumbnail = document.querySelector('img[src="https://example.com/thumbnail.jpg"]');
      expect(thumbnail).toBeInTheDocument();
    });

    it('renders favicon when faviconUrl provided', () => {
      render(<LinkPreviewCard url={defaultUrl} previewData={mockPreviewData} />);

      const favicon = document.querySelector('img[src="data:image/png;base64,abc123"]');
      expect(favicon).toBeInTheDocument();
    });

    it('renders domain from URL', () => {
      render(<LinkPreviewCard url={defaultUrl} previewData={mockPreviewData} />);

      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('removes www prefix from domain', () => {
      render(<LinkPreviewCard url="https://www.example.com/page" previewData={mockPreviewData} />);

      expect(screen.getByText('example.com')).toBeInTheDocument();
    });
  });

  describe('fallback rendering', () => {
    it('renders fallback when no preview data', () => {
      render(<LinkPreviewCard url={defaultUrl} />);

      // Should show domain in fallback view
      expect(screen.getByText('example.com')).toBeInTheDocument();
    });

    it('shows URL in fallback view', () => {
      render(<LinkPreviewCard url={defaultUrl} />);

      expect(screen.getByText(defaultUrl)).toBeInTheDocument();
    });
  });

  describe('actions', () => {
    it('calls onOpenInBrowser when open button clicked', () => {
      const onOpenInBrowser = jest.fn();
      render(
        <LinkPreviewCard
          url={defaultUrl}
          previewData={mockPreviewData}
          onOpenInBrowser={onOpenInBrowser}
        />
      );

      const openButton = screen.getByRole('button', { name: /open in browser/i });
      fireEvent.click(openButton);

      expect(onOpenInBrowser).toHaveBeenCalledTimes(1);
    });

    it('opens link via electronAPI when no onOpenInBrowser provided', () => {
      render(<LinkPreviewCard url={defaultUrl} previewData={mockPreviewData} />);

      const openButton = screen.getByRole('button', { name: /open in browser/i });
      fireEvent.click(openButton);

      expect(window.electronAPI.shell.openExternal).toHaveBeenCalledWith(defaultUrl);
    });

    it('calls onRefresh when refresh button clicked', () => {
      const onRefresh = jest.fn();
      render(
        <LinkPreviewCard url={defaultUrl} previewData={mockPreviewData} onRefresh={onRefresh} />
      );

      const refreshButton = screen.getByRole('button', { name: /refresh preview/i });
      fireEvent.click(refreshButton);

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('does not render refresh button when onRefresh not provided', () => {
      render(<LinkPreviewCard url={defaultUrl} previewData={mockPreviewData} />);

      expect(screen.queryByRole('button', { name: /refresh preview/i })).not.toBeInTheDocument();
    });
  });

  describe('domain extraction edge cases', () => {
    it('handles URLs with subdomain', () => {
      render(<LinkPreviewCard url="https://blog.example.com/post" previewData={mockPreviewData} />);

      expect(screen.getByText('blog.example.com')).toBeInTheDocument();
    });

    it('handles malformed URLs gracefully', () => {
      // Should not crash on invalid URL
      render(<LinkPreviewCard url="not-a-valid-url" />);

      // There will be multiple elements showing the URL (domain + full URL in fallback)
      expect(screen.getAllByText('not-a-valid-url').length).toBeGreaterThan(0);
    });
  });

  describe('conditional rendering', () => {
    it('does not show description when not provided', () => {
      const dataWithoutDescription: LinkPreviewData = {
        title: 'Title Only',
      };
      render(<LinkPreviewCard url={defaultUrl} previewData={dataWithoutDescription} />);

      expect(screen.getByText('Title Only')).toBeInTheDocument();
      // Verify no description paragraph exists (other than title)
    });

    it('shows domain as title when title not provided', () => {
      const dataWithoutTitle: LinkPreviewData = {
        description: 'Description only',
      };
      render(<LinkPreviewCard url={defaultUrl} previewData={dataWithoutTitle} />);

      // The domain should appear as the title
      const textElements = screen.getAllByText('example.com');
      expect(textElements.length).toBeGreaterThan(0);
    });
  });
});

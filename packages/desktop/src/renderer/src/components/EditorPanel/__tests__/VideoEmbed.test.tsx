/**
 * VideoEmbed Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { VideoEmbed } from '../VideoEmbed';

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    shell: {
      openExternal: jest.fn().mockResolvedValue(undefined),
    },
  },
  writable: true,
});

describe('VideoEmbed', () => {
  const defaultProps = {
    embedUrl: 'https://www.youtube.com/embed/dQw4w9WgXcQ',
    originalUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    title: 'Never Gonna Give You Up',
    providerName: 'YouTube',
    thumbnailUrl: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('initial render', () => {
    it('renders thumbnail with play button initially', () => {
      render(<VideoEmbed {...defaultProps} />);

      // Should show thumbnail
      const thumbnail = screen.getByRole('img');
      expect(thumbnail).toHaveAttribute('src', defaultProps.thumbnailUrl);

      // Should have play button (MUI uses SVG with title)
      expect(document.querySelector('.play-button')).toBeInTheDocument();
    });

    it('renders title in the title bar', () => {
      render(<VideoEmbed {...defaultProps} />);

      expect(screen.getByText('Never Gonna Give You Up')).toBeInTheDocument();
    });

    it('renders provider name', () => {
      render(<VideoEmbed {...defaultProps} />);

      expect(screen.getByText('YouTube')).toBeInTheDocument();
    });

    it('shows URL when no title provided', () => {
      render(<VideoEmbed {...defaultProps} title={null} />);

      expect(screen.getByText(defaultProps.originalUrl)).toBeInTheDocument();
    });
  });

  describe('play interaction', () => {
    it('shows iframe when play button clicked', () => {
      render(<VideoEmbed {...defaultProps} />);

      // Click the thumbnail/play area
      const playArea = document.querySelector('.play-button')?.closest('div');
      if (playArea) {
        fireEvent.click(playArea);
      }

      // Should now show iframe
      const iframe = screen.getByTitle('Never Gonna Give You Up');
      expect(iframe).toBeInTheDocument();
      expect(iframe).toHaveAttribute('src', defaultProps.embedUrl);
    });

    it('iframe has correct attributes', () => {
      render(<VideoEmbed {...defaultProps} />);

      // Click to play
      const playArea = document.querySelector('.play-button')?.closest('div');
      if (playArea) {
        fireEvent.click(playArea);
      }

      const iframe = screen.getByTitle('Never Gonna Give You Up');
      expect(iframe).toHaveAttribute('allow', expect.stringContaining('accelerometer'));
    });
  });

  describe('toolbar', () => {
    it('shows toolbar on hover', () => {
      render(
        <VideoEmbed
          {...defaultProps}
          onRefresh={jest.fn()}
          onDelete={jest.fn()}
          onConvertToChip={jest.fn()}
        />
      );

      // Find the container and hover
      const container = screen.getByText('Never Gonna Give You Up').closest('.MuiBox-root');
      if (container?.parentElement) {
        fireEvent.mouseEnter(container.parentElement);
      }

      // Should show toolbar buttons
      expect(screen.getByRole('button', { name: /open in browser/i })).toBeInTheDocument();
    });

    it('calls onRefresh when refresh button clicked', () => {
      const onRefresh = jest.fn();
      render(<VideoEmbed {...defaultProps} onRefresh={onRefresh} />);

      // Hover to show toolbar
      const titleBar = screen.getByText('Never Gonna Give You Up').closest('.MuiBox-root');
      if (titleBar?.parentElement) {
        fireEvent.mouseEnter(titleBar.parentElement);
      }

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('calls onDelete when delete button clicked', () => {
      const onDelete = jest.fn();
      render(<VideoEmbed {...defaultProps} onDelete={onDelete} />);

      // Hover to show toolbar
      const titleBar = screen.getByText('Never Gonna Give You Up').closest('.MuiBox-root');
      if (titleBar?.parentElement) {
        fireEvent.mouseEnter(titleBar.parentElement);
      }

      const deleteButton = screen.getByRole('button', { name: /remove/i });
      fireEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('calls onConvertToChip when convert button clicked', () => {
      const onConvertToChip = jest.fn();
      render(<VideoEmbed {...defaultProps} onConvertToChip={onConvertToChip} />);

      // Hover to show toolbar
      const titleBar = screen.getByText('Never Gonna Give You Up').closest('.MuiBox-root');
      if (titleBar?.parentElement) {
        fireEvent.mouseEnter(titleBar.parentElement);
      }

      const convertButton = screen.getByRole('button', { name: /convert to chip/i });
      fireEvent.click(convertButton);

      expect(onConvertToChip).toHaveBeenCalledTimes(1);
    });
  });

  describe('open in browser', () => {
    it('calls onOpenInBrowser when open button clicked', () => {
      const onOpenInBrowser = jest.fn();
      render(<VideoEmbed {...defaultProps} onOpenInBrowser={onOpenInBrowser} />);

      // Hover to show toolbar
      const titleBar = screen.getByText('Never Gonna Give You Up').closest('.MuiBox-root');
      if (titleBar?.parentElement) {
        fireEvent.mouseEnter(titleBar.parentElement);
      }

      const openButton = screen.getByRole('button', { name: /open in browser/i });
      fireEvent.click(openButton);

      expect(onOpenInBrowser).toHaveBeenCalledTimes(1);
    });

    it('opens via electronAPI when no onOpenInBrowser provided', () => {
      render(<VideoEmbed {...defaultProps} />);

      // Hover to show toolbar
      const titleBar = screen.getByText('Never Gonna Give You Up').closest('.MuiBox-root');
      if (titleBar?.parentElement) {
        fireEvent.mouseEnter(titleBar.parentElement);
      }

      const openButton = screen.getByRole('button', { name: /open in browser/i });
      fireEvent.click(openButton);

      expect(window.electronAPI.shell.openExternal).toHaveBeenCalledWith(defaultProps.originalUrl);
    });
  });

  describe('aspect ratio', () => {
    it('uses 16:9 aspect ratio by default', () => {
      render(<VideoEmbed {...defaultProps} />);

      // The video container should have the default 16:9 aspect ratio
      const videoContainer = screen.getByTestId('video-container');
      expect(videoContainer).toBeInTheDocument();
      expect(videoContainer.getAttribute('data-aspect-ratio')).toBe(String(16 / 9));
    });

    it('uses custom aspect ratio when provided', () => {
      render(<VideoEmbed {...defaultProps} aspectRatio={4 / 3} />);

      // The video container should have the custom 4:3 aspect ratio
      const videoContainer = screen.getByTestId('video-container');
      expect(videoContainer).toBeInTheDocument();
      expect(videoContainer.getAttribute('data-aspect-ratio')).toBe(String(4 / 3));
    });
  });

  describe('selection state', () => {
    it('applies selected styling when selected', () => {
      const { container } = render(<VideoEmbed {...defaultProps} selected={true} />);

      // The main container should have selected styling
      const mainBox = container.firstChild as HTMLElement;
      expect(mainBox).toHaveStyle({ borderColor: expect.anything() });
    });
  });
});

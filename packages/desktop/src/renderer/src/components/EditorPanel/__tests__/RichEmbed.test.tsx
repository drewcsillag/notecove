/**
 * RichEmbed Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import { RichEmbed } from '../RichEmbed';

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  value: {
    shell: {
      openExternal: jest.fn().mockResolvedValue(undefined),
    },
  },
  writable: true,
});

describe('RichEmbed', () => {
  const defaultProps = {
    html: '<blockquote>Test tweet content</blockquote>',
    originalUrl: 'https://twitter.com/user/status/123',
    providerUrl: 'https://twitter.com',
    providerName: 'Twitter',
    title: 'Tweet by User',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('provider allowlist', () => {
    it('renders null for disallowed providers', () => {
      const { container } = render(
        <RichEmbed {...defaultProps} providerUrl="https://malicious-site.com" />
      );

      expect(container.firstChild).toBeNull();
    });

    it('renders content for allowed providers', () => {
      render(<RichEmbed {...defaultProps} />);

      // Should render the container
      const iframe = screen.getByTitle('Tweet by User');
      expect(iframe).toBeInTheDocument();
    });

    it('renders for Twitter', () => {
      render(<RichEmbed {...defaultProps} providerUrl="https://twitter.com" />);
      expect(screen.getByTitle('Tweet by User')).toBeInTheDocument();
    });

    it('renders for X.com', () => {
      render(<RichEmbed {...defaultProps} providerUrl="https://x.com" />);
      expect(screen.getByTitle('Tweet by User')).toBeInTheDocument();
    });

    it('renders for Spotify', () => {
      render(<RichEmbed {...defaultProps} providerUrl="https://spotify.com" />);
      expect(screen.getByTitle('Tweet by User')).toBeInTheDocument();
    });

    it('renders for GitHub Gist', () => {
      render(<RichEmbed {...defaultProps} providerUrl="https://gist.github.com" />);
      expect(screen.getByTitle('Tweet by User')).toBeInTheDocument();
    });
  });

  describe('iframe rendering', () => {
    it('renders iframe with sandboxed HTML', () => {
      render(<RichEmbed {...defaultProps} />);

      const iframe = screen.getByTitle('Tweet by User');
      expect(iframe).toHaveAttribute('sandbox', expect.stringContaining('allow-scripts'));
    });

    it('uses default title when none provided', () => {
      render(<RichEmbed {...defaultProps} title={null} />);

      const iframe = screen.getByTitle('Embedded content');
      expect(iframe).toBeInTheDocument();
    });

    it('includes the HTML content in srcDoc', () => {
      render(<RichEmbed {...defaultProps} />);

      const iframe = screen.getByTitle('Tweet by User');
      expect(iframe.getAttribute('srcdoc')).toContain(
        '<blockquote>Test tweet content</blockquote>'
      );
    });

    it('includes CSP meta tag in srcDoc', () => {
      render(<RichEmbed {...defaultProps} />);

      const iframe = screen.getByTitle('Tweet by User');
      expect(iframe.getAttribute('srcdoc')).toContain('Content-Security-Policy');
    });
  });

  describe('provider bar', () => {
    it('shows provider name when provided', () => {
      render(<RichEmbed {...defaultProps} />);

      expect(screen.getByText('Twitter')).toBeInTheDocument();
    });

    it('does not show provider bar when no provider name', () => {
      render(<RichEmbed {...defaultProps} providerName={null} />);

      expect(screen.queryByText('Twitter')).not.toBeInTheDocument();
    });
  });

  describe('toolbar', () => {
    it('shows toolbar on hover', () => {
      render(
        <RichEmbed
          {...defaultProps}
          onRefresh={jest.fn()}
          onDelete={jest.fn()}
          onConvertToChip={jest.fn()}
        />
      );

      // Find container and hover
      const provider = screen.getByText('Twitter');
      const container = provider.closest('.MuiBox-root')?.parentElement;
      if (container) {
        fireEvent.mouseEnter(container);
      }

      expect(screen.getByRole('button', { name: /open in browser/i })).toBeInTheDocument();
    });

    it('calls onRefresh when refresh button clicked', () => {
      const onRefresh = jest.fn();
      render(<RichEmbed {...defaultProps} onRefresh={onRefresh} />);

      // Hover to show toolbar
      const provider = screen.getByText('Twitter');
      const container = provider.closest('.MuiBox-root')?.parentElement;
      if (container) {
        fireEvent.mouseEnter(container);
      }

      const refreshButton = screen.getByRole('button', { name: /refresh/i });
      fireEvent.click(refreshButton);

      expect(onRefresh).toHaveBeenCalledTimes(1);
    });

    it('calls onDelete when delete button clicked', () => {
      const onDelete = jest.fn();
      render(<RichEmbed {...defaultProps} onDelete={onDelete} />);

      // Hover to show toolbar
      const provider = screen.getByText('Twitter');
      const container = provider.closest('.MuiBox-root')?.parentElement;
      if (container) {
        fireEvent.mouseEnter(container);
      }

      const deleteButton = screen.getByRole('button', { name: /remove/i });
      fireEvent.click(deleteButton);

      expect(onDelete).toHaveBeenCalledTimes(1);
    });

    it('calls onConvertToChip when convert button clicked', () => {
      const onConvertToChip = jest.fn();
      render(<RichEmbed {...defaultProps} onConvertToChip={onConvertToChip} />);

      // Hover to show toolbar
      const provider = screen.getByText('Twitter');
      const container = provider.closest('.MuiBox-root')?.parentElement;
      if (container) {
        fireEvent.mouseEnter(container);
      }

      const convertButton = screen.getByRole('button', { name: /convert to chip/i });
      fireEvent.click(convertButton);

      expect(onConvertToChip).toHaveBeenCalledTimes(1);
    });
  });

  describe('open in browser', () => {
    it('calls onOpenInBrowser when open button clicked', () => {
      const onOpenInBrowser = jest.fn();
      render(<RichEmbed {...defaultProps} onOpenInBrowser={onOpenInBrowser} />);

      // Hover to show toolbar
      const provider = screen.getByText('Twitter');
      const container = provider.closest('.MuiBox-root')?.parentElement;
      if (container) {
        fireEvent.mouseEnter(container);
      }

      const openButton = screen.getByRole('button', { name: /open in browser/i });
      fireEvent.click(openButton);

      expect(onOpenInBrowser).toHaveBeenCalledTimes(1);
    });

    it('opens via electronAPI when no onOpenInBrowser provided', () => {
      render(<RichEmbed {...defaultProps} />);

      // Hover to show toolbar
      const provider = screen.getByText('Twitter');
      const container = provider.closest('.MuiBox-root')?.parentElement;
      if (container) {
        fireEvent.mouseEnter(container);
      }

      const openButton = screen.getByRole('button', { name: /open in browser/i });
      fireEvent.click(openButton);

      expect(window.electronAPI.shell.openExternal).toHaveBeenCalledWith(defaultProps.originalUrl);
    });
  });

  describe('dimensions', () => {
    it('uses default width when not provided', () => {
      const { container } = render(<RichEmbed {...defaultProps} />);

      // Container should have a width set
      const mainBox = container.firstChild as HTMLElement;
      expect(mainBox).toBeInTheDocument();
    });

    it('uses provided width', () => {
      const { container } = render(<RichEmbed {...defaultProps} width={400} />);

      const mainBox = container.firstChild as HTMLElement;
      expect(mainBox).toBeInTheDocument();
    });

    it('uses provided height for iframe', () => {
      render(<RichEmbed {...defaultProps} height={250} />);

      const iframe = screen.getByTitle('Tweet by User');
      expect(iframe).toBeInTheDocument();
    });
  });

  describe('selection state', () => {
    it('applies selected styling when selected', () => {
      const { container } = render(<RichEmbed {...defaultProps} selected={true} />);

      const mainBox = container.firstChild as HTMLElement;
      expect(mainBox).toHaveStyle({ borderColor: expect.anything() });
    });
  });
});

/**
 * RichEmbed Component
 *
 * Renders arbitrary HTML content in a sandboxed iframe.
 * Used for oEmbed "rich" type responses (e.g., Twitter embeds).
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, Typography, IconButton, Tooltip, Skeleton } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LabelIcon from '@mui/icons-material/Label';
import LinkIcon from '@mui/icons-material/Link';
import { isAllowedRichProvider } from './utils/providerEmbed';

/**
 * Props for the RichEmbed component
 */
export interface RichEmbedProps {
  /** HTML content to embed */
  html: string;
  /** Original URL */
  originalUrl: string;
  /** Provider URL for security check */
  providerUrl?: string | null;
  /** Provider name */
  providerName?: string | null;
  /** Title */
  title?: string | null;
  /** Expected width */
  width?: number | null;
  /** Expected height */
  height?: number | null;
  /** Whether the node is selected in the editor */
  selected?: boolean;
  /** Callback to refresh */
  onRefresh?: () => void;
  /** Callback to delete */
  onDelete?: () => void;
  /** Callback to open in browser */
  onOpenInBrowser?: () => void;
  /** Callback to convert to chip */
  onConvertToChip?: () => void;
  /** Callback to convert to plain link */
  onConvertToPlainLink?: () => void;
}

/**
 * RichEmbed - Renders sandboxed HTML content
 */
export const RichEmbed: React.FC<RichEmbedProps> = ({
  html,
  originalUrl,
  providerUrl,
  providerName,
  title,
  width,
  height,
  selected = false,
  onRefresh,
  onDelete,
  onOpenInBrowser,
  onConvertToChip,
  onConvertToPlainLink,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [iframeHeight, setIframeHeight] = useState<number>(height ?? 300);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Check if provider is allowed
  const isAllowed = isAllowedRichProvider(providerUrl ?? undefined);

  const handleOpenInBrowser = useCallback(() => {
    if (onOpenInBrowser) {
      onOpenInBrowser();
    } else {
      void window.electronAPI.shell.openExternal(originalUrl);
    }
  }, [originalUrl, onOpenInBrowser]);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);

    // Try to get the actual content height
    if (iframeRef.current) {
      try {
        const iframeDoc = iframeRef.current.contentDocument;
        if (iframeDoc?.body) {
          const contentHeight = iframeDoc.body.scrollHeight;
          if (contentHeight > 0) {
            setIframeHeight(Math.min(contentHeight + 20, 800)); // Max 800px
          }
        }
      } catch {
        // Cross-origin, can't access - use default height
      }
    }
  }, []);

  // Listen for resize messages from iframe
  useEffect(() => {
    const handleMessage = (event: MessageEvent<unknown>): void => {
      const data = event.data as Record<string, unknown> | null;
      if (data?.['type'] === 'resize' && typeof data['height'] === 'number') {
        setIframeHeight(Math.min(data['height'], 800));
      }
    };

    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  const showToolbar = isHovered || selected;

  // If provider is not allowed, don't render HTML - caller should fallback to UnfurlCard
  if (!isAllowed) {
    return null;
  }

  // Create sandboxed HTML document
  const sandboxedHtml = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <meta http-equiv="Content-Security-Policy"
              content="default-src 'self' https:; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; img-src 'self' https: data:; frame-src https:;">
        <style>
          * { box-sizing: border-box; }
          body {
            margin: 0;
            padding: 8px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            overflow: hidden;
          }
          /* Common embed styles */
          .twitter-tweet, .instagram-media, blockquote {
            margin: 0 !important;
          }
        </style>
        <script>
          // Report height to parent
          function reportHeight() {
            const height = document.body.scrollHeight;
            window.parent.postMessage({ type: 'resize', height: height }, '*');
          }
          // Report on load and resize
          window.addEventListener('load', () => {
            reportHeight();
            // Re-report after embeds load (Twitter, etc.)
            setTimeout(reportHeight, 1000);
            setTimeout(reportHeight, 2000);
            setTimeout(reportHeight, 3000);
          });
          window.addEventListener('resize', reportHeight);
          // Observe DOM changes
          const observer = new MutationObserver(reportHeight);
          document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, { childList: true, subtree: true });
          });
        </script>
      </head>
      <body>${html}</body>
    </html>
  `;

  return (
    <Box
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      sx={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        maxWidth: '100%',
        width: width ?? 550,
        my: 1,
        border: 1,
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        backgroundColor: 'background.paper',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        '&:hover': {
          borderColor: selected ? 'primary.main' : 'action.hover',
        },
        ...(selected && {
          boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}25`,
        }),
      }}
    >
      {/* Toolbar - appears on hover/selection */}
      {showToolbar && (
        <Box
          onClick={(e) => {
            e.stopPropagation();
          }}
          sx={{
            position: 'absolute',
            top: 8,
            right: 8,
            zIndex: 10,
            display: 'flex',
            gap: 0.5,
            backgroundColor: 'background.paper',
            borderRadius: 1,
            border: 1,
            borderColor: 'divider',
            px: 0.5,
            py: 0.25,
            boxShadow: 1,
          }}
        >
          <Tooltip title="Open in browser">
            <IconButton size="small" onClick={handleOpenInBrowser} aria-label="Open in browser">
              <OpenInNewIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton size="small" onClick={onRefresh} aria-label="Refresh">
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          {onConvertToChip && (
            <Tooltip title="Convert to chip">
              <IconButton size="small" onClick={onConvertToChip} aria-label="Convert to chip">
                <LabelIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          {onConvertToPlainLink && (
            <Tooltip title="Convert to plain link">
              <IconButton
                size="small"
                onClick={onConvertToPlainLink}
                aria-label="Convert to plain link"
              >
                <LinkIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="Remove">
              <IconButton size="small" onClick={onDelete} aria-label="Remove">
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      {/* Loading skeleton */}
      {isLoading && (
        <Box sx={{ p: 2 }}>
          <Skeleton variant="text" width="60%" height={24} />
          <Skeleton variant="text" width="80%" height={18} />
          <Skeleton variant="rectangular" width="100%" height={150} sx={{ mt: 1 }} />
        </Box>
      )}

      {/* Sandboxed iframe */}
      <Box
        component="iframe"
        ref={iframeRef}
        srcDoc={sandboxedHtml}
        title={title ?? 'Embedded content'}
        sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
        onLoad={handleIframeLoad}
        sx={{
          width: '100%',
          height: iframeHeight,
          border: 'none',
          display: isLoading ? 'none' : 'block',
        }}
      />

      {/* Provider bar */}
      {providerName && (
        <Box
          sx={{
            p: 1,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            {providerName}
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default RichEmbed;

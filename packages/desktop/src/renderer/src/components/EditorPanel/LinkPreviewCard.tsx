/**
 * LinkPreviewCard Component
 *
 * Displays a rich preview card for web links with thumbnail, title, and description.
 * Shows on hover over link chips.
 */

import React, { useCallback } from 'react';
import { Box, Paper, Typography, IconButton, Tooltip, Skeleton } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import LinkIcon from '@mui/icons-material/Link';
import ViewAgendaOutlinedIcon from '@mui/icons-material/ViewAgendaOutlined';

/**
 * Preview data for a link (derived from oEmbed response)
 * This is a simplified view of oEmbed data for UI rendering
 */
export interface LinkPreviewData {
  /** Title of the page/resource */
  title?: string;
  /** Description/summary of the content */
  description?: string;
  /** URL to a thumbnail image */
  thumbnailUrl?: string;
  /** Favicon as a data URL */
  faviconUrl?: string;
  /** Name of the provider (e.g., "YouTube", "Twitter") */
  providerName?: string;
}

/**
 * Props for the LinkPreviewCard component
 */
export interface LinkPreviewCardProps {
  /** The URL being previewed */
  url: string;
  /** Preview data for the link (if available) */
  previewData?: LinkPreviewData;
  /** Whether data is currently loading */
  isLoading?: boolean;
  /** Error message if fetching failed */
  error?: string;
  /** Callback to refresh/re-fetch the preview */
  onRefresh?: () => void;
  /** Callback to open the link in browser */
  onOpenInBrowser?: () => void;
  /** Callback to expand this chip to a full unfurl card */
  onExpandToCard?: () => void;
  /** Whether expand to card option should be shown (only valid in certain contexts) */
  showExpandOption?: boolean;
}

/**
 * Extract domain from a URL for display
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

/**
 * Loading skeleton for the preview card
 */
const PreviewSkeleton: React.FC = () => (
  <Box sx={{ display: 'flex', gap: 2 }}>
    <Skeleton
      variant="rectangular"
      width={80}
      height={80}
      sx={{ borderRadius: 1, flexShrink: 0 }}
    />
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Skeleton variant="text" width="80%" height={24} />
      <Skeleton variant="text" width="100%" height={18} />
      <Skeleton variant="text" width="60%" height={18} />
    </Box>
  </Box>
);

/**
 * Error state for the preview card
 */
const PreviewError: React.FC<{ error: string; onRefresh?: () => void }> = ({
  error,
  onRefresh,
}) => (
  <Box
    sx={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      py: 2,
      color: 'text.secondary',
    }}
  >
    <Typography variant="body2" color="error" sx={{ mb: 1 }}>
      {error}
    </Typography>
    {onRefresh && (
      <IconButton size="small" onClick={onRefresh} aria-label="Retry loading preview">
        <RefreshIcon fontSize="small" />
      </IconButton>
    )}
  </Box>
);

/**
 * Default fallback when no oEmbed data is available
 */
const FallbackPreview: React.FC<{ url: string }> = ({ url }) => {
  const domain = extractDomain(url);

  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, py: 1 }}>
      <Box
        sx={{
          width: 40,
          height: 40,
          borderRadius: 1,
          backgroundColor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <LinkIcon sx={{ color: 'text.secondary' }} />
      </Box>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 500,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {domain}
        </Typography>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{
            display: 'block',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {url}
        </Typography>
      </Box>
    </Box>
  );
};

/**
 * LinkPreviewCard - Displays a rich preview for web links
 *
 * Visual design:
 * ┌─────────────────────────────────────────────┐
 * │ ┌─────────┐  Full Page Title                │
 * │ │         │  Description text that wraps    │
 * │ │  thumb  │  to multiple lines...           │
 * │ │         │                                 │
 * │ └─────────┘  🔗 example.com    [↗] [⟳]     │
 * └─────────────────────────────────────────────┘
 */
export const LinkPreviewCard: React.FC<LinkPreviewCardProps> = ({
  url,
  previewData,
  isLoading = false,
  error,
  onRefresh,
  onOpenInBrowser,
  onExpandToCard,
  showExpandOption = false,
}) => {
  const domain = extractDomain(url);

  const handleOpenInBrowser = useCallback(() => {
    if (onOpenInBrowser) {
      onOpenInBrowser();
    } else {
      void window.electronAPI.shell.openExternal(url);
    }
  }, [url, onOpenInBrowser]);

  const handleRefresh = useCallback(() => {
    onRefresh?.();
  }, [onRefresh]);

  return (
    <Paper
      elevation={8}
      sx={{
        width: 400,
        maxWidth: '100%',
        p: 2,
        borderRadius: 2,
      }}
    >
      {/* Loading state */}
      {isLoading && <PreviewSkeleton />}

      {/* Error state */}
      {!isLoading && error && <PreviewError error={error} {...(onRefresh ? { onRefresh } : {})} />}

      {/* Content - show when not loading and no error */}
      {!isLoading && !error && (
        <>
          {previewData ? (
            // Rich preview with oEmbed data
            <Box>
              <Box sx={{ display: 'flex', gap: 2 }}>
                {/* Thumbnail */}
                {previewData.thumbnailUrl && (
                  <Box
                    sx={{
                      width: 80,
                      height: 80,
                      borderRadius: 1,
                      overflow: 'hidden',
                      flexShrink: 0,
                      backgroundColor: 'action.hover',
                    }}
                  >
                    <Box
                      component="img"
                      src={previewData.thumbnailUrl}
                      alt=""
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                      }}
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        // Hide broken image
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </Box>
                )}

                {/* Text content */}
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  {/* Title */}
                  <Typography
                    variant="subtitle2"
                    sx={{
                      fontWeight: 600,
                      mb: 0.5,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                    }}
                  >
                    {previewData.title ?? domain}
                  </Typography>

                  {/* Description */}
                  {previewData.description && (
                    <Typography
                      variant="body2"
                      color="text.secondary"
                      sx={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        fontSize: '0.8125rem',
                      }}
                    >
                      {previewData.description}
                    </Typography>
                  )}
                </Box>
              </Box>

              {/* Footer with domain and actions */}
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  mt: 1.5,
                  pt: 1,
                  borderTop: 1,
                  borderColor: 'divider',
                }}
              >
                {/* Domain with favicon */}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
                  {previewData.faviconUrl && (
                    <Box
                      component="img"
                      src={previewData.faviconUrl}
                      alt=""
                      sx={{ width: 16, height: 16 }}
                      onError={(e: React.SyntheticEvent<HTMLImageElement>) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  )}
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {domain}
                  </Typography>
                </Box>

                {/* Action buttons */}
                <Box sx={{ display: 'flex', gap: 0.5 }}>
                  {showExpandOption && onExpandToCard && (
                    <Tooltip title="Expand to card">
                      <IconButton size="small" onClick={onExpandToCard} aria-label="Expand to card">
                        <ViewAgendaOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  <Tooltip title="Open in browser">
                    <IconButton
                      size="small"
                      onClick={handleOpenInBrowser}
                      aria-label="Open in browser"
                    >
                      <OpenInNewIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {onRefresh && (
                    <Tooltip title="Refresh preview">
                      <IconButton size="small" onClick={handleRefresh} aria-label="Refresh preview">
                        <RefreshIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </Box>
              </Box>
            </Box>
          ) : (
            // Fallback when no oEmbed data
            <>
              <FallbackPreview url={url} />
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                  mt: 1,
                  pt: 1,
                  borderTop: 1,
                  borderColor: 'divider',
                }}
              >
                <Tooltip title="Open in browser">
                  <IconButton
                    size="small"
                    onClick={handleOpenInBrowser}
                    aria-label="Open in browser"
                  >
                    <OpenInNewIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                {onRefresh && (
                  <Tooltip title="Refresh preview">
                    <IconButton size="small" onClick={handleRefresh} aria-label="Refresh preview">
                      <RefreshIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            </>
          )}
        </>
      )}
    </Paper>
  );
};

export default LinkPreviewCard;

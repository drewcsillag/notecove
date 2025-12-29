/**
 * UnfurlCard Component
 *
 * Displays a rich preview card for web links as a block-level element in the editor.
 * Used by the OEmbedUnfurl node extension.
 */

import React, { useCallback, useState } from 'react';
import { Box, Typography, IconButton, Tooltip, Skeleton, Button } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LinkIcon from '@mui/icons-material/Link';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LabelIcon from '@mui/icons-material/Label';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { type OEmbedErrorType, getOEmbedErrorMessage, isRetryableError } from '@notecove/shared';

/**
 * Props for the UnfurlCard component
 */
export interface UnfurlCardProps {
  /** The URL being unfurled */
  url: string;
  /** Title of the page */
  title?: string | null;
  /** Description/summary */
  description?: string | null;
  /** Thumbnail URL or data URL */
  thumbnailUrl?: string | null;
  /** Provider name (e.g., "YouTube") */
  providerName?: string | null;
  /** Whether data has been loaded */
  hasData?: boolean;
  /** Whether data is stale and should be refreshed */
  isStale?: boolean;
  /** Whether currently loading */
  isLoading?: boolean;
  /** Error message if fetch failed */
  error?: string | null;
  /** Error type for friendly messages */
  errorType?: OEmbedErrorType | null;
  /** Whether the node is selected in the editor */
  selected?: boolean;
  /** Callback to refresh the unfurl data */
  onRefresh?: () => void;
  /** Callback to delete the unfurl block */
  onDelete?: () => void;
  /** Callback to open in browser */
  onOpenInBrowser?: () => void;
  /** Callback to convert to chip (removes unfurl, keeps link as chip) */
  onConvertToChip?: () => void;
  /** Callback to convert to plain link (removes unfurl, keeps link as plain text) */
  onConvertToPlainLink?: () => void;
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
 * Loading skeleton for the unfurl card (vertical layout)
 */
const UnfurlSkeleton: React.FC = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
    {/* Text skeleton */}
    <Box>
      <Skeleton variant="text" width="70%" height={24} />
      <Skeleton variant="text" width="100%" height={18} />
      <Skeleton variant="text" width="40%" height={16} sx={{ mt: 0.5 }} />
    </Box>
    {/* Image skeleton */}
    <Skeleton variant="rectangular" width="100%" height={200} sx={{ borderRadius: 1 }} />
  </Box>
);

/**
 * Error state for the unfurl card
 */
interface UnfurlErrorProps {
  errorType?: OEmbedErrorType | null | undefined;
  error?: string | null | undefined;
  onRefresh?: (() => void) | undefined;
  onConvertToPlainLink?: (() => void) | undefined;
}

const UnfurlError: React.FC<UnfurlErrorProps> = ({
  errorType,
  error,
  onRefresh,
  onConvertToPlainLink,
}) => {
  const friendlyMessage = getOEmbedErrorMessage(errorType ?? undefined);
  const canRetry = isRetryableError(errorType ?? undefined);

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        py: 3,
        px: 2,
        color: 'text.secondary',
        textAlign: 'center',
      }}
    >
      <ErrorOutlineIcon sx={{ fontSize: 40, mb: 1.5, opacity: 0.5, color: 'warning.main' }} />
      <Typography variant="body2" sx={{ mb: 0.5, fontWeight: 500 }}>
        Preview not available
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 2 }}>
        {friendlyMessage}
      </Typography>
      <Box sx={{ display: 'flex', gap: 1 }}>
        {canRetry && onRefresh && (
          <Button
            size="small"
            variant="outlined"
            startIcon={<RefreshIcon />}
            onClick={(e) => {
              e.stopPropagation();
              onRefresh();
            }}
          >
            Try Again
          </Button>
        )}
        {onConvertToPlainLink && (
          <Button
            size="small"
            variant="text"
            onClick={(e) => {
              e.stopPropagation();
              onConvertToPlainLink();
            }}
          >
            Show as Link
          </Button>
        )}
      </Box>
      {/* Show raw error for debugging (subtle) */}
      {error && error !== friendlyMessage && (
        <Typography variant="caption" color="text.disabled" sx={{ mt: 1, fontSize: 10 }}>
          {error}
        </Typography>
      )}
    </Box>
  );
};

/**
 * UnfurlCard - Displays a rich preview card for web links
 *
 * Visual design:
 * ┌─────────────────────────────────────────────────────┐
 * │ ┌─────────────┐  Page Title Here                    │
 * │ │             │  Description text that can wrap to  │
 * │ │  thumbnail  │  multiple lines but gets truncated  │
 * │ │   (120px)   │  after 3 lines with ellipsis...     │
 * │ │             │                                     │
 * │ └─────────────┘  example.com                        │
 * └─────────────────────────────────────────────────────┘
 */
export const UnfurlCard: React.FC<UnfurlCardProps> = ({
  url,
  title,
  description,
  thumbnailUrl,
  providerName,
  // hasData - no longer used but kept for API compatibility
  hasData: _hasData = false,
  isStale = false,
  isLoading = false,
  error,
  errorType,
  selected = false,
  onRefresh,
  onDelete,
  onOpenInBrowser,
  onConvertToChip,
  onConvertToPlainLink,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [thumbnailError, setThumbnailError] = useState(false);
  const [copied, setCopied] = useState(false);
  const domain = extractDomain(url);

  const handleOpenInBrowser = useCallback(() => {
    if (onOpenInBrowser) {
      onOpenInBrowser();
    } else {
      void window.electronAPI.shell.openExternal(url);
    }
  }, [url, onOpenInBrowser]);

  const handleCopyUrl = useCallback(() => {
    // Copy as rich format with plain text fallback
    // Rich format: HTML link with title for pasting in rich text editors
    // Plain format: Just the URL for plain text contexts
    const linkTitle = title ?? url;
    const html = `<a href="${url}">${linkTitle}</a>`;
    void window.electronAPI.clipboard.writeRich(html, url);
    setCopied(true);
    setTimeout(() => {
      setCopied(false);
    }, 2000);
  }, [url, title]);

  const handleThumbnailError = useCallback(() => {
    setThumbnailError(true);
  }, []);

  const showToolbar = isHovered || selected;
  const showThumbnail = thumbnailUrl && !thumbnailError;

  return (
    <Box
      onMouseEnter={() => {
        setIsHovered(true);
      }}
      onMouseLeave={() => {
        setIsHovered(false);
      }}
      onClick={handleOpenInBrowser}
      sx={{
        position: 'relative',
        display: 'inline-flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 1.5,
        p: 1.5,
        my: 1,
        maxWidth: '100%',
        border: 1,
        borderColor: selected ? 'primary.main' : 'divider',
        borderRadius: 2,
        cursor: 'pointer',
        transition: 'border-color 0.2s, box-shadow 0.2s',
        backgroundColor: 'background.paper',
        '&:hover': {
          borderColor: selected ? 'primary.main' : 'action.hover',
        },
        ...(selected && {
          boxShadow: (theme) => `0 0 0 2px ${theme.palette.primary.main}25`,
        }),
      }}
    >
      {/* Toolbar - appears on hover/selection */}
      {showToolbar && !isLoading && (
        <Box
          onClick={(e) => {
            e.stopPropagation();
          }}
          sx={{
            position: 'absolute',
            top: -12,
            right: 8,
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
          <Tooltip title={copied ? 'Copied!' : 'Copy URL'}>
            <IconButton size="small" onClick={handleCopyUrl} aria-label="Copy URL">
              <ContentCopyIcon sx={{ fontSize: 16, color: copied ? 'success.main' : undefined }} />
            </IconButton>
          </Tooltip>
          {onRefresh && (
            <Tooltip title={isStale ? 'Refresh (data may be stale)' : 'Refresh'}>
              <IconButton
                size="small"
                onClick={onRefresh}
                aria-label="Refresh preview"
                color={isStale ? 'warning' : 'default'}
              >
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
            <Tooltip title="Remove preview">
              <IconButton size="small" onClick={onDelete} aria-label="Remove preview">
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      {/* Loading state */}
      {isLoading && <UnfurlSkeleton />}

      {/* Error state */}
      {!isLoading && error && (
        <UnfurlError
          error={error}
          errorType={errorType}
          onRefresh={onRefresh}
          onConvertToPlainLink={onConvertToPlainLink}
        />
      )}

      {/* Content - show when not loading and no error */}
      {!isLoading && !error && (
        <>
          {/* Text content - now on top */}
          <Box>
            {/* Title */}
            <Typography
              variant="subtitle1"
              sx={{
                fontWeight: 600,
                mb: 0.5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                lineHeight: 1.3,
              }}
            >
              {title ?? url}
            </Typography>

            {/* Description */}
            {description && (
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  display: '-webkit-box',
                  WebkitLineClamp: 2,
                  WebkitBoxOrient: 'vertical',
                  lineHeight: 1.4,
                  mb: 0.5,
                }}
              >
                {description}
              </Typography>
            )}

            {/* Domain/Provider */}
            <Typography
              variant="caption"
              color="text.secondary"
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.5,
              }}
            >
              <LinkIcon sx={{ fontSize: 12 }} />
              {providerName ?? domain}
            </Typography>
          </Box>

          {/* Thumbnail - preserves aspect ratio, doesn't stretch */}
          {showThumbnail && (
            <Box
              component="img"
              src={thumbnailUrl}
              alt=""
              sx={{
                maxWidth: '100%',
                height: 'auto',
                maxHeight: 400,
                borderRadius: 1,
                backgroundColor: 'action.hover',
              }}
              onError={handleThumbnailError}
            />
          )}
        </>
      )}
    </Box>
  );
};

export default UnfurlCard;

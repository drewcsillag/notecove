/**
 * VideoEmbed Component
 *
 * Renders an embedded video player (YouTube, Vimeo, etc.) in an iframe.
 * Used by OEmbedUnfurl for video-type oEmbed responses.
 */

import React, { useState, useCallback } from 'react';
import { Box, Typography, IconButton, Tooltip, Skeleton } from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import RefreshIcon from '@mui/icons-material/Refresh';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import LabelIcon from '@mui/icons-material/Label';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';

/**
 * Props for the VideoEmbed component
 */
export interface VideoEmbedProps {
  /** The embed URL for the iframe */
  embedUrl: string;
  /** Original URL of the video page */
  originalUrl: string;
  /** Video title */
  title?: string | null;
  /** Provider name (e.g., "YouTube") */
  providerName?: string | null;
  /** Thumbnail URL to show before playing */
  thumbnailUrl?: string | null;
  /** Aspect ratio (width / height), defaults to 16/9 */
  aspectRatio?: number | undefined;
  /** Whether the node is selected in the editor */
  selected?: boolean;
  /** Callback to refresh the embed data */
  onRefresh?: () => void;
  /** Callback to delete the embed block */
  onDelete?: () => void;
  /** Callback to open original URL in browser */
  onOpenInBrowser?: () => void;
  /** Callback to convert to chip */
  onConvertToChip?: () => void;
}

/**
 * VideoEmbed - Renders an embedded video player
 */
export const VideoEmbed: React.FC<VideoEmbedProps> = ({
  embedUrl,
  originalUrl,
  title,
  providerName,
  thumbnailUrl,
  aspectRatio = 16 / 9,
  selected = false,
  onRefresh,
  onDelete,
  onOpenInBrowser,
  onConvertToChip,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleOpenInBrowser = useCallback(() => {
    if (onOpenInBrowser) {
      onOpenInBrowser();
    } else {
      void window.electronAPI.shell.openExternal(originalUrl);
    }
  }, [originalUrl, onOpenInBrowser]);

  const handlePlay = useCallback(() => {
    setIsLoading(true);
    setIsPlaying(true);
  }, []);

  const handleIframeLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  const showToolbar = isHovered || selected;

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
        width: 640,
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
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            borderRadius: 1,
            px: 0.5,
            py: 0.25,
          }}
        >
          <Tooltip title="Open in browser">
            <IconButton
              size="small"
              onClick={handleOpenInBrowser}
              aria-label="Open in browser"
              sx={{ color: 'white' }}
            >
              <OpenInNewIcon sx={{ fontSize: 16 }} />
            </IconButton>
          </Tooltip>
          {onRefresh && (
            <Tooltip title="Refresh">
              <IconButton
                size="small"
                onClick={onRefresh}
                aria-label="Refresh"
                sx={{ color: 'white' }}
              >
                <RefreshIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          {onConvertToChip && (
            <Tooltip title="Convert to chip">
              <IconButton
                size="small"
                onClick={onConvertToChip}
                aria-label="Convert to chip"
                sx={{ color: 'white' }}
              >
                <LabelIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip title="Remove">
              <IconButton
                size="small"
                onClick={onDelete}
                aria-label="Remove"
                sx={{ color: 'white' }}
              >
                <DeleteOutlineIcon sx={{ fontSize: 16 }} />
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      {/* Video container */}
      <Box
        data-testid="video-container"
        data-aspect-ratio={aspectRatio}
        sx={{
          position: 'relative',
          width: '100%',
          paddingTop: `${(1 / aspectRatio) * 100}%`,
          backgroundColor: 'black',
        }}
      >
        {isPlaying ? (
          <>
            {isLoading && (
              <Skeleton
                variant="rectangular"
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                }}
              />
            )}
            <Box
              component="iframe"
              src={embedUrl}
              title={title ?? 'Video'}
              onLoad={handleIframeLoad}
              sx={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                border: 'none',
              }}
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </>
        ) : (
          /* Thumbnail with play button */
          <Box
            onClick={handlePlay}
            sx={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '&:hover .play-button': {
                transform: 'scale(1.1)',
              },
            }}
          >
            {thumbnailUrl && (
              <Box
                component="img"
                src={thumbnailUrl}
                alt=""
                sx={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}
            <Box
              className="play-button"
              sx={{
                position: 'relative',
                zIndex: 1,
                width: 68,
                height: 48,
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                borderRadius: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 0.2s',
              }}
            >
              <PlayArrowIcon sx={{ fontSize: 32, color: 'white' }} />
            </Box>
          </Box>
        )}
      </Box>

      {/* Title bar */}
      <Box
        sx={{
          p: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          borderTop: 1,
          borderColor: 'divider',
        }}
      >
        <Typography
          variant="body2"
          sx={{
            flex: 1,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {title ?? originalUrl}
        </Typography>
        {providerName && (
          <Typography variant="caption" color="text.secondary">
            {providerName}
          </Typography>
        )}
      </Box>
    </Box>
  );
};

export default VideoEmbed;

/**
 * ImageLightbox - Full-screen image viewer
 *
 * Displays images in a full-screen lightbox overlay with:
 * - Full-resolution image display
 * - Dark overlay background
 * - Close button (X) in corner
 * - Click outside to close
 * - Escape key to close
 * - Arrow keys for next/prev navigation
 *
 * @see plans/add-images/PLAN-PHASE-3.md
 */

import { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Box, IconButton, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

/** Event data for opening lightbox */
export interface LightboxOpenEvent {
  imageId: string;
  sdId: string;
  alt?: string;
  /** All images in the note for navigation */
  allImages?: { imageId: string; sdId: string; alt?: string }[] | undefined;
}

/** Custom event name for opening lightbox */
export const LIGHTBOX_OPEN_EVENT = 'notecove:lightbox:open';

/**
 * Dispatch event to open lightbox
 */
export function openLightbox(data: LightboxOpenEvent): void {
  const event = new CustomEvent(LIGHTBOX_OPEN_EVENT, { detail: data });
  window.dispatchEvent(event);
}

/**
 * ImageLightbox component
 */
export function ImageLightbox(): React.JSX.Element | null {
  const [isOpen, setIsOpen] = useState(false);
  const [currentImage, setCurrentImage] = useState<LightboxOpenEvent | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  // Handle open event
  useEffect(() => {
    const handleOpen = (e: Event) => {
      const data = (e as CustomEvent<LightboxOpenEvent>).detail;
      setCurrentImage(data);
      setIsOpen(true);

      // Find current index if navigating through multiple images
      if (data.allImages) {
        const idx = data.allImages.findIndex((img) => img.imageId === data.imageId);
        setCurrentIndex(idx >= 0 ? idx : 0);
      } else {
        setCurrentIndex(0);
      }
    };

    window.addEventListener(LIGHTBOX_OPEN_EVENT, handleOpen);
    return () => {
      window.removeEventListener(LIGHTBOX_OPEN_EVENT, handleOpen);
    };
  }, []);

  // Load image when currentImage changes
  useEffect(() => {
    if (!currentImage) {
      setImageUrl(null);
      return;
    }

    setIsLoading(true);
    void (async () => {
      try {
        const url = await window.electronAPI.image.getDataUrl(
          currentImage.sdId,
          currentImage.imageId
        );
        setImageUrl(url);
      } catch (error) {
        console.error('[ImageLightbox] Failed to load image:', error);
        setImageUrl(null);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [currentImage]);

  // Close lightbox
  const close = useCallback(() => {
    setIsOpen(false);
    setCurrentImage(null);
    setImageUrl(null);
  }, []);

  // Navigate to previous image
  const goToPrev = useCallback(() => {
    if (!currentImage?.allImages || currentImage.allImages.length <= 1) return;
    const newIndex =
      (currentIndex - 1 + currentImage.allImages.length) % currentImage.allImages.length;
    const prevImage = currentImage.allImages[newIndex];
    if (prevImage) {
      setCurrentImage({ ...prevImage, allImages: currentImage.allImages });
      setCurrentIndex(newIndex);
    }
  }, [currentImage, currentIndex]);

  // Navigate to next image
  const goToNext = useCallback(() => {
    if (!currentImage?.allImages || currentImage.allImages.length <= 1) return;
    const newIndex = (currentIndex + 1) % currentImage.allImages.length;
    const nextImage = currentImage.allImages[newIndex];
    if (nextImage) {
      setCurrentImage({ ...nextImage, allImages: currentImage.allImages });
      setCurrentIndex(newIndex);
    }
  }, [currentImage, currentIndex]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      } else if (e.key === 'ArrowLeft') {
        goToPrev();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, close, goToPrev, goToNext]);

  // Prevent body scroll when lightbox is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const hasMultipleImages = (currentImage?.allImages?.length ?? 0) > 1;

  return createPortal(
    <Box
      onClick={close}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        animation: 'lightbox-fade-in 0.2s ease-out',
        '@keyframes lightbox-fade-in': {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
      }}
    >
      {/* Close button */}
      <IconButton
        onClick={close}
        sx={{
          position: 'absolute',
          top: 16,
          right: 16,
          color: 'white',
          backgroundColor: 'rgba(255, 255, 255, 0.1)',
          '&:hover': {
            backgroundColor: 'rgba(255, 255, 255, 0.2)',
          },
        }}
        aria-label="Close lightbox"
      >
        <CloseIcon />
      </IconButton>

      {/* Previous button */}
      {hasMultipleImages && (
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            goToPrev();
          }}
          sx={{
            position: 'absolute',
            left: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'white',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            },
          }}
          aria-label="Previous image"
        >
          <ChevronLeftIcon fontSize="large" />
        </IconButton>
      )}

      {/* Next button */}
      {hasMultipleImages && (
        <IconButton
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          sx={{
            position: 'absolute',
            right: 16,
            top: '50%',
            transform: 'translateY(-50%)',
            color: 'white',
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
            '&:hover': {
              backgroundColor: 'rgba(255, 255, 255, 0.2)',
            },
          }}
          aria-label="Next image"
        >
          <ChevronRightIcon fontSize="large" />
        </IconButton>
      )}

      {/* Image container */}
      <Box
        onClick={(e) => {
          e.stopPropagation();
        }}
        sx={{
          maxWidth: '90vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          animation: 'lightbox-scale-in 0.2s ease-out',
          '@keyframes lightbox-scale-in': {
            from: { transform: 'scale(0.95)', opacity: 0 },
            to: { transform: 'scale(1)', opacity: 1 },
          },
        }}
      >
        {isLoading ? (
          <Typography color="white">Loading...</Typography>
        ) : imageUrl ? (
          <Box
            component="img"
            src={imageUrl}
            alt={currentImage?.alt ?? ''}
            sx={{
              maxWidth: '100%',
              maxHeight: '90vh',
              objectFit: 'contain',
              borderRadius: 1,
            }}
          />
        ) : (
          <Typography color="error.main">Failed to load image</Typography>
        )}

        {/* Image counter */}
        {hasMultipleImages && (
          <Typography
            sx={{
              color: 'white',
              mt: 2,
              fontSize: '0.875rem',
              opacity: 0.7,
            }}
          >
            {currentIndex + 1} / {currentImage?.allImages?.length}
          </Typography>
        )}
      </Box>
    </Box>,
    document.body
  );
}

export default ImageLightbox;

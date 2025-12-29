/**
 * Bottom Statusbar Component
 *
 * A window-wide statusbar at the bottom of the application.
 * Contains the SyncStatusIndicator and reserves space for future status items.
 */

import React from 'react';
import { Box, useTheme } from '@mui/material';
import { SyncStatusIndicator } from '../SyncStatusIndicator';

export interface BottomStatusbarProps {
  /** Optional children to render in the right section */
  children?: React.ReactNode;
}

export const BottomStatusbar: React.FC<BottomStatusbarProps> = ({ children }) => {
  const theme = useTheme();

  return (
    <Box
      data-testid="bottom-statusbar"
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        width: '100%',
        borderTop: `1px solid ${theme.palette.divider}`,
        backgroundColor: theme.palette.background.paper,
        minHeight: 24,
      }}
    >
      {/* Left section - sync indicator */}
      <Box sx={{ display: 'flex', alignItems: 'center' }}>
        <SyncStatusIndicator />
      </Box>

      {/* Right section - reserved for future status items */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, pr: 1 }}>{children}</Box>
    </Box>
  );
};

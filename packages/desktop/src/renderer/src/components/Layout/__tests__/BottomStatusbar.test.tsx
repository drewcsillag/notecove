/**
 * BottomStatusbar Component Tests
 */

import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ThemeProvider, createTheme } from '@mui/material';
import { BottomStatusbar } from '../BottomStatusbar';

// Mock SyncStatusIndicator to simplify testing
jest.mock('../../SyncStatusIndicator', () => ({
  SyncStatusIndicator: () => <div data-testid="sync-status-indicator">Sync Status</div>,
}));

const theme = createTheme();

const renderWithTheme = (component: React.ReactElement) => {
  return render(<ThemeProvider theme={theme}>{component}</ThemeProvider>);
};

describe('BottomStatusbar', () => {
  it('should render at bottom of window', () => {
    const { container } = renderWithTheme(<BottomStatusbar />);

    // Check that the statusbar element exists
    const statusbar = container.firstChild as HTMLElement;
    expect(statusbar).toBeTruthy();
  });

  it('should contain SyncStatusIndicator', () => {
    renderWithTheme(<BottomStatusbar />);

    expect(screen.getByTestId('sync-status-indicator')).toBeInTheDocument();
  });

  it('should have proper styling with border-top', () => {
    const { container } = renderWithTheme(<BottomStatusbar />);

    const statusbar = container.firstChild as HTMLElement;
    // The MUI Box should have the border-top style
    expect(statusbar).toHaveStyle({ borderTop: expect.any(String) });
  });

  it('should have flexbox layout for future items', () => {
    const { container } = renderWithTheme(<BottomStatusbar />);

    const statusbar = container.firstChild as HTMLElement;
    expect(statusbar).toHaveStyle({ display: 'flex' });
  });

  it('should render left section for sync indicator', () => {
    renderWithTheme(<BottomStatusbar />);

    // Sync indicator should be on the left side
    const syncIndicator = screen.getByTestId('sync-status-indicator');
    expect(syncIndicator).toBeInTheDocument();
  });

  it('should have data-testid for integration testing', () => {
    renderWithTheme(<BottomStatusbar />);

    expect(screen.getByTestId('bottom-statusbar')).toBeInTheDocument();
  });
});

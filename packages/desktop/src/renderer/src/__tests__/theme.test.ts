/**
 * Tests for Material-UI Theme Configuration
 */

import { createAppTheme, theme } from '../theme';

describe('Theme', () => {
  describe('createAppTheme', () => {
    it('should create a light theme', () => {
      const lightTheme = createAppTheme('light');

      expect(lightTheme.palette.mode).toBe('light');
      expect(lightTheme.palette.primary.main).toBe('#2196F3');
      expect(lightTheme.palette.secondary.main).toBe('#1976D2');
    });

    it('should create a dark theme', () => {
      const darkTheme = createAppTheme('dark');

      expect(darkTheme.palette.mode).toBe('dark');
      expect(darkTheme.palette.primary.main).toBe('#2196F3');
      expect(darkTheme.palette.secondary.main).toBe('#1976D2');
    });

    it('should have custom font family', () => {
      const appTheme = createAppTheme('light');

      expect(appTheme.typography.fontFamily).toContain('-apple-system');
      expect(appTheme.typography.fontFamily).toContain('Roboto');
    });

    it('should have body style overrides', () => {
      const appTheme = createAppTheme('light');

      const cssBaseline = appTheme.components?.MuiCssBaseline;
      expect(cssBaseline).toBeDefined();

      const styleOverrides = cssBaseline?.styleOverrides as Record<string, Record<string, unknown>>;
      expect(styleOverrides?.body?.margin).toBe(0);
      expect(styleOverrides?.body?.padding).toBe(0);
      expect(styleOverrides?.body?.overflow).toBe('hidden');
    });
  });

  describe('default theme export', () => {
    it('should export a default light theme', () => {
      expect(theme.palette.mode).toBe('light');
    });
  });
});

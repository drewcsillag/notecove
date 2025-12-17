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
      expect(styleOverrides['body']?.['margin']).toBe(0);
      expect(styleOverrides['body']?.['padding']).toBe(0);
      expect(styleOverrides['body']?.['overflow']).toBe('hidden');
    });
  });

  describe('default theme export', () => {
    it('should export a default light theme', () => {
      expect(theme.palette.mode).toBe('light');
    });
  });

  describe('scrollbar styling', () => {
    it('should define scrollbar styles in light mode', () => {
      const lightTheme = createAppTheme('light');
      const styleOverrides = lightTheme.components?.MuiCssBaseline?.styleOverrides as Record<
        string,
        unknown
      >;

      expect(styleOverrides).toBeDefined();
      expect(styleOverrides['::-webkit-scrollbar']).toBeDefined();
      expect(styleOverrides['::-webkit-scrollbar-track']).toBeDefined();
      expect(styleOverrides['::-webkit-scrollbar-thumb']).toBeDefined();
    });

    it('should define scrollbar styles in dark mode', () => {
      const darkTheme = createAppTheme('dark');
      const styleOverrides = darkTheme.components?.MuiCssBaseline?.styleOverrides as Record<
        string,
        unknown
      >;

      expect(styleOverrides).toBeDefined();
      expect(styleOverrides['::-webkit-scrollbar']).toBeDefined();
      expect(styleOverrides['::-webkit-scrollbar-track']).toBeDefined();
      expect(styleOverrides['::-webkit-scrollbar-thumb']).toBeDefined();
    });

    it('should have different thumb colors for light and dark modes', () => {
      const lightTheme = createAppTheme('light');
      const darkTheme = createAppTheme('dark');

      const lightOverrides = lightTheme.components?.MuiCssBaseline?.styleOverrides as Record<
        string,
        Record<string, unknown>
      >;
      const darkOverrides = darkTheme.components?.MuiCssBaseline?.styleOverrides as Record<
        string,
        Record<string, unknown>
      >;

      const lightThumbColor = lightOverrides['::-webkit-scrollbar-thumb']?.['backgroundColor'];
      const darkThumbColor = darkOverrides['::-webkit-scrollbar-thumb']?.['backgroundColor'];

      expect(lightThumbColor).toBeDefined();
      expect(darkThumbColor).toBeDefined();
      expect(lightThumbColor).not.toBe(darkThumbColor);
    });

    it('should set scrollbar width', () => {
      const lightTheme = createAppTheme('light');
      const styleOverrides = lightTheme.components?.MuiCssBaseline?.styleOverrides as Record<
        string,
        Record<string, unknown>
      >;

      const scrollbarWidth = styleOverrides['::-webkit-scrollbar']?.['width'];
      expect(scrollbarWidth).toBeDefined();
    });
  });
});

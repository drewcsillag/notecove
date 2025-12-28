/**
 * TipTap Editor Styles Tests
 *
 * Tests for the editor styles function, particularly max-width constraints.
 */

import { createTheme } from '@mui/material';
import { getTipTapEditorStyles, EDITOR_MAX_WIDTH } from '../tipTapEditorStyles';

describe('getTipTapEditorStyles', () => {
  const lightTheme = createTheme({ palette: { mode: 'light' } });
  const darkTheme = createTheme({ palette: { mode: 'dark' } });

  describe('EDITOR_MAX_WIDTH constant', () => {
    it('exports EDITOR_MAX_WIDTH constant', () => {
      expect(EDITOR_MAX_WIDTH).toBeDefined();
      expect(typeof EDITOR_MAX_WIDTH).toBe('number');
      expect(EDITOR_MAX_WIDTH).toBeGreaterThan(0);
    });

    it('has a reasonable value for reading width', () => {
      // Should be between 600-900px for comfortable reading
      expect(EDITOR_MAX_WIDTH).toBeGreaterThanOrEqual(600);
      expect(EDITOR_MAX_WIDTH).toBeLessThanOrEqual(900);
    });
  });

  describe('ProseMirror max-width styles', () => {
    it('applies max-width to ProseMirror element in light theme', () => {
      const styles = getTipTapEditorStyles(lightTheme);

      // Access the nested ProseMirror styles
      const proseMirrorStyles = (styles as Record<string, unknown>)['& .ProseMirror'] as Record<
        string,
        unknown
      >;

      expect(proseMirrorStyles).toBeDefined();
      expect(proseMirrorStyles['maxWidth']).toBe(EDITOR_MAX_WIDTH);
    });

    it('applies max-width to ProseMirror element in dark theme', () => {
      const styles = getTipTapEditorStyles(darkTheme);

      const proseMirrorStyles = (styles as Record<string, unknown>)['& .ProseMirror'] as Record<
        string,
        unknown
      >;

      expect(proseMirrorStyles).toBeDefined();
      expect(proseMirrorStyles['maxWidth']).toBe(EDITOR_MAX_WIDTH);
    });

    it('centers ProseMirror content with auto margins', () => {
      const styles = getTipTapEditorStyles(lightTheme);

      const proseMirrorStyles = (styles as Record<string, unknown>)['& .ProseMirror'] as Record<
        string,
        unknown
      >;

      expect(proseMirrorStyles['marginLeft']).toBe('auto');
      expect(proseMirrorStyles['marginRight']).toBe('auto');
    });
  });
});

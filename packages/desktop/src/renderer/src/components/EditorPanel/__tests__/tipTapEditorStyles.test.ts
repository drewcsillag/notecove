/**
 * TipTap Editor Styles Tests
 *
 * Tests for the editor styles function, particularly max-width constraints
 * and conditional strikethrough styling.
 */

import { createTheme } from '@mui/material';
import { getTipTapEditorStyles, EDITOR_MAX_WIDTH } from '../tipTapEditorStyles';

describe('getTipTapEditorStyles', () => {
  const lightTheme = createTheme({ palette: { mode: 'light' } });
  const darkTheme = createTheme({ palette: { mode: 'dark' } });

  // Helper to extract task item styles from the nested structure
  // Task items are at: ProseMirror > li[data-type="taskItem"] > &[data-checked="X"] > .task-content
  function getTaskItemContentStyles(
    styles: Record<string, unknown>,
    checkedState: 'checked' | 'nope'
  ): Record<string, unknown> | undefined {
    const proseMirrorStyles = styles['& .ProseMirror'] as Record<string, unknown>;
    const taskItemStyles = proseMirrorStyles['& li[data-type="taskItem"]'] as Record<
      string,
      unknown
    >;
    const checkedStyles = taskItemStyles[`&[data-checked="${checkedState}"]`] as
      | Record<string, unknown>
      | undefined;
    return checkedStyles?.['& .task-content'] as Record<string, unknown> | undefined;
  }

  // Helper to get checkbox styles
  function getTaskItemCheckboxStyles(
    styles: Record<string, unknown>,
    checkedState: 'checked' | 'nope'
  ): Record<string, unknown> | undefined {
    const proseMirrorStyles = styles['& .ProseMirror'] as Record<string, unknown>;
    const taskItemStyles = proseMirrorStyles['& li[data-type="taskItem"]'] as Record<
      string,
      unknown
    >;
    const checkedStyles = taskItemStyles[`&[data-checked="${checkedState}"]`] as
      | Record<string, unknown>
      | undefined;
    return checkedStyles?.['& .task-checkbox'] as Record<string, unknown> | undefined;
  }

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

  describe('strikethrough option', () => {
    it('applies strikethrough to checked items by default', () => {
      const styles = getTipTapEditorStyles(lightTheme) as Record<string, unknown>;
      const contentStyles = getTaskItemContentStyles(styles, 'checked');

      expect(contentStyles).toBeDefined();
      expect(contentStyles?.['textDecoration']).toBe('line-through');
      expect(contentStyles?.['opacity']).toBe(0.6);
    });

    it('applies strikethrough to nope items by default', () => {
      const styles = getTipTapEditorStyles(lightTheme) as Record<string, unknown>;
      const contentStyles = getTaskItemContentStyles(styles, 'nope');

      expect(contentStyles).toBeDefined();
      expect(contentStyles?.['textDecoration']).toBe('line-through');
      expect(contentStyles?.['opacity']).toBe(0.6);
    });

    it('applies strikethrough when explicitly enabled', () => {
      const styles = getTipTapEditorStyles(lightTheme, {
        strikethroughEnabled: true,
      }) as Record<string, unknown>;

      const checkedStyles = getTaskItemContentStyles(styles, 'checked');
      expect(checkedStyles?.['textDecoration']).toBe('line-through');
      expect(checkedStyles?.['opacity']).toBe(0.6);

      const nopeStyles = getTaskItemContentStyles(styles, 'nope');
      expect(nopeStyles?.['textDecoration']).toBe('line-through');
      expect(nopeStyles?.['opacity']).toBe(0.6);
    });

    it('removes strikethrough when disabled', () => {
      const styles = getTipTapEditorStyles(lightTheme, {
        strikethroughEnabled: false,
      }) as Record<string, unknown>;

      const checkedStyles = getTaskItemContentStyles(styles, 'checked');
      expect(checkedStyles?.['textDecoration']).toBe('none');
      expect(checkedStyles?.['opacity']).toBe(1);

      const nopeStyles = getTaskItemContentStyles(styles, 'nope');
      expect(nopeStyles?.['textDecoration']).toBe('none');
      expect(nopeStyles?.['opacity']).toBe(1);
    });

    it('keeps checkbox colors when strikethrough is disabled', () => {
      const styles = getTipTapEditorStyles(lightTheme, {
        strikethroughEnabled: false,
      }) as Record<string, unknown>;

      // The checkbox itself should still have its color
      const checkedCheckbox = getTaskItemCheckboxStyles(styles, 'checked');
      expect(checkedCheckbox?.['backgroundColor']).toBe(lightTheme.palette.success.main);

      const nopeCheckbox = getTaskItemCheckboxStyles(styles, 'nope');
      expect(nopeCheckbox?.['backgroundColor']).toBe(lightTheme.palette.error.main);
    });
  });
});

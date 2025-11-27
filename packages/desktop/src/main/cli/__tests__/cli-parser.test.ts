/**
 * CLI Parser Tests
 *
 * Tests for command-line argument parsing for profile selection.
 */

import { parseCliArgs } from '../cli-parser';

describe('CLI Parser', () => {
  describe('parseCliArgs', () => {
    it('returns default values when no arguments provided', () => {
      const result = parseCliArgs([]);
      expect(result).toEqual({
        profileName: null,
        skipPicker: false,
        debugProfiles: false,
        resetPicker: false,
      });
    });

    it('parses --profile=<name> argument', () => {
      const result = parseCliArgs(['--profile=Development']);
      expect(result.profileName).toBe('Development');
    });

    it('parses --profile=<name> with spaces in name', () => {
      const result = parseCliArgs(['--profile=My Profile']);
      expect(result.profileName).toBe('My Profile');
    });

    it('parses --profile=<name> with equals sign in name', () => {
      const result = parseCliArgs(['--profile=Test=Profile']);
      expect(result.profileName).toBe('Test=Profile');
    });

    it('parses --skip-picker flag', () => {
      const result = parseCliArgs(['--skip-picker']);
      expect(result.skipPicker).toBe(true);
    });

    it('parses --debug-profiles flag', () => {
      const result = parseCliArgs(['--debug-profiles']);
      expect(result.debugProfiles).toBe(true);
    });

    it('parses --reset-picker flag', () => {
      const result = parseCliArgs(['--reset-picker']);
      expect(result.resetPicker).toBe(true);
    });

    it('parses multiple flags together', () => {
      const result = parseCliArgs(['--profile=Test', '--skip-picker', '--debug-profiles', '--reset-picker']);
      expect(result.profileName).toBe('Test');
      expect(result.skipPicker).toBe(true);
      expect(result.debugProfiles).toBe(true);
      expect(result.resetPicker).toBe(true);
    });

    it('ignores unrelated arguments', () => {
      const result = parseCliArgs([
        '/path/to/electron',
        '--some-other-flag',
        '--profile=Test',
        'random-arg',
      ]);
      expect(result.profileName).toBe('Test');
      expect(result.skipPicker).toBe(false);
    });

    it('handles empty profile name', () => {
      const result = parseCliArgs(['--profile=']);
      // Empty profile name should be null
      expect(result.profileName).toBeNull();
    });

    it('uses last profile if specified multiple times', () => {
      const result = parseCliArgs(['--profile=First', '--profile=Second']);
      expect(result.profileName).toBe('Second');
    });
  });

  describe('edge cases', () => {
    it('handles argv with electron path and app args', () => {
      // Real argv looks like: [electron, main.js, --profile=X]
      const result = parseCliArgs([
        '/Applications/Electron.app/Contents/MacOS/Electron',
        '/path/to/app',
        '--profile=Production',
      ]);
      expect(result.profileName).toBe('Production');
    });

    it('is case-sensitive for profile names', () => {
      const result = parseCliArgs(['--profile=DEVELOPMENT']);
      expect(result.profileName).toBe('DEVELOPMENT');
    });

    it('handles profile names with special characters', () => {
      const result = parseCliArgs(['--profile=Test (Copy)']);
      expect(result.profileName).toBe('Test (Copy)');
    });
  });
});

/**
 * CLI Parser
 *
 * Parses command-line arguments for profile selection and other options.
 */

export interface CliArgs {
  /** Profile name to use (skips picker if provided) */
  profileName: string | null;
  /** Profile ID to use directly (skips picker, used for Switch Profile restart) */
  profileId: string | null;
  /** Skip profile picker entirely (use default or first profile) */
  skipPicker: boolean;
  /** Dump profiles.json to console for debugging */
  debugProfiles: boolean;
  /** Reset the "don't ask again" preference and show picker */
  resetPicker: boolean;
}

/**
 * Parse command-line arguments
 *
 * @param argv - Command-line arguments (typically process.argv)
 * @returns Parsed CLI arguments
 */
export function parseCliArgs(argv: string[]): CliArgs {
  const result: CliArgs = {
    profileName: null,
    profileId: null,
    skipPicker: false,
    debugProfiles: false,
    resetPicker: false,
  };

  for (const arg of argv) {
    // Parse --profile=<name>
    if (arg.startsWith('--profile=')) {
      const name = arg.slice('--profile='.length);
      // Only set if non-empty
      result.profileName = name || null;
    }

    // Parse --profile-id=<id> (used for Switch Profile restart)
    if (arg.startsWith('--profile-id=')) {
      const id = arg.slice('--profile-id='.length);
      // Only set if non-empty
      result.profileId = id || null;
    }

    // Parse --skip-picker
    if (arg === '--skip-picker') {
      result.skipPicker = true;
    }

    // Parse --debug-profiles
    if (arg === '--debug-profiles') {
      result.debugProfiles = true;
    }

    // Parse --reset-picker
    if (arg === '--reset-picker') {
      result.resetPicker = true;
    }
  }

  return result;
}

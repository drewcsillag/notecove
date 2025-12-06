# Desktop Package TODOs

## Coverage Thresholds

Current thresholds (updated December 2025):

- statements: 26%
- branches: 18%
- functions: 21%
- lines: 27%

Target thresholds:

- statements: 80%
- branches: 80%
- functions: 80%
- lines: 80%

Approach: Thresholds are set to current coverage levels. As coverage improves, thresholds should be updated to prevent regression.

## Future Enhancements

- Add integration tests for i18n with actual translations (currently mocked in unit tests)
- Consider adding `"esModuleInterop": true` to tsconfig.json to resolve ts-jest warning
- Document pnpm configuration for auto-running Electron install scripts

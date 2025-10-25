# Desktop Package TODOs

## Coverage Thresholds

**IMPORTANT**: The coverage thresholds in `jest.config.js` were temporarily lowered to accommodate placeholder code during initial development.

Current thresholds (as of Phase 2.1):

- statements: 5%
- branches: 0%
- functions: 1%
- lines: 5%

**Action Required**: Gradually increase these thresholds back to 80% as actual implementation code is added. The goal is to reach:

- statements: 80%
- branches: 80%
- functions: 80%
- lines: 80%

Suggested approach:

- After each phase implementation, calculate actual coverage
- Increase thresholds to current coverage level or slightly below
- Never decrease thresholds once increased
- Reach 80% by end of Phase 3 (full desktop implementation)

## Future Enhancements

- Add integration tests for i18n with actual translations (currently mocked in unit tests)
- Consider adding `"esModuleInterop": true` to tsconfig.json to resolve ts-jest warning
- Document pnpm configuration for auto-running Electron install scripts

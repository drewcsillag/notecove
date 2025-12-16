# Handler Tests

This directory contains focused test files for IPC handlers, split from the original monolithic `handlers.test.ts` file.

## Test Files

- **folder-handlers.test.ts** - Folder CRUD operations (create, rename, delete, list, get, move, reorder)
- **sd-handlers.test.ts** - Storage Directory management (list, create, setActive, getActive, delete, getCloudStoragePaths)
- **note-handlers.test.ts** - Core note operations (create, delete, restore, permanentDelete, load, unload, getState, applyUpdate)
- **note-edit-handlers.test.ts** - Note editing operations (duplicate, togglePin, move, updateTitle)
- **note-query-handlers.test.ts** - Note query operations (getMetadata, list, search, counts)
- **diagnostics-handlers.test.ts** - Diagnostics operations
- **sync-handlers.test.ts** - Sync-related operations
- **export-import-handlers.test.ts** - Backup/restore operations
- **misc-handlers.test.ts** - Miscellaneous handlers (app state, config, tags, links, telemetry)

## Shared Test Utilities

All test files use the shared utilities from `test-utils.ts`:

- **Mock factories**: `createAllMocks()`, `createMockDatabase()`, `createMockCRDTManager()`, etc.
- **Type helpers**: `AllMocks`, `MockDatabase`, `MockCRDTManager`, etc.
- **Test helpers**: `resetUuidCounter()`, `nextUuid()`, `createMockEvent()`

## Test Structure

Each test file follows this pattern:

```typescript
// 1. Jest mocks (electron, crypto, uuid, fs/promises, node-fs-adapter)
jest.mock('electron', () => ({ ... }));
jest.mock('crypto', () => ({ ... }));
// ... other mocks

// 2. Imports
import { IPCHandlers } from '../../handlers';
import { createAllMocks, castMocksToReal, resetUuidCounter, type AllMocks } from './test-utils';

// 3. Test suite
describe('Handler Name', () => {
  let handlers: IPCHandlers;
  let mocks: AllMocks;

  beforeEach(async () => {
    resetUuidCounter();
    mocks = createAllMocks();
    const realMocks = castMocksToReal(mocks);
    handlers = new IPCHandlers(/* ... pass realMocks */);
  });

  afterEach(() => {
    handlers.destroy();
  });

  // Tests...
});
```

## Migration Status

**Note**: The original `handlers.test.ts` (4,464 lines) contains many additional tests that have not yet been migrated to the focused test files. The original file should be retained as a reference until all tests are fully migrated.

### Migrated Tests (current)

- Folder CRUD (complete)
- SD management (basic operations)
- Note core operations (create, delete, restore, permanentDelete, load, unload, getState, applyUpdate)
- Note edit operations (duplicate, togglePin, move, updateTitle)
- Note query operations (basic)
- App state, config, tags, links
- Diagnostics and sync (basic)
- Backup/restore (basic)

### Still in Original File

The following test categories remain in `handlers.test.ts` and should be migrated over time:

- Note search (comprehensive tests)
- Note:moveToSD (detailed conflict resolution tests)
- Recovery handlers (getStaleMoves, takeOverMove, cancelMove)
- Comprehensive diagnostics tests
- Note info and metadata tests
- Image handlers tests
- Comment handlers tests
- Window handlers tests
- Comprehensive backup/restore tests
- Various edge cases and integration tests

## Running Tests

```bash
# Run all handler tests
npm test handlers

# Run specific handler test file
npm test folder-handlers.test

# Run with coverage
npm test -- --coverage handlers
```

## Target

Each test file should be under 750 lines to maintain readability and focus.

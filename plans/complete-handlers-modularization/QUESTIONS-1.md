# Questions - Handlers Modularization Completion

## Background

I've investigated the current state of the codebase and found:

1. **Original refactoring commit**: `db9d515` (Dec 16, 2025) created `handlers/` directory with 17 modular files totaling ~6357 lines
2. **Original `handlers.ts`**: Was 5349 lines at refactor time, now 5767 lines (418 lines added since)
3. **Both versions are being maintained in parallel**: The original monolithic `handlers.ts` was never removed and continues to be the one actually used (exported from `ipc/index.ts`)

### Current Import Chain

```
main/index.ts → import { IPCHandlers } from './ipc/handlers'
ipc/index.ts → export { IPCHandlers } from './handlers' (monolithic)
```

The modular version at `handlers/index.ts` exports its own `IPCHandlers` class but is NOT being used.

### Handler Differences

**Handlers in MODULAR version but MISSING from monolithic:**

- `backup:createPreOperationSnapshot`
- `diagnostics:cleanupOrphanedActivityLog`
- `diagnostics:deleteMissingCRDTEntry`
- `diagnostics:getOrphanedActivityLogs`
- `diagnostics:getStaleMigrationLocks`
- `diagnostics:removeStaleMigrationLock`
- `folder:getChildInfo`
- `link:searchNotesForAutocomplete`
- `window:openStorageInspector`

**Handlers in MONOLITHIC version but MISSING from modular:**

- `theme:set`

### Constructor Differences

**Monolithic version** takes individual constructor parameters:

```typescript
constructor(
  private crdtManager: CRDTManager,
  private database: Database,
  // ... many more
  private stopWebServer?: StopWebServerFn
)
```

**Modular version** takes a `HandlerDependencies` interface:

```typescript
constructor(deps: HandlerDependencies)
```

The modular `HandlerDependencies` is missing `stopWebServer` callback.

---

## Questions

### 1. Migration Strategy

The cleanest path forward is to:

1. Update the modular version to have feature parity with monolithic
2. Update `ipc/index.ts` to export from `./handlers/index` instead of `./handlers`
3. Update all other imports to use the new path
4. Delete the monolithic `handlers.ts`

**Question**: Is this the approach you want, or would you prefer something different (e.g., keeping the monolithic file temporarily for comparison)?

that looks right

### 2. Handler Differences

The modular version has several NEW handlers that don't exist in monolithic. These appear to be newer features. Should I:

- (A) Add the missing `theme:set` handler to modular version, then switch
- (B) Check if `theme:set` is still needed (it may have been replaced/removed intentionally)

The setup and the question don't align here. But it's possible that new features were done in the new handlers and they are being used?

### 3. Test Files

There are test files in two locations:

- `ipc/__tests__/handlers.test.ts` (tests the monolithic file)
- `ipc/__tests__/handlers/` (tests the modular files)

Should I:

- (A) Delete `handlers.test.ts` after verifying `handlers/` tests cover the same cases
- (B) Merge any unique tests from `handlers.test.ts` into the modular test files first

B

### 4. Verification

After the switch, I'll run the full CI to verify nothing broke. Is there any specific functionality you'd like me to manually test as well?

I'll want to test a bunch of different things. Just stop prior to running CI and I'll fiddle around and see if I notice anything. But feel free to run other tests before then that you deem reasonable and necessary to have reasonable confidence. But to be specific and not run just everything.

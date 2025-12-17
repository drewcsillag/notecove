# Plan Critique

## Potential Issues

### 1. handlers.ts - Cross-Domain Dependencies

**Risk**: Some handlers may call other handlers internally (e.g., note deletion might call image cleanup).

**Mitigation**:

- Before splitting, trace internal method calls
- Keep shared helper functions in a separate `handler-utils.ts`
- If handlers call each other, they should use the dependency injection pattern, not direct function calls

### 2. handlers.test.ts - Mock Complexity

**Risk**: The mock setup is tightly coupled and extracting it may break tests.

**Mitigation**:

- Create `test-utils.ts` FIRST before splitting any tests
- Use factory functions that return fresh mocks for each test
- Run tests after each extraction to catch breaks early

### 3. main/index.ts - Initialization Order

**Risk**: The app initialization has a specific order (database → CRDT managers → watchers → windows). Splitting might disrupt this.

**Mitigation**:

- Keep initialization logic in index.ts, extract only the implementations
- Use explicit dependency injection, not implicit module-level state
- Document the initialization order in comments

### 4. preload/index.ts - Bundling

**Risk**: Vite might not correctly bundle the split modules into a single preload file.

**Mitigation**:

- Test the build after splitting
- Check that `contextBridge.exposeInMainWorld` receives the complete API
- May need to adjust vite.config.ts if issues arise

### 5. database.ts - TypeScript Typing

**Risk**: The composition/mixin pattern may cause TypeScript issues with the Database interface.

**Mitigation**:

- Consider using interface extension instead of mixins
- Each operation module can export functions that take the adapter
- The SqliteDatabase class calls these functions, keeping the interface intact

### 6. Test File Locations

**Risk**: Moving test files might break Jest's test discovery or coverage reporting.

**Mitigation**:

- Verify jest.config paths cover new locations
- Run `pnpm test` after each move
- Update any test path patterns in CI config

---

## Alternative Approaches Considered

### For handlers.ts

**Alternative**: Use a registry pattern where handlers self-register

```typescript
// Each module calls: registerHandler('note:load', handler)
```

**Rejected because**: Adds complexity, harder to trace which handlers exist

### For database.ts

**Alternative**: Keep as single file, use regions/comments for organization
**Rejected because**: Doesn't meet the <750 line requirement

### For preload/index.ts

**Alternative**: Keep as single file, it's just API definitions
**Rejected because**: 2,515 lines is significant, and domain separation improves maintainability

---

## Refinements to Plan

### 1. Add `handler-utils.ts`

Add a utility file for shared handler functions:

- `discoverImageAcrossSDs()`
- `isValidImageId()`
- Common error handling patterns

### 2. Consolidate small handler groups

The `misc-handlers.ts` at ~600 lines is close to the limit. Consider further splitting:

- `comment-mention-handlers.ts` (~200 lines)
- `testing-webserver-handlers.ts` (~200 lines)
- `misc-handlers.ts` (~200 lines for truly miscellaneous)

### 3. Database operations - simpler approach

Instead of mixins, use a simpler pattern:

```typescript
// note-operations.ts
export function noteOperations(adapter: DatabaseAdapter) {
  return {
    async upsertNote(note: NoteCache): Promise<void> { ... },
    async getNote(noteId: UUID): Promise<NoteCache | null> { ... },
    // ...
  };
}

// database.ts
export class SqliteDatabase implements Database {
  private notes: ReturnType<typeof noteOperations>;

  constructor(adapter: DatabaseAdapter) {
    this.notes = noteOperations(adapter);
  }

  // Delegate
  upsertNote = (note: NoteCache) => this.notes.upsertNote(note);
  getNote = (noteId: UUID) => this.notes.getNote(noteId);
}
```

This is clearer and maintains TypeScript compatibility.

---

## Final Checklist Before Implementation

- [ ] Read handlers.ts fully to identify internal dependencies
- [ ] Read handlers.test.ts mock setup to plan extraction
- [ ] Verify vite.config.ts preload entry point
- [ ] Check jest.config.ts test patterns
- [ ] Ensure feature branch is up to date with main

---

## Conclusion

The plan is solid with these refinements:

1. Add `handler-utils.ts` for shared functions
2. Consider splitting `misc-handlers.ts` further if needed
3. Use simpler delegation pattern for database.ts

Ready for implementation.

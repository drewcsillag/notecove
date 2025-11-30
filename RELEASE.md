# Release Process

## Version Management

The version number is defined in the root `package.json` and synced to all other locations using automated scripts.

### Single Source of Truth

Edit the version **only** in `/package.json`. The sync scripts will propagate it to:

**package.json files:**
- `packages/desktop/package.json`
- `packages/shared/package.json`
- `website/package.json`
- `tools/package.json`

**Hardcoded references:**
- `packages/desktop/src/main/telemetry/__tests__/config.test.ts`
- `packages/desktop/src/main/telemetry/__tests__/logger.test.ts`
- `packages/desktop/src/main/telemetry/logger.example.ts`

### Scripts

#### Bump Version

```bash
pnpm version:bump patch   # 0.1.0 → 0.1.1
pnpm version:bump minor   # 0.1.0 → 0.2.0
pnpm version:bump major   # 0.1.0 → 1.0.0
pnpm version:bump 1.2.3   # Set specific version
```

This updates the root `package.json` and automatically syncs to all other files.

#### Sync Version

```bash
pnpm version:sync         # Sync all files to match root
pnpm version:sync --check # Check if versions are in sync (exits 1 if not)
```

Use `--check` in CI to catch version drift.

### Release Workflow

1. Ensure all changes are committed and CI passes
2. Run `pnpm version:bump <patch|minor|major>`
3. Commit the version bump: `git commit -am "chore: bump version to x.y.z"`
4. Tag the release: `git tag vx.y.z`
5. Push with tags: `git push && git push --tags`

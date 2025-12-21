# Dependabot Security Alerts Fix Plan

**Overall Progress:** `100%`

## Summary

Fix 2 open Dependabot security alerts:

1. **js-yaml** (Medium) - Prototype pollution vulnerability
2. **esbuild** (Medium) - Dev server request forwarding vulnerability

**Approach**: Used simple pnpm overrides - no Vite 6.x upgrade needed.

## Tasks

### Phase 1: Quick Fixes via Overrides

- [x] 🟩 **1.1: Regenerate lockfile for js-yaml**
  - Added simplified override `"js-yaml": "4.1.1"` to force all instances to patched version
  - Verified only js-yaml@4.1.1 in lockfile

- [x] 🟩 **1.2: Add esbuild override**
  - Added `"esbuild@<0.25.0": "0.25.0"` to pnpm overrides
  - Verified only esbuild 0.25.0+ in lockfile (0.25.0, 0.25.12, 0.27.2)

### Phase 2: Validation

- [x] 🟩 **2.1: Test desktop build**
  - `pnpm --filter @notecove/desktop build` succeeded

- [x] 🟩 **2.2: Test website build**
  - `pnpm --filter @notecove/website build` succeeded
  - VitePress builds correctly with esbuild 0.25.x override

- [x] 🟩 **2.3: Run full test suite**
  - All 736 tests passed (42 skipped)

- [x] 🟩 **2.4: CI validation**
  - `pnpm ci-local` passed all checks

### Phase 3: Vite 6.x Upgrade (If Override Fails or As Enhancement)

- [x] 🟩 **3.1: Assess if needed**
  - Not needed - esbuild override worked successfully with Vite 5.x
  - Both desktop and website builds work with esbuild 0.25.x

- [ ] ⬜ **3.2: Update dependencies (if needed)**
  - Skipped - override approach worked

### Phase 4: Final Verification

- [x] 🟩 **4.1: Verify lockfile is clean**
  - js-yaml: Only 4.1.1 (patched)
  - esbuild: Only 0.25.0+ (0.25.0, 0.25.12, 0.27.2)

- [x] 🟩 **4.2: Commit changes**
  - Ready for commit

---

## Changes Made

1. **package.json**: Simplified pnpm overrides
   - Replaced complex js-yaml version selectors with simple `"js-yaml": "4.1.1"`
   - Added `"esbuild@<0.25.0": "0.25.0"` override

2. **pnpm-lock.yaml**: Regenerated with fixed versions

---

## Related Files

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial analysis
- [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md) - Plan critique and revised approach

# Plan Critique - Questions

## Findings from Plan Review

### 1. VitePress Solution Simplified

I realized we can fix VitePress's esbuild vulnerability without upgrading to alpha by adding a pnpm override:

```json
"pnpm": {
  "overrides": {
    "esbuild@<0.25.0": ">=0.25.0"
  }
}
```

This forces all esbuild versions (including those bundled via VitePress → Vite 5.x) to use 0.25.x+.

**Potential risk**: esbuild 0.25.x may not be compatible with Vite 5.x (breaking changes between 0.21 and 0.25).

**Question**: Should I try the override approach first? If it breaks VitePress builds, we can fall back to either accepting the isolated vulnerability or upgrading to alpha.

Give it a go and see how it goes

### 2. Ordering Recommendation

I recommend this revised order:

1. js-yaml fix (lockfile regen)
2. Add esbuild override to fix both desktop AND website vulnerabilities
3. Upgrade Vite/electron-vite for desktop (belt-and-suspenders, plus we get Vite 6 features)
4. Test everything

This gets us to "vulnerabilities fixed" faster, then we do the cleaner upgrade.

### 3. Testing VitePress

The plan mentions "build verification" but doesn't explicitly test:

- VitePress dev server (`pnpm --filter @notecove/website dev`)
- VitePress build (`pnpm --filter @notecove/website build`)

These should be explicitly tested after any esbuild override.

---

## Question

**Q1: esbuild override approach**

Should I try fixing both vulnerabilities with a simple pnpm override first, before doing the full Vite 6.x upgrade?

- **Pro**: Faster fix, less code change risk
- **Con**: Might break if esbuild 0.25 isn't compatible with Vite 5.x

If the override works, we could still do the Vite 6.x upgrade as a separate "nice to have" in this branch or a future branch.

Your preference?

try the simple override first

# Dev Build Profile Picker Default Selection

**Overall Progress:** `100%`

## Summary

In dev builds, the profile picker should never default to a production profile, even if it was the most recently used. This prevents accidental corruption of production data.

## Requirements (from QUESTIONS-1.md)

- **Option A**: Default to the most recently used dev profile (ignore production profiles for default selection)
- **Ignore `defaultProfileId`** in dev builds if it points to a production profile
- **Retain warning dialog** when explicitly selecting production profiles via CLI or UI

## Tasks

### 1. Write failing tests

- [x] 🟩 **1.1 Add unit test for ProfilePicker pre-selection logic**
  - Test that in dev builds, production profiles are skipped for pre-selection
  - Test that most recently used dev profile is selected instead

### 2. Fix ProfilePicker.tsx pre-selection

- [x] 🟩 **2.1 Modify pre-selection logic in ProfilePicker.tsx**
  - In dev builds, filter to dev profiles before selecting the default
  - If `defaultProfileId` points to a production profile, ignore it and use most recent dev profile

### 3. Verify and document

- [x] 🟩 **3.1 Run tests to confirm fix**
- [ ] 🟥 **3.2 Manual verification** (optional - user can test)

## Files to Modify

1. `packages/desktop/src/renderer/profile-picker/ProfilePicker.tsx` - Pre-selection logic (lines 79-86)

## Files to Add

1. `packages/desktop/src/renderer/profile-picker/__tests__/ProfilePicker.test.tsx` - Unit tests for pre-selection

## Implementation Details

The change is localized to `ProfilePicker.tsx` lines 79-86. Current logic:

```typescript
// Pre-select the default or most recently used profile
if (data.defaultProfileId && filteredProfiles.some((p) => p.id === data.defaultProfileId)) {
  setSelectedId(data.defaultProfileId);
} else if (filteredProfiles.length > 0) {
  // Sort by lastUsed and select the most recent
  const sorted = [...filteredProfiles].sort((a, b) => b.lastUsed - a.lastUsed);
  setSelectedId(sorted[0]?.id ?? null);
}
```

New logic for dev builds:

```typescript
// For dev builds, only consider dev profiles for pre-selection
const preSelectCandidates = data.isDevBuild
  ? filteredProfiles.filter((p) => p.isDev)
  : filteredProfiles;

// Check if defaultProfileId is valid for pre-selection
const defaultIsValid =
  data.defaultProfileId && preSelectCandidates.some((p) => p.id === data.defaultProfileId);

if (defaultIsValid) {
  setSelectedId(data.defaultProfileId);
} else if (preSelectCandidates.length > 0) {
  const sorted = [...preSelectCandidates].sort((a, b) => b.lastUsed - a.lastUsed);
  setSelectedId(sorted[0]?.id ?? null);
} else if (filteredProfiles.length > 0) {
  // Fallback: if no dev profiles, don't pre-select anything (user must explicitly choose)
  // Actually, we should leave selectedId as null - user must click to select prod profile
  setSelectedId(null);
}
```

Note: If there are no dev profiles in a dev build, we don't pre-select any production profile. The user must explicitly click one (which is intentional - forces conscious choice).

## Plan Critique

### Verified

- Main process `skipPicker` logic already guards with `!options.isDevBuild` (line 215 of `profile-picker/index.ts`)
- Only the renderer pre-selection needs fixing

### Edge Cases

- **Only production profiles exist**: Nothing pre-selected in dev build. User must click. ✅ Correct behavior.
- **Mix of dev and prod profiles**: Most recent dev profile pre-selected. ✅ Correct behavior.
- **defaultProfileId points to prod profile**: Ignored in dev build, most recent dev profile used. ✅ Correct behavior.

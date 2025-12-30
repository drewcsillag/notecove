# Plan Critique Questions

## 1. Mode Availability Infrastructure

The plan assumes profile mode is available where needed, but doesn't specify how. I propose:

**Option A: Pass mode through initialization chain**

- `showProfilePicker()` returns `{ profileId, mode, skipPicker }`
- Main process stores mode in memory during session
- Pass mode to `ensureDefaultNote()` and expose via IPC for renderer

**Option B: Read from profiles.json each time**

- Add `getProfileMode(profileId)` IPC call
- Components query when needed

I recommend **Option A** - cleaner, mode is read once at startup and cached.

Is this the right approach?

Agree with A

## 2. Profile Picker Preload Extension

The wizard needs `getCloudStoragePaths()` which isn't in the profile picker preload. Options:

**Option A**: Add the IPC to profile-picker preload
**Option B**: Have main process detect cloud paths and pass to picker

I recommend **Option A** for consistency with existing pattern.

Agreed?

Agree

## 3. Phase Reordering

Should I reorder phases for faster feedback loop as described in critique? Specifically:

- Move Phase 4.1 (secure import) earlier since it's independently testable
- Allow Phases 4.2-4.3 and Phase 5 to run in parallel

yes

## 4. Fallback During Development

During wizard development, should we keep the simple name-only profile creation as a temporary fallback? This would let us merge incremental progress without blocking profile creation if the wizard has bugs.

The fallback could be:

- A "Quick Create" option in the wizard
- Or simply finish wizard UI before removing the old flow

yes we should

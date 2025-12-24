# Questions - Dev Build Profile Picker Default

## Context Understanding

I've analyzed the current profile picker behavior. Here's what I found:

### Current Behavior

1. **Pre-selection logic** (in `ProfilePicker.tsx` lines 79-86):
   - First, it tries to use `defaultProfileId` from config
   - If that's not available, it sorts all filtered profiles by `lastUsed` and selects the most recent

2. **Filtering logic** (lines 72-74):
   - Dev builds show ALL profiles (including production profiles)
   - Production builds filter out dev profiles

3. **The issue**: In dev builds, if you last used a production profile, it will be pre-selected next time because:
   - The filtering includes all profiles
   - The pre-selection picks the most recently used profile
   - Production profiles have `isDev: false`

### Clarifying Questions

1. **What should the default selection be in dev builds?**
   - **Option A**: Always default to the most recently used **dev profile** (ignore production profiles for default selection)
   - **Option B**: Always default to a specific profile named "Development" if it exists
   - **Option C**: Only ignore production profiles if there's at least one dev profile available (fallback to production if no dev profiles exist)
   - **Option D**: Something else?

A

2. **Should we also prevent the `defaultProfileId` from working in dev builds if it points to a production profile?**
   - Currently, if `defaultProfileId` is set to a production profile, that would be pre-selected in dev builds
   - Should we ignore `defaultProfileId` in dev builds if it's a production profile?

Yes

3. **What about CLI arguments?**
   - The `--profile-id` and `--profile` CLI args can specify any profile
   - Currently, dev builds show a warning dialog when accessing production profiles via CLI
   - Should this warning behavior be kept? (I assume yes)

Retain th warning

## My Recommendation

I'd suggest **Option A** with **Yes** for question 2:

In dev builds:

- When pre-selecting the default, only consider dev profiles (profiles with `isDev: true`)
- If `defaultProfileId` points to a production profile, ignore it and use the most recently used dev profile instead
- Keep the existing warning dialog when explicitly selecting production profiles via CLI or UI click

This prevents accidental production data access while still allowing intentional access with explicit user confirmation.

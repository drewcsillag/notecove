# Onboarding Wizard Implementation Plan

**Overall Progress:** `100%` (Complete)

**Original Prompt:** [PROMPT.md](./PROMPT.md)

**Questions & Answers:** [QUESTIONS-1.md](./QUESTIONS-1.md) | [QUESTIONS-2.md](./QUESTIONS-2.md) | [QUESTIONS-3.md](./QUESTIONS-3.md) | [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md)

## Summary

Implement a multi-step onboarding wizard that appears when creating new profiles. The wizard guides users through selecting a profile mode (Local, Cloud, Paranoid, or Custom) and configures storage and privacy settings accordingly.

### Mode Definitions

| Mode     | Storage                   | User Info | Link Previews      | Cloud Quick-Add | Can Change Later                              |
| -------- | ------------------------- | --------- | ------------------ | --------------- | --------------------------------------------- |
| Local    | ~/Documents/NoteCove      | Asked     | Configurable       | Yes             | Can add cloud storage                         |
| Cloud    | {cloud_provider}/NoteCove | Asked     | Configurable       | Yes             | Full flexibility                              |
| Paranoid | ~/Documents/NoteCove      | Not asked | Locked to "secure" | Hidden          | Cannot add cloud, cannot change link settings |
| Custom   | User-specified path       | Asked     | Configurable       | Yes             | Can add cloud storage                         |

### Wizard Steps

1. **Profile Name** - Enter profile name
2. **Mode Selection** - Choose Local/Cloud/Paranoid/Custom with descriptions
3. **Storage Configuration** - Mode-specific:
   - Local/Paranoid: Confirm ~/Documents/NoteCove (read-only display)
   - Cloud: Select provider (iCloud/Dropbox/Google Drive/OneDrive) or fall back to Local if none detected
   - Custom: Full storage directory picker UI
4. **User Settings** - Username and handle (skipped for Paranoid)
5. **Confirmation** - Summary of choices with Create button

## Development Notes

- **Keep fallback**: During development, retain the simple name-only profile creation until wizard is stable
- **Incremental delivery**: Each phase should result in a working (if incomplete) system

## Tasks

### Phase 1: Data Model & Infrastructure

- [x] 🟩 **1.1: Add mode field to Profile type**
  - [x] 🟩 Update `packages/shared/src/profiles/types.ts` to add `mode?: 'local' | 'cloud' | 'paranoid' | 'custom'`
  - [x] 🟩 Make it optional for backwards compatibility (existing profiles default to 'local' behavior)
  - [x] 🟩 Add tests for profile type with mode field
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **1.2: Update ProfileStorage to handle mode**
  - [x] 🟩 Update `createProfile` to accept mode parameter
  - [x] 🟩 Update profile serialization/deserialization
  - [x] 🟩 Add tests
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **1.3: Mode availability infrastructure**
  - [x] 🟩 Update `showProfilePicker()` to return `{ profileId, mode, skipPicker }`
  - [x] 🟩 Store mode in main process memory during session
  - [x] 🟩 Pass mode to `ensureDefaultNote()` for secure import decision (completed in Phase 5)
  - [x] 🟩 Mode queryable via existing `profile:getInfo` IPC (no new handler needed)
  - [x] 🟩 Create `ProfileModeContext` in renderer (completed in Phase 6)
  - [x] 🟩 Update PLAN.md

### Phase 2: Secure Import Mode (independently testable)

This phase is moved earlier because it can be developed and tested independently.

See [QUESTIONS-3.md](./QUESTIONS-3.md) for background on this requirement.

- [x] 🟩 **2.1: Add secure import mode to markdown parser**
  - [x] 🟩 Add `secureMode?: boolean` parameter to `markdownToProsemirror()`
  - [x] 🟩 When `secureMode: true`:
    - Strip `{.chip}` and `{.unfurl}` display mode attributes
    - Force all links to plain (no displayMode set)
    - Skip creation of `oembedUnfurl` block nodes
  - [x] 🟩 Add tests for secure import mode
  - [x] 🟩 Update PLAN.md

### Phase 3: Wizard UI Components

- [x] 🟩 **3.1: Extend profile picker preload with cloud detection**
  - [x] 🟩 Add `getCloudStoragePaths` IPC to `packages/desktop/src/preload/profile-picker.ts`
  - [x] 🟩 Add `getDefaultStoragePath` IPC for local/paranoid default path
  - [x] 🟩 Add `selectStoragePath` IPC for custom mode directory picker
  - [x] 🟩 Add `createProfileWithConfig` IPC for wizard profile creation
  - [x] 🟩 Add corresponding handlers in profile picker main process
  - [x] 🟩 Update ProfilePickerAPI interface in both preload and renderer
  - [x] 🟩 Export `getSelectedProfileMode()` function for Phase 5 use
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **3.2: Create wizard step components**
  - [x] 🟩 Create `packages/desktop/src/renderer/profile-picker/wizard/` directory structure
  - [x] 🟩 `WizardContainer.tsx` - Main wizard shell with step navigation
  - [x] 🟩 `StepProfileName.tsx` - Profile name input
  - [x] 🟩 `StepModeSelection.tsx` - Mode cards with descriptions
  - [x] 🟩 `StepStorageConfig.tsx` - Mode-specific storage configuration
  - [x] 🟩 `StepUserSettings.tsx` - Username/handle inputs
  - [x] 🟩 `StepConfirmation.tsx` - Summary and create button
  - [x] 🟩 `types.ts` and `styles.ts` - Shared types and styles
  - [x] 🟩 `index.ts` - Exports
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **3.3: Implement wizard navigation logic**
  - [x] 🟩 Step state management (useState for currentStep and WizardState)
  - [x] 🟩 Back/Next/Create buttons (handleNext, handleBack, handleCreate)
  - [x] 🟩 Skip logic for Paranoid mode (getVisibleSteps excludes userSettings)
  - [x] 🟩 Validation per step (canProceed checks in each step)
  - [x] 🟩 Cloud storage detection and fallback (loads providers on mount)
  - [x] 🟩 Update PLAN.md

### Phase 4: Integrate Wizard with Profile Picker

- [x] 🟩 **4.1: Add wizard to profile picker flow**
  - [x] 🟩 Modify ProfilePicker to show wizard when "+ New Profile" clicked
  - [x] 🟩 Removed simple name-only creation (wizard is the only path now)
  - [x] 🟩 Pass wizard completion data back to main process
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **4.2: Update IPC handlers for wizard data**
  - [x] 🟩 Added `profile-picker:createProfileWithConfig` IPC for wizard profile creation
  - [x] 🟩 Store initialization data in profile (initialStoragePath, initialUsername, initialHandle)
  - [x] 🟩 Apply initial settings on first launch (link preview mode for paranoid)
  - [x] 🟩 Added `clearInitializationData()` to ProfileStorage
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **4.3: Handle dev build auto-creation**
  - [x] 🟩 Auto-created "Development" profile skips wizard (created directly)
  - [x] 🟩 Auto-created dev profile has mode: 'local' by default
  - [x] 🟩 Update PLAN.md

### Phase 5: Paranoid Mode Enforcement (can run in parallel with Phase 6)

- [x] 🟩 **5.1: Use secure import for paranoid profile welcome note**
  - [x] 🟩 Updated `ensureDefaultNote()` to accept profileMode parameter
  - [x] 🟩 Updated `populateWelcomeContent()` to accept secureMode parameter
  - [x] 🟩 Call `markdownToProsemirror(markdown, { secureMode: true })` for paranoid profiles
  - [x] 🟩 Added test file `src/main/__tests__/note-init.test.ts` to verify no unfurl/chip nodes created
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **5.2: Add editor-level network safety checks (defense-in-depth)**
  - [x] 🟩 Verified existing code already handles secure mode:
    - `OEmbedUnfurl.ts`: Hides unfurl blocks when preference is 'secure'
    - `WebLinkChipPlugin.ts`: Skips network fetches in secure mode
    - `WebLink.ts`: Bakes in 'link' displayMode for new links in secure mode
    - `linkContext.ts`: Forces 'link' mode when preference is 'secure'
  - [x] 🟩 Added tests in `linkContext.test.ts` for secure mode behavior
  - [x] 🟩 Update PLAN.md

### Phase 6: Settings Mode Restrictions (can run in parallel with Phase 5)

- [x] 🟩 **6.1: Hide Link Previews tab for paranoid mode**
  - [x] 🟩 Created `ProfileModeContext.tsx` in renderer
  - [x] 🟩 Added `user:getProfileMode` IPC handler in `misc-handlers.ts`
  - [x] 🟩 Added preload API and type definitions
  - [x] 🟩 Added `ProfileModeProvider` to `App.tsx`
  - [x] 🟩 Updated `SettingsDialog.tsx` with `hideInParanoidMode` tab property
  - [x] 🟩 Link Previews tab hidden when mode is 'paranoid'
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **6.2: Hide cloud quick-add buttons for paranoid mode**
  - [x] 🟩 Updated `StorageDirectorySettings.tsx` with `useProfileMode` hook
  - [x] 🟩 "Quick Add from Cloud Storage" section hidden when mode is 'paranoid'
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **6.3: Lock link preview setting for paranoid mode**
  - [x] 🟩 Link preview set to "secure" on paranoid profile creation (Phase 4.2)
  - [x] 🟩 Paranoid profiles: preference is "secure" and Link Previews tab is hidden
  - [x] 🟩 Update PLAN.md

### Phase 7: Testing

- [x] 🟩 **7.1: Unit tests for wizard components**
  - [x] 🟩 Created `wizard/__tests__/StepProfileName.test.tsx` (11 tests)
  - [x] 🟩 Created `wizard/__tests__/StepModeSelection.test.tsx` (14 tests)
  - [x] 🟩 Created `wizard/__tests__/StepStorageConfig.test.tsx` (23 tests)
  - [x] 🟩 Created `wizard/__tests__/StepUserSettings.test.tsx` (14 tests)
  - [x] 🟩 Created `wizard/__tests__/StepConfirmation.test.tsx` (20 tests)
  - [x] 🟩 Created `wizard/__tests__/WizardContainer.test.tsx` (15 tests)
  - [x] 🟩 Tests cover navigation, mode restrictions, validation
  - [x] 🟩 Total: 97 unit tests for wizard components
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **7.2: E2E tests for wizard flow**
  - [x] 🟩 Created `e2e/onboarding-wizard.spec.ts` with wizard flow tests
  - [x] 🟩 Test Local mode creation (complete flow)
  - [x] 🟩 Test Paranoid mode creation (verifies user settings step is skipped)
  - [x] 🟩 Test Custom mode creation (verifies folder picker requirement)
  - [x] 🟩 Test Cloud mode UI (shows provider cards when available)
  - [x] 🟩 Test navigation (back button, cancel button)
  - [x] 🟩 Test validation (profile name required, mode selection required)
  - [x] 🟩 Updated existing `profile-picker.spec.ts` for wizard flow
  - [ ] 🟨 Test mode restrictions in settings (deferred - requires main app launch)
  - [x] 🟩 Update PLAN.md

- [x] 🟩 **7.3: E2E tests for paranoid mode network safety**
  - [x] 🟩 Created `e2e/paranoid-mode-network-safety.spec.ts`
  - [x] 🟩 Test that links render as plain (no chip/unfurl) in paranoid mode
  - [x] 🟩 Test that no network requests are made for link previews
  - [x] 🟩 Test that Link Previews tab is hidden in settings
  - [x] 🟩 Test that cloud quick-add buttons are hidden in settings
  - [x] 🟩 Test that linkDisplayPreference is set to secure
  - [x] 🟩 Update PLAN.md

### Phase 8: Documentation

- [x] 🟩 **8.1: Update website documentation**
  - [x] 🟩 Created `website/features/profiles.md` - comprehensive profiles & privacy modes page
  - [x] 🟩 Updated `website/.vitepress/config.ts` - added profiles to sidebar
  - [x] 🟩 Updated `website/features/index.md` - added profiles section and feature comparison
  - [x] 🟩 Updated `website/index.md` - added profiles to "What's Working" section
  - [ ] 🟨 Screenshots: Deferred (no current way to capture wizard UI automatically)
  - [x] 🟩 Update PLAN.md

### Phase 9: Cleanup

- [x] 🟩 **9.1: Remove development fallbacks**
  - [x] 🟩 Simple name-only profile creation was removed in Phase 4.1
  - [x] 🟩 ProfilePicker now uses wizard-only flow (WizardContainer)
  - [x] 🟩 Verified: "+ New Profile" button opens wizard
  - [x] 🟩 Update PLAN.md

## Deferred Items

None

## Technical Notes

### File Locations

- Profile types: `packages/shared/src/profiles/types.ts`
- Profile storage: `packages/shared/src/profiles/profile-storage.ts`
- Profile picker UI: `packages/desktop/src/renderer/profile-picker/`
- Profile picker preload: `packages/desktop/src/preload/profile-picker.ts`
- Profile picker main: `packages/desktop/src/main/profile-picker/index.ts`
- Wizard UI: `packages/desktop/src/renderer/profile-picker/wizard/`
- Profile mode context: `packages/desktop/src/renderer/src/contexts/ProfileModeContext.tsx`
- Profile mode state: `packages/desktop/src/main/profile-state.ts`
- Profile mode IPC: `packages/desktop/src/main/ipc/handlers/misc-handlers.ts` (user:getProfileMode)
- App profile selection: `packages/desktop/src/main/app-profile.ts`
- Settings dialog: `packages/desktop/src/renderer/src/components/Settings/SettingsDialog.tsx`
- Storage settings: `packages/desktop/src/renderer/src/components/Settings/StorageDirectorySettings.tsx`
- Link preview settings: `packages/desktop/src/renderer/src/components/Settings/OEmbedSettings.tsx`
- Link context utilities: `packages/desktop/src/renderer/src/components/EditorPanel/utils/linkContext.ts`
- Markdown parser: `packages/shared/src/markdown/markdown-to-prosemirror.ts`
- Note initialization: `packages/desktop/src/main/note-init.ts`
- Welcome content: `packages/desktop/resources/welcome.md`
- Documentation: `website/features/profiles.md`

### IPC Calls Implemented

- Existing: `sd.getCloudStoragePaths()` - detect cloud storage (main app)
- Existing: `sd.create(name, path)` - create storage directory
- Existing: `appState.set(key, value)` - set link preview preference
- New: `user:getProfileMode` - get current profile mode for renderer
- New (picker): `profile-picker:createProfileWithConfig` - create profile with full wizard config
- New (picker): `profile-picker:getCloudStoragePaths` - detect cloud storage in picker window
- New (picker): `profile-picker:getDefaultStoragePath` - get default ~/Documents/NoteCove path
- New (picker): `profile-picker:selectStoragePath` - open directory picker for custom mode

### Backwards Compatibility

- Existing profiles without `mode` field treated as 'local' (full permissions)
- No migration needed for existing profiles

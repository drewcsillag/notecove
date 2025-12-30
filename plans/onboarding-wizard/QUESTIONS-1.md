# Onboarding Wizard - Questions Round 1

## 1. When should the onboarding wizard appear?

Currently, when a new profile is created from the Profile Picker, it just creates the profile and then the user selects it. The onboarding wizard needs to run at some point to configure the storage location and settings.

**Options:**
a) **Immediately after clicking "Create" in Profile Picker** - Replace the simple name-only creation flow with a wizard that asks name + mode + settings
b) **After selecting a newly created profile but before main app loads** - Profile is created, user selects it, then wizard runs
c) **On first launch of main app with empty profile** - Detect that profile has no storage directories and prompt

Which approach do you prefer? I'm leaning toward (a) since it provides a cleaner experience where the profile is fully configured before use.

a

## 2. Should existing profiles get the wizard?

If a user has existing profiles from before this feature existed, should they ever see the wizard? Or is this purely for new profile creation?

no

## 3. Clarification on "Quick adds from cloud storage"

For paranoid mode, you mentioned "disable the quick adds from cloud storage in the storage directories tab in settings."

Does this mean:
a) The "Quick Add from Cloud Storage" buttons (iCloud Drive, Dropbox, etc.) should be hidden in the settings UI for paranoid profiles
b) The buttons should still be visible but won't appear in the onboarding wizard
c) Something else?

a

## 4. Cloud mode - What if no cloud storage is detected?

The cloud storage quick-add feature detects installed cloud storage (iCloud Drive, Dropbox, Google Drive, OneDrive) by checking if their folders exist.

If the user selects "Cloud" mode but no cloud storage folders are detected on their system, what should happen?
a) Fall back to showing Local mode with a message explaining why
b) Still show the cloud storage options but indicate none are detected, allow manual path entry
c) Block cloud mode selection if no cloud storage detected

a

## 5. Default storage directory naming

- **Local mode**: Currently creates "Default" at `~/Documents/NoteCove`. Should we use a different name like "Local" or keep "Default"?
- **Cloud mode**: Should use the cloud provider name (e.g., "iCloud Drive", "Dropbox") pointing to `{cloud_path}/NoteCove`?
- **Paranoid mode**: Same as Local?

correct

There should probably be a 4th option of "Custom" where they get something essentially the same as the storage directories tab of the settings panel, but is otherwise the same as "Local"

## 6. Can users change modes later?

After initial setup, can users:

- Add cloud storage directories to a local/paranoid profile?
  Yes to local, No to paranoid

- Change from paranoid to local (enabling user info)?
  No - I want to make it so that you can't accidentally screw things up as much as possible, and this sort of thing breaks that mindset.

- Change link preview settings freely?
  Yes, unless paranoid mode -- I forgot about that.

This kind of information should find its way into the wizard.

## 7. Website documentation

This is a new feature for desktop only. Should it be added to the website's feature documentation? It seems like a significant enough feature to warrant inclusion.

yes

## 8. UI Style for the Wizard

Should the wizard:
a) Be a separate window (like the current Profile Picker)
b) Be a modal dialog within the Profile Picker window
c) Be a multi-step dialog with next/back navigation
d) Be a single-page form with all options visible at once

I'm thinking a step-by-step wizard (c) would be clearest, with steps like:

1. Choose mode (Local/Cloud/Paranoid) with descriptions
2. Mode-specific configuration (cloud provider selection or just storage path confirmation)
3. User settings (for Local/Cloud modes only)
4. Confirmation/summary

agree with C

# Onboarding Wizard - Questions Round 2

Based on your answers, I need a few clarifications:

## 1. Storing the profile mode

To enforce mode restrictions later (paranoid can't add cloud storage, can't change link previews), we need to store the mode somewhere. Options:

a) Add a `mode: 'local' | 'cloud' | 'paranoid' | 'custom'` field to the Profile type in profiles.json
b) Store it as an app state key in the profile's database
c) Infer it from settings (e.g., if link previews are "secure" and no cloud quick-adds visible, must be paranoid)

I recommend (a) since it's explicit and available before the profile database is loaded.

a

## 2. Custom mode - should it ask for user info?

You said Custom is "otherwise the same as Local" - so it should:

- Ask for username/handle
- Allow cloud storage additions later
- Allow link preview changes

Correct?

correct

## 3. Profile name input

Currently the Profile Picker has a simple "Profile name..." input when creating a new profile. With the wizard, the profile name input should:
a) Be on the first step of the wizard (before mode selection)
b) Be part of the mode selection step
c) Be on a final confirmation step

I'm leaning toward (a) - name first, then mode selection.

agree with a

## 4. Paranoid mode - what about existing oEmbed discovery setting?

OEmbed settings has a "discovery" toggle that's separate from the link display preference. For paranoid mode, should we also disable/lock this setting (it makes network requests)?

The current behavior is: when "Plain links (secure)" is selected, discovery is automatically disabled with a warning message. Should paranoid mode also hide/lock this toggle, or is the automatic disable sufficient?

The automatic disable should be sufficient. Oooh, I don't know if I mentioned it but the link previews tab in settings should just not showfor paranoid mode.

## 5. Dev builds

In dev builds, a "Development" profile is auto-created if none exist. Should this auto-created profile:
a) Skip the wizard entirely (current behavior, just create with defaults)
b) Still show the wizard
c) Use a default mode (which one?)

I'm thinking (a) for convenience in development - the wizard would still show if you manually click "+ New Profile" in dev mode.

Yes a.

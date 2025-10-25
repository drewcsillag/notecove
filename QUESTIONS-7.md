# Questions and Ambiguities - Round 7

Final clarification on iOS deployment

---

## 1. iOS App on Your Phone for MVP

**Q1.1:** You asked "What would be required to make that happen?" for getting the iOS app on your phone for MVP.

**Requirements:**

**Option A: Development Build (Simplest for MVP)**

- Free Apple Developer account (no cost)
- Register your iPhone's UDID in your Apple Developer account
- Use Xcode to build and install directly via USB or wirelessly
- App expires after 7 days and needs to be rebuilt/reinstalled
- No code signing certificate needed
- No app store submission

**Option B: TestFlight (Better for longer testing)**

- Paid Apple Developer account ($99/year)
- Code signing certificate
- Upload build to App Store Connect
- Invite yourself as a tester
- Install via TestFlight app
- Builds last 90 days
- No public app store submission needed

**Option C: Ad-Hoc Distribution**

- Paid Apple Developer account ($99/year)
- Code signing certificate
- Register device UDID
- Distribute IPA file
- App lasts 1 year
- Can share with up to 100 devices

**My recommendation for MVP:**
Start with **Option A** (free account, direct Xcode installation) for initial development and testing. The 7-day expiration is annoying but acceptable for active development. Once you want longer-term testing, upgrade to **Option B** (TestFlight with paid account).

**For the plan, I'll include:**

- Setup instructions for free Apple Developer account
- Xcode project configuration for development builds
- Scripts/commands to build and install to device
- Note that paid account + TestFlight is optional upgrade

Does this work for you, or do you want to start with paid account + TestFlight from the beginning?

> that works for me.

---

## 2. IPC API Scope

**Q2.1:** You prefer IPC for the API (good choice for the reasons you mentioned).

For MVP scope, should the IPC API support:

**Read Operations:**

- Query notes by various criteria (title pattern, tags, todos, etc.)
- Get note content by ID
- List folders
- Search full text

**Write Operations:**

- Create new note
- Update note content
- Delete note
- Move note to folder
- Add/remove tags

**Or should MVP IPC API be read-only, with write operations added post-MVP?**

The concern with write operations in MVP is ensuring they properly:

- Generate CRDT updates
- Update SQLite cache
- Trigger UI updates
- Handle file watching conflicts

Read-only is simpler and safer for MVP. Write operations can be added once the core is stable.

Your preference?

> read only for MVP, write operations after

---

## 3. MVP Definition Final Confirmation

**Q3.1:** You said Phase 4 vs Phase 1-3 is "a better delineation" for MVP.

Just to be crystal clear, MVP means:

- **Phase 1**: Core Foundation ✓
- **Phase 2**: Desktop UI (basic) ✓
- **Phase 3**: iOS App (basic) ✓
- **Phase 4**: Advanced Features (tags, links, search, export) - **NOT in MVP**

So MVP = working desktop + iOS app with basic note editing, folders, syncing, and history. Advanced features like tags, inter-note links, advanced search, and export come after MVP.

**Phase 5** (Documentation & Polish) happens alongside/after as features are built.

Is this correct?

> correct

---

## 4. Color Scheme Clarification

**Q4.1:** You mentioned:

- Brown as main accent color
- Blue for dark mode (since brown might not work well)
- Clean, not garish

Should the plan include:

- Light theme: Brown accent (#795548 or similar earth tone)
- Dark theme: Blue accent (#2196F3 or similar)
- Otherwise follow Material Design color principles
- Allow customization later

Or should I research/suggest specific color palettes for your approval?

> lets just go blue and skip brown altogether
> allow for customization later
> in general, allow for the ability to change my mind

---

## Notes

These are truly the final questions - just need clarity on iOS deployment approach for MVP, IPC API scope, and final MVP definition confirmation. Once answered, I have everything to create the comprehensive plan!

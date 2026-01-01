# Plan Critique Questions

Based on my review of PLAN.md, I have some questions before finalizing:

## 1. CRDT Strategy - Decide Now

The plan defers this to Phase 2.1, but it's foundational. Options:

**A. JavaScriptCore + ios-bridge.ts (existing code)**
- Pros: Reuses proven desktop code, faster to implement
- Cons: JavaScriptCore overhead, debugging is harder

**B. Port Yjs to Swift**
- Pros: Native performance, better debugging
- Cons: Major undertaking, risk of divergence from desktop

**C. Use Swift Yjs binding (if one exists)**
- Would need to research availability

**My recommendation:** Option A (JavaScriptCore) for MVP. We already have `ios-bridge.ts`. We can optimize later if performance is an issue.


**Question:** Agree with JavaScriptCore approach for MVP?

yes
A
---

## 2. iOS Background Sync Limitations

iOS apps can't poll files in the background like desktop can. This means:
- When app is backgrounded, it won't know about new files from iCloud sync
- When app returns to foreground, we trigger a full rescan

This is a fundamental limitation. Desktop will see iOS changes quickly (iCloud pushes), but iOS will only see desktop changes when the app is opened.

**Question:** Is this acceptable for MVP? Or should we investigate:
- Background App Refresh (limited, unreliable)
- Push notifications from desktop? (would require server)

It's 100% fine if it doesn't see new changes until the app is opened.
---

## 3. iOS 26 Features to Consider

You mentioned considering iOS 26 features. From what I know, potentially useful ones:

- **Enhanced Stage Manager** - More window flexibility
- **Improved document picker** - Better folder access UX
- **New SwiftUI APIs** - Unknown until WWDC 2025

Since iOS 26 details aren't fully public yet, should I:
- A. Target iOS 17 for now, add iOS 26 enhancements later
- B. Wait for iOS 26 release to finalize the plan

**Question:** How to handle iOS 26?

iOS26 details should be public as it's been out for long enough for there to be an iOS 26.1. As a detail, it's new year's eve 2025
---

## 4. Debug Tools Earlier

I want to move "basic sync debugging" earlier in the plan. Specifically:
- Add a hidden "Debug" tab in Phase 2 (before sync testing)
- Show: file list, database tables, activity log
- This becomes the foundation for "Storage Inspector" in Phase 5

**Question:** Okay to add this to Phase 2?

Very much ok.
---

## 5. Test Data Strategy

For faster UI development, I propose:
- Create a `fixtures/` folder with sample CRDT files
- Use these for UI testing before real sync works
- Copy from a desktop installation

**Question:** Can I grab some sample data from your desktop app for fixtures?

sure. Grab data from the Dev profile mT4tE5bfQWK0XRphOhp8Ig SD /tmp/nc-asdlkjh

---

## Summary

Main decisions needed:
1. JavaScriptCore for CRDT? (I recommend yes)
2. Background sync limitation acceptable?
3. iOS 26 strategy?
4. Debug tools in Phase 2? (I recommend yes)
5. Test fixture strategy?

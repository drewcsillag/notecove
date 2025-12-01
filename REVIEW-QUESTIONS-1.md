# Plan Review: Web Interface - Questions Round 1

## Review Summary

Evaluated against the Plan Review Framework. Found several issues to address.

### Checklist Results

| Category                        | Status | Notes                               |
| ------------------------------- | ------ | ----------------------------------- |
| 1. Task Sequencing & Visibility | ⚠️     | Early phases have no visible output |
| 2. Dependencies & Task Ordering | ✅     | Prerequisites properly ordered      |
| 3. Risk Management & Validation | ⚠️     | High-risk tasks not front-loaded    |
| 4. Scope Control                | ✅     | Well-bounded, explicit exclusions   |
| 5. Technical Readiness          | ⚠️     | Some platform risks not addressed   |
| 6. Efficiency & Reuse           | ✅     | Good reuse of existing patterns     |
| 7. Communication & Checkpoints  | ⚠️     | No explicit review points           |

---

## Issues Found

### Issue 1: No Early Visible Progress

**Problem**: Phases 1-4 are all backend infrastructure. User sees nothing working until Phase 5 (Server Management UI). This makes it hard to validate progress and could lead to late discovery of integration issues.

**Proposed fix**: Add a "minimal demo" checkpoint after Phase 2 or 3 where you can manually test browser access via curl or browser dev tools, even without the full UI.

**Question 1.1**: Should I restructure to deliver a minimal working demo earlier? Options:

- **A**: Keep current structure (infrastructure first, then UI)
- **B**: Add explicit "manual test" checkpoint after Phase 2 (curl can hit API)
- **C**: Reorder so basic UI comes earlier (more complex)

## If it's not too much addtional work, B

### Issue 2: Missing Browser Login Page

**Problem**: The plan doesn't include a login page for the browser. When a user scans the QR code or types the URL, how do they enter the auth token?

Current plan assumes token is embedded in URL (from QR code), but what if user types URL manually or token expires?

**Question 2.1**: How should browser authentication work?

- **A**: Token embedded in URL only (QR code required, or user copies long URL)
- **B**: Add a simple login page where user enters token manually
- **C**: Both (login page shows if token not in URL or invalid)

## C

### Issue 3: Browser Build Configuration is High-Risk

**Problem**: Task 4.3 "Browser Build Configuration" is scheduled late but is a potential blocker. If we can't cleanly separate Electron from browser builds, the whole approach needs rethinking.

**Question 3.1**: Should we front-load the browser build spike?

- **A**: Yes, move to Phase 1 as a proof-of-concept (before investing in API layer)
- **B**: No, current ordering is fine - we'll adapt if issues arise

## A

### Issue 4: Self-Signed Certs on iOS Safari

**Problem**: iOS Safari has strict certificate requirements. Self-signed certs typically show an error and may require manual trust setup in iOS Settings. This could be a significant friction point for the primary use case (iPad access).

**Question 4.1**: Have you tested self-signed certs on iOS Safari before? Is manual trust setup acceptable?
It's fine

**Question 4.2**: Should we investigate alternatives?

- **A**: Accept the friction (document the iOS trust setup process)
- **B**: Research iOS-specific solutions (e.g., mkcert for local CA)
- **C**: Make HTTPS optional (allow HTTP for trusted LANs) with a warning

## A and B

### Issue 5: mDNS/Bonjour Platform Compatibility

**Problem**: `bonjour-service` works well on macOS but may have issues on Windows/Linux:

- Windows: May require Bonjour Print Services or iTunes installed
- Linux: Requires avahi-daemon

**Question 5.1**: Is cross-platform mDNS important, or is macOS sufficient for now (given iPad is the target)?

- **A**: macOS only is fine (iPad discovery is the main goal)
- **B**: Must work cross-platform (add fallback or document requirements)
- **C**: Make mDNS optional/best-effort (works if available, graceful degradation otherwise)

## A -- We'll get to others later, but yes C

### Issue 6: No Explicit Review Checkpoints

**Problem**: The plan doesn't specify when to pause for user review/approval before continuing.

**Question 6.1**: Where should we checkpoint for your review?

- **A**: After each phase (8 checkpoints)
- **B**: After major milestones: Phase 2 (API working), Phase 4 (browser works), Phase 8 (done)
- **C**: Only at end (you trust me to run with it)
- **D**: Other cadence?

## B

### Issue 7: Firewall/Network Considerations

**Problem**: Plan doesn't mention that users may need to:

- Allow the port through OS firewall
- Ensure devices are on same network/subnet
- Handle router isolation (some routers isolate wireless clients)

**Question 7.1**: Should we:

- **A**: Just document these in troubleshooting (Phase 8.3)
- **B**: Add runtime detection/warnings when server can't be reached
- **C**: Both

## A

## Proposed Plan Modifications

Based on typical answers, here's what I'd change:

1. **Add explicit checkpoint** after Phase 3 ("API + WebSocket working, testable via curl/browser dev tools")

2. **Add login page task** to Phase 4 or 5:
   - Simple form: "Enter access token"
   - Store in localStorage
   - Redirect to main app on success

3. **Move browser build spike** to Phase 1.0 (or add as 0.1 proof-of-concept)

4. **Add iOS cert documentation** to Phase 8.3

5. **Make mDNS optional** with graceful degradation

6. **Add firewall troubleshooting** to documentation

---

## Questions Summary

| #   | Question                   | Options                                               |
| --- | -------------------------- | ----------------------------------------------------- |
| 1.1 | Early visible progress     | A: Keep current / B: Add curl checkpoint / C: Reorder |
| 2.1 | Browser login flow         | A: URL-only / B: Login page / C: Both                 |
| 3.1 | Front-load browser build   | A: Yes / B: No                                        |
| 4.1 | iOS Safari cert experience | (open-ended)                                          |
| 4.2 | Cert alternatives          | A: Accept friction / B: Research / C: Optional HTTPS  |
| 5.1 | mDNS platform scope        | A: macOS only / B: Cross-platform / C: Optional       |
| 6.1 | Review checkpoints         | A: Each phase / B: Major milestones / C: End only     |
| 7.1 | Firewall handling          | A: Document / B: Runtime warnings / C: Both           |

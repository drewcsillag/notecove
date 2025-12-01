# Questions: Web Browser Access via Localhost

## Summary of Exploration

Based on my exploration of `packages/desktop`, the architecture is **well-suited** for adding web browser support:

- **UI Layer**: React-based, mostly framework-agnostic (~85% reusable)
- **Data Layer**: Well-abstracted with adapter patterns (already supports iOS bridge)
- **IPC Layer**: Clean separation via preload script - 50+ handlers that could map to REST endpoints
- **Shared Package**: Platform-agnostic CRDT/sync logic already exists

The proposed approach would have the Electron main process spin up an HTTP server (Express/Fastify) that:
1. Serves the renderer UI as static files
2. Exposes REST/WebSocket endpoints mirroring the existing IPC handlers
3. Allows browser clients to connect on `localhost:<port>`

**Estimated effort**: Medium-sized feature (relative complexity, not a time estimate)

---

## Questions

### 1. Access Scope

**Q1.1**: Is this strictly **localhost-only**, or do you want the option for **remote access** (e.g., accessing from a phone on the same network)?

- Localhost-only is simpler (no auth needed, no HTTPS)
- Remote access adds complexity: authentication, HTTPS/TLS, CORS, security concerns

Remote access

**Q1.2**: Should users be able to configure the port number, or is a hardcoded port acceptable?
configurable
---

### 2. Concurrent Usage

**Q2.1**: Should the **Electron window and browser** be usable **simultaneously**?

- If yes: Need real-time sync between views (WebSocket push for updates)
- If no: Could lock one interface while the other is active

Yes

**Q2.2**: If simultaneous use is required, should edits in one view appear **immediately** in the other (live collaboration style), or is eventual consistency acceptable (refresh to see changes)?

We have a dcecnt sync system in notecove because of the way it works already -- i.e. two notecove instances pointing at the same storage directory sync, as well as multiple notecove windows pointing at the same note sync. Would we need something more than that?
---

### 3. Feature Scope

**Q3.1**: Which features must work in the browser? (Check all that apply)

- [x] Note viewing/editing
- [x] Folder management
- [x] Tag management
- [x] Note search
- [ ] Settings/configuration
- [ ] Storage directory management (adding/removing SDs)
- [ ] Export functionality
- [x] History/timeline view
- [x] Diagnostics
- [ ] Profile switching

**Q3.2**: Some features rely on native OS dialogs (file picker, folder picker). For browser:
- **Option A**: Disable these features in browser mode
- **Option B**: Provide alternative web-based UI (e.g., path text input, file upload)
- **Option C**: Other approach?

For the features here, I don't think we'd need them -- we might need to disable export on notes, but I think that's it
---

### 4. Storage Directories (SDs)

The desktop app accesses Storage Directories (cloud folders, local paths) directly via the filesystem.

**Q4.1**: In browser mode, should the user be able to:
- **A**: Only view/edit notes in existing SDs (configured via Electron)?
- **B**: Add new SDs via the browser (would need a way to specify paths accessible to the server)?
- **C**: Something else?

A

**Q4.2**: For cloud storage SDs (iCloud, Dropbox, etc.), the Electron app accesses them because they're mounted on the local filesystem. Should browser mode work with these too, or only local paths?

Filesystem access is through the main process, not the renderer. Does this answer the question?
---

### 5. Server Lifecycle

**Q5.1**: When should the web server start?
- **A**: Always when Electron app starts
- **B**: On-demand via a menu option or setting
- **C**: Configurable in settings

B and C

**Q5.2**: Should there be a system tray icon or notification indicating the server is running?

yes

**Q5.3**: If the Electron window is closed but the server is running, what should happen?
- Keep server running (app stays in tray)?
- Shut down server (and app)?

Shut it down

---

### 6. Security

**Q6.1**: For localhost-only mode, is **no authentication** acceptable, or do you want a token/password?

token or password

**Q6.2**: Should there be a way to **view active connections** or **disconnect browsers**?
yes

**Q6.3**: Any concerns about a local port being accessible to other apps/websites? (localhost isn't perfectly secure - malicious websites can sometimes probe localhost ports)

no

---

### 7. Mobile Browser Support

**Q7.1**: Is mobile browser support (phone/tablet) a goal, or is desktop browser sufficient?

If mobile:
- The current UI is desktop-oriented (multi-panel layout)
- Would need responsive design considerations
- Touch interactions differ from mouse

iPad is what I have in mind until I have an ios app proper. If it works for anything else, that's gravy

---

### 8. Use Cases

Understanding the primary use case helps prioritize:

**Q8.1**: What's the main motivation for this feature?
- **A**: Quick access without launching Electron (lighter weight)
- **B**: Access from multiple devices on LAN (phone, other computers)
- **C**: Future web deployment preparation
- **D**: Testing/development convenience
- **E**: Other: _______________

Access for devices for which there is no native client, or the client cannot be installed there for whatever reason.
---

### 9. Technical Constraints

**Q9.1**: Are there any performance concerns running a web server inside Electron? (Memory/CPU impact when server is idle)

not at present

**Q9.2**: The current desktop app uses `better-sqlite3` (native module). For browser access, we'd call this from the server - this means database operations would be the same. But should there be any considerations for concurrent access from multiple browser tabs?

I can't think so. Sqlite should handle this AFAIK. But correct me if I'm wrong

**Q9.3**: Is there an existing port or port range you'd prefer to use, or avoid?

No
---

### 10. Existing Pattern

**Q10.1**: The codebase has `packages/desktop` and `packages/shared`. Should the web server code:
- **A**: Live in `packages/desktop` (web server is part of the Electron app)
- **B**: Be a new package `packages/web-server` (separate but integrated)
- **C**: Other structure?

What do you recommend?
---

## Summary of Key Decisions Needed

| # | Decision | Impact |
|---|----------|--------|
| 1 | Localhost-only vs remote | Security architecture, HTTPS, auth |
| 2 | Simultaneous Electron+browser | Real-time sync complexity |
| 3 | Feature scope | Development effort, UI work |
| 4 | SD access in browser | File system exposure design |
| 5 | Server lifecycle | UX, system resource usage |
| 6 | Authentication | Security posture |
| 7 | Mobile support | UI/responsive design work |

---

## Follow-up Questions

### 11. HTTPS/TLS for Remote Access

Since you want remote access with authentication, sending passwords over plain HTTP on your LAN isn't ideal. Options:

**Q11.1**: How should we handle HTTPS?
- **A**: Self-signed certificate (browsers show warning on first connect, user clicks "proceed anyway")
- **B**: HTTP-only (simpler, but credentials transmitted in clear on LAN)
- **C**: Let user provide their own certificate (power-user option)
Self signed or user provided

### 12. Authentication Details

**Q12.1**: How should the auth token/password work?
- **A**: User sets a static password in Electron app settings
- **B**: Auto-generated token displayed in Electron app (changes each time server starts)
- **C**: Both options available

token, but something typable as copy/paste may not be available.

**Q12.2**: Should we show a QR code in the Electron app for easy iPad setup? (Scan QR → opens URL with auth token embedded)

oooh Yes!

### 13. Network Discovery

**Q13.1**: How should users find the server URL from their iPad?
- **A**: Display URL in Electron app, user types it manually
- **B**: Use mDNS/Bonjour so it appears as `notecove.local` (works well on Apple devices)
- **C**: QR code with full URL
- **D**: Multiple of the above

all of the above

### 14. iPad UI Adaptation

The current desktop UI has multiple panels (folder tree, notes list, editor).

**Q14.1**: For iPad, should we:
- **A**: Use the same layout (may feel cramped, but workable on iPad Pro)
- **B**: Add responsive breakpoints that collapse panels (hamburger menu style)
- **C**: Defer iPad-specific layout to later phase (get it working first, optimize later)
C - in landscape mode, it might just be fine.
---

## Next Steps

Once these questions are answered, I can:
1. Create a detailed implementation plan with phases
2. Identify relative complexity of each piece
3. Identify which existing code can be reused vs. needs modification
4. Propose the minimal viable implementation for initial testing

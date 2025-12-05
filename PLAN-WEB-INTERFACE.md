# Web Interface Feature Implementation Plan

**Overall Progress:** `85%` (Phase 0-7 complete, Phase 6 skipped)

## Summary

Add a web server to the Electron desktop app that allows browser access (including iPad) over the local network. The server runs inside the Electron main process, exposes REST/WebSocket endpoints mirroring the existing IPC handlers, and serves the renderer UI.

## Key Decisions (from Q&A)

| Aspect           | Decision                                                      |
| ---------------- | ------------------------------------------------------------- |
| Access           | Remote (LAN), configurable port                               |
| Concurrent use   | Yes, existing sync handles it                                 |
| Features         | Notes, folders, tags, search, history, diagnostics            |
| Excluded         | Settings, SD management, export, profile switching            |
| Server lifecycle | On-demand (menu/setting), shuts down with app                 |
| Auth             | Token-based (typable), QR code for setup, login page fallback |
| HTTPS            | Self-signed (default) or user-provided cert                   |
| Discovery        | Manual URL + mDNS/Bonjour (optional) + QR code                |
| iPad UI          | Defer responsive design; landscape likely fine                |
| Package location | `packages/desktop` (not separate package)                     |

## Review Checkpoints

| After Phase | Checkpoint                         |
| ----------- | ---------------------------------- |
| Phase 2     | ✅ API working (testable via curl) |
| Phase 4     | ✅ Browser client works end-to-end |
| Phase 8     | 🔲 Feature complete                |

---

## Tasks

### Phase 0: Browser Build Spike (Risk Reduction) ✅

> **Goal**: Prove we can build renderer for browser without Electron dependencies before investing in API layer.
>
> **Result**: SUCCESS - No blockers found. See [SPIKE-BROWSER-BUILD.md](./packages/desktop/docs/SPIKE-BROWSER-BUILD.md)

- [x] 🟩 **0.1: Proof-of-Concept Browser Build**
  - [x] 🟩 Create minimal Vite config for browser-only build
  - [x] 🟩 Identify Electron-specific imports in renderer code (none found!)
  - [x] 🟩 Create stub/mock for `window.electronAPI` in browser context
  - [x] 🟩 Build renderer and verify it loads in browser
  - [x] 🟩 Document any blockers or required refactoring (none required)

---

### Phase 1: Core Server Infrastructure

- [x] 🟩 **1.1: HTTP Server Foundation**
  - [x] 🟩 Write tests for server startup/shutdown lifecycle (17 tests)
  - [x] 🟩 Add Fastify as dependency (lightweight, TypeScript-native)
  - [x] 🟩 Create `src/main/web-server/server.ts` with start/stop methods
  - [ ] 🟥 Integrate server lifecycle with Electron app lifecycle (deferred to Phase 5)

- [x] 🟩 **1.2: TLS/HTTPS Support**
  - [x] 🟩 Write tests for certificate loading and self-signed generation (14 tests)
  - [x] 🟩 Create `src/main/web-server/tls.ts` for cert management
  - [x] 🟩 Generate self-signed cert (using node-forge, works in jsdom tests)
  - [x] 🟩 Support user-provided cert via config
  - [ ] 🟨 Research mkcert for iOS-friendly local CA (document findings) - deferred

- [x] 🟩 **1.3: Authentication**
  - [x] 🟩 Write tests for token generation, validation, middleware (22 tests)
  - [x] 🟩 Create `src/main/web-server/auth.ts` with token logic
  - [x] 🟩 Generate typable token (alphanumeric, excludes confusing chars)
  - [x] 🟩 Add auth middleware to protect all API routes (6 tests)
  - [ ] 🟨 Store token in config, regenerate on demand (deferred to Phase 5)

---

### Phase 2: REST API Layer ✅

- [x] 🟩 **2.1: API Route Structure**
  - [x] 🟩 Write tests for route registration and error handling (6 tests)
  - [x] 🟩 Create `src/main/web-server/routes/` directory structure
  - [x] 🟩 Implement base route handler with ServiceHandlers interface
  - [x] 🟩 Add consistent error response format (context.ts helpers)

- [x] 🟩 **2.2: Note Endpoints** (14 tests)
  - [x] 🟩 `GET /api/notes?sdId=...&folderId=...` - list notes
  - [x] 🟩 `GET /api/notes/:id` - get note metadata
  - [x] 🟩 `POST /api/notes` - create note
  - [x] 🟩 `DELETE /api/notes/:id` - delete note
  - [x] 🟩 `POST /api/notes/:id/move` - move note
  - [x] 🟩 `GET /api/search?q=...` - search notes

- [x] 🟩 **2.3: Folder Endpoints** (14 tests)
  - [x] 🟩 `GET /api/folders?sdId=...` - list folders
  - [x] 🟩 `POST /api/folders` - create folder
  - [x] 🟩 `PUT /api/folders/:sdId/:id` - rename folder
  - [x] 🟩 `DELETE /api/folders/:sdId/:id` - delete folder
  - [x] 🟩 `POST /api/folders/:sdId/:id/move` - move folder
  - [x] 🟩 `POST /api/folders/:sdId/:id/reorder` - reorder folder

- [x] 🟩 **2.4: Tag Endpoints** (1 test)
  - [x] 🟩 `GET /api/tags` - list tags

- [x] 🟩 **2.5: History & Diagnostics Endpoints** (3 tests)
  - [x] 🟩 `GET /api/notes/:noteId/history/timeline` - get timeline
  - [x] 🟩 `GET /api/notes/:noteId/history/stats` - get stats
  - [x] 🟩 `GET /api/diagnostics/status` - get diagnostics info

- [x] 🟩 **2.6: Storage Directory Endpoints** (3 tests)
  - [x] 🟩 `GET /api/storage-directories` - list configured SDs
  - [x] 🟩 `GET /api/storage-directories/active` - get active SD

- [x] 🟩 **2.7: Manual Test Checkpoint**
  - [x] 🟩 Verify API endpoints work via curl (test-server.ts)
  - [x] 🟩 Document test commands (printed on server start)

> **📋 CHECKPOINT**: ✅ COMPLETE - API testable via curl with test-server.ts

---

### Phase 3: Real-time Updates (WebSocket)

- [x] 🟩 **3.1: WebSocket Server** (10 tests)
  - [x] 🟩 Write tests for WebSocket connection and auth
  - [x] 🟩 Add WebSocket support to Fastify server
  - [x] 🟩 Require auth token on WebSocket handshake
  - [x] 🟩 Track connected clients

- [x] 🟩 **3.2: Event Broadcasting**
  - [x] 🟩 Write tests for event broadcast to connected clients (in websocket.test.ts)
  - [x] 🟩 Hook into existing IPC broadcast mechanism (setWebBroadcastCallback)
  - [x] 🟩 Broadcast note/folder/tag changes to WebSocket clients
  - [x] 🟩 Handle client disconnect gracefully

---

### Phase 4: Browser Client Adapter ✅

- [x] 🟩 **4.1: API Client Module**
  - [ ] 🟨 Write tests for API client methods (deferred - manual testing via browser)
  - [x] 🟩 Create `src/renderer/src/api/web-client.ts`
  - [x] 🟩 Implement same interface as `window.electronAPI`
  - [x] 🟩 Use fetch for REST, WebSocket for events
  - [x] 🟩 Handle auth token storage (localStorage)

- [x] 🟩 **4.2: Platform Detection & Adapter**
  - [ ] 🟨 Write tests for platform detection (deferred - manual testing via browser)
  - [x] 🟩 Create `src/renderer/src/api/index.ts` adapter
  - [x] 🟩 Detect Electron vs browser environment
  - [x] 🟩 Export unified API that uses correct implementation

- [x] 🟩 **4.3: Browser Build Configuration**
  - [x] 🟩 Finalize Vite config for browser-only bundle (based on Phase 0 findings)
  - [x] 🟩 Exclude Electron preload from browser build
  - [x] 🟩 Configure static file serving in Fastify (existing routes/index.ts)

- [x] 🟩 **4.4: Browser Login Page**
  - [ ] 🟨 Write tests for login flow (deferred - manual testing via browser)
  - [x] 🟩 Create simple login page component (LoginPage/LoginPage.tsx)
  - [x] 🟩 Extract token from URL query param if present (from QR code)
  - [x] 🟩 Show login form if token missing or invalid
  - [x] 🟩 Store valid token in localStorage
  - [x] 🟩 Redirect to main app on success (BrowserApp.tsx handles this)

> **📋 CHECKPOINT**: ✅ COMPLETE - Browser client works end-to-end.

---

### Phase 5: Server Management UI ✅

- [x] 🟩 **5.1: IPC Handlers & Server Control**
  - [x] 🟩 Add IPC handlers for webServer:start, webServer:stop, webServer:getStatus
  - [x] 🟩 Add IPC handlers for token regeneration
  - [x] 🟩 Create WebServerManager class in main/web-server/manager.ts
  - [x] 🟩 Integrate with Electron app lifecycle (init on ready, cleanup on quit)
  - [ ] 🟨 Menu item deferred (settings panel switch is sufficient)

- [x] 🟩 **5.2: Server Settings Panel**
  - [x] 🟩 Add web server section to settings UI (WebServerSettings.tsx)
  - [x] 🟩 Port configuration input with validation (1024-65535)
  - [x] 🟩 Token display with show/hide toggle and regenerate button
  - [x] 🟩 Start/Stop server via switch control
  - [x] 🟩 Server status display (running/stopped, port, client count)
  - [ ] 🟨 Certificate status/path display deferred

- [x] 🟩 **5.3: QR Code Display**
  - [x] 🟩 Add qrcode library
  - [x] 🟩 Generate QR with URL + auth token
  - [x] 🟩 Display QR in server settings panel (200x200px)
  - [x] 🟩 Show full URL alongside QR with copy button
  - [ ] 🟨 QR code generation tests deferred (manual testing sufficient)

- [x] 🟩 **5.4: Active Connections View**
  - [x] 🟩 Track connected clients (IP, user-agent, connect time)
  - [x] 🟩 Display active connections in settings panel with polling (5s)
  - [x] 🟩 Add "Disconnect" button per client
  - [x] 🟩 Add "Disconnect All" button
  - [x] 🟩 Format connection duration (seconds/minutes/hours)

---

### Phase 6: Network Discovery (mDNS/Bonjour) ⏭️ SKIPPED

> **Note**: mDNS was deemed unnecessary for initial release. QR code + manual URL entry is sufficient.

- [ ] 🟨 **6.1: mDNS Advertisement** (deferred)
  - [ ] 🟨 Write tests for mDNS service registration (mock on failure)
  - [ ] 🟨 Add bonjour-service library
  - [ ] 🟨 Advertise service when server starts (catch errors gracefully)
  - [ ] 🟨 Stop advertisement when server stops
  - [ ] 🟨 Use discoverable name (e.g., `NoteCove on [hostname]`)
  - [ ] 🟨 Log warning if mDNS unavailable, continue without it

---

### Phase 7: Feature Gating for Browser ✅

- [x] 🟩 **7.1: Disable Unsupported Features**
  - [x] 🟩 Create `src/renderer/src/utils/platform.ts` with isElectron/isBrowser detection
  - [x] 🟩 Hide export menu in browser (requires file save dialog)
  - [x] 🟩 Hide Settings tabs that require Electron:
    - Storage Directories (needs file picker)
    - Database (needs filesystem access)
    - Recovery (needs database access)
    - Web Server (browser is already a client)
    - Telemetry (config stored via Electron)
  - [x] 🟩 SD management hidden (only accessible via Electron app menu)
  - [x] 🟩 Profile switching hidden (only accessible via Electron app menu)
  - [ ] 🟨 Tests for feature detection (deferred - manual testing sufficient)

---

### Phase 8: Integration & Polish

- [ ] 🟥 **8.1: E2E Testing**
  - [ ] 🟥 Add E2E test: start server, connect browser, edit note
  - [ ] 🟥 Add E2E test: simultaneous Electron + browser editing
  - [ ] 🟥 Add E2E test: auth flow (invalid token rejected)
  - [ ] 🟥 Add E2E test: WebSocket reconnection

- [ ] 🟥 **8.2: Error Handling**
  - [ ] 🟥 Handle port-in-use gracefully
  - [ ] 🟥 Handle cert generation failures
  - [ ] 🟥 Show user-friendly errors in UI

- [ ] 🟥 **8.3: Documentation**
  - [ ] 🟥 Update user documentation with web access instructions
  - [ ] 🟥 Add iOS Safari certificate trust instructions
  - [ ] 🟥 Add troubleshooting section:
    - Firewall configuration (allow port through OS firewall)
    - Network requirements (same subnet, no client isolation)
    - Certificate warnings and how to accept them

> **📋 CHECKPOINT**: Final review. Feature complete.

---

## File Structure (New Files)

```
packages/desktop/src/main/web-server/
├── server.ts           # Fastify server setup, start/stop
├── tls.ts              # Certificate generation/loading
├── auth.ts             # Token generation, validation, middleware
├── websocket.ts        # WebSocket handling, client tracking
├── routes/
│   ├── index.ts        # Route registration
│   ├── notes.ts        # Note endpoints
│   ├── folders.ts      # Folder endpoints
│   ├── tags.ts         # Tag endpoints
│   ├── search.ts       # Search endpoint
│   ├── history.ts      # History endpoints
│   ├── diagnostics.ts  # Diagnostics endpoint
│   └── storage.ts      # SD listing endpoint
└── mdns.ts             # mDNS/Bonjour advertisement (optional)

packages/desktop/src/renderer/src/api/
├── index.ts            # Unified API adapter
├── electron-client.ts  # Wraps window.electronAPI (existing behavior)
└── web-client.ts       # HTTP/WebSocket client for browser

packages/desktop/src/renderer/src/components/
└── LoginPage.tsx       # Browser login page (new)

packages/desktop/src/renderer/src/utils/
└── platform.ts         # Platform detection, feature flags
```

---

## Dependencies to Add

| Package              | Purpose                               |
| -------------------- | ------------------------------------- |
| `fastify`            | HTTP server                           |
| `@fastify/websocket` | WebSocket support                     |
| `@fastify/static`    | Static file serving                   |
| `@fastify/cors`      | CORS for browser requests             |
| `selfsigned`         | Self-signed certificate generation    |
| `qrcode`             | QR code generation                    |
| `bonjour-service`    | mDNS/Bonjour advertisement (optional) |

---

## Out of Scope (Explicitly Deferred)

- Responsive iPad UI (landscape mode assumed sufficient)
- Export functionality in browser
- SD management in browser
- Settings configuration in browser
- Profile switching in browser
- Remote access outside LAN (no port forwarding/tunneling)
- Cross-platform mDNS (macOS focus, best-effort elsewhere)

---

## Subsidiary Documents

- [QUESTIONS-WEB-INTERFACE.md](./QUESTIONS-WEB-INTERFACE.md) - Requirements Q&A
- [REVIEW-QUESTIONS-1.md](./REVIEW-QUESTIONS-1.md) - Plan review Q&A
- [SPIKE-BROWSER-BUILD.md](./packages/desktop/docs/SPIKE-BROWSER-BUILD.md) - Phase 0 spike results

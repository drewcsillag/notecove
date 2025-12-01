# Web Interface Feature Implementation Plan

**Overall Progress:** `5%` (Phase 0 complete)

## Summary

Add a web server to the Electron desktop app that allows browser access (including iPad) over the local network. The server runs inside the Electron main process, exposes REST/WebSocket endpoints mirroring the existing IPC handlers, and serves the renderer UI.

## Key Decisions (from Q&A)

| Aspect | Decision |
|--------|----------|
| Access | Remote (LAN), configurable port |
| Concurrent use | Yes, existing sync handles it |
| Features | Notes, folders, tags, search, history, diagnostics |
| Excluded | Settings, SD management, export, profile switching |
| Server lifecycle | On-demand (menu/setting), shuts down with app |
| Auth | Token-based (typable), QR code for setup, login page fallback |
| HTTPS | Self-signed (default) or user-provided cert |
| Discovery | Manual URL + mDNS/Bonjour (optional) + QR code |
| iPad UI | Defer responsive design; landscape likely fine |
| Package location | `packages/desktop` (not separate package) |

## Review Checkpoints

| After Phase | Checkpoint |
|-------------|------------|
| Phase 2 | 🔲 API working (testable via curl) |
| Phase 4 | 🔲 Browser client works end-to-end |
| Phase 8 | 🔲 Feature complete |

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

- [ ] 🟥 **1.1: HTTP Server Foundation**
  - [ ] 🟥 Write tests for server startup/shutdown lifecycle
  - [ ] 🟥 Add Fastify as dependency (lightweight, TypeScript-native)
  - [ ] 🟥 Create `src/main/web-server/server.ts` with start/stop methods
  - [ ] 🟥 Integrate server lifecycle with Electron app lifecycle

- [ ] 🟥 **1.2: TLS/HTTPS Support**
  - [ ] 🟥 Write tests for certificate loading and self-signed generation
  - [ ] 🟥 Create `src/main/web-server/tls.ts` for cert management
  - [ ] 🟥 Generate self-signed cert on first run (store in userData)
  - [ ] 🟥 Support user-provided cert via config
  - [ ] 🟥 Research mkcert for iOS-friendly local CA (document findings)

- [ ] 🟥 **1.3: Authentication**
  - [ ] 🟥 Write tests for token generation, validation, middleware
  - [ ] 🟥 Create `src/main/web-server/auth.ts` with token logic
  - [ ] 🟥 Generate typable token (e.g., 6 words or short alphanumeric)
  - [ ] 🟥 Add auth middleware to protect all API routes
  - [ ] 🟥 Store token in config, regenerate on demand

---

### Phase 2: REST API Layer

- [ ] 🟥 **2.1: API Route Structure**
  - [ ] 🟥 Write tests for route registration and error handling
  - [ ] 🟥 Create `src/main/web-server/routes/` directory structure
  - [ ] 🟥 Implement base route handler that wraps IPC handler calls
  - [ ] 🟥 Add consistent error response format

- [ ] 🟥 **2.2: Note Endpoints**
  - [ ] 🟥 Write tests for note CRUD operations via API
  - [ ] 🟥 `GET /api/notes/:id` - load note
  - [ ] 🟥 `GET /api/notes/:id/state` - get note state
  - [ ] 🟥 `POST /api/notes/:id/update` - apply CRDT update
  - [ ] 🟥 `POST /api/notes` - create note
  - [ ] 🟥 `DELETE /api/notes/:id` - delete note
  - [ ] 🟥 `POST /api/notes/:id/move` - move note

- [ ] 🟥 **2.3: Folder Endpoints**
  - [ ] 🟥 Write tests for folder operations via API
  - [ ] 🟥 `GET /api/folders` - list folders
  - [ ] 🟥 `POST /api/folders` - create folder
  - [ ] 🟥 `PUT /api/folders/:id` - rename folder
  - [ ] 🟥 `DELETE /api/folders/:id` - delete folder
  - [ ] 🟥 `POST /api/folders/:id/move` - reorder folder

- [ ] 🟥 **2.4: Tag & Search Endpoints**
  - [ ] 🟥 Write tests for tag and search operations
  - [ ] 🟥 `GET /api/tags` - list tags
  - [ ] 🟥 `GET /api/search?q=...` - search notes

- [ ] 🟥 **2.5: History & Diagnostics Endpoints**
  - [ ] 🟥 Write tests for history/diagnostics operations
  - [ ] 🟥 `GET /api/history/:noteId` - get note history
  - [ ] 🟥 `GET /api/diagnostics` - get diagnostics info

- [ ] 🟥 **2.6: Storage Directory Endpoints**
  - [ ] 🟥 Write tests for SD listing (read-only)
  - [ ] 🟥 `GET /api/storage-directories` - list configured SDs
  - [ ] 🟥 `GET /api/notes?sd=...&folder=...` - list notes

- [ ] 🟥 **2.7: Manual Test Checkpoint**
  - [ ] 🟥 Verify API endpoints work via curl/Postman
  - [ ] 🟥 Document test commands for future reference

> **📋 CHECKPOINT**: Pause for review. API should be testable via curl.

---

### Phase 3: Real-time Updates (WebSocket)

- [ ] 🟥 **3.1: WebSocket Server**
  - [ ] 🟥 Write tests for WebSocket connection and auth
  - [ ] 🟥 Add WebSocket support to Fastify server
  - [ ] 🟥 Require auth token on WebSocket handshake
  - [ ] 🟥 Track connected clients

- [ ] 🟥 **3.2: Event Broadcasting**
  - [ ] 🟥 Write tests for event broadcast to connected clients
  - [ ] 🟥 Hook into existing IPC broadcast mechanism
  - [ ] 🟥 Broadcast note/folder/tag changes to WebSocket clients
  - [ ] 🟥 Handle client disconnect gracefully

---

### Phase 4: Browser Client Adapter

- [ ] 🟥 **4.1: API Client Module**
  - [ ] 🟥 Write tests for API client methods
  - [ ] 🟥 Create `src/renderer/src/api/web-client.ts`
  - [ ] 🟥 Implement same interface as `window.electronAPI`
  - [ ] 🟥 Use fetch for REST, WebSocket for events
  - [ ] 🟥 Handle auth token storage (localStorage)

- [ ] 🟥 **4.2: Platform Detection & Adapter**
  - [ ] 🟥 Write tests for platform detection
  - [ ] 🟥 Create `src/renderer/src/api/index.ts` adapter
  - [ ] 🟥 Detect Electron vs browser environment
  - [ ] 🟥 Export unified API that uses correct implementation

- [ ] 🟥 **4.3: Browser Build Configuration**
  - [ ] 🟥 Finalize Vite config for browser-only bundle (based on Phase 0 findings)
  - [ ] 🟥 Exclude Electron preload from browser build
  - [ ] 🟥 Configure static file serving in Fastify

- [ ] 🟥 **4.4: Browser Login Page**
  - [ ] 🟥 Write tests for login flow
  - [ ] 🟥 Create simple login page component
  - [ ] 🟥 Extract token from URL query param if present (from QR code)
  - [ ] 🟥 Show login form if token missing or invalid
  - [ ] 🟥 Store valid token in localStorage
  - [ ] 🟥 Redirect to main app on success

> **📋 CHECKPOINT**: Pause for review. Browser should work end-to-end.

---

### Phase 5: Server Management UI

- [ ] 🟥 **5.1: Server Control Menu**
  - [ ] 🟥 Add "Start Web Server" / "Stop Web Server" menu item
  - [ ] 🟥 Show server status in menu (running/stopped, port)
  - [ ] 🟥 Add keyboard shortcut

- [ ] 🟥 **5.2: Server Settings Panel**
  - [ ] 🟥 Add web server section to settings UI
  - [ ] 🟥 Port configuration input
  - [ ] 🟥 Token display with regenerate button
  - [ ] 🟥 Certificate status/path display

- [ ] 🟥 **5.3: QR Code Display**
  - [ ] 🟥 Write tests for QR code generation
  - [ ] 🟥 Add QR code library (qrcode)
  - [ ] 🟥 Generate QR with URL + auth token
  - [ ] 🟥 Display QR in server settings panel
  - [ ] 🟥 Show plain URL alongside QR

- [ ] 🟥 **5.4: Active Connections View**
  - [ ] 🟥 Track connected clients (IP, user-agent, connect time)
  - [ ] 🟥 Display active connections in settings panel
  - [ ] 🟥 Add "Disconnect" button per client
  - [ ] 🟥 Add "Disconnect All" button

---

### Phase 6: Network Discovery (mDNS/Bonjour)

> **Note**: mDNS is optional with graceful degradation. Focus on macOS; other platforms best-effort.

- [ ] 🟥 **6.1: mDNS Advertisement**
  - [ ] 🟥 Write tests for mDNS service registration (mock on failure)
  - [ ] 🟥 Add bonjour-service library
  - [ ] 🟥 Advertise service when server starts (catch errors gracefully)
  - [ ] 🟥 Stop advertisement when server stops
  - [ ] 🟥 Use discoverable name (e.g., `NoteCove on [hostname]`)
  - [ ] 🟥 Log warning if mDNS unavailable, continue without it

---

### Phase 7: Feature Gating for Browser

- [ ] 🟥 **7.1: Disable Unsupported Features**
  - [ ] 🟥 Write tests for feature detection
  - [ ] 🟥 Create `src/renderer/src/utils/platform.ts`
  - [ ] 🟥 Hide/disable export menu in browser
  - [ ] 🟥 Hide/disable SD management in browser
  - [ ] 🟥 Hide/disable settings that require Electron
  - [ ] 🟥 Hide/disable profile switching in browser

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

| Package | Purpose |
|---------|---------|
| `fastify` | HTTP server |
| `@fastify/websocket` | WebSocket support |
| `@fastify/static` | Static file serving |
| `@fastify/cors` | CORS for browser requests |
| `selfsigned` | Self-signed certificate generation |
| `qrcode` | QR code generation |
| `bonjour-service` | mDNS/Bonjour advertisement (optional) |

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

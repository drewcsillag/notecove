## Phase 5: Documentation & Polish

### 5.1 Documentation Website - Landing Page 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Set up Vite + React project in `/packages/website`
- [ ] 🟥 Configure for GitHub Pages deployment
- [ ] 🟥 Design landing page
  - Hero section with app description
  - Feature highlights
  - Screenshots/demos
  - Download links (when available)
  - Links to documentation
- [ ] 🟥 Create app icon/logo
  - Blue accent color (#2196F3)
  - Clean, minimalist style
  - License-compatible icons (Apache 2.0, MIT)
- [ ] 🟥 Deploy to GitHub Pages

**Acceptance Criteria:**

- Landing page is live
- Looks professional
- Links work

---

### 5.2 Documentation Website - User Guide 🟥

**Status:** To Do (Incremental)

**Tasks:**

- [ ] 🟥 Write installation instructions
  - macOS, Windows, Linux
  - iOS (TestFlight / direct install via Xcode)
- [ ] 🟥 Write user guide
  - Getting started
  - Creating notes and folders
  - Using tags
  - Inter-note links
  - Search
  - Export
  - Settings and SDs
  - Sync behavior
- [ ] 🟥 Add screenshots for each feature
- [ ] 🟥 Update incrementally as features are completed

**Acceptance Criteria:**

- User guide covers all features
- Screenshots are current
- Easy to follow

---

### 5.3 Documentation Website - Developer Docs 🟥

**Status:** To Do (Incremental)

**Tasks:**

- [ ] 🟥 Write architecture overview
  - CRDT design
  - File structure
  - Sync mechanism
  - SQLite caching
  - iOS JavaScriptCore bridge
- [ ] 🟥 Write API documentation
  - IPC API reference
  - CLI tool usage
- [ ] 🟥 Write contribution guide
  - How to build from source
  - Testing
  - Code style
  - PR process
- [ ] 🟥 Link to design docs in `/docs/`

**Acceptance Criteria:**

- Developer docs are comprehensive
- API is fully documented
- Easy for contributors to understand codebase

---

### 5.4 CI/CD Pipeline 🟥

**Status:** To Do

**Tasks:**

- [ ] 🟥 Enhance GitHub Actions workflow (based on Phase 1.2 local CI script)
  - Run tests, linting, builds on every push/PR
  - Test on: macOS, Windows, Linux
  - Report coverage
  - Use same checks as `pnpm ci-local`
- [ ] 🟥 Set up automated builds for releases
  - electron-builder for desktop (macOS, Windows, Linux)
  - Xcode build for iOS
- [ ] 🟥 Plan for code signing (defer actual setup)
  - macOS: Apple Developer account needed
  - Windows: Code signing certificate needed
  - iOS: Apple Developer account (same as macOS)
  - Document requirements in developer docs
- [ ] 🟥 Plan for distribution (defer actual setup)
  - GitHub Releases for desktop
  - TestFlight for iOS (requires paid Apple account - $99/year)
  - Future: Mac App Store, iOS App Store

**Acceptance Criteria:**

- CI runs on every push
- Can build release artifacts locally
- Code signing and distribution requirements documented

---

### 5.5 UI Polish & Refinements 🟥

**Status:** To Do (Ongoing)

**Tasks:**

- [ ] 🟥 Refine animations and transitions
- [ ] 🟥 Improve error messages and user feedback
- [ ] 🟥 Add loading states and progress indicators
- [ ] 🟥 Improve drag & drop visual feedback
- [ ] 🟥 Add tooltips and help text
- [ ] 🟥 Responsive design improvements
- [ ] 🟥 Performance optimizations
- [ ] 🟥 Icon and asset cleanup

**Acceptance Criteria:**

- UI feels polished and responsive
- Interactions are smooth
- Error messages are helpful

---

## Testing Strategy

### Test Coverage Targets

- **Overall:** 70% minimum
- **CRDT/Sync Logic:** ~100%
- **File System Operations:** ~100%
- **SQLite Operations:** ~100%
- **UI Components:** 70%

### Test Types

1. **Unit Tests (Jest)**
   - CRDT operations
   - File system operations
   - SQLite queries
   - Utility functions
   - React components (with React Testing Library)

2. **Integration Tests (Jest)**
   - Multi-instance sync scenarios
   - CRDT + SQLite consistency
   - IPC communication

3. **E2E Tests (Playwright for desktop, XCTest for iOS)**
   - User workflows
   - Multi-window scenarios
   - Settings and configuration
   - Search and filtering
   - Drag and drop

4. **Manual Testing**
   - Cross-platform compatibility
   - Sync with real cloud storage services
   - Performance with large note collections
   - Accessibility with screen readers

### Test Scenarios (Critical)

- **Multi-instance sync:** Two desktop instances editing same note simultaneously
- **Cross-platform sync:** Desktop and iOS editing same note
- **Offline mode:** Edit notes offline, sync when online
- **Conflict handling:** Ensure CRDT merges correctly
- **Data integrity:** Never lose note data
- **Large datasets:** Performance with 10,000+ notes
- **Out-of-order sync:** Updates arrive in arbitrary order due to cloud sync delays

---

## Development Workflow

### Branch Strategy

- `main` branch: stable, tested code
- Feature branches: `feature/<name>` for each major task
- Merge to `main` only after review and `pnpm ci-local` passes
- Each phase gets a feature branch (e.g., `feature/phase-1-core`)

### Code Review Process

- After implementing each phase, perform self-review
- Run `pnpm ci-local` (full test suite, linting, coverage)
- Check code coverage meets thresholds
- Update documentation as needed
- Get user approval before merging to `main`

### Bug Fixes

- Any bug report gets a test first (TDD)
- Fix the bug
- Verify test passes
- Expand existing test or create new one
- Run `pnpm ci-local` before committing

---

## Design Documentation

Complex architecture decisions should be documented in `/docs/`:

- `crdt-structure.md` - Yjs document design for notes and folders
- `file-sync-protocol.md` - File sync mechanism, error handling, out-of-order updates
- `sqlite-schema.md` - Database schema and caching strategy
- `ipc-protocol.md` - IPC commands, events, and data flow
- `tiptap-yjs-compatibility.md` - TipTap extension compatibility with Yjs
- `ios-jscore-bridge.md` - Swift ↔ JavaScriptCore bridge design

These docs should be created as part of implementation and kept up to date.

---

## Appendix: Deferred Features & Future Enhancements

These are features mentioned but explicitly marked as post-MVP or future enhancements:

1. **Note History - Diff View:** Side-by-side comparison of versions with colored changes
2. **Advanced Search - Saved Searches:** Ability to save search queries for reuse
3. **Color Customization:** Beyond blue accent, full theme customization
4. **Task Management Enhancements:** Due dates, @mentions, assignment
5. **Apple Shortcuts/AppleScript:** Automation integration
6. **IPC API Write Operations:** Create/update/delete via API
7. **Browser Extension:** For web clipping (mentioned as potential API use case)
8. **Plugin System:** Extensibility via third-party plugins
9. **Localization:** Support for languages beyond English
10. **App Store Distribution:** Mac App Store, iOS App Store (after TestFlight phase)
11. **Crash Reporting:** Integration with services like Sentry
12. **Settings Sync:** Optionally sync settings across devices (currently local-only)
13. **Version Snapshots:** Periodic snapshots of CRDT state for faster loading
14. **Advanced Tag Management:** Rename tags globally, merge tags
15. **Note Templates:** Create notes from templates
16. **Import:** Import from other note apps (Evernote, Notion, etc.)

---

## Plan Change History

- **2025-01-XX:** Post-planning review
  - Reordered Phase 1: Testing Framework Setup moved to 1.2 (was 1.5)
  - Reordered Phase 2: Note Editor moved to 2.3 (was 2.6)
  - Added iOS Architecture Overview section before Phase 3
  - Clarified IPC protocol (removed misleading `saveNote`, documented CRDT auto-persistence flow)
  - Added local CI script (`pnpm ci-local`) to Phase 1.2
  - Added `/docs/` for design documentation
  - Added requirement to document complex designs in `/docs/`
  - Expanded design docs references throughout plan
  - Clarified CRDT structures (folder hierarchy, "All Notes"/"Recently Deleted" as UI-only)
  - Added notes about out-of-order update handling
  - Added notes about SQLite caching strategy

---

## Linked Documents

- [QUESTIONS-1.md](./QUESTIONS-1.md) - Initial clarification questions
- [QUESTIONS-2.md](./QUESTIONS-2.md) - Follow-up questions
- [QUESTIONS-3.md](./QUESTIONS-3.md) - Technical decisions
- [QUESTIONS-4.md](./QUESTIONS-4.md) - Implementation details
- [QUESTIONS-5.md](./QUESTIONS-5.md) - Feature clarifications
- [QUESTIONS-6.md](./QUESTIONS-6.md) - Final clarifications
- [QUESTIONS-7.md](./QUESTIONS-7.md) - iOS and MVP definition
- [POST-PLAN-1.md](./POST-PLAN-1.md) - Post-planning discussion round 1
- [POST-PLAN-2.md](./POST-PLAN-2.md) - Post-planning discussion round 2

---

**End of Plan**

# Plan Critique - oEmbed Link Unfurling

## 1. Ordering Analysis

### Phase 1 Internal Ordering ✅

The ordering is correct:

1. Database schema first (storage layer)
2. Types (shared definitions)
3. Registry bundling (lookup capability)
4. Fetcher service (uses 1-3)
5. IPC handlers (exposes 4)
6. Preload API (exposes 5)

### Phase 2 Internal Ordering ⚠️ Minor Issue

Current order: 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6

**Issue**: The decoration plugin (2.6) should be developed alongside the chip component (2.2), not after. Without the plugin, we can't see chips in the editor.

**Suggested reorder**:

1. 2.1 - WebLink attribute
2. 2.4 - Context detection (needed to decide chip vs unfurl)
3. 2.5 - Multi-link detection
4. 2.2 + 2.6 - Chip component AND decoration plugin together
5. 2.3 - Hover preview (enhancement)

### Phase 3 Internal Ordering ✅

Order is logical - node → component → toolbar → lazy loading → auto-unfurl.

### Cross-Phase Dependencies ✅

Each phase correctly depends on previous phases.

---

## 2. Feedback Loop - Getting to Testable Sooner

### Current Path to First Visual Result

Phase 1 (all) → Phase 2.1 → 2.2 → ... → First visible chip

**This is too long.** We should be able to see something working earlier.

### Proposed: Add "Demo Mode" to Phase 1

After 1.5 (IPC Handlers), add a quick test before Phase 2:

```
1.7 Quick Visual Test
  - Add temporary "Test oEmbed" button to editor toolbar
  - Opens dialog: paste URL → fetch → show raw JSON result
  - Validates the full stack works before building UI
  - Remove after Phase 2 is complete
```

This gets us a working demo in Phase 1 and makes debugging easier.

---

## 3. Debug Tools - Missing

The plan lacks explicit debug tooling. Add to Phase 1:

### Recommended Additions

```
1.8 Debug Infrastructure
  - Add logging to OEmbedService (fetch attempts, cache hits/misses)
  - Add oEmbed tab to Storage Inspector (if exists)
  - Console command: window.__debugOEmbed(url) for manual testing
```

This is especially important because:

- oEmbed endpoints are third-party and can fail in unexpected ways
- Cache issues are hard to diagnose without visibility
- Network timing issues need logging to debug

---

## 4. Missing Items

### 4.1 Favicon Fetching (Incomplete)

Phase 2.2 mentions favicon fetching but doesn't specify:

- **Where**: Main process or renderer?
- **How**: Google's favicon API or direct fetch?
- **Caching**: Should favicons be cached?

**Recommendation**: Add explicit task in Phase 1:

```
1.7 Favicon Service
  - IPC handler: favicon:get(domain) → base64 or URL
  - Use Google's favicon API: https://www.google.com/s2/favicons?domain={domain}&sz=32
  - Cache in database (simple key-value)
```

### 4.2 Image/Thumbnail Proxying (Missing)

Thumbnails from external sites may have:

- CORS issues preventing display
- Mixed content (HTTP thumbnails on HTTPS app)
- Privacy concerns (external tracking)

**Recommendation**: Add to Phase 1:

```
1.8 Thumbnail Proxy
  - Main process fetches thumbnail via Electron net
  - Returns base64 data URL
  - Avoids CORS and mixed content issues
  - Optional: cache thumbnails locally
```

### 4.3 Link Text Preservation (Unclear)

When a link like `[Check this out](https://youtube.com/...)` becomes an unfurl:

- What happens to "Check this out" text?
- Is it preserved? Shown above the unfurl? Discarded?

**Recommendation**: Clarify in Phase 3.5:

- Keep link text in the mark
- Unfurl block shows below, link text remains in paragraph
- User can delete the unfurl without losing the link

### 4.4 Export/Copy Behavior (Missing)

How do unfurls appear when:

- Exporting to Markdown?
- Copying to clipboard?
- Pasting into another app?

**Recommendation**: Add to Phase 5:

```
5.6 Export Behavior
  - Markdown export: Convert unfurl to plain link [title](url)
  - Copy to clipboard: Include both link text and URL
  - Paste from external: Detect URLs and trigger unfurl
```

### 4.5 iOS Compatibility (Missing)

The plan is desktop-focused. What about iOS?

**Question for user**: Should unfurls work on iOS too?

- If yes: Need to implement fetching in iOS native code
- If no: Should degrade gracefully to plain links

### 4.6 Offline Behavior (Implicit)

What happens when offline?

- Cached unfurls should display
- New links should show loading then "offline" state
- Should not block editing

**Recommendation**: Already handled by cache-first approach, but add explicit test case.

---

## 5. Risk Assessment

### High Risk

| Risk                              | Likelihood | Impact | Mitigation                                   |
| --------------------------------- | ---------- | ------ | -------------------------------------------- |
| Provider endpoints fail/slow      | High       | Medium | Timeout (5s), retry logic, graceful fallback |
| Rich HTML contains malicious code | Medium     | High   | Sandboxed iframe, allowlist providers        |
| Many links slow down editor       | Medium     | Medium | Lazy loading, queue with max concurrent      |

### Medium Risk

| Risk                        | Likelihood | Impact | Mitigation                   |
| --------------------------- | ---------- | ------ | ---------------------------- |
| CORS blocks thumbnails      | High       | Low    | Proxy through main process   |
| Registry gets stale         | Medium     | Low    | Weekly update checks         |
| Display mode sync conflicts | Low        | Medium | Last-write-wins (acceptable) |

### Low Risk

| Risk                           | Likelihood | Impact | Mitigation                |
| ------------------------------ | ---------- | ------ | ------------------------- |
| oEmbed spec changes            | Very Low   | Medium | Version check in response |
| Discovery finds wrong endpoint | Low        | Low    | Fallback to preview card  |

### Additional Test Cases Needed

1. **Timeout handling** - Provider takes > 5 seconds
2. **Invalid JSON** - Provider returns malformed response
3. **Rate limiting** - Provider returns 429
4. **Large images** - Thumbnail is 10MB+
5. **Recursive embeds** - Embed contains another embed URL
6. **XSS in title/description** - Malicious text in oEmbed response

---

## 6. Questions for User

See: [QUESTIONS-PLAN-1.md](./QUESTIONS-PLAN-1.md)

Key questions:

1. **iOS compatibility** - Desktop only, or iOS too?
2. **Export behavior** - How unfurls appear in markdown/clipboard
3. **Debug tooling** - Add oEmbed tab to Storage Inspector?
4. **Link text preservation** - Keep original text or replace?
5. **Thumbnail caching** - Cache locally or always fetch?

---

## 7. Recommended Plan Updates

Based on this critique, update the plan with:

### Phase 1 Additions

- 1.7 Favicon Service (IPC handler + Google API)
- 1.8 Thumbnail Proxy (main process fetch, return base64)
- 1.9 Debug Infrastructure (logging, test button)

### Phase 2 Reordering

Reorder to: 2.1 → 2.4 → 2.5 → 2.2+2.6 → 2.3

### Phase 5 Additions

- 5.6 Export Behavior (markdown, clipboard)
- 5.7 Offline Handling (explicit test cases)

### Additional Test Cases

Add explicit tests for:

- Timeout handling (>5s)
- Invalid JSON responses
- Rate limiting (429)
- XSS in title/description
- Large thumbnails

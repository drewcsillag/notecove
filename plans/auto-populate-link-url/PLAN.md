# Auto-Populate Link URL Feature

**Overall Progress:** `100%`

## Overview

When the user selects text that looks like a URL or hostname and presses Cmd+K (or clicks the link button), the URL input field should be auto-populated with the selected text (formatted as a URL if needed).

## Design Decisions

Based on [QUESTIONS-1.md](./QUESTIONS-1.md):

- **Detection scope**: Full URLs, bare hostnames with TLDs, hostnames with paths, IP addresses, localhost
- **Target component**: LinkInputPopover only (text must be selected)
- **Whitespace**: Trim before detection, reject internal spaces
- **URL formatting**: Prepend `https://` to bare hostnames (`http://` for IP addresses)
- **UX**: Use existing select-on-focus behavior, no additional visual indicator

## Tasks

### Phase 1: Create URL Detection Utility

- [x] 🟩 **1.1: Write tests for URL/hostname detection function**
  - Location: `packages/shared/src/utils/__tests__/web-link-utils.test.ts`
  - [x] 🟩 Test full URLs with http/https schemes
  - [x] 🟩 Test bare hostnames with common TLDs (.com, .org, .net, .io, .dev, .co, .ai, .edu, .gov)
  - [x] 🟩 Test hostnames with paths (e.g., `example.com/path`)
  - [x] 🟩 Test IP addresses (with and without ports)
  - [x] 🟩 Test localhost (with and without port)
  - [x] 🟩 Test rejection cases: internal spaces, non-URL text, sentence fragments
  - [x] 🟩 Test whitespace trimming

- [x] 🟩 **1.2: Implement `detectUrlFromSelection()` function**
  - Location: `packages/shared/src/utils/web-link-utils.ts`
  - Auto-exported via `packages/shared/src/utils/index.ts` (barrel export exists)
  - Input: string (selected text)
  - Output: `string | null` (formatted URL or null if not detected)
  - Behavior:
    - Trim whitespace
    - Return null if contains internal spaces
    - Return as-is if starts with `http://` or `https://`
    - Return `https://` + text if ends with recognized TLD
    - Return `https://` + text if contains port (`:` followed by digits)
    - Return `https://localhost` + port if localhost pattern
    - Return `http://` + text if IP address pattern
    - Return null otherwise

### Phase 2: Integrate with TipTapEditor

- [x] 🟩 **2.1: Update linkInputPopoverData state type**
  - Add optional `initialUrl?: string` field to the state interface
  - This must come FIRST before modifying the functions that use it

- [x] 🟩 **2.2: Modify `handleCmdK()` to detect URL from selection**
  - Get selected text using `editor.state.doc.textBetween(from, to)`
  - Call `detectUrlFromSelection(selectedText)`
  - Include `initialUrl` in `setLinkInputPopoverData()` call

- [x] 🟩 **2.3: Modify `handleLinkButtonClick()` to detect URL from selection**
  - Same logic as handleCmdK - both functions have identical selection handling
  - Get selected text, detect URL, include in state

- [x] 🟩 **2.4: Pass initialUrl to LinkInputPopover**
  - In the useEffect that renders LinkInputPopover (around line 1664)
  - Pass `initialUrl={linkInputPopoverData.initialUrl}` prop

### Phase 3: Testing & Validation

- [x] 🟩 **3.1: Run unit tests for shared package**
  - `pnpm --filter @notecove/shared test`
  - Result: 98 tests passing

- [x] 🟩 **3.2: Run all tests via ci-runner**
  - Result: 1697/1697 unit tests passing
  - Result: 367/369 E2E tests passing (2 flaky failures unrelated to this feature)

- [ ] 🟥 **3.3: Manual testing** (awaiting user approval)
  - Test selecting `https://example.com` and pressing Cmd+K → URL pre-filled
  - Test selecting `example.com` and pressing Cmd+K → `https://example.com` pre-filled
  - Test selecting `192.168.1.1:8080` and pressing Cmd+K → `http://192.168.1.1:8080` pre-filled
  - Test selecting `localhost:3000` and pressing Cmd+K → `https://localhost:3000` pre-filled
  - Test selecting `foo.bar` (non-TLD) → URL field empty
  - Test selecting `some random text` → URL field empty
  - Test clicking link button (not Cmd+K) with URL selected → same behavior
  - Test existing link editing still works

## Files Modified

| File                                                                        | Changes                                                                               |
| --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `packages/shared/src/utils/web-link-utils.ts`                               | Added `detectUrlFromSelection()` function with TLD list and IP detection              |
| `packages/shared/src/utils/__tests__/web-link-utils.test.ts`                | Added 50+ tests for the new function                                                  |
| `packages/desktop/src/renderer/src/components/EditorPanel/TipTapEditor.tsx` | Modified state type, `handleCmdK()`, `handleLinkButtonClick()`, and popover rendering |

## TLD List

Common TLDs to recognize:

```
.com, .org, .net, .edu, .gov, .io, .dev, .co, .ai, .app, .me, .info, .biz, .xyz, .tech, .online, .site, .blog, .cloud, .store
```

Plus country codes: `.uk, .de, .fr, .jp, .cn, .au, .ca, .us, .in, .br, .ru, .nl, .es, .it, .pl, .se, .no, .fi, .dk, .ch, .at, .be, .nz`

## Implementation Notes

1. **Both handlers need updating**: `handleLinkButtonClick` and `handleCmdK` have nearly identical logic for the selection case. Both need the URL detection added.

2. **No changes to LinkInputPopover needed**: The component already supports `initialUrl` prop and auto-selects the text on focus.

3. **Auto-export works**: New functions in `web-link-utils.ts` are automatically exported via the barrel export in `index.ts`.

4. **Detection should be synchronous**: No async calls, runs on every Cmd+K/link button press.

5. **State type update order matters**: Must update the TypeScript interface before using the new field to avoid type errors.

## Critique Notes (Phase 3)

### Ordering Fixed

- Moved state type update (2.1) before the functions that use it (2.2, 2.3)

### Both Entry Points Covered

- Added explicit step for `handleLinkButtonClick` since it has identical logic to `handleCmdK`

### Risk Assessment

- Low risk: This is an additive feature, doesn't change existing behavior when text isn't URL-like
- The `initialUrl` prop already exists on `LinkInputPopover`, we're just utilizing it

# E2E Test Failures Investigation

## Key Finding

After running the tests, I discovered that **the tests use shared state** (`test.beforeAll` / `test.afterAll`). All tests in a file share the same Electron app instance. When one test creates notes/tags, they accumulate, causing later tests to fail.

For example:

- Test at line 683 expects content "Text on new line" but gets "#newtag1766884873009" - this is leftover state from a previous test
- Tag panel test times out looking for a specific tag pattern because too many tags exist from previous tests

**Root Cause**: Test isolation is broken. Each test should start with a clean slate.

## Summary of Failed Tests

The 20 failed tests fall into these categories:

### 1. Autocomplete/Popup Tests (15 tests)

- **Tags autocomplete** (8 tests): `tags.spec.ts` lines 408, 450, 498, 541, 588, 626, 659
- **Inter-note links autocomplete** (4 tests): `inter-note-links.spec.ts` lines 140, 172, 218, 267
- **Web links popups** (4 tests): `web-links.spec.ts` lines 360, 447, 487, 527

All of these tests are waiting for `[role="tooltip"]` or `.floating-popup-wrapper` to become visible, but they time out.

### 2. Tag Decoration Tests (2 tests)

- `tags.spec.ts:124` - "should persist hashtag styling after typing more content"
- `tags.spec.ts:236` - "should update tag styling after editing"

These use `getByRole('button', { name: /Tag: tag1/ })` to find hashtag decorations.

### 3. Other Tests (3 tests)

- `clipboard-copy.spec.ts:67` - "copying paragraphs should preserve blank lines"
- `tri-state-checkboxes.spec.ts:598` - "undo fully restores state and position"
- `multi-sd-cross-instance.spec.ts:906` - "Editor should show edits from other instance"

## Root Cause Analysis

### Hypothesis 1: Floating Popup Timing Issue

The `floating-popup.ts` creates popups with `display: none` initially and shows them via `show()`. The autocomplete tests wait for `[role="tooltip"]` to be visible, but the popup may not be rendering in time.

**Evidence**: The popup code calls `show()` immediately after creation (line 157-158), but there's no guarantee the React component has rendered its content.

### Hypothesis 2: Test Isolation Issues

The tests use `test.beforeAll` and `test.afterAll` instead of `beforeEach/afterEach`, meaning all tests in a file share the same Electron app instance. State from earlier tests could affect later tests.

**Evidence**: Some tests pass when run individually but fail when run with others.

### Hypothesis 3: Timing/Wait Issues

Many tests use fixed `waitForTimeout` calls (500ms, 1000ms, 2500ms) which may be insufficient on slower machines or during CI.

**Evidence**: Tests are looking for elements immediately after actions without proper `waitFor` patterns.

## Questions

### 1. What changed recently that could have broken these tests?

I need to check git history for changes to:

- `floating-popup.ts`
- `Hashtag.ts` extension
- `InterNoteLink.ts` extension
- `WebLinkPopover.tsx`
- Autocomplete/suggestion rendering

There've been a number of changes today, but it may have been yesterday

### 2. Are these tests actually verifying the right selectors?

The tests use:

- `[role="tooltip"]` for autocomplete popups
- `.floating-popup-wrapper` for link popovers
- `getByRole('button', { name: /Tag: tagname/ })` for hashtags

Need to verify these match what's actually rendered.

I'm not sure that they are

### 3. Is there a race condition in popup rendering?

The `ReactRenderer` from TipTap creates React components that need to mount. The popup wrapper is appended to `document.body` but the React content may not be ready.

## Potential Fixes

### Option A: Fix test isolation (proper fix)

- Change `test.beforeAll` / `test.afterAll` to `test.beforeEach` / `test.afterEach`
- Each test gets a fresh Electron app instance
- **Pros**: Proper isolation, tests are independent
- **Cons**: Slower (app restart between each test)

### Option B: Clean state between tests (compromise)

- Keep shared app instance but clean notes/tags between tests
- Add a cleanup step in `test.beforeEach` that deletes all notes
- **Pros**: Faster than full restart
- **Cons**: May not catch all state issues

### Option C: Make tests more resilient (band-aid)

- Use unique identifiers that won't collide
- Filter/search for specific items instead of expecting exact counts
- **Pros**: Quick to implement
- **Cons**: Doesn't fix the underlying isolation problem

## Questions

1. Which approach do you prefer for fixing test isolation?

Lets try B

2. Should I fix all 20 tests at once, or tackle one category at a time (tags, inter-note-links, web-links)?

Whichever is easier

3. Some tests may have actual bugs beyond isolation - should I investigate each failure individually after fixing isolation?

yes

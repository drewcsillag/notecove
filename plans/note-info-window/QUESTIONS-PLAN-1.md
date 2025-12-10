# Plan Review Questions

## Q1: Window Title

Should the Note Info window title be:

- (a) "Note Info" (static)
- (b) "Note Info - {note title}" (dynamic)
- (c) Something else?

b

## Q2: E2E Tests

Should I add an automated E2E test for the Note Info window, or are manual tests sufficient for this feature?

yes

## Q3: Error Handling

If someone triggers Note Info when no note is selected (or note is deleted), should we:

- (a) Show an error message in the window
- (b) Not open the window at all (silently fail)
- (c) Show a toast/notification error

c

## Q4: Parent Window Fallback

If Note Info is triggered when no window has focus (edge case), should we:

- (a) Use the first/main window as parent
- (b) Create the Note Info window without a parent (independent)
- (c) Don't open (require a focused window)

c

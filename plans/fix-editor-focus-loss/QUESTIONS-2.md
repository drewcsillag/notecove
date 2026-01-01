# Follow-up Questions

## Issue 1: Non-editable note after duplicate + cross-SD move

Thank you for the clarification! This helps narrow things down. Since:

- Content loads fine (no loading spinner, content is visible)
- Other instances can edit the note
- Local instance cannot edit

This strongly suggests the local instance has a stale or incorrect state. The `editable` state is controlled by:

1. `readOnly` prop (true if note is deleted)
2. `isLoading` state (true while loading)

**Diagnostic Questions:**

1. If you close and reopen the app, does the note become editable?
   no

2. If you click on a different note and then back to this note, does it become editable?
   I can now, but there's another note that I stil cannot edit. Oh, and now I can't edit the original one either anymore.. wut?

3. Can you check the browser DevTools console (Cmd+Option+I or View > Toggle Developer Tools) for any error messages when you click on this note?

This is what I see in the console for the non-editable one
index-BJLUH-1s.js:41859 [FolderTree] Tree initialOpen: {isCollapsedAll: false, expandedFolderIds: 11, allFolderIds: 14, result: 11}
index-BJLUH-1s.js:58049 [useWindowState] Reporting final state: scroll=0, cursor=12
index-BJLUH-1s.js:155822 [TipTapEditor] Unmount: Saving note 5TJ83vPDQWiUiILGRnIfbg with title: "Copy of Get shit done affirmations"
index-BJLUH-1s.js:153190 [useNoteSync] Loading note atte2O8CRCOXndc_cJNDSQ
index-BJLUH-1s.js:57950 [useWindowState] Window ID from URL: b1848d5b-b97b-463a-8ce6-0db41f8bff21
index-BJLUH-1s.js:57968 [useWindowState] Reporting current note: atte2O8CRCOXndc_cJNDSQ (sd: none)
index-BJLUH-1s.js:41859 [FolderTree] Tree initialOpen: {isCollapsedAll: false, expandedFolderIds: 11, allFolderIds: 14, result: 11}
index-BJLUH-1s.js:153196 [useNoteSync] Got state from main process, size: 750 bytes
index-BJLUH-1s.js:155591 [TipTapEditor] onUpdate fired but loading flag is set, skipping
index-BJLUH-1s.js:153201 [useNoteSync] Applied state to yDoc
index-BJLUH-1s.js:155604 [TipTapEditor] onUpdate extracting title for note atte2O8CRCOXndc_cJNDSQ: "Copy of Claude Usage EOD Targets"
index-BJLUH-1s.js:155822 [TipTapEditor] Unmount: Saving note atte2O8CRCOXndc_cJNDSQ with title: "Copy of Claude Usage EOD Targets"
index-BJLUH-1s.js:155604 [TipTapEditor] onUpdate extracting title for note atte2O8CRCOXndc_cJNDSQ: "Copy of Claude Usage EOD Targets"
index-BJLUH-1s.js:58049 [useWindowState] Reporting final state: scroll=0, cursor=1
index-BJLUH-1s.js:155822 [TipTapEditor] Unmount: Saving note atte2O8CRCOXndc_cJNDSQ with title: "Copy of Claude Usage EOD Targets"
index-BJLUH-1s.js:88173 linkifyjs: already initialized - will not register custom scheme "http" until manual call of linkify.init(). Register all schemes and plugins before invoking linkify the first time.
registerCustomProtocol @ index-BJLUH-1s.js:88173
(anonymous) @ index-BJLUH-1s.js:88420
onCreate @ index-BJLUH-1s.js:88418
(anonymous) @ index-BJLUH-1s.js:73838
emit @ index-BJLUH-1s.js:73838
(anonymous) @ index-BJLUH-1s.js:75409
setTimeout
mount @ index-BJLUH-1s.js:75402
Editor @ index-BJLUH-1s.js:75385
createEditor @ index-BJLUH-1s.js:77611
refreshEditorInstance @ index-BJLUH-1s.js:77712
(anonymous) @ index-BJLUH-1s.js:77687
Qj @ client-CKFsqpXn.js:5001
Hk @ client-CKFsqpXn.js:6236
Ek @ client-CKFsqpXn.js:5800
jg @ client-CKFsqpXn.js:2714
(anonymous) @ client-CKFsqpXn.js:5634
index-BJLUH-1s.js:88173 linkifyjs: already initialized - will not register custom scheme "https" until manual call of linkify.init(). Register all schemes and plugins before invoking linkify the first time.
registerCustomProtocol @ index-BJLUH-1s.js:88173
(anonymous) @ index-BJLUH-1s.js:88420
onCreate @ index-BJLUH-1s.js:88418
(anonymous) @ index-BJLUH-1s.js:73838
emit @ index-BJLUH-1s.js:73838
(anonymous) @ index-BJLUH-1s.js:75409
setTimeout
mount @ index-BJLUH-1s.js:75402
Editor @ index-BJLUH-1s.js:75385
createEditor @ index-BJLUH-1s.js:77611
refreshEditorInstance @ index-BJLUH-1s.js:77712
(anonymous) @ index-BJLUH-1s.js:77687
Qj @ client-CKFsqpXn.js:5001
Hk @ client-CKFsqpXn.js:6236
Ek @ client-CKFsqpXn.js:5800
jg @ client-CKFsqpXn.js:2714
(anonymous) @ client-CKFsqpXn.js:5634
index-BJLUH-1s.js:58029 [useWindowState] Saved state is for different note (saved: a1026510-cb9b-41a5-aa62-35ae018eb829, requested: atte2O8CRCOXndc_cJNDSQ)
index-BJLUH-1s.js:153480 [useEditorStateRestoration] Loaded per-note editor state: {scrollTop: 0, cursorPosition: 35}
index-BJLUH-1s.js:153518 [useEditorStateRestoration] Restoring cursor position: 35
index-BJLUH-1s.js:58004 [useWindowState] Reporting editor state: scroll=0, cursor=35

**One more detail:**
When you moved the note across SDs - was the note already open in the editor when you moved it? (Context: The editor uses the note's sdId for various operations, and if it gets stale after a cross-SD move, that could cause issues)

Probably.

## Issue 2: Focus loss / flicker during title updates

The flicker you're seeing is a significant clue. "Like a bunch of the screen reloads" suggests React is remounting components or doing a major re-render cascade.

**Diagnostic Questions:**

1. Did this start happening after a specific change or update, or has it always been this way?

I think it's been within the last day, but I suppose it could have been around for a good while. I just happened to notice it today

2. If you open the DevTools and go to the Console tab, do you see any messages being logged when the flicker happens? Particularly look for:
   - Any error messages
   - Any `[TipTapEditor]` or `[useNoteSync]` log messages during the flicker
   - Any "onUpdate" related messages

There's a bunch of stuff here so I'll just paste it
index-BJLUH-1s.js:58004 [useWindowState] Reporting editor state: scroll=0, cursor=10
index-BJLUH-1s.js:153161 [useNoteSync] Sending update to main process for note a1026510-cb9b-41a5-aa62-35ae018eb829, size: 24 bytes, hash: 0101f7c99dee0600...
index-BJLUH-1s.js:155604 [TipTapEditor] onUpdate extracting title for note a1026510-cb9b-41a5-aa62-35ae018eb829: "Notecove Sorated TODOs"
index-BJLUH-1s.js:153226 [useNoteSync] Skipping own update bounce-back, hash: 0101f7c99dee0600...
index-BJLUH-1s.js:153232 [useNoteSync] Applying remote update with 24 bytes, hash: 0101f7c99dee0600...
index-BJLUH-1s.js:153161 [useNoteSync] Sending update to main process for note a1026510-cb9b-41a5-aa62-35ae018eb829, size: 24 bytes, hash: 0101f7c99dee0601...
index-BJLUH-1s.js:155604 [TipTapEditor] onUpdate extracting title for note a1026510-cb9b-41a5-aa62-35ae018eb829: "Notecove Sorasted TODOs"
index-BJLUH-1s.js:153232 [useNoteSync] Applying remote update with 34 bytes, hash: 0101ebc9a4dd0f00...
index-BJLUH-1s.js:153226 [useNoteSync] Skipping own update bounce-back, hash: 0101f7c99dee0601...
index-BJLUH-1s.js:153232 [useNoteSync] Applying remote update with 24 bytes, hash: 0101f7c99dee0601...
index-BJLUH-1s.js:153232 [useNoteSync] Applying remote update with 34 bytes, hash: 0101ebc9a4dd0f01...
index-BJLUH-1s.js:153161 [useNoteSync] Sending update to main process for note a1026510-cb9b-41a5-aa62-35ae018eb829, size: 24 bytes, hash: 0101f7c99dee0602...
index-BJLUH-1s.js:155604 [TipTapEditor] onUpdate extracting title for note a1026510-cb9b-41a5-aa62-35ae018eb829: "Notecove Sorasdted TODOs"
index-BJLUH-1s.js:153226 [useNoteSync] Skipping own update bounce-back, hash: 0101f7c99dee0602...
index-BJLUH-1s.js:153232 [useNoteSync] Applying remote update with 24 bytes, hash: 0101f7c99dee0602...
index-BJLUH-1s.js:153232 [useNoteSync] Applying remote update with 34 bytes, hash: 0101ebc9a4dd0f02...
index-BJLUH-1s.js:153161 [useNoteSync] Sending update to main process for note a1026510-cb9b-41a5-aa62-35ae018eb829, size: 24 bytes, hash: 0101f7c99dee0603...
index-BJLUH-1s.js:155604 [TipTapEditor] onUpdate extracting title for note a1026510-cb9b-41a5-aa62-35ae018eb829: "Notecove Sorasdfted TODOs"
index-BJLUH-1s.js:153226 [useNoteSync] Skipping own update bounce-back, hash: 0101f7c99dee0603...
index-BJLUH-1s.js:153232 [useNoteSync] Applying remote update with 24 bytes, hash: 0101f7c99dee0603...
index-BJLUH-1s.js:153232 [useNoteSync] Applying remote update with 34 bytes, hash: 0101ebc9a4dd0f03...
index-BJLUH-1s.js:155621 [TipTapEditor] Sending title update for note a1026510-cb9b-41a5-aa62-35ae018eb829: "Notecove Sorasdfted TODOs"
index-BJLUH-1s.js:41859 [FolderTree] Tree initialOpen: {isCollapsedAll: false, expandedFolderIds: 11, allFolderIds: 14, result: 11}
index-BJLUH-1s.js:155822 [TipTapEditor] Unmount: Saving note a1026510-cb9b-41a5-aa62-35ae018eb829 with title: "Notecove Sorasdfted TODOs"
index-BJLUH-1s.js:155604 [TipTapEditor] onUpdate extracting title for note a1026510-cb9b-41a5-aa62-35ae018eb829: "Notecove Sorasdfted TODOs"
index-BJLUH-1s.js:58049 [useWindowState] Reporting final state: scroll=0, cursor=17
index-BJLUH-1s.js:155822 [TipTapEditor] Unmount: Saving note a1026510-cb9b-41a5-aa62-35ae018eb829 with title: "Notecove Sorasdfted TODOs"
index-BJLUH-1s.js:88173 linkifyjs: already initialized - will not register custom scheme "http" until manual call of linkify.init(). Register all schemes and plugins before invoking linkify the first time.
registerCustomProtocol @ index-BJLUH-1s.js:88173
(anonymous) @ index-BJLUH-1s.js:88420
onCreate @ index-BJLUH-1s.js:88418
(anonymous) @ index-BJLUH-1s.js:73838
emit @ index-BJLUH-1s.js:73838
(anonymous) @ index-BJLUH-1s.js:75409
setTimeout
mount @ index-BJLUH-1s.js:75402
Editor @ index-BJLUH-1s.js:75385
createEditor @ index-BJLUH-1s.js:77611
refreshEditorInstance @ index-BJLUH-1s.js:77712
(anonymous) @ index-BJLUH-1s.js:77687
Qj @ client-CKFsqpXn.js:5001
Hk @ client-CKFsqpXn.js:6236
Ek @ client-CKFsqpXn.js:5800
jg @ client-CKFsqpXn.js:2714
Wk @ client-CKFsqpXn.js:6140
Pk @ client-CKFsqpXn.js:6083
Gk @ client-CKFsqpXn.js:5739
J2 @ client-CKFsqpXn.js:431
R2 @ client-CKFsqpXn.js:459
index-BJLUH-1s.js:88173 linkifyjs: already initialized - will not register custom scheme "https" until manual call of linkify.init(). Register all schemes and plugins before invoking linkify the first time.
registerCustomProtocol @ index-BJLUH-1s.js:88173
(anonymous) @ index-BJLUH-1s.js:88420
onCreate @ index-BJLUH-1s.js:88418
(anonymous) @ index-BJLUH-1s.js:73838
emit @ index-BJLUH-1s.js:73838
(anonymous) @ index-BJLUH-1s.js:75409
setTimeout
mount @ index-BJLUH-1s.js:75402
Editor @ index-BJLUH-1s.js:75385
createEditor @ index-BJLUH-1s.js:77611
refreshEditorInstance @ index-BJLUH-1s.js:77712
(anonymous) @ index-BJLUH-1s.js:77687
Qj @ client-CKFsqpXn.js:5001
Hk @ client-CKFsqpXn.js:6236
Ek @ client-CKFsqpXn.js:5800
jg @ client-CKFsqpXn.js:2714
Wk @ client-CKFsqpXn.js:6140
Pk @ client-CKFsqpXn.js:6083
Gk @ client-CKFsqpXn.js:5739
J2 @ client-CKFsqpXn.js:431
R2 @ client-CKFsqpXn.js:459

3. Does the flicker happen if you just select text (not editing), wait, and then type? (This would help isolate whether it's tied to title changes specifically)

Only if I edit. It also makes undo not work. I'd assume it has something to do with the note list update debounce timer.

## For Both Issues

If you can provide console logs from DevTools during these scenarios, it would help tremendously in pinpointing the exact cause.

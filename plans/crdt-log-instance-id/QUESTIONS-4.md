# Questions - Part 4: Codebase-Wide UUID Migration

You want to change ALL UUIDs from 36-char format to 22-char base64url format. This is a much larger scope. Let me clarify:

---

## Q13: Scope Confirmation

**All of these would change from `8f5c0e1a-4b2e-4d7f-8c3b-9a1d2e3f4a5b` to `j1wOGksuTX-MOzqR0uPzSg`:**

- [ ] Note IDs (in filenames, database, IPC, UI)
- [ ] Folder IDs (in database, folder tree CRDT)
- [ ] Profile IDs (in config, database, presence files)
- [ ] Instance IDs (in database, logs)
- [ ] Storage Directory IDs (in database, paths)
- [ ] CRDT log filenames
- [ ] Activity log filenames and content
- [ ] Deletion log filenames and content

Is this the complete list? Anything else?

## Can you find any other places we use them?

## Q14: Storage Directory Structure Change

You mentioned "kill the meta and update subfolders of the folders path in storage directories."

Current structure:

```
{sd}/
  folders/
    meta/
    updates/
  notes/
    {noteId}/
      logs/
      snapshots/
```

What should the new structure look like? Should folders work like notes (with logs/snapshots subdirs)?

## I don't think snapshots is necessary, but the logs folder already exists

## Q15: Database Storage Format

Should the database store:

**Option A**: Compact IDs (22-char) everywhere

- Smaller DB size
- Need migration for existing DBs

**Option B**: Full UUIDs internally, compact only in filenames/display

- No DB migration needed
- Conversion at boundaries only

**Option C**: Store both (full UUID primary, compact as indexed column)

- Lookup flexibility
- More storage

My recommendation: **Option A** - go all-in on compact format. Cleaner long-term.

## A

## Q16: UI Display

For user-visible places (About window, note URLs, etc.):

**Option A**: Show only compact IDs
**Option B**: Show both formats (compact primary, full in tooltip/expandable)
**Option C**: Show full UUID with copy-compact button

Earlier you said you wanted both in About window. Should this apply everywhere UUIDs are shown?

## Yes, A

## Q17: Backward Compatibility / Migration

For existing storage directories with old-format UUIDs:

**Option A**: Auto-migrate on startup (rename folders, update DB)

- Clean transition
- Risk if migration fails mid-way

**Option B**: Support both formats, migrate lazily

- Safer but messier codebase

**Option C**: Require manual migration or fresh start

- Simplest code
- Disruptive for users

My recommendation: **Option A** with careful rollback support.

Tolerate old, but only create using new. But profile and instance ids should change immediately. I expect you'll have questions about what I meant here.

---

## Q18: Generation of New IDs

When generating new UUIDs, should we:

**Option A**: Generate standard UUID, then encode to compact

- Uses `crypto.randomUUID()` → encode
- Full UUID available if needed

**Option B**: Generate random bytes directly, encode to base64url

- Skip UUID intermediate step
- Slightly more efficient

My recommendation: **Option A** - standard UUID generation is well-tested, encoding is cheap.

## A

## Q19: URL/Deep Link Considerations

If note IDs become compact, URLs would change:

- Before: `notecove://note/8f5c0e1a-4b2e-4d7f-8c3b-9a1d2e3f4a5b`
- After: `notecove://note/j1wOGksuTX-MOzqR0uPzSg`

The base64url format uses `-` and `_` which are URL-safe. Any concerns here?

## no concerns, the compaction scheme should only produce url safe things.

## Q20: Timeline / Phasing

This is a big change. Should we:

**Option A**: Do it all at once (big bang)

- Consistent codebase
- Higher risk

**Option B**: Phase it (logs first, then notes, then folders, etc.)

- Lower risk per phase
- Temporary inconsistency

Given the scope, what's your preference?

B

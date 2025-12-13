# Plan Critique Questions

Questions arising from the plan critique that need answers before finalizing.

---

## 1. Table Nesting Rules

Can tables be placed:

- Inside blockquotes? (e.g., `> | cell |`)
- Inside list items?
- Nested inside other tables?

**My recommendation:** Allow tables inside blockquotes. Disallow tables inside list items and nested tables (too complex, edge-case heavy).
No nesting of tables at all

---

## 2. Header Toggle Behavior

When user clicks "Toggle header row", what happens?

**Option A:** Convert first row cells between `<th>` and `<td>` (TipTap default)
**Option B:** Add/remove a dedicated header row

**My recommendation:** Option A (TipTap default). Simpler and more intuitive.

## A

## 3. Size Limit Enforcement

How strictly should we enforce the 20 col / 1000 row limits?

**Option A:** Hard enforce everywhere (UI, commands, schema)
**Option B:** Enforce in UI/commands, but allow larger tables from paste (with warning)
**Option C:** Soft limit - just warn, don't prevent

**My recommendation:** Option B. Prevents users from creating massive tables, but doesn't break paste from external sources.

## B

## 4. Phase Consolidation

The plan has 11 phases. I suggest consolidating to 9:

- Merge Phase 5 (Resize/Alignment) + Phase 8 (Selection Styling) → "Interactions & Visual Polish"
- Merge Phase 9 (Accessibility) + Phase 10 (Export) → "Export & Accessibility"

**Question:** Are you okay with this consolidation, or prefer keeping them separate for smaller commits?
I'm ok with consolidation

---

## 5. Yjs Testing Priority

The highest risk is Yjs incompatibility. Should we:

**Option A:** Test Yjs compatibility in Phase 1 (fail fast)
**Option B:** Test in Phase 11 as originally planned

**My strong recommendation:** Option A. If tables don't work with Yjs, we need to know immediately, not after building 10 phases of features.

## A

## Summary of Answers

| Question            | Answer                                                      |
| ------------------- | ----------------------------------------------------------- |
| Table nesting       | **None** - no tables in blockquotes, lists, or other tables |
| Header toggle       | Option A (TipTap default - convert first row)               |
| Size enforcement    | Option B (enforce in UI/commands, warn on large paste)      |
| Phase consolidation | Yes - consolidated to 9 phases                              |
| Yjs testing         | Option A - moved to Phase 1 (fail fast)                     |

## Changes Applied to PLAN.md

1. Added Phase 1.4: Yjs compatibility testing (CRITICAL)
2. Added Phase 1.5: Basic CSS styling (includes selection highlighting)
3. Added Phase 1.6: Debug tooling
4. Documented nesting rules in Summary of Decisions
5. Consolidated phases: 11 → 9 phases
   - Merged Resize/Alignment + Selection Styling → Phase 5 "Interactions & Visual Polish"
   - Merged Accessibility + Export → Phase 8 "Export & Accessibility"
6. Updated risk assessment with additional risks

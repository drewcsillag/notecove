# Feature Implementation Workflow

**Task:** $ARGUMENTS

---

## Setup

1. Derive a kebab-case slug from the task description (e.g., "rename an SD" → `rename-sd`)
2. Create and checkout git branch: `{slug}`
3. Create directory: `plans/{slug}/`

---

## Phase 1: Analysis & Questions

Your task is NOT to implement yet, but to fully understand and prepare.

**Responsibilities:**

- Analyze and understand the existing codebase thoroughly
- Determine exactly how this feature integrates, including dependencies, structure, edge cases (within reason), and constraints
- Clearly identify anything unclear or ambiguous in the description or current implementation
- Write all questions or ambiguities to `plans/{slug}/QUESTIONS-1.md`

**Important:**

- Do NOT assume any requirements or scope beyond explicitly described details
- Do NOT implement anything yet - just explore, plan, and ask questions
- This phase is iterative: after user answers QUESTIONS-1.md, you may write QUESTIONS-2.md, etc.
- Continue until all ambiguities are resolved

**⏸ CHECKPOINT**: When you have no more questions, say "No more questions. Say 'continue' for Phase 2"

---

## Phase 2: Plan Creation

Based on the full exchange, produce a markdown plan document (`plans/{slug}/PLAN.md`).

**Requirements for the plan:**

- Include clear, minimal, concise steps
- Track the status of each step using these emojis:
  - 🟩 Done
  - 🟨 In Progress
  - 🟥 To Do
- Include dynamic tracking of overall progress percentage (at top)
- Do NOT add extra scope or unnecessary complexity beyond explicitly clarified details
- Steps should be modular, elegant, minimal, and integrate seamlessly within the existing codebase
- Use TDD: tests are part of the plan and written before the thing they test
- If you make subsidiary plan files, todos files, memory files, etc., link them from PLAN.md
- As subsidiary plans change through implementation, update the top level plan as well

**Template Example:**

```markdown
# Feature Implementation Plan

**Overall Progress:** `0%`

## Tasks:

- [ ] 🟥 **Step 1: Setup authentication module**
  - [ ] 🟥 Create authentication service class
  - [ ] 🟥 Implement JWT token handling

- [ ] 🟥 **Step 2: Develop frontend login UI**
  - [ ] 🟥 Design login page component
  - [ ] 🟥 Integrate component with endpoints
```

**⏸ CHECKPOINT**: When PLAN.md is ready, say "Plan created. Say 'continue' for Phase 3"

---

## Phase 3: Plan Critique

Review the plan in PLAN.md as a staff engineer. Evaluate:

- **Ordering**: Do earlier steps inadvertently rely on later things?
- **Feedback loop**: Which ordering gets us to something we can interactively test sooner?
- **Debug tools**: Do we have debug tools ready when we'll want them if something's not working?
- **Missing items**: Is there something missing that should be asked about?
- **Risk assessment**: Have risks been properly assessed? Should we consider additional tests?

**Additional requirements:**

- PLAN sections should link to QUESTIONS or other .md files where relevant
- This phase may generate questions - write them to `plans/{slug}/QUESTIONS-PLAN-1.md` (and iterate as needed)

**⏸ CHECKPOINT**: When plan is finalized, say "Plan finalized. Say 'continue' for Phase 4"

---

## Phase 4: Implementation

Now implement precisely as planned, in full.

**Implementation Requirements:**

- Write elegant, minimal, modular code
- Adhere strictly to existing code patterns, conventions, and best practices
- Include clear comments/documentation within the code where needed
- As you implement each step:
  - Update PLAN.md with emoji status and overall progress percentage
- Follow TDD: write failing tests first, then implement to make them pass
- Run ci-runner before any commits
- Update PLAN.md if implementation reality differs from the original plan

**⏸ CHECKPOINT**: Pause before commits for user approval

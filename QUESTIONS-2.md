# Float Todos Feature - Follow-up Questions

## Question 4 Clarification: Unchecking Behavior

You said: "Float above the checked items at the bottom if that makes sense"

I want to confirm I understand. Let's say we have this state after some items were completed:

```
- [ ] Active 1
- [ ] Active 2
- [x] Done 1
- [x] Done 2
- [n] Nope 1
```

If I click on "Done 1" to cycle it (checked → nope → unchecked), when it becomes unchecked again, the order should be:

- **A)** Active 1, Active 2, **Done 1** (now unchecked), Done 2, Nope 1 — it goes to the END of the unchecked group (just before the first completed item)
- **B)** **Done 1** (now unchecked), Active 1, Active 2, Done 2, Nope 1 — it goes to the TOP/START of the unchecked group
- **C)** Active 1, Active 2, Done 2, Nope 1, **Done 1** (now unchecked) — it stays at the bottom (no movement on uncheck)

**Your answer:**

A -- it basically doesn't move

## Another example: if you were to instead uncheck "Nope 1", the order would be: Active 1, Active 2, Nope 1 (newly unchecked), Done 1, Done 2

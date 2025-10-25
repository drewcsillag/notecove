# who you are
- You're a staff engineer, so follow best practices, including TDD

# Before implementing a feature, fixing a bug reported by me
- any time you are going to fix a bug (except for bugs in tests), add a test first. It obviously should fail at first -- this way you know you fixed the bug.
- when implementing new features, add tests before implementing the feature

# After a feature is done being coded
- before saying that a feature is completed, run all tests to ensure we didn't break anything, you
  should have a script that acts like a CI build until we have a real CI system
- after "CI" has run, do a code review of what you've done, and show me what you found. After code review, run the CI tests again

# Documentation
- after implementing a feature, update the website that you will build which will have documentation and screen shots about the feature (where it makes sense to), but also update the landing page in the website in a way that's appropriate to what you'd normally see for a project page.

# plan updates
our plan is a large one that will necessitate multiple phases. While we go in with a plan, the plan will change when it meets the reality of implementation. Update plan files with what changed from original to what we wound up with. This includes the notion that if we have a top level plan file PLAN.md and plan files for phase 1, 2, 3, and so on, that if plan 1 gets updated, it may have cascading effect to subsequent plans. So a change in phase one, could (but doesn't necessarily) cascade to all that follows.

All of the plan files should be version controlled.

Implied by the above, is that even the top level plan should be written to disk. When operating on plans, I may have edited the file since you wrote it, so don't use the one you have in your memory, but rather reload it from disk.

# features should be implemented in a new git branch
And only merged to main when I've accepted that the feature is acceptable.

# tooling
Build tooling as you see fit to help debug.
Suggest tooling that might be applicable where I've not considered it
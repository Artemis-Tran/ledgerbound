# A story change starts from the user, and a chapter after it is checked or discarded

ADR 0004 gave a deep revision one start: a review finding with `record: change`, in a complete book. That is too narrow. An author also wants big changes that no review asked for (a character who dies earlier, an arc that ends in a different place, a new series ending), and wants them in the middle of a book too. A big change also often starts above the chapter level, at an arc, an act, a book plan or the series, and `replan` could change only the chapter plans, threads and targets of chapters that are not written.

So a **story change** is a change to what happens that the user asks for, at any level and at any time. The `change-story` skill owns every story change and every deep revision: `revise-book` gives each `record: change` finding to it. Its steps are the same at each level: find the highest level that the change touches, change the plan top down from there, find the first approved chapter that the change touches, and choose a strategy.

- **Forward**: the approved chapters stay, and the change starts at the next chapter that is not approved. Only `replan` runs.
- **Reopen**: `lb reopen` at the first chapter that the change touches (ADR 0004), a replan, then for each reopened chapter one of two choices:
  - **check**: the chapter keeps its prose, and gets the continuity check against the new record (as after a reopen now), with span revisions where it does not agree.
  - **discard**: `lb discard <point>` deletes its prose, staged delta, memory, brief and verify record, and keeps its plan. The chapter-writer writes it again from the new plan.

A rewrite of a whole chapter is a discard. A rewrite of one scene is a check with one review finding for the reviser, as `revise-book` does now.

`replan` gets one rule in place of its list: **a replan can change each part of the plan that no approved chapter shows**. After a reopen, the reopened chapters are drafts, so their arc beats, stages, acts, the climax, the later book plans and the series ending can change. A `locked` decision or a draw changes only when the user says so, as before.

## Considered options

- **Keep `revise-book` as the only start, and let the user write findings into `review.md`.** No new skill, but a story change would need a complete book and a review, and a finding names chapters, not an arc or a book plan.
- **A third strategy, "regenerate", next to check.** It is the same as a discard of each chapter from a point on, so one choice for each chapter covers it, and a run can check some chapters and discard others.
- **Discard in the skill with `rm`, as `revise-book` step 4 does now.** It works, but the files of one chapter are in five places, and a step that misses one leaves a stale brief or verify record that `lb run` trusts. A command makes the delete the same each time, and the tests cover it.

## Consequences

- The ledger rules of ADR 0004 stay: only `lb reopen` takes entries out of the ledger, and the skill commits before each reopen. `lb discard` works only on a chapter that is not approved, so it never touches the ledger.
- `change-story` gives the cost before the user decides: the chapters from `lb reopen --dry-run`, and their words. It recommends forward when forward is sufficient, and a discard only for a chapter whose events the change replaces.
- The details that a discarded chapter added to lore entries and character files stay in those files. The skill keeps them from the old memory files before the discard, and shows the user each one that no approved chapter states again, as `revise-book` step 5 does now for one chapter.
- `revise-book` keeps the choice of findings and the prose revisions. A `change` finding with `apply` becomes a story change, with the finding as its cause.
- An imported book cannot change (ADR 0003): a story change starts in the first planned book or later.
- A story change cannot yet add, remove or move a chapter or a book. Those need commands that renumber points, and they come in later versions.

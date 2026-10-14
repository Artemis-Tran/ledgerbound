---
name: replan
description: Change the part of a Ledgerbound plan that no approved chapter shows - from the series ending and book plans down to arcs, chapter plans, threads and targets - and get the user's approval. Use when `lb commit` reports REPLAN NEEDED, when verify-chapter returns replan or blocked on a plan error, or when change-story starts it for a story change.
---

# replan

The written chapters are the story now. A replan moves the plan to meet them, and the user approves it: the `replan` checkpoint is on in every mode except `autopilot`. In autopilot you make the user's choices, within the limits in step 3. File formats: `${CLAUDE_PLUGIN_ROOT}/reference/formats.md`.

## What a replan can change

**A replan can change each part of the plan that no approved chapter shows.** After `lb reopen`, the reopened chapters are drafts, so the plan of each one can change too. That covers:

- The series ending and the later book plans in `series.md` and `books/NN/plan.md`: the acts, the custom anchors, the `climax` and the `tension` range. The climax stays in a chapter that is not approved.
- The arcs, wounds and appearances in the character files, and the `characters` of the chapter plans: an arc beat or a character change at a point after the last approved chapter.
- The relationship files: a stage that no approved chapter places, and the `stages` and `bonding` of the chapter plans.
- The chapter plans of chapters that are not approved, with their `tension`, `stakes` and scene `result`s.
- `threads.yaml`: the beats and payoffs in chapters that are not approved. A plant in an approved chapter stays.
- `targets.yaml`: a target moves, changes, or gets `reset: true`.
- The lore entries: a new entry, a fact that no approved chapter contradicts, or a change in `changes` from a chapter that is not approved.
- The `open` decisions of the bible. A `locked` decision or a draw changes only when the user says so.

The approved chapters and `ledger.jsonl` stay as they are. When the committed record is wrong about an approved chapter, the correction goes first in the next chapter's staged delta, with a `cause` that starts with `Correction:` (see formats.md, "Delta entries").

## Steps

1. **Cause.** Write down in one or two sentences why the plan must change: the `REPLAN NEEDED` lines of `lb commit`, the open errors in `runs/verify/NN-MM.json`, or the story change from `change-story` with its level.
   When `lb validate` gives `tension-missing` or `climax-missing` (a plan from an earlier version), the replan adds them: the `climax` and `tension` range of the book plan by step 4 of `${CLAUDE_PLUGIN_ROOT}/skills/plan-series/SKILL.md`, then the `tension`, `stakes` and scene `result`s of each chapter that is not written by steps 3 and 5 of `${CLAUDE_PLUGIN_ROOT}/skills/plan-book/SKILL.md`. Read the memory files of the written chapters first: the curve starts from where the story is. Give the written chapters no new fields.

2. Read `bible.md`, the book plan, `targets.yaml`, `threads.yaml`, the plans of the chapters that are not written, the memory files of the written chapters, and `lb fold` (the state now).

3. **Options.** When there is a real choice (for example: move the target, or add a chapter that earns it), give the user two options with their trade-offs, and recommend one. Wait for their choice.
   In autopilot, choose the option that keeps the most of the approved plan, and continue. When every option needs a change to a `locked` decision or a draw, stop and ask the user: that is theirs.

4. **Change** the files, top down from the highest level that changes: the series and the book plans by `${CLAUDE_PLUGIN_ROOT}/skills/plan-series/SKILL.md`, the arcs and relationships by `${CLAUDE_PLUGIN_ROOT}/skills/plan-arcs/SKILL.md`, then the chapter plans and threads by `${CLAUDE_PLUGIN_ROOT}/skills/plan-book/SKILL.md`. Each level hands its new ending states to the level below. Set `status: draft` in each plan file that you changed. Delete `runs/briefs/NN-MM.md` and `books/NN/deltas/MM.jsonl` of every chapter whose plan changed and that has no prose yet: they were made from the old plan.
   Run `lb validate`, and fix each error.
   Done when `lb validate` reports no error.

5. Run **the checkpoint loop** in `${CLAUDE_PLUGIN_ROOT}/reference/checkpoint-loop.md` for `replan`. In the summary, give a before → after line for each changed plan, target and thread.
   In autopilot the gate is cleared: run `lb approve replan`, and write the cause, the choice and the before → after lines to `runs/autopilot.md` (format: "Autopilot log" in `${CLAUDE_PLUGIN_ROOT}/reference/chapter-steps.md`).

6. After `lb approve replan`: when `change-story` started this replan, return to it. Else run `lb run`, and continue with the step it names (or `generate-book`).

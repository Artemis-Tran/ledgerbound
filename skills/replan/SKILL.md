---
name: replan
description: Change the rest of a Ledgerbound plan when the draft moves away from it - the unwritten chapter plans, threads, targets, anchors and open decisions - and get the user's approval. Use when `lb commit` reports REPLAN NEEDED, when verify-chapter returns replan or blocked on a plan error, or when the user wants to change the direction of the story.
---

# replan

The written chapters are the story now. A replan moves the plan to meet them, and the user approves it: the `replan` checkpoint is on in every mode except `autopilot`. In autopilot you make the user's choices, within the limits in step 3. File formats: `${CLAUDE_PLUGIN_ROOT}/reference/formats.md`.

## What a replan can change

- The chapter plans of chapters that are not approved, and the custom anchors in the book plan.
- `threads.yaml`: the beats and payoffs in chapters that are not written. A plant in a written chapter stays.
- `targets.yaml`: a target moves, changes, or gets `reset: true`.
- The lore entries: a new entry, or a change that no approved chapter contradicts.
- The `open` decisions of the bible. A `locked` decision changes only when the user says so.

The approved chapters and `ledger.jsonl` stay as they are. When the committed record is wrong about an approved chapter, the correction goes first in the next chapter's staged delta, with a `cause` that starts with `Correction:` (see formats.md, "Delta entries").

## Steps

1. **Cause.** Write down in one or two sentences why the plan must change: the `REPLAN NEEDED` lines of `lb commit`, the open errors in `runs/verify/NN-MM.json`, or the user's request.

2. Read `bible.md`, the book plan, `targets.yaml`, `threads.yaml`, the plans of the chapters that are not written, the memory files of the written chapters, and `lb fold` (the state now).

3. **Options.** When there is a real choice (for example: move the target, or add a chapter that earns it), give the user two options with their trade-offs, and recommend one. Wait for their choice.
   In autopilot, choose the option that keeps the most of the approved plan, and continue. When every option needs a change to a `locked` decision or a draw, stop and ask the user: that is theirs.

4. **Change** the files. Set `status: draft` in each plan file that you changed. Delete `runs/briefs/NN-MM.md` and `books/NN/deltas/MM.jsonl` of every chapter whose plan changed and that has no prose yet: they were made from the old plan.
   Run `lb validate`, and fix each error.
   Done when `lb validate` reports no error.

5. Run **the checkpoint loop** in `${CLAUDE_PLUGIN_ROOT}/reference/checkpoint-loop.md` for `replan`. In the summary, give a before → after line for each changed plan, target and thread.
   In autopilot the gate is cleared: run `lb approve replan`, and write the cause, the choice and the before → after lines to `runs/autopilot.md` (format: "Autopilot log" in `${CLAUDE_PLUGIN_ROOT}/reference/chapter-steps.md`).

6. After `lb approve replan`, run `lb run`, and continue with the step it names (or `generate-book`).

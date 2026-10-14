---
name: change-story
description: Make a story change in a Ledgerbound novel - a change to what happens that the user asks for, at any level from a scene to the series ending, at any time - with a replan top down, then forward or a reopen that checks or discards each later chapter. Use when the user wants a big change to the plot, an arc, a book or approved chapters, when revise-book gives it a `record: change` finding, or to continue a story change that stopped.
---

# change-story

A **story change** changes what happens. It changes the plan top down from the highest level that it touches, then takes one of two strategies (ADR 0005 in the ledgerbound folder, `lb where`, gives the reasons):

- **Forward**: every approved chapter stays, and the change starts at the next chapter that is not approved. Only a replan runs. It costs the least.
- **Reopen**: `lb reopen` takes the record back to the first approved chapter whose events change (ADR 0004), a replan changes the plan, and each reopened chapter gets one action:
  - `check`: the prose stays, and the continuity check compares it with the new record.
  - `scene`: the reviser rewrites one scene, and the chapter gets the full check.
  - `discard`: `lb discard` deletes the prose, and the chapter-writer writes it again from the new plan.

The progress file `runs/change/<id>.json` is the state of the run, so the skill continues a story change that stopped at the first step that is not done. Keep this session small: give the agents paths, read their JSON results, and read memory files in place of prose.

## Steps

1. **Start.** When a file in `runs/change/` exists, a story change stopped: tell the user its `change`, and continue at the first step that it does not mark done. Else run `lb validate` and fix each error, and commit any open change in the novel repo.
   Write the change in the user's words. When `revise-book` started this skill, the change is its `apply` `plan` and `change` findings: their IDs, problems and recommendations.
   Done when you have the change, `lb validate` reports no error, and `git status` is clean.

2. **Level.** Find the highest level that the change touches, from the top: the series ending (`series.md`), a book plan (`books/NN/plan.md`: its acts, its climax, its tension range), an arc or a relationship (`characters/*.md`, `relationships/*.md`), the chapter plans, a scene. Read the memory files of the approved chapters, and find the first approved chapter whose events must change: P. A change that needs a `locked` decision or a draw to change: show the user which one, and continue only after they say so. A change in an imported book cannot be made: its prose is canon (ADR 0003).
   Done when you have the level, the plan files that change, and P, or no P because no approved chapter changes.

3. **Strategy.** With no P, the strategy is forward: write the file below with no actions.
   Else run `lb reopen P --dry-run`: the chapters it reopens and their words are the cost. Give each reopened chapter an action from its memory file: `discard` when the change replaces its events or removes the chapter, `scene` when the change replaces one scene, else `check`. When the change needs a new chapter or book, one less, or a different order, say so: the replan does it with `lb chapter` or `lb book`, and a chapter that moves keeps its action. A new book in the middle of a series needs a reopen from the first chapter of the book after it. When the old events of the approved chapters can stay on the page, and the change can start after them, also offer forward, and recommend it. When `revise-book` gave the strategy and the actions, they are your recommendation. Show the user the cost and the action of each chapter, and recommend one strategy. The user chooses the strategy and can change each action.
   Write `runs/change/<id>.json` (`<id>` a short slug of the change): `{ "change": "<the change>", "findings": [<IDs from revise-book>], "strategy": "forward | reopen", "reopened": "<P> | null", "actions": { "<point>": "check | scene | discard" }, "scenes": { "<point>": "<the scene and how it changes>" }, "old_details": [], "steps": [] }`.
   Done when the user chose, and the file exists. The strategy is the user's choice in every mode, autopilot too. For forward, go to step 5.

4. **Reopen.** Skip this step for forward. For P and each `scene` or `discard` chapter, read its memory file, and add its `lore_added` and `character_added` to `old_details`: the old chapter wrote them into the lore entries and the character files. Run `lb reopen P`. Add `reopen` to `steps`, and commit: `Story change <id>: reopen from <P>`.
   Done when `steps` has `reopen`.

5. **Replan.** Run the `replan` skill. Its cause is the change, its level, its strategy and the chapters and books to insert, remove or move, and it changes the plan top down from that level. `lb chapter` and `lb book` renumber the points in `runs/change/<id>.json` too, and a new chapter needs no action: it is `planned`. After `lb approve replan`, add `replan` to `steps`, and commit: `Story change <id>: replan`. For forward, go to step 8.
   Done when `steps` has `replan`.

6. **Discard.** For each `discard` chapter, run `lb discard <point>`. Add `discard` to `steps`.
   Done when `lb run` gives each `discard` chapter as `planned`.

7. **Write and check.** Run `lb run --book <B> --json` for the book of P, and do its next step as `generate-book` does (`${CLAUDE_PLUGIN_ROOT}/reference/chapter-steps.md`), chapter after chapter. Before the step for a `scene` chapter that `steps` does not list as `scene <point>`:
   - Run `lb brief <point>`. Find the scene in the chapter (`grep -n`), and write `runs/verify/NN-MM.findings.json` with one finding: `{ "severity": "error", "rule": "change", "line": <first line of the scene>, "quote": "<first words of the scene>", "problem": "<the change>", "fix_hint": "scene: lines A-B; record change: <its entry in scenes>" }`. Start the `ledgerbound:reviser` agent with the point, the brief path and the findings path.
   - Delete `runs/verify/NN-MM.json` and `books/NN/memory/MM.md`: the chapter gets the full check, and its memory comes from the new prose. Add `scene <point>` to `steps`.
   When a step says stop (a `replan`, a `blocked` chapter, the `chapter-1` checkpoint), do what `generate-book` does, and tell the user that `change-story` continues from here. When the book is complete and a later book has reopened chapters, continue with `lb run --book <B+1>`.
   Done when every reopened chapter is `done`.

8. **Old details.** For each detail in `old_details`, `grep` the approved chapters for it. Show the user each detail that no approved chapter states, with its lore entry or character file: they decide whether it stays.
   Done when the user decided on each one.

9. **Report**, in a few lines: the change, the strategy, the plan files that changed, and for each reopened chapter its action and its open errors. Delete `runs/change/<id>.json`, and commit: `Story change <id>: done`. For forward, tell the user that `generate-book` writes the changed plan. When `revise-book` started this skill, return to it.

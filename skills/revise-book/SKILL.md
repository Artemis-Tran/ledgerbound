---
name: revise-book
description: The optional revision phase of a complete Ledgerbound book - the user chooses findings of its book review, then deep revisions (lb reopen, replan, rewrite, and the continuity check of every later chapter) and prose revisions (revise-chapter) apply them. Use when the user wants to revise a book after its review, or to continue a revision that stopped.
---

# revise-book

The **book review** `books/NN/review.md` gives findings of two kinds (`${CLAUDE_PLUGIN_ROOT}/reference/review.md`, "Record and size"):

- `record: keep`: a **prose revision**. `revise-chapter` applies it, and the ledger stays.
- `record: change`: a **deep revision**. `lb reopen` takes the ledger back to the start of the chapter, and that chapter and every later one become drafts with their staged deltas. The chapter is rewritten, and each later chapter gets the continuity check again, in order, so the cost grows with the chapters after it. ADR 0004 in the ledgerbound folder (`lb where`) gives the reasons.

The `decision` of each finding is the state of this run: `open`, `apply`, `skip`, then `done`. `runs/review/revise-NN.json` holds the deep revision's progress. So the skill continues a revision that stopped at the first step that is not done. Keep this session small: give the agents paths, and read their JSON results, never the prose.

## Steps

1. **Book.** When `runs/review/revise-NN.json` exists, a deep revision stopped: go to step 3. Else the book is complete (`lb run --book N --json`) and has a review; else run `review-book` first. Run `lb validate`, and fix each error first. Commit any open change in the novel repo.
   Done when the review exists, `lb validate` reports no error, and `git status` is clean.

2. **Choose.** Show the user each `open` finding, as `review-book` step 4 does: the `keep` findings first, then the `change` findings with the chapters that `lb reopen <first chapter> --dry-run` reopens. Recommend: apply each `major` `keep` finding; apply a `change` finding only when its gain is worth the chapters it reopens. The user decides `apply` or `skip` for each one, and can change a recommendation; put their words into the finding's `recommendation`. Write each decision, and the user's reason for a skip as `note`, into the review.
   In autopilot, set `apply` on each `major` `keep` finding and `skip` on each `minor` one, with the `note` "autopilot". Leave each `change` finding `open`: a deep revision is the user's choice.
   Done when each finding has a decision, or is a `change` finding left `open` in autopilot.

3. **Reopen.** Skip steps 3–5 when no `change` finding is `apply`. When `runs/review/revise-NN.json` exists, the reopen is done: run the replan below when its `replanned` is `false`, else go to step 4, or to step 5 when each reopened chapter is `done`.
   Let P be the first chapter of the earliest `apply` `change` finding. Read `books/NN/memory/MM.md` of P: keep its `lore_added` and `character_added`, because the old chapter wrote them into the lore entries and character files. Run `lb reopen P`. Write `runs/review/revise-NN.json`: `{ "reopened": "<P>", "old_details": [<lore_added and character_added of P>], "replanned": false, "rewritten": [] }`. Commit: `Book <N>: reopen from chapter <M> (<finding IDs>)`.
   Run the `replan` skill. The cause is each `apply` `change` finding: its problem and its recommendation. The replan changes the chapter plans of the reopened chapters, the threads and the targets, so that the plan has the new events. After `lb approve replan`, set `replanned` to `true`.
   Done when `replanned` is `true`.

4. **Rewrite and check.** Run `lb run --book <B> --json` for the book of P, and do its next step as `generate-book` does (`${CLAUDE_PLUGIN_ROOT}/reference/chapter-steps.md`), chapter after chapter. Before the step for a chapter that an `apply` `change` finding names and that is not in `rewritten`, rewrite it:
   - `size: chapter`: delete the chapter file and its staged delta. `lb run` then gives `planned`, and the chapter-writer writes the chapter from the new plan. Its brief has the start of the next chapter, so the new chapter leads into it.
   - `size: scene`: run `lb brief <point>`. Find the scene of the finding's evidence in the chapter (`grep -n`), and write `runs/verify/NN-MM.findings.json` with one finding: `{ "severity": "error", "rule": "review", "line": <first line of the scene>, "quote": "<first words of the scene>", "problem": "<the problem>", "fix_hint": "scene: lines A-B; record change: <the recommendation>" }`. Start the `ledgerbound:reviser` agent with the point, the brief path and the findings path.
   Then delete `runs/verify/NN-MM.json` and `books/NN/memory/MM.md` of the chapter: it gets the full check, and its memory comes from the new prose. Add the point to `rewritten`.
   A reopened chapter that is not rewritten has a verify record with `reopened: true`: `verify-chapter` checks its record first.
   When a step says stop (a `replan`, a `blocked` chapter, the `chapter-1` checkpoint), do what `generate-book` does, and tell the user that `revise-book` continues from here. When the book is complete and a later book has reopened chapters, continue with `lb run --book <B+1>`.
   Done when every reopened chapter is `done`.

5. **Old details.** For each detail in `old_details` of `runs/review/revise-NN.json`, read the new memory file of P. When the new chapter does not have the detail, and no other approved chapter states it (`grep` the chapters), show it to the user with its lore entry or character file: they decide whether it stays.
   Then set `decision: done` on each `apply` `change` finding, with a `note` of what changed, and delete `runs/review/revise-NN.json`.

6. **Revise prose.** For each chapter with `apply` `keep` findings, in chapter order, run the `revise-chapter` skill with the point and the findings as the user's notes: each finding is one note with its recommendation, and the quote and line of its evidence in that chapter (`grep -n`; with no quote when a deep revision changed the words). A finding with `size: scene` gets the `fix_hint` `scene: lines A-B`. When it returns, set `decision: done` on each of its findings, with a `note` of what changed, or the open errors of its result.
   Done when no `apply` finding is left.

7. **Report**, in a few lines: the findings `done`, `skip` and still `open`; for each revised chapter, the words before and after; the open errors of each chapter; and the details of step 5. Commit the review: `Book <N>: revised (<finding IDs>)`. Tell the user that `review-book` can review the book again, and that `publish-book` is the next step.

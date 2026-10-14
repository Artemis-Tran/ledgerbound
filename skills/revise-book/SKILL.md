---
name: revise-book
description: The optional revision phase of a complete Ledgerbound book - the user chooses findings of its book review, then a story change (change-story) applies the ones that change the record, and prose revisions (revise-chapter) apply the others. Use when the user wants to revise a book after its review, or to continue a revision that stopped.
---

# revise-book

The **book review** `books/NN/review.md` gives findings of two kinds (`${CLAUDE_PLUGIN_ROOT}/reference/review.md`, "Record and size"):

- `record: keep`: a **prose revision**. `revise-chapter` applies it, and the ledger stays.
- `record: change`: a **deep revision**. The `change-story` skill applies it: `lb reopen` takes the ledger back to the start of the chapter, and that chapter and every later one become drafts with their staged deltas. Each one is checked again or written again, in order, so the cost grows with the chapters after it.

The `decision` of each finding is the state of this run: `open`, `apply`, `skip`, then `done`, and `runs/change/` holds the progress of a story change. So the skill continues a revision that stopped at the first step that is not done. Keep this session small: give the agents paths, and read their JSON results, never the prose.

## Steps

1. **Book.** When a file in `runs/change/` has `findings`, a deep revision stopped: go to step 3. Else the book is complete (`lb run --book N --json`) and has a review; else run `review-book` first. Run `lb validate`, and fix each error first. Commit any open change in the novel repo.
   Done when the review exists, `lb validate` reports no error, and `git status` is clean.

2. **Choose.** Show the user each `open` finding, as `review-book` step 4 does: the `keep` findings first, then the `change` findings with the chapters that `lb reopen <first chapter> --dry-run` reopens. Recommend: apply each `major` `keep` finding; apply a `change` finding only when its gain is worth the chapters it reopens. The user decides `apply` or `skip` for each one, and can change a recommendation; put their words into the finding's `recommendation`. Write each decision, and the user's reason for a skip as `note`, into the review.
   In autopilot, set `apply` on each `major` `keep` finding and `skip` on each `minor` one, with the `note` "autopilot". Leave each `change` finding `open`: a deep revision is the user's choice.
   Done when each finding has a decision, or is a `change` finding left `open` in autopilot.

3. **Change.** Skip this step when no `change` finding is `apply`. Run the `change-story` skill with the `apply` `change` findings as the change. Its strategy is reopen, from the first chapter of the earliest finding; give each chapter of a finding the action of its `size` (`chapter`: `discard`, `scene`: `scene`), and each other reopened chapter `check`. When it returns, set `decision: done` on each of those findings, with a `note` of what changed.
   Done when no `change` finding is `apply`.

4. **Revise prose.** For each chapter with `apply` `keep` findings, in chapter order, run the `revise-chapter` skill with the point and the findings as the user's notes: each finding is one note with its recommendation, and the quote and line of its evidence in that chapter (`grep -n`; with no quote when a deep revision changed the words). A finding with `size: scene` gets the `fix_hint` `scene: lines A-B`. When it returns, set `decision: done` on each of its findings, with a `note` of what changed, or the open errors of its result.
   Done when no `apply` finding is left.

5. **Report**, in a few lines: the findings `done`, `skip` and still `open`; for each revised chapter, the words before and after; and the open errors of each chapter. Commit the review: `Book <N>: revised (<finding IDs>)`. Tell the user that `review-book` can review the book again, and that `publish-book` is the next step.

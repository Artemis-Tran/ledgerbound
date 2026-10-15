---
name: revise-book
description: The optional revision phase of a complete Ledgerbound book - the user chooses findings of its book review, then a story change (change-story) applies the ones that change the record, and prose revisions (revise-chapter) apply the others. Use when the user wants to revise a book after its review, or to continue a revision that stopped.
---

# revise-book

The **book review** `books/NN/review.md` gives findings with a source (`${CLAUDE_PLUGIN_ROOT}/reference/review.md`, "Source", and ADR 0007 in the ledgerbound folder, `lb where`). The source decides the fix, and the fixes run in this order, because a plan fix can remove or rewrite the chapters of a later finding:

1. `plan`, and each finding with `record: change`: a **story change**. The `change-story` skill applies it.
2. `pattern`: a **pattern fix**. Change the origin, take the census, revise each chapter of the census to the limit, and take the census again.
3. `prose`: a **prose revision**. `revise-chapter` applies it, and the ledger stays.

A review from before version 0.29.0 has no `source`: each of its findings is `prose`. Tell the user that a new review (`review-book`) gives the sources, and that a prose revision of a pattern reaches only its evidence.

The `decision` of each finding is the state of this run: `open`, `apply`, `skip`, then `done`, and `runs/change/` holds the progress of a story change. So the skill continues a revision that stopped at the first step that is not done. Keep this session small: give the agents paths, and read their JSON results, never the prose.

## Steps

1. **Book.** When a file in `runs/change/` has `findings`, a deep revision stopped: go to step 3. Else the book is complete (`lb run --book N --json`) and has a review; else run `review-book` first. Run `lb validate`, and fix each error first. Commit any open change in the novel repo.
   Done when the review exists, `lb validate` reports no error, and `git status` is clean.

2. **Choose.** Show the user each `open` finding, as `review-book` step 4 does, in its group. Recommend: apply each `major` finding and each `pattern` finding; apply a `plan` or `change` finding when its gain is worth its cost. For a `pattern`, show the change of its origin that you will make, in one line for each file. The user decides `apply` or `skip` for each one, and can change a recommendation; put their words into the finding's `recommendation`. Write each decision, and the user's reason for a skip as `note`, into the review.
   In autopilot, set `apply` on each `major` `prose` finding and each `pattern` finding, and `skip` on each `minor` `prose` one, with the `note` "autopilot". Leave each `plan` and `change` finding `open`: a story change is the user's choice.
   Done when each finding has a decision, or is a `plan` or `change` finding left `open` in autopilot.

3. **Plan.** Skip this step when no `plan` or `change` finding is `apply`. Run the `change-story` skill with those findings as the change. For a `change` finding, recommend reopen from the first chapter of the earliest finding, and give each chapter of a finding the action of its `size` (`chapter`: `discard`, `scene`: `scene`), and each other reopened chapter `check`. A `plan` finding with `record: keep` can go forward or reopen: `change-story` finds the strategy. When it returns, set `decision: done` on each of those findings, with a `note` of what changed.
   Done when no `plan` or `change` finding is `apply`.

4. **Pattern.** For each `apply` `pattern` finding, in order:
   - **Origin.** Change each file or rule of its `origin`, so that it no longer makes the pattern: cut or rewrite the gesture, habit or signature detail in the character file and say how often the prose may use it; cut the form from the voice sample; add the forms to `lint.banned_add` in `project.yaml` when a phrase must not come back; or change the rule in `guidelines/writing.md`. The user approved the finding, so a changed file keeps its `status`. Commit: `Book <N>: origin of <id>`.
   - **Census.** With `match` or `lint`: run `lb census --finding <id> --book N --json`. With `look_for`: split the chapters into ranges as `review-book` step 2 does, and start one `ledgerbound:book-critic` agent per range with the range and the finding ID, all at the same time; join their `runs/review/census-<id>-*.json`. Choose the places to cut, so that each chapter and the book are inside the `limit`: keep the places where the pattern does real work, and cut the others.
   - **Revise.** For each chapter with a place to cut, in chapter order, run `revise-chapter` with the point and one note: the problem, the recommendation, and each line and its words from the census. Say "change each listed place; a place in a new form of the same pattern is not a fix".
   - **Census again.** Take the census again, the same way. When it is over the limit, revise the chapters that are still over once more. Set `decision: done` with a `note`: the census before and after, and the origin change.
   Done when no `pattern` finding is `apply`.

5. **Revise prose.** For each chapter with `apply` `prose` findings, in chapter order, run the `revise-chapter` skill with the point and the findings as the user's notes: each finding is one note with its recommendation, and the quote and line of its evidence in that chapter (`grep -n`; with no quote when a deep revision changed the words). A finding with `size: scene` gets the `fix_hint` `scene: lines A-B`. When it returns, set `decision: done` on each of its findings, with a `note` of what changed, or the open errors of its result.
   Done when no `apply` finding is left.

6. **Report**, in a few lines: the findings `done`, `skip` and still `open`; for each pattern, the census before and after; for each revised chapter, the words before and after; and the open errors of each chapter. Commit the review: `Book <N>: revised (<finding IDs>)`. Tell the user that `review-book` can review the book again, and that `publish-book` is the next step.

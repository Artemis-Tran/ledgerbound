---
name: tic-pass
description: Take a prose tic that the user names in their own words out of a range of approved Ledgerbound chapters. The user sees every change as a numbered before-and-after list and restores by number, and their choices tune the next chapters. Also gives a census of a tic with no changes ("how bad is this across the book?"). Use for a habit with no rule ID (long similes, composed insults, characters who explain the joke), or to continue a tic pass that stopped.
---

# tic-pass

A sweep over a book flattens the voice or finds too little. A **tic pass** works because the user sees each change at the sentence level, and a restore is cheap. The user's restores show the true rule, which nobody can state in advance. So the pilot comes first, and the **calibration file** is the core of the skill: each later checker reads it.

The ledger does not change: this is a prose revision. Each round copy, record and round number works as in `revise-chapter`. NN is the book and MM the chapter, two digits each. Give the agents paths, and read their short JSON, never the prose. A pass always waits for the user, also with `mode: autopilot`.

**The chapter stays as committed until the user answers.** After the reviser, `lb changes <point> --shelve` moves its work to `runs/verify/NN-MM.proposed.md` and puts the round copy back in `books/`. So `lb run` shows `done`, and no other step can commit a change that the user has not seen. Only a chapter that the reviser is editing at that moment shows `remembered`.

The files of a pass, where `<slug>` is a short name for the tic:

- `runs/tic-pass/<slug>.md`, the calibration file:

  ```markdown
  # <the tic in the user's words, word for word, one line for each tic>

  ## Strictness
  <the author's choice, with its full text from the table below, or their own words>

  ## Line
  Flag: <what to flag, from the user's words and their last answer>
  Leave: <what to leave>

  ## Keep
  - <each "keep" example of the user, word for word>

  ## Restored
  - 1.01: <each restored sentence, word for word>

  ## Accepted
  - 1.01: 17 of 26. <the 3 examples: before -> after>
  ```

- `runs/tic-pass/<slug>.json`, the state: `{ "tic": "<the user's words>", "range": "1.01-1.24", "chapters": [{ "point": "1.01", "state": "revising | waiting | done", "round": 3, "batch": 0 }] }`. `batch` is the number of the before-and-after file, and the pilot is batch 0.
- `runs/tic-pass/<slug>/NN-MM.find.json`, from the checker. `runs/tic-pass/<slug>/batch-K.md`, the before-and-after file.

**Continue a pass that stopped.** When the state file of the tic exists, read it. For a chapter in state `revising`, copy its round copy back to `books/NN/chapters/MM.md`, delete `runs/verify/NN-MM.proposed.md` when it exists, and run the chapter again from **Find**. For a batch in state `waiting`, go to **Show**: `lb changes` gives the same list again. Then go on at the first chapter with no state.

## Strictness

The author decides how much the checker flags. Ask them; there is no silent default.

| Strictness | Text for the calibration file |
|---|---|
| `light` | Flag only the cases that a reader would stop on: the worst showpieces. When in doubt, leave it. |
| `medium` | Flag each clear case, except a case that does real work in its scene: a joke that lands, the turn of a scene. |
| `strict` | Flag every case of the tic, also a near-miss and a case that works. Leave only what always stays. |

The author can also use their own words ("at most 3 for each chapter"). In order, these win: what always stays (the checker's list), then `## Keep` and `## Restored`, then `## Line`, then `## Strictness`. So a restore stays out of a later check, also at `strict`. A strictness is for the whole pass: a tic that needs another strictness gets its own pass.

## A census, with no changes

For "how bad is this tic across the book?". Ask for the strictness, and write the calibration file up to `## Keep`. When the tic has fixed forms, run `lb census <regex>... --book N --json`, and tell the user that a regex counts every form, as `strict` does. Else split the chapters into ranges as `review-book` step 2 does, and start one `ledgerbound:book-critic` agent per range with the range and the calibration file, all at the same time; each one writes `runs/tic-pass/<slug>/census-AA-BB.json`.
Show the count for each chapter, the total and the worst examples, and offer a pass over the chapters with places.
Done when the user has the counts. This branch changes no prose and makes no commit.

## Steps

1. **Start.** Inputs: the tic in the user's words, the range, any "keep" examples, and the strictness; ask for it when the user did not give it. Choose the slug. `lb run --book N` shows each chapter of the range as `done`, and the book is not an imported book. Commit any open change in the novel repo; when the folder is not a git repo, tell the user once and continue. Run `lb validate`, and note each `ledger-quote-*` issue that exists now. Write the calibration file, and show the user the `Strictness` and `Line` sections.
   Done when the novel repo has no open change, and the calibration file and the state file exist.

2. **Pilot.** Take the first chapter of the range through steps 3 to 8 alone: a chapter that sets the voice is the best test of the strictness and the line. Tell the user the cost: 2 agents. When the chapter has no finding, the next chapter is the pilot.
   Done when step 8 is done for a chapter with changes. Then go to step 9.

3. **Find.** For each chapter, run `lb brief <point>`. Let R be the record's `round` + 1, or 1 when there is no record. Copy the chapter to `runs/verify/NN-MM.rR.md`. Write the record with `round` set to R: keep each other field, or write `{ "round": R, "verdict": "pass", "open": [] }` when there is none. The tic findings stay out of `open`. Set the chapter's state to `revising`, with its round.
   Start the `ledgerbound:prose-checker` agent with "tic pass", the point, the calibration file and the path `runs/tic-pass/<slug>/NN-MM.find.json`. The checker writes the findings and the keeps there, and returns only their counts and up to 3 notable keeps.
   Done when the file exists. With no finding, set the state to `done`: the chapter needs no reviser.

4. **Change.** Start the `ledgerbound:reviser` agent with "tic pass", the point, the round R, the brief path and the find file as the findings path. Run `lb validate`. A new `ledger-quote-*` issue of the chapter goes back to the reviser once, then to the user. Then run `lb changes <point> --shelve`, and set the state to `waiting`, with the batch. Keep each `not_fixed` item of the reviser for the report.
   Done when the shelve exits 0.

5. **Show.** Run `lb changes <each waiting point of the batch> --out runs/tic-pass/<slug>/batch-K.md --json`, with the points in the same order every time: the numbers run across the batch, and they stay the same until the apply. Send the file to the user with SendUserFile (when the session has no such tool, give its path). Also give them the 3 `examples` from the JSON, the notable keeps from the checkers, and the count of changes and keeps at this strictness. Ask which numbers to restore, or "all good", or if they want another strictness. To leave a chapter out for now, they restore all its numbers.
   When they want another strictness, write it in the calibration file, delete `runs/verify/NN-MM.proposed.md` of each chapter of the batch, and go back to step 3 for the batch. The chapters are still as committed.
   Done when the user has given numbers or "all good" for the whole batch.

6. **Restore.** Run `lb changes <the same points> --apply --restore <numbers> --json`; with "all good", leave out `--restore`. Each `warnings` item is a restore next to a change that stays, because one pair can span a change that the reviser made in the next sentence. Show the user its `context`, and ask: restore the neighbour too, keep it as it is, or give the words. The apply is done, so make their answer an edit of the chapter: `lb changes <point>` lists what still differs from the round copy, with new numbers and the exact words.
   Run `lb lint --before <round copy> <chapter>` and `lb validate` for each chapter. A new lint error from a restore stays, because the user's restore wins: tell the user. A new `ledger-quote-*` issue must go: tell the user which number broke the quote, and take that restore back.
   Done when each warning has an answer and no new `ledger-quote-*` issue is left.

7. **Learn.** In the calibration file: add each sentence of `restored` under `## Restored`, add each chapter's count and `accepted.examples` under `## Accepted`, and write the rule that the choices show into `## Line`, in one or two sentences ("short figures of one clause stay; long composed showpieces go"), and show the user the rule. Each restored sentence is then an exception: no prose checker flags it again, in this pass or a later one.
   When the rule is a lasting taste, offer one line for `reader-notes.md`. When the book is still being written, also offer one line for `guidelines/writing.md`, so that the writer stops making the tic (ADR 0007).
   Done when `## Line` has the rule from this answer.

8. **Commit.** In the novel repo:
   - **Seams.** Run the **Seam check** of `${CLAUDE_PLUGIN_ROOT}/reference/chapter-steps.md` only for a chapter whose checker returned `later` above 0, with `lb changed <point> --since <its R>`. The checker searched the later chapters and the callbacks for each flagged phrase, and a change at figure level seldom breaks a callback, so a chapter with no hit needs no check.
   - **Phrase log.** Remove each `stale_log` entry of the apply from `phrase_log` in `books/NN/memory/MM.md`. Skip the memory writer: the reviser adds no new image, and the summary still holds. An old image that stays in the log only keeps that image banned; the entries with exact words, the deadpan lines above all, are the ones that a count needs.
   - **Git.** `git add -A && git commit -m "Book <N>, chapter <M>: revised (<tic in a few words>)"`, or one commit for a batch: `Book <N>, chapters <A>-<B>: revised (<tic in a few words>)`. Set each chapter's state to `done`.
   Done when `lb run --book N` shows each chapter of the batch as `done`.

9. **Batch.** For the rest of the range, take about 4 chapters at a time through steps 3 to 8, with the agents of a batch all at the same time and one before-and-after file for the batch. Before each batch, tell the user the cost: 2 agents for each chapter.
   After each answer, compare the restores with the changes. Over a quarter restored: stop before the next batch, and ask if the strictness should go down or the line should move. Write their answer into `## Strictness` or `## Line`. A change applies to the next chapters; a chapter that is done stays as it is.
   Done when each chapter of the range has the state `done`.

10. **Report**, in a few lines: for each chapter the changes kept and restored, the strictness, the rule in `## Line`, the seams still open, each `not_fixed` item, and any line offered for the reader notes or the guidelines.

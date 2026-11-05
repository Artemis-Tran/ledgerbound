# A tic pass learns from the user's restores, and the chapter waits on a shelf

A review finding or a rule ID can start a revision, but the user often knows a tic only in their own words: "too many long similes", "characters who explain the joke". A sweep over a book for such a tic flattens the voice or finds too little. The user ran one by hand on a novel, and it worked, because they saw each change at the sentence level and a restore was cheap. On the first chapter they restored 9 of 26 cuts. Those choices showed the true rule, which they could not state in advance: short figures of one clause stay, and long composed showpieces go.

## The decision

**A tic pass is a new skill, `tic-pass`, with a pilot chapter, then batches.** After each answer, the rule that the restores show goes into a calibration file (`runs/tic-pass/<slug>.md`), and each later checker reads it.

**The author chooses the strictness.** A tic in plain words does not say how much to flag: one author wants only the worst showpieces, and another wants every literary device marked. So the skill asks, `light`, `medium`, `strict` or the author's own words, and writes the choice into the calibration file, where the checker and the census read it. There is no silent default. `## Line`, `## Keep` and `## Restored` win over it, so what the author taught the pass stays true at `strict`. The answer to a batch can also be another strictness: the shelf goes, and the chapters still as committed go through the find step again.

**A tic has rule `user`, with severity `error`.** `revise-chapter` already uses this rule for the user's notes. The rule is not in `lb rules`, so no `max: warn` limits it. The reviser changes each finding of its file at any severity, so the cap of a rule was never what stops it; lint findings stay out of the file for this reason. The checker has its own section for a tic pass, because its usual steps judge only rules of `lb rules`.

**The checker writes its findings to a path.** It now has the Write tool, as the chapter-reader and the book-critic have. It writes one file, with `findings` and `keeps`, and returns only the counts, so the main session stays small. The reviser reads the same file, so it knows what to leave.

**The reviser's work waits on a shelf.** A `verdict: fail` record does not change the stage of an approved chapter: `lb run` returns before it reads the verdict. An uncommitted chapter does change it: `lb run` shows `remembered`, and says to commit. So a batch that waits for the user would look like a chapter to commit, and any `git add -A` would commit changes that the user has not seen. `lb changes --shelve` moves the work to `runs/verify/NN-MM.proposed.md` and puts the round copy back in `books/`. `lb changes --apply` writes it when the user answers. The tic findings also stay out of `open` in the verify record, so that the report at the end of a book does not list them.

**The diff is in the CLI, on tokens.** `lb changes` splits each file into sentences and separators and takes the longest common subsequence of the whole list. A change is a run of tokens that differ, so a restore is a splice: all restored gives the round copy, none gives the revision, and each mix in between is exact. The same two files always give the same numbers, and the shelf does not change, so the numbers stay the same from the list to the restore.

**A restored sentence is an exception for good.** `## Restored` in the calibration files is its one record. Every prose check reads it, also outside a tic pass, or a later `revise-chapter` would undo the user's choice.

**The seam check and the memory writer run only when they are needed.** A change at figure level seldom breaks a callback. The checker looks in the callbacks and the later chapters for each flagged phrase, and a chapter with a hit gets the seam check. `lb changes --apply` names each phrase-log entry that the chapter no longer has, and the main session removes it from the memory file. A paraphrased entry that stays only keeps an old image banned, which is safe. A run of the memory writer for each chapter would cost one more agent to fix that.

## Considered options

- **Revise the chapter in place while the user decides.** It is simpler, and it is what the user did by hand. Then `lb run` shows `remembered` for each waiting chapter, and the next `git add -A` of any other step commits the changes.
- **Make `lb run` read the state of a tic pass, and show a waiting chapter as `done`.** The stage is right then, but the next chapter's commit still takes the changes with it, and the writer reads a proposal as canon.
- **A new rule ID or a new field for a tic.** A new field changes the findings format for each reader, and gains nothing over `user`.
- **Only learn from restores, with no strictness.** The first list then comes from the checker's own taste, and an author who wants far fewer changes must restore most of them to say so.
- **Calibration only in the session.** The rule is then lost when a pass stops, and the agents of a batch cannot read it.
- **A chapter-plan `exceptions` entry for a restored line.** It waives a rule for a whole chapter, and a tic has no rule. It also changes the plan of an approved chapter.
- **Census by the prose checker only.** It costs an agent for each chapter. `lb census` is first for a tic with fixed forms, then the `book-critic` census, which reads a range of about 25,000 words (ADR 0007).

## Consequences

- A chapter that the reviser is editing at that moment shows `remembered`. When a pass stops there, the skill puts the round copy back and runs the chapter again.
- A tic pass runs no continuity checker: the checker and the reviser leave window text and plot facts as they are, `lb validate` checks the committed quotes, and the user reads every changed sentence.
- `lb discard` and `lb chapter` delete the shelf with the other verify files. `lb reopen` leaves it, as it leaves the round copies, and `lb changes --apply` refuses a chapter that is not approved or that no longer matches its round copy.
- A restored sentence can break a lint rule on purpose. `lb lint` run alone still reports it; the prose checker returns no finding on it, so no later revision undoes it.

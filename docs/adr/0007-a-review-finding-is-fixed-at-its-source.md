# A review finding is fixed at its source, and a revision checks its seams

Three reviews of one book (`parts-unknown`, book 1) gave the same scores, after about 70 revision commits: enjoyment 8, plot 7, pacing 7, characters 8, prose 7. Each review found about 15 new problems, and many of them were old problems in a new form (`tags-came-back`, `dock-images-still-dense`) or damage that the revision made (`revision-seams`). The revision worked, chapter by chapter, and the book did not get better. We found four causes:

1. **A finding names a symptom, not its source.** Bram turns his nose into the wind eight times, because `characters/bram.md` says that he does it "every twenty paces". The memory writer put that gesture into the character file, and each brief gives the file to the chapter-writer. The revision cut spans in the prose, and the file made the tic again. No step of a revision went back to the files that make the prose.
2. **A pattern fix reached only its evidence.** A finding has 1–3 quotes, and the revision changed the chapters of those quotes. The review said itself that "the old dock-images fix reached only 1.17-1.24".
3. **The review preferred small fixes.** `reference/review.md` asked for "the fewest chapters" and for `record: change` "only when the fix truly needs it". Of 51 findings that the revisions applied, 50 were `record: keep` and most were `span`. A problem of the plan (a vow that the story never tests, an act that is a run of closures) became a span fix, and a span fix cannot add an arc beat. The scores did not move, because the problems that hold them are in the plan.
4. **A revision did not know what refers to the chapter it changed.** The record tracks stats, items and knowledge; the rolling memory is a summary. Neither one holds the small setups and callbacks between chapters (the bread in Wenna's pocket, a vow, what a gesture means). So a revision of chapter 7 broke chapters that refer back to it, and no check saw it.

Also, "at most 15 findings" read as a quota, so each review found 15 problems again, and no review said that the book was ready.

## The decision

**Each finding has a `source`**, and the source decides the fix:

- `prose`: the problem is in one place, or a few. `revise-chapter` fixes it, as before.
- `pattern`: the problem comes back across the book (a tic, an image, a gesture, a shape of sentence or chapter). The finding names its `origin`: the files or rules that make it (a character file, a voice card, a voice sample, a rule of `guidelines/writing.md`, the lint lists in `project.yaml`). A **pattern fix** changes the origin first, then takes a **census** (each place of the pattern in the book), then revises each chapter of the census to a `limit`, then takes the census again. A pattern fix is done when the second census is inside the limit.
- `plan`: the problem is in the plan: an arc beat that is missing, a thread with no payoff it earned, an act or a chapter with the wrong shape. `change-story` fixes it (ADR 0005): forward when the old chapters can stay, else a reopen.

`chapters` names every chapter where the problem is, not the fewest. The critic recommends the fix that solves the problem, and gives no thought to its cost: `revise-book` shows the cost to the user, who decides.

**A census is a count, by a command when it can be.** `lb census <regex>...` gives each match in each chapter of a book, with its line. A finding gives its regexes in `census`, one for each form of the pattern, so that a new form is counted too. A pattern that a regex cannot find (the quay similes) gets its census from checker agents that read the book in ranges, as the critics do.

**A repeated gesture is not a character fact.** The memory writer puts a gesture into the phrase log, not into the character file. A habit goes into a character file only when the plan or the user makes it one. A signature detail stays, and the brief says how often the prose may use it.

**A later review ends.** A review of a book that had a review before first judges each old finding: `fixed`, `partly` or `not fixed`, with its new finding when it is not fixed. Then it adds only the new findings that pass a bar: `major`, a pattern in 3 or more chapters, or a seam that a revision made. Zero new findings is a good result. The review has a verdict, `ready` or `revise`: `ready` when no `major` finding is open. The earlier review goes to `books/NN/reviews/rK.md`, so the record of the reviews stays in the novel repo.

**A revision checks its seams** (the second version). The memory writer adds `callbacks` to each memory file: each earlier point that the chapter refers back to, and what it refers to. `lb callbacks <point>` lists the later chapters that refer back to a chapter. After a revision of a chapter, the continuity checker checks the callbacks of each of those chapters against the changed lines. A repo whose memory files have no callbacks gets them once, from the memory writer, before its first revision.

## Considered options

- **More findings and more rounds of revise-chapter.** That is what the three reviews did. Each round fixed spans, and the origin made them again.
- **Only better instructions to the critic.** A critic that names the origin still leaves the fix to `revise-chapter`, which sees one chapter and its evidence. The census and the change at the origin must be steps of the revision.
- **A census by agents only.** It costs a full read of the book for each pattern. Most tics have a few fixed forms that a regex finds, so the command is first, and agents only for what a regex cannot find.
- **Callbacks as threads.** A thread is a plan element with a plant and a payoff. The bread in a pocket is too small for the plan, and the writer makes it, not the planner. The memory file of the chapter that refers back is the right place.

## Consequences

- `ReviewFinding` gets `source`, `origin` and `census` (with its `limit`), and the review gets `verdict` and the judgments of the old findings. A review from an earlier version has none of them: `revise-book` treats each of its findings as `source: prose`, and the next review starts the new format.
- `revise-book` applies the findings in this order: `plan` (through `change-story`), then `pattern` (origin, census, revision, census), then `prose`. A plan fix can remove the chapters of a later finding, so it goes first.
- A pattern fix changes files that later books read too, so it improves the next book as well as this one.
- The memory format changes in the second version (`callbacks`), with `reference/formats.md` and both examples.

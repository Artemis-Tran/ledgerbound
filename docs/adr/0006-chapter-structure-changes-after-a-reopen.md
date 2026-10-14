# The chapter structure changes only after a reopen, and each point reference follows its chapter

A story change can need a new chapter, one chapter less, or chapters in a different order. A point (`1.07`) holds the chapter number, and many files hold points: the file names and the `chapter:` frontmatter of the plans, the prose and the memory, the staged deltas, `threads.yaml`, the `changes` of lore entries and character files, the review findings, and the progress files of a story change. A change of the structure by hand misses one of them, and `lb validate` cannot always find the miss: a thread that names the wrong chapter is still a legal thread.

So `lb chapter insert | remove | move` changes the structure, with one rule: **every chapter from the lowest number that changes on must be not approved.** A story change runs `lb reopen` first. The ledger then holds no entry of those chapters, so a renumber never touches the ledger, and ADR 0004 stays the one way back into it.

Each command:

- moves the plan, the prose, the staged delta and the memory of each chapter with its number, and sets their `chapter:`
- changes each point reference to a moved chapter in `threads.yaml`, the lore entries, the character files, the review files and `runs/change/*.json`. It changes only the characters of the value, so the comments and the layout of each file stay. A point can be a YAML number (`1.10` reads as 1.1), so the command reads it as the schema does.
- deletes the brief and the verify files of each moved chapter, and of the chapter before the change. A moved chapter with prose gets the verify record `reopened: true`: it now comes after different chapters, so its record is checked again.

`remove` refuses while something names the chapter: its plan places anchors, arc beats or stages, or a thread, a change or a review finding names it. It lists each one, and the replan moves it first. `insert` leaves a gap that `lb validate` reports (`chapter-gap`) until the replan writes the new plan.

## Considered options

- **A remove that moves each reference to the next chapter.** Fewer steps, but a plant or an anchor in the wrong chapter is a plan error that no check finds. The replan knows where each one belongs; the command does not.
- **An insert that writes an empty plan.** The plan needs a job, scenes and an ending, and an empty one passes as a plan. A gap is an error until the replan fills it, so it cannot be forgotten.
- **Renumber approved chapters too, and rewrite the points of the ledger.** It would let a story change add a chapter without a reopen of the later chapters. But a chapter that comes later reads a different fold, so its prose must be checked again anyway: the reopen gives that check, and the ledger stays append-only.

## Consequences

- To insert a chapter before approved chapters, a story change reopens from there, and each later chapter is checked against the new record.
- Points in free text (a summary that says "in 1.07") do not change. The structured fields are the record of the plan.
- Adding a chapter at the end of a book needs no command: the replan writes its plan.

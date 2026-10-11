# The book review

A **book review** is a critic's judgment of one complete book, in `books/NN/review.md`. The `book-critic` agents read the prose in ranges and write notes; the `review-writer` agent makes the review from the notes. This page is the shared reference of both. The file format is in `formats.md`, row `books/NN/review.md`; the worked example is `examples/tiny-standalone/books/01/review.md`.

## The critic

You are a critic who reads the book as a reader who paid for it, and who also knows the genre: LitRPG and progression fantasy. Judge what the page does to a reader, not what the plan wanted. Each judgment rests on **evidence**: an exact quote of at most 20 words, with its point.

The chapter checks already judged each chapter against `guidelines/writing.md` and the record. The review looks at what a check of one chapter cannot see: the book as a whole, and how its chapters work together. A finding about one sentence belongs to a chapter check; a pattern across chapters belongs here.

## The areas

Judge each area, and give it a score from 1 (a reader stops) to 10 (a reader recommends the book for it).

- **enjoyment**: Does the book deliver its `gives` draws and the promise of each act? Where does a reader want to stop, and where can they not stop? Are the high points earned by what comes before them? Is the progression satisfying: each gain with a cost, a struggle and a use on the page?
- **plot**: Does each question that the book raises get an answer or a clear handoff? Does each thread get a payoff that it earned? Is the climax decided by the protagonist's own act? Look for holes, coincidences that help the protagonist, a turn that comes from nowhere, and a middle where nothing changes.
- **pacing**: Does the tension, as you read it, rise from act to act? Look for runs of chapters with the same shape (the same kind of scene, the same ending type, the same length), scenes that do the same job twice, exposition that stops the story, and transitions between chapters that drop the reader.
- **characters**: Does each arc move, and does the reader see each change happen? Is each main character's motive clear in each scene? Does each one have a want of their own in their scenes, or do some only react? Does each voice stay different? Does each relationship change, and does a reader believe each change?
- **prose**: The patterns that only the whole book shows: a tic that comes back in many chapters, an image used again and again, a voice that drifts from the start of the book to its end, too much or too little of the System on the page, feeling that is told in place of felt.

## A finding

Each finding is one problem, with:

- `area`, and `severity`: `major` when a reader would put the book down or tell a friend about the problem; else `minor`.
- `chapters`: the points of the chapters that the fix changes. Keep it to the fewest chapters that fix the problem.
- `problem`: what is wrong and what it does to the reader, in 1–3 sentences.
- `evidence`: 1–3 quotes with their points.
- `recommendation`: one concrete change: what happens, where, and what the reader then feels. A direction ("more tension") is not a recommendation.
- `record` and `size` (see below).

Give at most 15 findings, the most important first. A strength is not a finding: it goes in the verdict.

## Record and size

The **record** holds the stats, ranks, items, locations, beliefs, the day and the entities of the story. A fix is one of two kinds:

- `record: keep`: the fix changes only how the page tells the story: feeling, dialogue, an added beat, a scene told again with the same events, a hint planted earlier, a cut. `revise-chapter` applies it, and the ledger stays as it is.
- `record: change`: the fix changes what happens in a way that the record tracks: a fight with a different result, an item that is lost or never found, a level gained later, a character who learns a secret earlier, a new character who must exist. A deep revision applies it: `lb reopen` takes the record back to that chapter, and every later chapter is checked again. It costs much more, so give it only when the fix truly needs it.

When you are not sure, compare the fix with the ledger: `lb fold <point> --json` gives the state at the end of a chapter, and the entries of a chapter are the lines of `ledger.jsonl` whose `point` starts with it. A fix that needs a different value there is `change`.

`size` is how much prose the fix rewrites: `span` (a sentence to a paragraph), `scene` or `chapter`. A `change` fix is a `scene` or a `chapter`.

## The verdict

The body of `review.md` is the critic's verdict, for the user: the verdict in 2–3 sentences, the strengths, and the 3 most important problems, each with its finding ID. Plain words, no scores in the body.

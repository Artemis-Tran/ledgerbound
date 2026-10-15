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
- `chapters`: the points of each chapter where the problem is, all of them.
- `problem`: what is wrong and what it does to the reader, in 1–3 sentences.
- `evidence`: 1–3 quotes with their points.
- `recommendation`: the change that solves the problem: what happens, where, and what the reader then feels. A direction ("more tension") is not a recommendation. Recommend the fix that solves the problem, whatever it costs: the user sees the cost and decides.
- `source`, and for a pattern its `origin` and `census` (see below).
- `record` and `size` (see below).

Give at most 15 findings, the most important first. Fewer is better than weak ones: a finding is a problem that a reader feels. A strength is not a finding: it goes in the verdict.

## Source

The `source` says where the fix starts (ADR 0007 in the ledgerbound folder). A fix that starts in the wrong place reaches only the places it names, and the problem comes back.

- `prose`: the problem is in one place, or a few, and nothing outside the prose makes it. A prose revision fixes it.
- `pattern`: the problem comes back across the book: a tic, an image, a gesture, a shape of sentence, a way of hiding a feeling. Something makes it, so a fix of the prose alone lets it come back in a new form. Give:
  - `origin`: the files or rules that make it, each with the line or rule that does it: a character file (a gesture written as a habit, a signature detail, a voice-card habit), a voice sample, a rule of `guidelines/writing.md`, or a missing entry in the lint lists of `project.yaml`. Read those files to find it. When the origin is the chapter-writer itself, name the rule or the lint list that must change so that it stops.
  - `census`: `match`, one regex for each form of the pattern (case does not matter; `lb census <regex>...` tests them); or `lint`, a rule that `lb lint` checks, when its findings are the places (`dialogue.quip-chain`, `dialogue.toppers`; `lb census --lint <rule>` tests it); or `look_for` when neither finds it (a kind of simile, a kind of chapter ending); and `limit`: how many places the book may keep (`per_chapter`, `per_book` or both). The census is each place, not only the evidence.
- `plan`: the problem is in the plan, and the prose did what the plan said: an arc beat that is missing (a vow that the story never tests), a thread with a payoff it did not earn, an act that is a run of the same chapter, a character with no want in the plan. A story change fixes it, from the plan down. A plan finding can keep the record (an added scene that tests the vow) or change it.

When you are not sure between `prose` and `pattern`, run `lb census` with the forms you saw: a problem in 3 or more chapters is a pattern. For the shape of the dialogue (short turns, quip chains, toppers), run `lb dialogue --book N`.

## Record and size

The **record** holds the stats, ranks, items, locations, beliefs, the day and the entities of the story. A fix is one of two kinds:

- `record: keep`: the fix changes only how the page tells the story: feeling, dialogue, an added beat, a scene told again with the same events, a hint planted earlier, a cut. `revise-chapter` applies it, and the ledger stays as it is.
- `record: change`: the fix changes what happens in a way that the record tracks: a fight with a different result, an item that is lost or never found, a level gained later, a character who learns a secret earlier, a new character who must exist. A deep revision applies it: `lb reopen` takes the record back to that chapter, and every later chapter is checked again. Give it when the fix needs it, and give the reason in the recommendation.

When you are not sure, compare the fix with the ledger: `lb fold <point> --json` gives the state at the end of a chapter, and the entries of a chapter are the lines of `ledger.jsonl` whose `point` starts with it. A fix that needs a different value there is `change`.

`size` is how much prose the fix rewrites: `span` (a sentence to a paragraph), `scene` or `chapter`. A `change` fix is a `scene` or a `chapter`.

## The verdict

`verdict` in the frontmatter is `ready` when the review has no `major` finding, else `revise`.

The body of `review.md` is the critic's verdict, for the user: the verdict in 2–3 sentences, the strengths, and the 3 most important problems, each with its finding ID. Plain words, no scores in the body.

## A later review

A book that had a review before gets a later review after its revision. The earlier review is in `books/NN/reviews/`, the last one with the highest number. A later review must end the cycle, not start it again:

1. Judge each finding of the earlier review that was `done`, in `earlier`: `fixed`, `partly` or `not-fixed`, with the new finding that carries what is left (`finding`), and a `note` of what you saw. A seam that the revision made is part of this judgment.
2. Add a new finding only when it passes the bar: it is `major`, or it is a pattern in 3 or more chapters, or it is a seam that the revision made. A problem that the earlier review saw and the user skipped is not new.
3. Zero new findings is a good result. When no `major` finding is open, the verdict is `ready`: say so in the body, and say what a further revision would gain.

Give each score from the book as it is now. A score moves when the reader's experience of the area changed, not when a finding was done.


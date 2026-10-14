---
name: review-book
description: Review a complete Ledgerbound book as a critic - enjoyment, plot, pacing, characters and prose across the whole book - into books/NN/review.md, with scores and findings that revise-book can apply. Use when a book is complete and the user wants a review, a critique or an opinion of it.
---

# review-book

The **book review** judges the whole book, which no chapter check sees: the arcs, the threads, the pacing and the patterns across chapters. The criteria and the shape of a finding are in `${CLAUDE_PLUGIN_ROOT}/reference/review.md`.

The main session coordinates and never reads the prose: the `book-critic` agents read the book in ranges, and the `review-writer` agent makes the review from their notes. Each step skips the work that exists, so a review that stopped continues.

## Steps

1. **Book.** Run `lb run --book N --json`, where N is the book the user names, else the current book.
   - The book plan has `imported: true`: stop, and tell the user that an imported book is canon, so the tool does not review it.
   - Chapters are open: tell the user which ones, and that `generate-book` completes them. Stop.
   When `books/NN/review.md` exists, ask the user: keep it, or a new review? To keep it, go to step 4. For a new review, move the review to `books/NN/reviews/rK.md` (K one more than the highest there, else 1), and the notes and censuses of `runs/review/` to `runs/review/old-<date>/`. The new review is then a later review: it judges the old findings first, and adds only new findings that pass its bar.
   Done when the book is complete and has no review.

2. **Read.** Skip the ranges that have notes in `runs/review/`. Split the chapters into ranges of about 25,000 words (`wc -w books/NN/chapters/*.md`), and start one `ledgerbound:book-critic` agent per range with the range, all at the same time.
   Done when each chapter is in exactly one notes file.

3. **Review.** Start the `ledgerbound:review-writer` agent with the book number.
   Done when `lb validate` reports no error for `books/NN/review.md`.

4. **Show.** Read the frontmatter of the review and its verdict. Show the user:
   - the verdict (`ready` or `revise`) and the five scores; for a later review, also the old findings with their `earlier` status;
   - the findings in three groups, most important first in each: the ID, area, severity, chapters, the problem in one line, and the recommendation.
     - `plan`, and each finding with `record: change`: the story changes that fix them. For each one, give its cost: `lb reopen <its first chapter> --dry-run` (chapters and words), or "forward" when the change can start after the written chapters.
     - `pattern`: the origin, and the census (`lb census --finding <id> --book N`: the places and the chapters, against the limit).
     - `prose`.
   Tell the user the path of the review, and that `revise-book` applies the findings that they choose.

5. **Git.** In the novel repo: `git add -A && git commit -m "Book <N>: review"`.

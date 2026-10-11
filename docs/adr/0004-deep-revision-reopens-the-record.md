# A deep revision reopens the record

The ledger is append-only: a committed delta never changes, and a correction is a barrier entry in a later chapter. A book review can find a problem whose fix changes what happens in an approved chapter (a fight with a different result, an item that is never found). A correction in a later chapter cannot fix that: the old event stays on the page. So `lb reopen <point>` is the one way back into the committed record. It takes the ledger entries of the chapter and of every later chapter back to their staged deltas, and sets those chapters back to `draft`. The chapter is then rewritten from a new plan, and each later chapter is checked again in order, through the normal steps of generation: verify, commit, memory, git.

We chose this because it uses the steps that already keep the record legal. After a reopen, the record is the same as in the middle of a generation run: the chapters before the point are committed, and the rest are drafts with staged deltas. `lb delta`, `lb claims` and `lb commit` need nothing new.

## Considered options

- **List only.** The skill shows the finding, and the user changes the book by hand. This is safe, but the user loses the checks of the record for the changes they make.
- **A correction in the next book.** `replan` adds a correction to the next book's first chapter. It works only when the old event can stay on the page and the story changes after it.
- **Edit the ledger in place.** Change only the entries of the rewritten chapter. The later chapters were written from the old fold, so a later entry can become illegal (an item removed that is no longer there), and nothing finds it.

## Consequences

- The ledger is append-only except for `lb reopen`, which only the `revise-book` skill runs, after the user chose the finding. Git keeps the old ledger: `revise-book` commits before the reopen.
- The cost of a deep revision grows with the chapters after it: each one gets the continuity check again. The prose check is skipped for a reopened chapter whose prose did not change (`reopened: true` in its verify record). `lb reopen --dry-run` gives the cost before the user decides.
- A later chapter whose claims no longer agree with the new record gets span revisions, or a replan when a span cannot fix it. A reopen across a book boundary reopens the later book's chapters too.
- The rolling memory of the rewritten chapter is written again. The details that the old chapter added to lore entries and character files stay there, so `revise-book` shows the ones that the new chapter does not have to the user.
- An imported book cannot be reopened: its prose is canon, and the record starts after it (ADR 0003).

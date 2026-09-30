# The record starts after an imported book

When an author wrote book 1 without Ledgerbound, the record of the project starts at the end of that book: the `start` values in `schema.yaml` are the state at the end of book 1, and the ledger has no entries in book 1. We chose this because the imported book is already canon, and a delta for each of its chapters, reconstructed from the prose by a model, could put errors into the record that no plan or check can find later. The fold at a point inside the imported book is the same as the fold at its end.

## Considered options

- **Reconstruct a delta for each imported chapter** (the claims extraction in reverse). This gives the full history of the record, but it costs a model run for each chapter, and each wrong value becomes committed canon. Book 2 needs only the state at the end of book 1.
- **One barrier entry at the last imported chapter.** This gives the same fold as the `start` values, but it needs a chapter with a staged delta and a commit for a chapter that no one wrote in the tool.

## Consequences

- The history of book 1 is in its rolling memory, its lore entries and its character files, not in the record.
- The lore entries and the character files do not start after book 1. Their body is the state at the start of book 1, and a change in book 1 is a lore change or a character change from a point in book 1, as for any other chapter. Only the record skips book 1.
- The status windows of book 1 are not checked against the record. When book 1 has windows, the import reads the `start` values from the last one of each character, and the author approves them at the `bible` checkpoint.

# {{TITLE}}

This is a Ledgerbound novel repo. Run `lb status` to see the checkpoints and the next step, and `lb run` during generation.

- Story state comes only from `lb fold` and the YAML files. Never compute ranks, counts or dates in your head.
- Only `lb commit` writes `ledger.jsonl`. A change to the record goes into a staged delta (`books/NN/deltas/MM.jsonl`).
- Only run `lb approve <checkpoint>` after the user says they approve. `lb approve chapter-1` also commits chapter 1.01.
- All prose follows `guidelines/writing.md`. The story bible and the voice samples win when a rule conflicts with them.

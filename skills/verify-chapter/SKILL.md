---
name: verify-chapter
description: Check one chapter of a Ledgerbound novel with the prose-checker and continuity-checker agents at the same time, then revise only the flagged spans, for at most 3 rounds. Use after a chapter is drafted, or when `lb run` names verify-chapter.
---

# verify-chapter

Two checkers that did not write the chapter find the problems, and a reviser fixes only the flagged spans. Each round is recorded in `runs/verify/NN-MM.json`, so a stopped check continues at the right round. NN is the book and MM the chapter, two digits each.

## Steps

1. **Round.** When `runs/verify/NN-MM.json` exists, this round is its `round` + 1; else it is round 1. When `runs/briefs/NN-MM.md` is missing, run `lb brief <point>`.
   In round 2 or later, run `lb changed <point>`: it gives the lines that the reviser changed.
   Copy the chapter to `runs/verify/NN-MM.r<round>.md`: the next round compares the revision with this copy.

2. **Check.** In one message, start both agents with paths only:
   - `ledgerbound:prose-checker` with the chapter `books/NN/chapters/MM.md`, its plan `books/NN/plan/MM.md`, the voice samples in `voice/`, and `characters/<id>.md` for each character who speaks. Say: "chapter M of book N".
   - `ledgerbound:continuity-checker` with the point.
   Round 1 checks the whole chapter. In round 2 or later, also give both agents the round, the changed lines from `lb changed`, and the path `runs/verify/NN-MM.json` (the open findings of the round before): they check the changed lines and the open findings.

3. **Record.** Put the findings of both agents in one list, sorted by line, in `runs/verify/NN-MM.findings.json`. A finding of a rule with `max: "warn"` in `lb rules` is a `warn`. Write `runs/verify/NN-MM.json`:

   ```json
   { "round": 1, "verdict": "pass | fail", "open": [{ "severity": "error", "rule": "plan.ending", "line": 88, "quote": "...", "problem": "..." }] }
   ```

   `verdict` is `pass` when no finding is an `error`. `open` holds every finding, with its severity and quote. Keep `extra_round` when the old record has it.

4. **Decide.**
   - `pass`: return `pass`. The open warnings stay in the record for the report at the end of the book.
   The last round is 3, or 4 when the record has `"extra_round": true`.
   - `fail` before the last round: start the `ledgerbound:reviser` agent with the point, the round, the brief path and the findings path. When it returns a `not_fixed` item with `"replan": true`, return `replan` with its reason. Else go back to step 1.
   - `fail` in the last round: return `blocked` with the open errors.

   Done when the result is `pass`, `blocked` or `replan`.

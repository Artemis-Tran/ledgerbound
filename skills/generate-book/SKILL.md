---
name: generate-book
description: Write the rest of a Ledgerbound book chapter by chapter, and continue after a usage-limit stop or a closed session from the files in runs/. Use when the user wants the whole book, or asks to continue or resume a run.
---

# generate-book

The run is a loop over `lb run`: it reads the files, gives the stage of each chapter, and names the next step. So a run that stopped continues from where it stopped, with no other state. The steps for each stage are in `${CLAUDE_PLUGIN_ROOT}/reference/chapter-steps.md`.

Keep this session small: give the agents paths, and read their JSON results, never the prose.

## Steps

1. Run `lb gate voice-sample`. If it is BLOCKED, stop and tell the user why.

2. Run `lb run --json`. Do the step in `chapter-steps.md` for the stage of its `next.chapter`. Then run `lb run --json` again, and continue with the next step, chapter after chapter.
   Done when `lb run` says the book is complete, or a step says stop: a checkpoint that waits for the user (`chapter-1`, `replan`), a replan, or a chapter that is `blocked`.

3. When the run stops before the end, tell the user why, what they must do, and that `generate-book` continues from this point.

4. When the book is complete, report:
   - the chapters, with the word count of each (`wc -w books/NN/chapters/*.md`);
   - the open warnings of `lb run --json`, grouped by rule;
   - the `open_questions` of the last memory file: the handoff to the next book;
   - for a series, the next step: the `plan-book` skill for the next book.

---
name: generate-chapter
description: Write one chapter of a Ledgerbound novel end to end - brief, delta, prose, verification, approval, rolling memory and a git commit. Use for the next chapter, or when the user names one (for example 1.07).
---

# generate-chapter

A chapter goes through fixed stages, and `lb run` works out the stage of each one from the files. The steps for each stage are in `${CLAUDE_PLUGIN_ROOT}/reference/chapter-steps.md`.

## Steps

1. Run `lb gate voice-sample`. If it is BLOCKED, stop and tell the user why.

2. Run `lb run`. The chapter is the first one that is not `done`. Chapters are committed in order: when the user named a later chapter, tell them which chapter comes first, and offer to write that one.

3. Do the step in `chapter-steps.md` for the chapter's stage. Run `lb run` again after each step, and do the next one.
   Done when the chapter is `done`, or a step says stop.

4. Tell the user in a few lines: the chapter, its word count, the number of verify rounds, the open warnings (from `runs/verify/NN-MM.json`), any replan, and in autopilot any accepted errors. Offer the next chapter, or `generate-book` for the rest of the book.

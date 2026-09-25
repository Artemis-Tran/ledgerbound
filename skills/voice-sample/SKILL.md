---
name: voice-sample
description: Write and approve the ~500-word voice sample that becomes the prose reference for a LitRPG project, and fix the status-window template. Use after the chapter plans are approved, or when `lb status` names voice-sample.
---

# voice-sample

The voice sample is about 500 words of prose in the chosen style. After approval it is the reference for all prose, and its status window becomes the **window template**.

## Steps

1. Run `lb gate chapter-plans`. If it is BLOCKED, stop and tell the user why.

2. Read `guidelines/writing.md` in full, the `prose-style`, `pov-tense` and `tone` decisions in `bible.md`, the voice cards of the characters in the sample, and the chapter plan the scene comes from.

3. **Choose the scene.** Take a scene from the chapter-1 plan that has the protagonist, one other main character who talks, and a stat change. If chapter 1 has no such scene, take one from a later chapter and say which.

4. **Write** `voice-sample.md`, with frontmatter `status: draft`, `pov`, and `characters` (the protagonist first). The prose:
   - starts inside the scene, with a character who does or wants something;
   - has dialogue where each line passes the tag test against the voice cards;
   - shows one status window in a fenced code block (```), with only the values that changed, as `old → new`. This format becomes the template, so make it clean and short;
   - ends on something new and concrete, in motion.

5. **Check.** Run the `check-prose` skill on `voice-sample.md`. For each finding, fix **only the flagged span**; a full rewrite brings in new tics. After each fix, run `lb lint --lines <A-B> voice-sample.md` on the changed lines. Run `check-prose` again. Stop after 3 rounds; tell the user what is still open.
   Done when `check-prose` returns `pass`, or 3 rounds are used.

6. **Checkpoint.** Show the user the sample and the check result. When they approve (or when `lb gate voice-sample` says the checkpoint is off, and check-prose passed):
   - copy the status window, without the fences, into `window_template: |` in the `bible.md` frontmatter;
   - run the checkpoint loop in `${CLAUDE_PLUGIN_ROOT}/reference/checkpoint-loop.md` for `voice-sample`.
   When they ask for changes, change only what they point at, and go back to step 5.

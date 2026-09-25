---
name: check-prose
description: Check prose against guidelines/writing.md in a fresh subagent that did not write it - lint plus judged rules (endings, dialogue, subtext, emotion, voice cards). Use for a voice sample, a chapter draft, or any prose file in a Ledgerbound novel repo.
---

# check-prose

The writer of a text cannot see its tics, so the check runs in the `prose-checker` agent, which starts with a fresh context. Do not judge the prose yourself in this skill.

## Steps

1. Collect the paths (all relative to the novel repo root):
   - the prose file;
   - its chapter plan (`books/NN/plan/MM.md` for `books/NN/chapters/MM.md`), if it has one;
   - `voice-sample.md`, if it is approved and is not the file under check;
   - `characters/<id>.md` for each character who speaks in the file.

2. Start the `ledgerbound:prose-checker` agent with the Agent tool. Give it only the paths and one line on what the file is (voice sample, or chapter N of book M). Do not give it your view of the text.

3. The agent returns JSON: `{ verdict, lint, findings: [{severity, rule, line, quote, problem, fix_hint}] }`. Give the caller the verdict and the findings, sorted by line, without change.

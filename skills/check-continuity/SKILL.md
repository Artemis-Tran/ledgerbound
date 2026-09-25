---
name: check-continuity
description: Check a chapter of a Ledgerbound novel against the record (stats, items, time, location, knowledge) and against its plan, in a fresh subagent that did not write it. Use for one chapter on request; verify-chapter runs it as part of every check.
---

# check-continuity

The check runs in the `continuity-checker` agent, which starts with a fresh context. Do not judge the chapter yourself in this skill.

## Steps

1. Get the point of the chapter (for example `1.07`). The chapter `books/NN/chapters/MM.md` must exist.

2. Start the `ledgerbound:continuity-checker` agent with the Agent tool. Give it only the point.

3. The agent returns JSON: `{ verdict, claims, findings: [{severity, rule, line, quote, problem, fix_hint}] }`. Give the caller the verdict and the findings, sorted by line, without change.

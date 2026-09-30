# The steps of one chapter

`lb run` gives the stage of each chapter and the next step. Do the step for the stage of the first chapter that is not `done`, then run `lb run` again. A point is `book.chapter`, for example `1.07`. Give the agents paths, never the prose: the main session stays small for a whole book.

With `mode: autopilot` in `project.yaml`, the run makes the user's decisions itself and continues. Each decision goes into `runs/autopilot.md` (see **Autopilot log**). The run stops only for the hard stops in **Stop**.

| Stage | Step |
|---|---|
| `planned` | Run `lb brief <point>`, then **write**. |
| `briefed` | **Write**. |
| `drafted` | **Verify**. |
| `verified` | **Approve**. |
| `approved` | **Remember**. |
| `remembered` | **Git**. |
| `blocked` | **Stop**, or in autopilot **Blocked in autopilot**. |

## Write

Start the `ledgerbound:chapter-writer` agent with the point and the brief path (`runs/briefs/NN-MM.md`), and nothing else.
Done when the agent returns `"status": "drafted"` and `lb delta <point>` exits 0. When it returns `"status": "replan"`, run the `replan` skill with its reason.

## Verify

Run the `verify-chapter` skill for the point.
Done when it returns `pass`. When it returns `blocked` or `replan`, go to **Stop** (in autopilot: `replan` runs the `replan` skill, then **verify** again; `blocked` goes to **Blocked in autopilot**).

## Approve

- When `lb run` names the `chapter-1` checkpoint: show the user the chapter path, its word count and the open warnings from `runs/verify/NN-01.json`, and ask: approve, or what to change? When they approve, run `lb approve chapter-1`. When they ask for changes, write their notes as findings to `runs/verify/NN-01.findings.json` (rule `user`), start the `ledgerbound:reviser` agent with the point, the brief path and that file, delete `runs/verify/NN-01.json`, and **verify** again.
- Otherwise run `lb commit <point>`.

Done when the command exits 0. When its output says **REPLAN NEEDED**, run the `replan` skill with those lines before the next chapter (in autopilot too: the skill then decides and logs).

## Remember

Start the `ledgerbound:memory-writer` agent with the point. When its `warnings` name a contradiction of a lore entry or a character file, add each one to `open` in `runs/verify/NN-MM.json` as `{ "severity": "warn", "rule": "continuity.lore", "line": <line>, "problem": "<the warning>" }` (`continuity.character` for a character file): the report at the end of the book shows it, and the user can fix the chapter or the file.
Done when `lb validate` reports no error for `books/NN/memory/MM.md`.

## Git

In the novel repo: `git add -A && git commit -m "Book <N>, chapter <M>: <title>"`. When the folder is not a git repo, tell the user once and continue.

## Blocked in autopilot

Read `runs/verify/NN-MM.json`.
- When an open error is about the plan (`plan.*`) and the record has no `extra_round`: run the `replan` skill with those errors. Then set `"extra_round": true` in the record, and **verify** again: the chapter gets one more round.
- Otherwise: set `"accepted": true` in the record, and write the open errors in the log. `lb run` then shows the chapter as `verified`, and `lb commit` accepts it with its lint errors.

Done when the record has `extra_round` or `accepted`.

## Autopilot log

Append to `runs/autopilot.md` (make it when it does not exist), one section per decision:

```markdown
## 1.07 — replan
Cause: Ivo is past copper, but b1/act1/end expects copper.
Chosen: move the target to b1/act2/end (the other option: a loss in 1.08).
- targets.yaml b1/act1/end: rank copper → iron
```

The kinds are `replan` and `accepted errors` (each error with its rule, line and problem).

## Stop

Hard stops, in every mode:
- `lb delta` or `lb commit` has an error that the reviser cannot fix: the record must stay legal.
- In autopilot, a replan that needs a change to a `locked` decision or a draw.

Outside autopilot, also: a `blocked` chapter. Read `runs/verify/NN-MM.json`. Show the user each open error (rule, line, problem). When an error is about the plan (`plan.*`), offer the `replan` skill. Otherwise ask the user how to fix it; after the fix, delete `runs/verify/NN-MM.json` and **verify** again.

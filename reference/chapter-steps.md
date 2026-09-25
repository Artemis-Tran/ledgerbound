# The steps of one chapter

`lb run` gives the stage of each chapter and the next step. Do the step for the stage of the first chapter that is not `done`, then run `lb run` again. A point is `book.chapter`, for example `1.07`. Give the agents paths, never the prose: the main session stays small for a whole book.

| Stage | Step |
|---|---|
| `planned` | Run `lb brief <point>`, then **write**. |
| `briefed` | **Write**. |
| `drafted` | **Verify**. |
| `verified` | **Approve**. |
| `approved` | **Remember**. |
| `remembered` | **Git**. |
| `blocked` | **Stop**. |

## Write

Start the `ledgerbound:chapter-writer` agent with the point and the brief path (`runs/briefs/NN-MM.md`), and nothing else.
Done when the agent returns `"status": "drafted"` and `lb delta <point>` exits 0. When it returns `"status": "replan"`, run the `replan` skill with its reason.

## Verify

Run the `verify-chapter` skill for the point.
Done when it returns `pass`. When it returns `blocked` or `replan`, go to **Stop**.

## Approve

- When `lb run` names the `chapter-1` checkpoint: show the user the chapter path, its word count and the open warnings from `runs/verify/01-01.json`, and ask: approve, or what to change? When they approve, run `lb approve chapter-1`. When they ask for changes, write their notes as findings to `runs/verify/01-01.findings.json` (rule `user`), start the `ledgerbound:reviser` agent with the point, the brief path and that file, delete `runs/verify/01-01.json`, and **verify** again.
- Otherwise run `lb commit <point>`.

Done when the command exits 0. When its output says **REPLAN NEEDED**, run the `replan` skill with those lines before the next chapter.

## Remember

Start the `ledgerbound:memory-writer` agent with the point.
Done when `lb validate` reports no error for `books/NN/memory/MM.md`.

## Git

In the novel repo: `git add -A && git commit -m "Book <N>, chapter <M>: <title>"`. When the folder is not a git repo, tell the user once and continue.

## Stop

Read `runs/verify/NN-MM.json`. Show the user each open error (rule, line, problem). When an error is about the plan (`plan.*`), offer the `replan` skill. Otherwise ask the user how to fix it; after the fix, delete `runs/verify/NN-MM.json` and **verify** again.

# Ledgerbound design

This is the approved design for phase 1 (planning) and phase 2 (generation). The terms come from [`CONTEXT.md`](../CONTEXT.md). The exact file formats, with examples, are in [`reference/formats.md`](../reference/formats.md). The zod schemas in `src/schemas.ts` are the source of truth for the formats.

## Two kinds of repo

- **This repo** is the tool: a Claude Code plugin (skills, one agent) and the `lb` CLI. See [ADR 0001](adr/0001-tool-repo-separate-from-novel-repos.md).
- **A novel repo** holds one story (a series or a standalone book). `lb init` makes it.

## Workflow and checkpoints

| Step | Skill | Writes | Checkpoint |
|---|---|---|---|
| 0 (optional) | `develop-idea` | `pitch.md` from the seed, via 3 premises | – (choosing a premise is the approval) |
| 1 | `start-project` | `bible.md`, `schema.yaml`, `facts.yaml`, `project.yaml` | `bible` |
| 2 | `plan-series` | `series.md`, `books/NN/plan.md` (book level, every book), `targets.yaml` | `series-plan` (series only), `book-plan` |
| 3 | `plan-arcs` | `characters/*.md` | `character-arcs` |
| 4 | `plan-book` | `books/NN/plan/MM.md`, `threads.yaml`, anchors | `chapter-plans` |
| 5 | `voice-sample` | `voice/dialogue.md`, `voice/action.md`, `voice/quiet.md`, window template in `bible.md` | `voice-sample` |
| 6 | `generate-chapter`, `verify-chapter` (or `generate-book` for all of them) | `books/NN/deltas/MM.jsonl`, `books/NN/chapters/MM.md`, `books/NN/memory/MM.md`, `ledger.jsonl` | `chapter-1` |
| any time | `replan` | chapter plans not written yet, `threads.yaml`, `targets.yaml`, open decisions | `replan` (always on) |

- A series plans the series level and every book at book level. Only the next book to write gets act, chapter and scene plans.
- Each checkpoint is `on` by default. `mode: just-write-it` switches all of them off except `replan`. `mode: autopilot` switches all of them off: a replan picks its own option (within the `open` decisions) and approves itself, and a chapter blocked after 3 rounds gets an automatic replan and one extra round when a plan error is open, or else is committed with its open errors. Each decision goes into `runs/autopilot.md`. The run still stops for a change to a `locked` decision or a draw, and for a record error.
- Only `lb approve` sets `status: approved`. It refuses when the validator finds errors.
- A skill starts with `lb gate <upstream checkpoint>`. The gate passes when the upstream files are valid and approved, or valid and the checkpoint is off.

## Draws and windows

- The **draws** are in the `bible.md` frontmatter: at least 3, with at least 1 `excludes`. `develop-idea` gives 4–7 draws to each premise, and `start-project` writes them. A bible with no draws (a repo made before 0.5.0) gives only the warning `no-draws`.
- Each book plan lists the `gives` draws that it delivers. When every book plan exists, each `gives` draw must be in one of them (`draw-undelivered`), at the `book-plan` gate.
- The brief has every `excludes` draw and the `gives` draws of its book. `prose-checker` judges `draws.excluded` as an error, and no chapter-plan exception can waive it.
- `windows` in `project.yaml` is `on` by default. With `off`, the voice samples need no status window and `bible.md` no window template, `lb lint` gives the error `windows.off` for each fenced block, and the brief tells the writer to show progression through the prose. The record does not change.

## The record

- The validator reads only YAML frontmatter and YAML files. Markdown bodies are notes for the model.
- Timeline, location and knowledge are built in. The author-defined schema has four field kinds: `counter`, `ladder`, `collection`, `text`.
- Targets attach to plan anchors (`b1/act1/end`, `b1/end`, `series/end`, or a custom `b1/<slug>`). A chapter plan maps an anchor to a chapter.

## Verification

- `lb lint` is deterministic. It returns JSON findings with a rule ID, a severity and a line. It exits 1 on any error that the chapter plan does not waive.
- `check-prose` runs in the `prose-checker` agent, which did not write the text. It runs `lb lint`, then judges the rules that a script cannot check.
- `lb rules` lists the rule IDs, their guideline section and which check owns each one.

## Phase 2: generation

### One chapter

| Step | Who | Reads | Writes |
|---|---|---|---|
| brief | `lb brief 1.07` | the files | `runs/briefs/01-07.md` |
| delta | `chapter-writer` agent | the brief only | `books/01/deltas/07.jsonl`, until `lb delta 1.07` passes |
| prose | `chapter-writer` agent | the brief, its delta | `books/01/chapters/07.md` (`status: draft`), then a `quote` on each delta entry |
| check | `prose-checker` and `continuity-checker` agents, at the same time | paths only | findings (JSON) |
| revise | `reviser` agent | the brief, the chapter, the findings | only the flagged spans, and the staged delta. Then check again; at most 3 rounds |
| approve | the user for chapter 1 of book 1 (`lb approve chapter-1`), else `lb commit 1.07` after a clean check | – | `status: approved`, the delta appended to `ledger.jsonl` |
| memory | `memory-writer` agent | the approved chapter | `books/01/memory/07.md` |
| git | the skill | – | one commit: `Book 1, chapter 7: <title>` |

The main session only coordinates. It never holds the prose, so it stays small for a whole book. All subagents use the session model.

### The record

- The writer makes the delta **before** the prose. `lb delta` rejects an illegal change before any prose depends on it. The prose must agree with the delta.
- A delta is **staged** in `books/NN/deltas/MM.jsonl` until the chapter is approved. Then `lb commit` appends it to `ledger.jsonl`, and it never changes again. A later correction is a barrier entry, and only `replan` adds one, with the user's approval.
- The fold starts from the `start` values in `schema.yaml`, replays the ledger, then the staged deltas. `lb fold 1.07` is the state at the end of chapter 7, `1.07.0` at its start, `1.07.3` after its third entry.
- `lb delta` errors: an unknown entity, field, fact or ladder step; an operation that the field kind does not have; a counter change larger than `max_step` or against `direction` in one chapter (unless the chapter plan has the exception `record.max-step` or `record.direction`); a day that goes back; an item removed that is not there; a delta for a chapter whose earlier chapters are not committed; a target of an anchor in this chapter that the fold at the chapter end does not meet. Warnings: a value clamped to `min`/`max`; an item added that is already there; the end day differs from the plan's `day`.
- When the chapter file exists, each entry needs a `quote` that is in the prose. The entries must be in the order of their quotes.
- A new entity comes in with a `create` entry. It does not change `schema.yaml`.

### Claims

The `continuity-checker` agent reads the chapter and the schema, **not the fold**, and writes every claim that the prose makes: `{line, quote, entity, field, value}`. `lb claims 1.07 <claims.json>` compares each claim with the fold after the entries whose quote is on or before that line. A number, a ladder step, an item, a belief or a day that does not agree is an error. A location or a text value that is not the same words is a warning, and the agent decides if it is the same place. The agent also checks the chapter against its plan: the job, the threads, the arc beat and the ending type. Status windows are written by the writer from the fold; each value in a window is a claim.

### Context brief

`lb brief 1.07` writes one file with: the prose decisions and the window template; the chapter plan and the next 2 plans; the schema fields, the facts and the entity IDs; the fold at the chapter start for the entities in the plan, and the POV character's beliefs; the targets of this chapter's anchors; the voice cards of the characters in the chapter; the three voice samples; the rolling memory (the last 3 chapters in full, the `summary` of older ones); the phrase log of the book; the threads that are open or that this chapter moves; the last ~300 words of the previous chapter. When the brief is longer than `brief_chars` in `project.yaml` (default 60,000), it first drops the oldest summaries, then the next plans.

### Checkpoints and replan

- `chapter-1` is chapter 1 of book 1 only. Its approval commits the delta. Every other chapter is approved when its check passes.
- A replan starts when `verify-chapter` ends with an open error about the plan that a span revision cannot fix; when `lb commit` reports that a later target cannot be reached from the fold; or when the user asks. It changes only chapter plans that are not written yet, `threads.yaml`, `targets.yaml`, anchors and open decisions (locked ones only when the user says so). It always stops for the user.

### Runs

`generate-book` repeats the chapter steps. `lb run` works out the stage of each chapter from the files (`planned → briefed → drafted → verified → approved → remembered → done`), writes `runs/book-NN.json`, and names the next step. After a usage-limit stop, the next run continues from there. The run stops at a checkpoint that is on, at a replan, and when a chapter still has an open error after 3 rounds (in autopilot, see "Workflow and checkpoints"). Open warnings go into the report at the end. `runs/` is committed with the novel.

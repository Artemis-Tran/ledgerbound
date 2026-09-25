# Ledgerbound design

This is the approved design for phase 1. The terms come from [`CONTEXT.md`](../CONTEXT.md). The exact file formats, with examples, are in [`reference/formats.md`](../reference/formats.md). The zod schemas in `src/schemas.ts` are the source of truth for the formats.

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
| 5 | `voice-sample` | `voice-sample.md`, window template in `bible.md` | `voice-sample` |
| phase 2 | `generate-chapter`, `verify-chapter`, `replan`, … | chapters, memory, ledger | `chapter-1`, `replan` |

- A series plans the series level and every book at book level. Only the next book to write gets act, chapter and scene plans.
- Each checkpoint is `on` by default. `mode: just-write-it` switches all of them off except `replan`.
- Only `lb approve` sets `status: approved`. It refuses when the validator finds errors.
- A skill starts with `lb gate <upstream checkpoint>`. The gate passes when the upstream files are valid and approved, or valid and the checkpoint is off.

## The record

- The validator reads only YAML frontmatter and YAML files. Markdown bodies are notes for the model.
- Timeline, location and knowledge are built in. The author-defined schema has four field kinds: `counter`, `ladder`, `collection`, `text`.
- Targets attach to plan anchors (`b1/act1/end`, `b1/end`, `series/end`, or a custom `b1/<slug>`). A chapter plan maps an anchor to a chapter.
- Phase 2 adds `ledger.jsonl`, the fold, `lb delta`, `lb claims` and `lb brief`.

## Verification

- `lb lint` is deterministic. It returns JSON findings with a rule ID, a severity and a line. It exits 1 on any error that the chapter plan does not waive.
- `check-prose` runs in the `prose-checker` agent, which did not write the text. It runs `lb lint`, then judges the rules that a script cannot check.
- `lb rules` lists the rule IDs, their guideline section and which check owns each one.

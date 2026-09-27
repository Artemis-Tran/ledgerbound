# ledgerbound

A Claude Code plugin that plans and writes LitRPG / progression-fantasy novels (chapters, books, series) with consistent story state and prose that does not read like AI. It runs on a Claude subscription through Claude Code. Everything is plain files in git.

- Terms: [`CONTEXT.md`](CONTEXT.md)
- Design: [`docs/design.md`](docs/design.md), decisions in [`docs/adr/`](docs/adr/)
- File formats: [`reference/formats.md`](reference/formats.md), worked example in [`examples/tiny-standalone/`](examples/tiny-standalone/)
- Writing rules: [`guidelines/writing.md`](guidelines/writing.md) (`lb init` copies it into each novel repo)

## Install (once)

Needs Node 22.18 or later.

```sh
cd ~/projects/ledgerbound
npm install
npm link            # puts `lb` on your PATH
```

In Claude Code:

```
/plugin marketplace add ~/projects/ledgerbound
/plugin install ledgerbound@ledgerbound-local
```

## Start a novel

```sh
mkdir ~/novels/my-story && cd ~/novels/my-story && git init
claude
```

Then run `/ledgerbound:start-project` followed by what you have (plot, style, POV, characters, setting, stat system). With only a one- or two-sentence idea, run `/ledgerbound:develop-idea <idea>` instead: it offers three premises, develops the one you pick into `pitch.md`, and hands over to `start-project`.

At any time, two commands tell you where you are:

- `lb status`: the checkpoints, and the next step.
- `lb run`: during generation, the stage of each chapter of the current book, and the next step.

Each skill tells you the next skill when it ends. When you are not sure, run `lb status`.

## Workflow

The workflow has two phases. **Planning** makes the plan and the voice, and you approve each part. **Generation** writes the chapters from that plan, one at a time and in sequence, and checks each one.

### Phase 1: planning

| Step | Skill | What it does | Files | Checkpoint |
|---|---|---|---|---|
| 0 (optional) | `develop-idea <idea>` | Offers 3 premises from a short idea. You choose or mix. | `pitch.md` | – |
| 1 | `start-project` | Asks only what is missing, offers options, and records each decision as `locked` (you chose) or `open` (the system chose). Writes the draws, and sets `windows`. | `bible.md`, `schema.yaml`, `facts.yaml`, `project.yaml` | `bible` |
| 2 | `plan-series` | Plans from the end: the series, then each book, with ending states, promises, questions, handoffs, and targets for the record. | `series.md`, `books/NN/plan.md`, `targets.yaml` | `series-plan`, `book-plan` |
| 3 | `plan-arcs` | Want, need, lie, voice card and arc beats for each main character. | `characters/*.md` | `character-arcs` |
| 4 | `plan-book` | A job, threads, arc beats, an ending type and scenes for each chapter of the next book. | `books/NN/plan/MM.md`, `threads.yaml` | `chapter-plans` |
| 5 | `voice-sample` | Three ~500-word scenes (dialogue, action, quiet), checked by `check-prose`. They become the reference for all prose. | `voice/*.md`, the window template in `bible.md` | `voice-sample` |

**Draws.** The draws are what a reader chooses the story for (`gives`: "time loop with significant variation", "a magic academy with real focus on the academy") and what the story promises not to have (`excludes`: "zero romance"). They are in `bible.md`. `develop-idea` gives each premise its draws, and `reference/draws.md` lists common ones. Each book plan names the `gives` draws that it delivers. The writer gets every exclusion in the brief, and the prose checker gives an error when a chapter breaks one.

**Windows.** `windows: off` in `project.yaml` is for progression fantasy with no visible System. There are then no status windows: the prose shows each gain, and the record still tracks the numbers. `start-project` sets it from the draws and the stat system.

At each checkpoint, the skill shows you a summary and asks you to approve it or to change it. Only your approval runs `lb approve <checkpoint>`.

### Phase 2: generation

Start phase 2 when `lb status` shows every phase-1 checkpoint as cleared. Then run one of these:

- `/ledgerbound:generate-chapter`: writes the next chapter, then stops. Use this for the first chapters, while you learn how the system writes.
- `/ledgerbound:generate-book`: writes every chapter that is not done, in sequence, and stops only when it needs you.

Both skills do the same steps for each chapter. `lb run` finds the stage of each chapter from its files, and the skill does the step for that stage:

| Stage | Step | Who | Result |
|---|---|---|---|
| `planned` | **Brief** | `lb brief 1.07` | `runs/briefs/01-07.md`: the only input of the writer (see below) |
| `briefed` | **Write** | `chapter-writer` agent | First the delta `books/01/deltas/07.jsonl`, which `lb delta` must accept. Then the prose `books/01/chapters/07.md`. Then a quote from the prose on each delta entry. Then `lb lint` until clean. |
| `drafted` | **Verify** | `verify-chapter`: `prose-checker` and `continuity-checker` agents at the same time, then the `reviser` agent | Findings in `runs/verify/01-07.json`. The reviser changes only the flagged spans. A maximum of 3 rounds. |
| `verified` | **Approve** | `lb commit 1.07` (for chapter 1.01: you, then `lb approve chapter-1`) | The delta goes into `ledger.jsonl`, and the chapter gets `status: approved` |
| `approved` | **Remember** | `memory-writer` agent | `books/01/memory/07.md`: summary, changes, open questions, ending type, phrase log |
| `remembered` | **Git** | the skill | One commit: `Book 1, chapter 7: <title>` |
| `done` | – | – | The next chapter starts |
| `blocked` | **Stop** (in autopilot: see "Autopilot" below) | the skill | The chapter still has an open error after its last verify round |

**What each part does:**

- **The delta comes before the prose.** The writer first decides what changes in the record in this chapter: levels, ranks, items, locations, beliefs, the day. `lb delta` rejects an illegal change before any prose depends on it. Illegal changes include a gain larger than `max_step`, a rank that goes down, an item that is not there, and a day that goes back. `lb delta` also rejects a delta that does not meet the targets of this chapter. Then the prose must show each change.
- **The context brief** gives the writer everything it needs, and nothing more. It contains the prose decisions and the window template, this chapter's plan and the next 2 plans, and the record (the fold) at the chapter start. It also contains this chapter's targets, the voice cards, the three voice samples, the rolling memory, the phrase log of used images and gestures, the open threads, and the last ~300 words of the previous chapter. The writer never reads the old chapters.
- **The two checkers did not write the chapter.** `prose-checker` runs `lb lint` and judges the writing guidelines. `continuity-checker` reads every claim from the prose (a number, an item, a place, the day, what a character knows) *without* the record. Then `lb claims` compares each claim with the fold at that line. It also checks the plan: the job, the scenes, the threads, the arc beat and the ending.
- **The reviser changes only the flagged spans.** A full rewrite brings in new tics. When the record is what is wrong, the reviser changes the staged delta instead.
- **Commit.** Until the commit, the delta is *staged* and can change. After the commit it is in `ledger.jsonl` and never changes. Chapters are committed in sequence.
- **Rolling memory** is written by an agent that did not write the chapter, from the chapter as it is on the page. Later chapters read these files, never the old prose.

### Where the run stops for you

| Stop | Why | What you do | In autopilot |
|---|---|---|---|
| `chapter-1` checkpoint | Chapter 1.01 is the first time that the voice runs at full length. | Read `books/01/chapters/01.md`. Approve it, or say what to change: the reviser changes it, and it is verified again. | No stop. |
| `blocked` | A chapter still has an open error after 3 rounds. | The skill shows the errors. Say how to fix them, or accept a replan when they are about the plan. | No stop: a replan and one more round, or a commit with the open errors. |
| **REPLAN NEEDED** | After a commit, a later target can no longer be reached (for example, Ivo is already past the rank that a target expects). | The `replan` skill proposes changes. You approve them. | No stop, unless the replan must change a `locked` decision or a draw. |
| `replan` from the writer or the reviser | The chapter cannot do its plan inside the rules of the record. | The same as above. | The same as above. |
| A record error | `lb delta` or `lb commit` has an error that the reviser cannot fix. The record must stay legal. | Say how to fix the delta or the plan. | Stop. This stop is in every mode. |

After a stop, or after a usage limit or a closed session, run `/ledgerbound:generate-book` again. It continues from the first stage that is not done, because all of its state is in the files.

### Replan

`/ledgerbound:replan` changes the part of the plan that is not written yet: chapter plans, `threads.yaml`, `targets.yaml`, anchors and open decisions. It changes a locked decision only when you say so. It never changes an approved chapter or the ledger. When the record is wrong about a written chapter, the replan adds a `Correction:` entry at the start of the next chapter's delta. A replan waits for your approval, also in `just-write-it` mode. Only `autopilot` mode lets it decide alone. You can also run it when you want to change the direction of the story.

### A series

`plan-book` plans the chapters of one book at a time. When `generate-book` completes book 1, it reports the open questions (the handoff). Then run `plan-book` for book 2, and generate book 2 in the same way. The ledger continues across the books.

### Checkpoints and modes

Each checkpoint is `on` by default. Switch a checkpoint off in `project.yaml` (`checkpoints: { chapter-1: off }`), or set a mode:

| `mode` | Stops for you at |
|---|---|
| `normal` | each checkpoint that is on, each replan, each `blocked` chapter |
| `just-write-it` | each replan, each `blocked` chapter |
| `autopilot` | only a change to a `locked` decision or a draw, and a record error that the reviser cannot fix |

A checkpoint that is off does not stop the workflow, but the validator still must pass.

### Autopilot

Set `mode: autopilot` in `project.yaml`. Autopilot switches off every checkpoint, also `chapter-1` and `replan`. It makes your decisions for you, and writes each one in `runs/autopilot.md` (the chapter, the cause, the choice, and a before → after line for each change):

- A replan selects the option that keeps the most of the approved plan, changes only `open` decisions, and runs `lb approve replan` itself. When each option changes a `locked` decision or a draw, the run stops and asks you.
- A chapter that is `blocked` after 3 rounds:
  - When an open error is about the plan (`plan.*`): an automatic replan, then one more verify round (round 4). The verify file `runs/verify/NN-MM.json` gets `"extra_round": true`. This occurs one time for each chapter.
  - Otherwise: the verify file gets `"accepted": true`. `lb run` then shows the chapter as `verified` ("open errors accepted"), and `lb commit` commits it with its lint errors.

`lb run` shows the chapters with accepted errors on the line `Accepted open errors: 07 (2), ...` (chapter and number of errors). At the end of the book, the report lists these chapters with their errors (read these first), and each replan in one line.

Use autopilot after the first chapters show that the voice and the plan work. For example, write chapter 1.01 in `normal` mode, then set `mode: autopilot` and run `/ledgerbound:generate-book`.

### Useful commands during generation

| Command | Shows |
|---|---|
| `lb run` | The stage of each chapter, the next step, and the chapters with accepted open errors. |
| `lb fold 1.07 --entity ivo` | Ivo at the end of chapter 7. Use `1.07.0` for the start of the chapter, and `1.07.3` for the state after its third entry. |
| `lb delta 1.07` | The staged delta of chapter 7, with its errors. |
| `lb lint books/01/chapters/07.md` | The deterministic prose checks. |
| `lb validate` | Every file and reference, and the ledger. |

### A novel repo made before version 0.5.0

The workflow continues without draws: `lb validate` gives only the warning `no-draws`. To add them:

1. Add `draws:` to the `bible.md` frontmatter (see `reference/formats.md` and `examples/tiny-standalone/bible.md`): at least 3, with at least 1 `excludes`.
2. Add `draws: [ids]` to each `books/NN/plan.md`, so that each `gives` draw is in a book plan.
3. Run `lb validate`, and fix each error. The files stay approved.

### A novel repo made before version 0.4.0

`lb` is linked to this folder, so it is already up to date. After you update the plugin (see "Update the plugin" below):

1. Run `lb validate` in the novel repo, and fix any error that it reports.
2. When a character knows a fact at the start of the story, add it to that character's `start` in `schema.yaml`: `beliefs: { father-debt: knows }`. Without it, the fold says `unaware`, and a target that expects `knows` fails.
3. `CLAUDE.md` and `guidelines/writing.md` in the novel repo are copies from `lb init`. You can copy the new `templates/CLAUDE.md` over the old `CLAUDE.md` (replace `{{TITLE}}`), but the workflow does not need it.
4. Run `lb status`. When phase 1 is complete, it names the first generation step.

## Update the plugin

After a change to the skills or agents, the version in `.claude-plugin/plugin.json` goes up. Then, in Claude Code:

```
/plugin marketplace update ledgerbound-local
/plugin            → ledgerbound → update
```

Restart Claude Code after the update.

## The CLI

```
lb init [dir] --title T [--format series|standalone]
lb status | validate | gate <cp> | approve <cp> | lint <file...> | rules | where
lb run | brief <point> | delta <point> | fold [point] | claims <point> <file> | commit <point>
```

A point is `book.chapter`, for example `1.07`. `lb --help` has the details. Every check exits non-zero on failure, so the skills use it as a gate.

## Development

```sh
npm test            # vitest
npm run typecheck
```

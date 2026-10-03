# ledgerbound

A Claude Code plugin that plans and writes LitRPG / progression-fantasy novels (chapters, books, series) with consistent story state and prose that does not read like AI. It runs on a Claude subscription through Claude Code. Everything is plain files in git.

- Terms: [`CONTEXT.md`](CONTEXT.md)
- Design: [`docs/design.md`](docs/design.md), decisions in [`docs/adr/`](docs/adr/)
- File formats: [`reference/formats.md`](reference/formats.md), worked examples in [`examples/tiny-standalone/`](examples/tiny-standalone/) and, for a series whose book 1 was written without Ledgerbound, [`examples/tiny-imported/`](examples/tiny-imported/)
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

When you already wrote book 1 of the series without Ledgerbound, run `/ledgerbound:import-book` instead. It splits your manuscript (Markdown or plain text) into chapters with `lb import`, reads the book, and makes the story bible, the schema, the rolling memory, the lore and the characters from it. Book 1 stays as you wrote it: the tool plans and writes book 2 and later, in your voice, from where book 1 ends.

At any time, two commands tell you where you are:

- `lb status`: the checkpoints, and the next step.
- `lb run`: during generation, the stage of each chapter of the current book, and the next step.

Each skill tells you the next skill when it ends. When you are not sure, run `lb status`.

## Workflow

The workflow has three phases. **Planning** makes the plan and the voice, and you approve each part. **Generation** writes the chapters from that plan, one at a time and in sequence, and checks each one. **Publishing** makes a complete book into an EPUB for the stores.

### Phase 1: planning

| Step | Skill | What it does | Files | Checkpoint |
|---|---|---|---|---|
| 0 (optional) | `develop-idea <idea>` | Offers 3 premises from a short idea. You choose or mix. When none fits, it asks you what to include and exclude, one question at a time, and offers 3 new premises. | `pitch.md` | – |
| 1 | `start-project` | Asks only what is missing, offers options, and records each decision as `locked` (you chose) or `open` (the system chose). Writes the draws, and sets `windows`. | `bible.md`, `schema.yaml`, `facts.yaml`, `project.yaml` | `bible` |
| 2 | `plan-world` | Plans the world with you, one area at a time: places, factions, history, customs, laws, creatures, and how the System works in the world. One lore entry per thing. The writer gets the entries that each chapter needs, and the continuity checker finds prose that contradicts one. | `lore/*.md` | `world` |
| 3 | `plan-series` | Plans from the end: the series, then each book, with ending states, promises, questions, handoffs, and targets for the record. | `series.md`, `books/NN/plan.md`, `targets.yaml` | `series-plan`, `book-plan` |
| 4 | `plan-arcs` | Want, need, lie and arc beats for each main character, and for each character a voice card and who they are at the start of the story. For each pair of main characters who share scenes, a relationship file: what each wants from the other, the friction, how they talk together, and the stages where they come closer or move apart. A romance also gets its obstacle and how much the prose shows. A relationship value that changes goes into the record. | `characters/*.md`, `relationships/*.md` | `character-arcs` |
| 5 | `plan-book` | A job, threads, arc beats, relationship stages, an ending type, the cast and scenes for each chapter of the next book, and a few bonding chapters where the characters rest together. A new character who comes back gets a character file. | `books/NN/plan/MM.md`, `threads.yaml` | `chapter-plans` |
| 6 | `voice-sample` | Three ~500-word scenes (dialogue, action, quiet), checked by `check-prose`. They become the reference for all prose. | `voice/*.md`, the window template in `bible.md` | `voice-sample` |

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
| `approved` | **Remember** | `memory-writer` agent | `books/01/memory/07.md`: summary, changes, open questions, ending type, the characters on the page, phrase log. New setting details go into the lore entries, and new details about a character into its file. A character who speaks or comes back gets a file. |
| `remembered` | **Git** | the skill | One commit: `Book 1, chapter 7: <title>` |
| `done` | – | – | The next chapter starts |
| `blocked` | **Stop** (in autopilot: see "Autopilot" below) | the skill | The chapter still has an open error after its last verify round |

**What each part does:**

- **The delta comes before the prose.** The writer first decides what changes in the record in this chapter: levels, ranks, items, locations, beliefs, the day. `lb delta` rejects an illegal change before any prose depends on it. Illegal changes include a gain larger than `max_step`, a rank that goes down, an item that is not there, and a day that goes back. `lb delta` also rejects a delta that does not meet the targets of this chapter. Then the prose must show each change.
- **The context brief** gives the writer everything it needs, and nothing more. It contains the prose decisions and the window template, this chapter's plan and the next 2 plans, and the record (the fold) at the chapter start. It also contains this chapter's targets, the lore and the cast of the chapter (who each character is, its want, need, lie, wound and contradiction, its arc beats so far, its voice card with its voice states, what changed, and when it was last seen), each relationship between two characters of the cast (with its stages so far), one line for each other lore entry and character, the three voice samples, the rolling memory, the ending types and the recent gestures of the cast from the phrase log (the prose checker compares each chapter with the whole log), the open threads, and the last ~300 words of the previous chapter. The writer never reads the old chapters.
- **The two checkers did not write the chapter.** `prose-checker` runs `lb lint` and judges the writing guidelines. It also compares each scene with the voice sample of its kind (`voice.match`), and `lb lint` finds a phrase copied from a sample, or one of the 20 names that AI fiction overuses (`names.ai-default`). `continuity-checker` reads every claim from the prose (a number, an item, a place, the day, what a character knows) *without* the record. Then `lb claims` compares each claim with the fold at that line. It also checks the plan: the job, the scenes, the threads, the arc beat, the relationship stage and the ending. And it compares the chapter with each lore entry and character that it names (`lb lore`, `lb who`) or that the brief has (`continuity.lore`, `continuity.character`).
- **The reviser changes only the flagged spans.** A full rewrite brings in new tics. When the record is what is wrong, the reviser changes the staged delta instead.
- **Commit.** Until the commit, the delta is *staged* and can change. After the commit it is in `ledger.jsonl` and never changes. Chapters are committed in sequence.
- **Rolling memory** is written by an agent that did not write the chapter, from the chapter as it is on the page. Later chapters read these files, never the old prose.
- **New lore.** When a chapter adds a setting detail that no lore entry has, the memory writer lists it in `lore_added` and writes it into its entry (a new entry when none fits). The entry stays approved: the approved chapter is the source. When the chapter changes the world (a roof comes down, a law ends), the fact goes into the entry's `changes`, from that chapter: the chapters before it still get the old world, and the chapters after it get the new one. Later briefs give the detail to the writer, and the continuity checker compares later chapters with it.
- **Side characters.** Each chapter plan lists its cast in `characters`. The memory writer records who is on the page (`appeared`) and writes each new detail about a character into its file. When a new character speaks, or comes back in a second chapter, the memory writer makes its file from the page, with a voice card from its dialogue. The brief then gives the writer who the character is and when the reader last saw them.

### Where the run stops for you

| Stop | Why | What you do | In autopilot |
|---|---|---|---|
| `chapter-1` checkpoint | Chapter 1.01 (or 2.01 after an imported book 1) is the first time that the voice runs at full length. | Read `books/01/chapters/01.md`. Approve it, or say what to change: the reviser changes it, and it is verified again. | No stop. |
| `blocked` | A chapter still has an open error after 3 rounds. | The skill shows the errors. Say how to fix them, or accept a replan when they are about the plan. | No stop: a replan and one more round, or a commit with the open errors. |
| **REPLAN NEEDED** | After a commit, a later target can no longer be reached (for example, Ivo is already past the rank that a target expects). | The `replan` skill proposes changes. You approve them. | No stop, unless the replan must change a `locked` decision or a draw. |
| `replan` from the writer or the reviser | The chapter cannot do its plan inside the rules of the record. | The same as above. | The same as above. |
| A record error | `lb delta` or `lb commit` has an error that the reviser cannot fix. The record must stay legal. | Say how to fix the delta or the plan. | Stop. This stop is in every mode. |

After a stop, or after a usage limit or a closed session, run `/ledgerbound:generate-book` again. It continues from the first stage that is not done, because all of its state is in the files.

### Replan

`/ledgerbound:replan` changes the part of the plan that is not written yet: chapter plans, `threads.yaml`, `targets.yaml`, anchors and open decisions. It changes a locked decision only when you say so. It never changes an approved chapter or the ledger. When the record is wrong about a written chapter, the replan adds a `Correction:` entry at the start of the next chapter's delta. A replan waits for your approval, also in `just-write-it` mode. Only `autopilot` mode lets it decide alone. You can also run it when you want to change the direction of the story.

### Revise an approved chapter

`/ledgerbound:revise-chapter` changes the prose of an approved chapter: for rules that you name (from `lb rules`), for your own notes, or both. The prose checker finds the spans (or a whole flat scene, which the reviser rewrites with the same plan, events and quotes), the reviser fixes them, and both checkers check the changed lines, for at most 3 rounds. The ledger does not change: each committed quote stays in the prose, word for word, and `lb validate` gives `ledger-quote-not-found` when one is gone. The memory writer then writes the chapter's rolling memory again. Run it once for each chapter of a range, in order.

### A series

`plan-book` plans the chapters of one book at a time. When `generate-book` completes book 1, it reports the open questions (the handoff). Then run `plan-book` for book 2, and generate book 2 in the same way. The ledger continues across the books.

### Phase 3: publishing

When a book is complete, run `/ledgerbound:publish-book`. It makes the book ready for a store:

1. It asks for what only you know: the author name, the ISBN (optional), the cover image, and your words for the personal pages (dedication, about the author, other books, newsletter).
2. It drafts the **blurb** (the store description) and up to 7 **keywords** from the bible, the draws and the book plan. You approve them.
3. It writes the **publish file** `books/NN/publish.yaml` and the **front and back pages** in `books/NN/pages/`: the copyright page, your pages, and for book 2 or later a **previously page** made from the rolling memory and the fold.
4. It runs `lb export`, which writes `exports/NN-<title>.epub`. When `epubcheck` is installed, it runs it too: the stores use the same check.

`lb export` needs every planned chapter approved. For an EPUB to read or share before the book is done, ask for a draft: `lb export --draft` exports the chapters that exist, and marks the title `(draft)`.

The EPUB is EPUB 3, with an EPUB 2 table of contents for older readers. It has curly quotes, the status windows as boxes in a monospace font, the series metadata, and a stable identifier (from the ISBN, or else from the author and title). You still upload the cover and fill in the store form yourself. See `reference/publishing.md` for what the stores need.

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
| `lb lore books/01/chapters/07.md` | The lore entries that a chapter names, as they are at the start of the chapter. |
| `lb lore old-gallery --at 1.07` | One lore entry as it is at the start of chapter 7: without the changes of later chapters. |
| `lb who books/01/chapters/07.md` | The characters that a chapter names, as they are at the start of the chapter. |
| `lb who hale --at 1.07` | One character at the start of chapter 7: who it is, its arc so far, its voice card, its record and when it was last seen. |
| `lb validate` | Every file and reference, and the ledger. |

### A novel repo made before version 0.24.0

Sections 5, 6 and 9 of `guidelines/writing.md` now ask for feeling on the page. Turn length follows the moment, so a turn under strong feeling can be longer and less tidy (`dialogue.speeches`). The new rules are:
- `emotion.felt`: the POV character's reaction at each turn that matters.
- `dialogue.delivery`: how a line is said.
- `dialogue.quip-chain`: no long runs of one-line quips.
- `dialogue.natural`: speech is less tidy than narration.
- `dialogue.plain-talk`: banter only between characters whose voice card or relationship asks for it. The dialogue sample's speech pattern belongs to its pair.

The voice samples set the minimum closeness to the POV character, not the maximum. The dialogue voice sample must show the felt reaction, the delivery and a longer turn: rewrite it when it is a chain of quips, and get the user's approval. `lb validate` now also checks that each committed quote of an approved chapter is still in its prose. `lb claims` checks an approved chapter against its committed entries, so the continuity checker can check a revision. Nothing in the ledger changes. To get the new text, copy `guidelines/writing.md` over your copy. To bring old chapters to the new rules, use `revise-chapter`.

### A novel repo made before version 0.16.0

Section 11 of `guidelines/writing.md` is now "11. Clear by default". It replaces "11. Clarity" and its 7 `clarity.*` rules, which made the reviser change pronouns to names and state the subtext. The 2 `plain.*` rules that the prose checker judges are: plain words and one main idea per sentence (`plain.words`), and at most one new term in a sentence and two in a paragraph (`plain.terms`). They are defaults: when the `prose-style` decision in `bible.md` asks for richer prose, or a scene needs it, they give way. Section 10 is as before 0.15.0: the voice samples win over the guidelines.

Section 3 has two new lint rules, `rhythm.clause-chains` (a sentence with 2 or more clauses joined by ", and" / ", but" / ", so") and `rhythm.commas` (more than 4 commas in one sentence). Both give a `warn`. The new section "12. Grammar" has 4 `grammar.*` rules that the prose checker judges (comma splices and run-ons, fragments, conjunctions that show the relation, commas).

Nothing in the ledger changes. To get the new text, copy `guidelines/writing.md` over your copy. A plan `exceptions` list with a `clarity.*` rule now fails `lb validate`: remove the rule from the list.

### A novel repo made before version 0.15.0

`guidelines/writing.md` has a new section, "11. Clarity", with 7 `clarity.*` rules that the prose checker judges (a reader can tell who, where and what; a new term is glossed; a pronoun has one clear antecedent; reasoning shows its steps). They are defaults: a finding is a `warn`, and an `error` only when a reader would lose the thread. Nothing in the ledger changes. To get the section, copy `guidelines/writing.md` over your copy, or add section 11 by hand.


### A novel repo made before version 0.13.0

The character files can now have a body, `aliases` and `changes`, and the chapter plans a `characters` list. The workflow continues without them: `lb validate` gives only the warning `character-empty`. To add them, write 2–5 sentences of who each character is under the frontmatter of `characters/<id>.md`, and add `characters: [ids]` to each chapter plan that is not written yet. The brief also includes each character that a plan names. The duplicate-name error is now `duplicate-name` (it was `lore-duplicate-name`), and it also finds a lore entry and a character with the same name.

### A novel repo made before version 0.12.0

`lb lint` and `lb validate` now reject the 20 names that AI fiction overuses (Elara, Kael, Lyra, Thorne, Voss and more: `guidelines/writing.md` §4, Names, in this repo). When your story uses one of them, `lb validate` names each planning file that has it (`name-ai-default`), and `lb lint` each chapter (`names.ai-default`). Rename the character, place or thing in the planning files first, and then in the chapters that are not approved yet. For approved chapters, run `replan`, or change the name in the prose and in the ledger yourself. To get the new section in your copy of the guidelines, copy `guidelines/writing.md` over it, or add the Names paragraph by hand.

### A novel repo made before version 0.10.0

The new `world` checkpoint comes after `bible`, and it needs at least one lore entry, so `lb status` names `plan-world`. Run `/ledgerbound:plan-world`: it writes the entries from the bible, and you approve them. The chapters that are not written yet get the entries in their briefs. The approved chapters and the ledger do not change. Add `world: on` under `checkpoints` in `project.yaml` if you want it in the list; a checkpoint that is not in the list is on.

### A novel repo made before version 0.8.0

`guidelines/writing.md` in the novel repo is a copy from `lb init`, so it has no section "9. Voice". The prose checker still judges `voice.match` from `lb rules`, but it checks better with the full text. When you did not change your copy, copy the new `guidelines/writing.md` over it. When you did, add section 9 by hand.

`lb lint` now also compares each chapter with the voice samples. An approved chapter can get new `repetition.*` findings. They do not change the ledger or a commit that is done.

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
lb import <manuscript> [--book N] [--heading REGEX] [--dry-run]
lb status | validate | gate <cp> | approve <cp> | lint <file...> | lore <file>|<id> --at <point> | who <file>|<id> --at <point> | rules | where
lb run | brief <point> | delta <point> | fold [point] | claims <point> <file> | commit <point>
lb export [--book N] [--draft] [--out FILE]
```

A point is `book.chapter`, for example `1.07`. `lb --help` has the details. Every check exits non-zero on failure, so the skills use it as a gate.

## Development

```sh
npm test            # vitest
npm run typecheck
```

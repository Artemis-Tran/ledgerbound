# Ledgerbound design

This is the approved design for phase 1 (planning) and phase 2 (generation). The terms come from [`CONTEXT.md`](../CONTEXT.md). The exact file formats, with examples, are in [`reference/formats.md`](../reference/formats.md). The zod schemas in `src/schemas.ts` are the source of truth for the formats.

## Two kinds of repo

- **This repo** is the tool: a Claude Code plugin (skills, one agent) and the `lb` CLI. See [ADR 0001](adr/0001-tool-repo-separate-from-novel-repos.md).
- **A novel repo** holds one story (a series or a standalone book). `lb init` makes it.

## Workflow and checkpoints

| Step | Skill | Writes | Checkpoint |
|---|---|---|---|
| 0 (optional) | `import-book`, in place of steps 0 and 1 when book 1 is already written | `books/01/chapters/*.md`, `books/01/memory/*.md`, `books/01/plan.md`, `bible.md`, `schema.yaml`, `facts.yaml`, `project.yaml`, `lore/*.md`, `characters/*.md` (see "Imported books") | `bible` |
| 0 (optional) | `develop-idea` | `pitch.md` from the seed, via 3 premises (when none fits: an align step on what to include and exclude, then 3 new premises) | – (choosing a premise is the approval) |
| 1 | `start-project` | `bible.md`, `schema.yaml`, `facts.yaml`, `project.yaml` | `bible` |
| 2 | `plan-world` | `lore/*.md`: places, factions, history, customs, laws, creatures, and the System in the world | `world` |
| 3 | `plan-series` | `series.md`, `books/NN/plan.md` (book level, every book), `targets.yaml` | `series-plan` (series only), `book-plan` |
| 4 | `plan-arcs` | `characters/*.md`, `relationships/*.md` | `character-arcs` |
| 5 | `plan-book` | `books/NN/plan/MM.md`, `threads.yaml`, anchors | `chapter-plans` |
| 6 | `voice-sample` | `voice/dialogue.md`, `voice/action.md`, `voice/quiet.md`, window template in `bible.md` | `voice-sample` |
| 7 | `generate-chapter`, `verify-chapter` (or `generate-book` for all of them) | `books/NN/deltas/MM.jsonl`, `books/NN/chapters/MM.md`, `books/NN/memory/MM.md`, `ledger.jsonl` | `chapter-1` |
| 8 | `publish-book` | `books/NN/publish.yaml`, `books/NN/pages/*.md`, then `exports/NN-<title>.epub` through `lb export` | – (the user approves the pages in the skill) |
| any time | `replan` | chapter plans not written yet, `threads.yaml`, `targets.yaml`, lore entries, open decisions | `replan` (on in every mode except `autopilot`) |

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
- Each book plan has a `climax` (2 or more chapters in the last act, from the anchor `bN/climax-start` to `bN/climax`, where the protagonist decides it) and a `tension` range. Each chapter plan has a `tension` level inside the range and `stakes`, and each scene has a `result` (`win`, `loss`, `mixed`). `lb validate` checks the range, that the climax spans 2 or more chapters and its decisive chapter has the highest tension, and the curve: no flat run of 4, a drop after the peak, a rise from act to act, and at least one scene that is not a win in each act. §13 of the guidelines says how each level reads.
- A chapter plan with `bonding: true` is a bonding chapter. `lb validate` gives a warning (the rules `bonding.*`, which an exception can waive) when it is above the book's lowest tension, when its act already has one or the chapter before is one, when it is in the climax or in the chapter just before it, and when no relationship file is between two characters of its cast. `prose-checker` judges `bonding.shift`.

## Relationships

- A relationship file (`relationships/<id>.md`, from `plan-arcs`) is between two characters with character files, and at least one of them is a protagonist or main character. There is one file for each pair. `lb validate` warns (`relationship-missing`) when two main characters are together in the cast of 2 or more chapters and have no file.
- Its stages work like arc beats: each one has a book and an act, and in a book with chapter plans, one chapter of that act lists it in `stages` (errors `stage-unplaced`, `stage-twice`, `stage-wrong-act`). Both characters are in the cast of that chapter (warning `stage-cast`). A relationship with no stages (`relationship-static`), or with 3 or more stages that are all `closer` (`relationship-flat`), gets a warning.
- A romance also needs `obstacle` and `on_page`. The skills keep a romance out of a story whose draws exclude it, and `prose-checker` judges `draws.excluded` on the page.
- The record still tracks a relationship value that changes (trust, a debt) as a field, with targets. The relationship file tells the writer how the two are together.

## Imported books

An author can write book 2 and later books with Ledgerbound when book 1 was written without it. Book 1 is then an **imported book**: its prose is canon, and the tool does not plan, write or check it. See [ADR 0003](adr/0003-record-starts-after-imported-book.md).

- `lb import <manuscript> --book 1` splits a Markdown or plain-text manuscript at its chapter headings into `books/01/chapters/MM.md`, with `status: approved` and `source: imported`. The manuscript is the source, so no check runs and no user approval is needed. The author converts a `.docx` or `.epub` file to Markdown first. Only a book before the first planned book can be imported.
  - In Markdown, the chapters are the headings of the highest level that the manuscript uses 2 or more times, so a single `# Title` above the chapters is not one. In plain text, a chapter starts at a short line of its own that starts with "Chapter", "Prologue", "Epilogue" or "Interlude". `--heading <regex>` replaces both rules. The chapters are numbered in order from 1, whatever the headings say; the title is the heading without "Chapter 3:".
  - The text before the first heading is not imported. The prose is written as it is: only the line ends and 3 or more blank lines change.
  - Warnings: words before the first heading, a chapter under 300 words, and a gap in the chapter numbers of the headings. Each one can mean a wrong split, so the skill runs `--dry-run` first and shows the list to the author.
  - It refuses a book with chapter plans, a book after a planned book, a book with chapter files already, and a book plan without `imported: true`. With no book plan yet, it writes the chapters and says to write the plan next.
- The `import-book` skill is the intake of an imported project. The main session never reads the whole book. It runs `lb import`, then one `book-reader` agent for each range of about 25,000 words, all at the same time: each one writes notes in `runs/import/` (the chapters, the style with quotes, the characters, the setting, the System and the last status windows, the secrets, the state at the end, the open questions, the draws). From the notes, it writes the story bible, the lint profile, the schema, the facts and the book 1 plan. What book 1 shows is `locked`: the author chose it when they wrote the book. Only what book 1 leaves free is `open`. Then the `memory-writer` agent runs on each chapter in order, and the rolling memory, the lore entries and the character files come from the prose, as for a generated chapter; for an imported chapter, it takes the record changes from the prose, because the folds give the state at the end of the book. The skill sets the lore entries and the character files to `draft`, so that `plan-world` and `plan-arcs` add to them and the author approves them at their checkpoints. It ends with the `bible` checkpoint. Each step skips the work that exists, so an import that stops continues.
- The record starts after the imported book: the `start` values in `schema.yaml`, and the beliefs in `start`, are the state at the end of book 1. When book 1 has status windows, the skill reads each value from the last window of each character. The author approves the values at the `bible` checkpoint.
- `books/01/plan.md` has `imported: true` and the four level fields, written from what book 1 is. It has no acts, `tension`, `climax` or `draws`. Its `handoff` is the input of book 2. `lb validate` does not check an imported book for the tension curve, the climax, the draws it delivers, its targets, or the placement of arc beats and stages. A project with only imported books does not check the delivery of the draws: its first planned book is not there yet. Only the books before the first planned book can be imported (`imported-order`), and an imported book has no chapter plans (`imported-planned`). `lb import` refuses a book that has chapter plans.
- The record starts after the imported book, so a target (`target-imported`) or a ledger entry (`ledger-imported`) in it is an error. The chapter count for `max_step` reachability starts at the first planned book.
- An arc beat or a stage in an imported book is history: the brief of each later chapter gives it, as for any earlier book. Its `act` names a part of the book in any words; no chapter places it, and the validator does not check the act.
- A point in an imported book is valid: a thread can have its plant or a beat in book 1, and a lore change or a character change can be from a point in book 1. The agreement of `threads.yaml` and the chapter plans applies only to chapters with plans.
- The voice samples come from book 1: `plan-arcs` and `plan-book` run as usual for book 2, then `voice-sample` selects three passages of the kinds `dialogue`, `action` and `quiet`, with `source: <point>`, in place of writing them. `lb lint` gives only warnings for a sample from an imported book. The `repetition.*` rules still compare each new chapter with the samples, so a new chapter does not copy the author's phrases.
- The author's own style has priority over `guidelines/writing.md`: the `prose-style` decision is `locked`, and `import-book` offers `lint` overrides in `project.yaml` for each rule that book 1 breaks often.
- An **import project** has a book plan with `imported: true` or a chapter with `source: imported`. While its `bible` checkpoint is not cleared, `lb status` names `import-book`. Then the steps come in this order: `plan-world` (it adds to the entries from the memory), `plan-series` (book 1 stays as it is; the books after it get plans), `plan-arcs`, `plan-book` for book 2, `voice-sample`, then generation. The current book is the first planned book, and the `chapter-1` checkpoint is its chapter 1 (2.01): the first chapter that the tool writes. `publish-book` and `lb export` do not require an imported book; the previously page of book 2 uses its rolling memory.

## Verification

- `lb lint` is deterministic. It returns JSON findings with a rule ID, a severity and a line. It exits 1 on any error that the chapter plan does not waive.
- `check-prose` runs in the `prose-checker` agent, which did not write the text. It runs `lb lint`, then judges the rules that a script cannot check.
- The voice samples are the fixed reference for the voice. `lb lint` compares a chapter with the other chapters of its book and with the voice samples, so a phrase copied from a sample is a `repetition.*` finding. `prose-checker` judges `voice.match`: each scene against the sample of its kind, never against the previous chapter, so drift cannot add up over a book.
- `lb rules` lists the rule IDs, their guideline section and which check owns each one.

## Phase 3: publishing

- The `publish-book` skill writes the publish file `books/NN/publish.yaml` and the front and back pages in `books/NN/pages/`, then runs `lb export`. It asks the user for what only they know (author, ISBN, cover, personal pages), drafts the blurb and the keywords for their approval, and writes personal pages only from the user's words.
- `lb export` builds EPUB 3 with no dependency: `node:zlib` gives deflate and CRC-32 for the zip, and the Markdown subset of the prose becomes XHTML (curly quotes; status windows as monospace boxes). It adds an EPUB 2 `toc.ncx` and a stable identifier (`urn:isbn:` or a UUID from the author, title and book). The same input gives the same XHTML; only `dcterms:modified` changes (`SOURCE_DATE_EPOCH` fixes it).
- A publishable export needs every planned chapter `approved`. `--draft` exports the chapters that exist, for reading. `lb validate` checks the publish file: each listed page exists, the cover exists, the ISBN check digit.

## Phase 2: generation

### One chapter

| Step | Who | Reads | Writes |
|---|---|---|---|
| brief | `lb brief 1.07` | the files | `runs/briefs/01-07.md` |
| delta | `chapter-writer` agent | the brief only | `books/01/deltas/07.jsonl`, until `lb delta 1.07` passes |
| prose | `chapter-writer` agent | the brief, its delta | `books/01/chapters/07.md` (`status: draft`), then a `quote` on each delta entry |
| check | `prose-checker` and `continuity-checker` agents, at the same time | paths only | findings (JSON) |
| revise | `reviser` agent | the brief, the chapter, the findings | only the flagged spans, and the staged delta. Then check again; at most 3 rounds |
| approve | the user for chapter 1 of the first planned book (`lb approve chapter-1`), else `lb commit 1.07` after a clean check | – | `status: approved`, the delta appended to `ledger.jsonl` |
| memory | `memory-writer` agent | the approved chapter | `books/01/memory/07.md`, and the new setting details in `lore/*.md` |
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

A plan, a chapter or a brief names a lore entry when it uses its ID (with spaces), its title or an alias: any case, with or without a leading article, singular or plural (`src/entries.ts`). A lore entry holds the world at the start of the story, and its `changes` hold how it changes, each from a point or plan anchor. The brief, `lb lore <file>` and `lb lore <id> --at <point>` give an entry as it is at the start of a chapter, so the writer and the checker never see a later state of the world. `lb lore <file>` lists the entries that a chapter names; the continuity checker compares the chapter with those entries and with the ones in the brief. When a chapter contradicts an entry, the memory writer leaves the entry as it is and reports a warning.

When a chapter adds a setting detail that no lore entry has, the memory writer lists it in `lore_added` and writes it into its entry (a new entry when none fits). When the chapter changes the world, the fact is a lore change from that chapter (`change: true`), and `lb validate` gives `lore-change-missing` when the entry does not have it. The entry keeps its status: the approved chapter is the source. `lb validate` gives `lore-unknown` when a `lore_added` entry has no file.

A character file works the same way as a lore entry, through the same code: a name (its ID, its name, an alias, or a capitalized part of its name in that case) finds it, its body is who the character is at the start of the story, its `appearance` is how the character looks then, in parts, and its `changes` hold how the character changes. A change can replace parts of the appearance from its point, so the brief gives the appearance as it is at the chapter, and the continuity checker tests the prose against that. A fact about how a character looks goes into its part through `character_added` with a `part`. A chapter plan lists its cast in `characters`, and the brief also includes each character that the plan names. The memory writer lists the characters on the page in `appeared`, and each new detail about a character in `character_added`, which it writes into the character file. When a character with no file speaks, or is on the page a second time, the memory writer writes its file from the approved chapter: the voice card from its dialogue, the body from what the page shows. The file is `approved`, because the approved chapter is its source. `lb validate` warns (`character-no-file`) when a character is in `appeared` of two chapters and has no file. A named person who is on the page one time and does not speak is a fact in the lore entry of its place. A relationship value that changes is a record field; how two characters are together is a relationship file.

`lb brief 1.07` writes one file with: the prose decisions and the window template; the chapter plan and the next 2 plans; the act of the chapter (promise, question, ending state), the book's promise and climax, which part of the climax the chapter is, and the chapter's tension level and stakes; the schema fields, the facts and the entity IDs; the fold at the chapter start for the entities in the plan, and the POV character's beliefs; the targets of this chapter's anchors; the lore entries that the plan lists or names, and each `always` entry, in full, with their lore changes before this chapter; a lore index with one line for each other entry; the cast (each character that the plan lists or names, the POV character and each one that a target names): the body, the want, need, lie, wound and contradiction, the arc beats up to this chapter, the voice card, the changes before this chapter (a change can change the voice) and the chapter where it was last seen; each relationship between two characters of the cast, with its stages up to this chapter and where the two stand at its start; a note when the chapter is a bonding chapter; a cast index with one line for each other character; the three voice samples; the rolling memory (the last 3 chapters in full, the `summary` of older ones in this book, and for each earlier book the `ending_state` and `handoff` of its plan in place of the summaries of its chapters); from the phrase log of the book, the ending types and the gestures of the cast in the last 5 chapters (the prose checker compares the chapter with the whole log, from `lb phrases`); the threads that are open or that this chapter moves; the last ~300 words of the previous chapter. When the brief is longer than `brief_chars` in `project.yaml` (default 60,000), it first drops the oldest summaries, then the next plans, then shortens the lore index and the cast index to names and IDs, then drops the lore entries that the plan only names, then the relationships and the characters that the plan only names.

### Checkpoints and replan

- `chapter-1` is chapter 1 of the first planned book only: 1.01, or 2.01 after an imported book 1. Its approval commits the delta. Every other chapter is approved when its check passes.
- A replan starts when `verify-chapter` ends with an open error about the plan that a span revision cannot fix; when `lb commit` reports that a later target cannot be reached from the fold; or when the user asks. It changes only chapter plans that are not written yet, `threads.yaml`, `targets.yaml`, anchors and open decisions (locked ones only when the user says so). It always stops for the user.

### Runs

`generate-book` repeats the chapter steps. `lb run` works out the stage of each chapter from the files (`planned → briefed → drafted → verified → approved → remembered → done`), writes `runs/book-NN.json`, and names the next step. After a usage-limit stop, the next run continues from there. The run stops at a checkpoint that is on, at a replan, and when a chapter still has an open error after 3 rounds (in autopilot, see "Workflow and checkpoints"). Open warnings go into the report at the end. `runs/` is committed with the novel.

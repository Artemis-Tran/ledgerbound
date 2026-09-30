---
name: import-book
description: Intake for a series whose book 1 the author already wrote without Ledgerbound - splits the manuscript into chapters, reads it, and makes the story bible, schema, facts, rolling memory, lore, characters and the book-1 plan from it, so that the tool writes book 2 and later. Use when the user has a written or published book to continue, or `lb status` names import-book.
---

# import-book

Book 1 becomes an **imported book**: its prose is canon, and the tool does not plan, write or check it. What book 1 shows is `locked`: the author chose it when they wrote the book. The record starts after book 1: the `start` values in `schema.yaml` are the state at its end (ADR 0003 in the ledgerbound folder, `lb where`). File formats: `${CLAUDE_PLUGIN_ROOT}/reference/formats.md`; worked example: `${CLAUDE_PLUGIN_ROOT}/examples/tiny-imported/`.

The main session coordinates and never reads the whole book: the `book-reader` agents read it in ranges, and the `memory-writer` agent reads one chapter at a time.

Each step checks the files first and skips the work that exists, so the skill continues an import that stopped.

## Steps

1. **Repo.** If there is no `project.yaml`, run `lb init . --title "<series title>" --format series`. If `lb` is not found, tell the user to run `npm link` once in the Ledgerbound repo.

2. **Manuscript.** Ask for the manuscript of book 1 as a Markdown or plain-text file. For a `.docx` or `.epub` file, offer to convert it with pandoc (`pandoc book-1.docx -t gfm --wrap=none -o book-1.md`), then show the user the first 40 lines of the result: a converted file can keep front pages, footnotes or backslash escapes that the user removes before the split.
   Done when the user confirms the file.

3. **Split.** Skip when `books/01/chapters/` has chapter files. Run `lb import <file> --dry-run`. Show the user the list of chapters (file, words, heading) and every warning, and ask if each chapter of the book is there once. When a heading is wrong, run it again with `--heading '<regex>'`, or ask the user to fix the heading in the file. Then run `lb import <file>`.
   Done when each chapter of book 1 is a file in `books/01/chapters/` and the user agrees with the list.

4. **Read.** Skip the ranges that have notes in `runs/import/`. Split the chapters into ranges of about 25,000 words (the words from step 3), and start one `ledgerbound:book-reader` agent per range with the range, all at the same time. Then read every notes file.
   Done when each chapter is in exactly one notes file.

5. **Bible.** Write `bible.md`, the way `start-project` does (`${CLAUDE_PLUGIN_ROOT}/skills/start-project/SKILL.md`, steps 3–7 and 10), with the notes as the user's material:
   - each decision that book 1 shows is `locked`, in the book's own terms, with `reason: shown in book 1`. `prose-style` comes from the notes' `## Style`, with its quotes as the examples;
   - each gap is a decision that book 1 leaves open, for the books after it. Ask about all the gaps in one round, and in the same round ask what the user already knows about book 2 and the end of the series. Put their answer into `plot` in their words, marked `locked`;
   - the draws come from the notes' `## Draws`. A draw is `locked` when the user confirms it in the same round;
   - `chapter_words`: the median length of the chapters of book 1. `windows`: `on` when a notes file says `windows: true`, and the window format of book 1 becomes the window template in the voice-sample step.
   Done when each required decision is set, and each `locked` decision is something the notes quote or the user said.

6. **Lint profile.** Run `lb lint --json` on the chapters of book 1 and count the findings per rule. The author's style wins over the general rules: for each rule that book 1 breaks in most chapters, tell the user the rule and one example, and offer the override that `project.yaml` has for it (`banned_remove` for a word, `max_em_dash_per_1000` for dashes). Record each rule that stays in force and that book 1 breaks, in the `prose-style` decision, so the checkers and the user know that the new books follow it.
   Done when the user decided on each rule that book 1 breaks in most chapters.

7. **Schema and facts.** Write `schema.yaml` from the `stat-system` decision, the way `start-project` step 8 does, with one change: the `start` values of each entity are the state at the **end of book 1**, from the last status window of each character in the notes (or the notes' `## State at the end`), and each character's `beliefs` are what they believe at the end of book 1. When the notes do not fix a value that the schema tracks, ask the user. Write `facts.yaml` from the notes' `## Secrets`: each secret that a character believes or does not know at the end of book 1, and each one that book 2 can turn on.
   Done when each main character is an entity with a `start` value for each tracked field.

8. **Book 1 plan.** Write `books/01/plan.md` with `status: draft`, `book: 1`, `title`, `imported: true` and the four level fields, from the notes: `ending_state` is where the characters stand at the end of book 1; `promise`, what book 1 delivers; `question`, what it raises and what it answers; `handoff`, each question in `## Open` of the last notes file that book 2 takes up. It has no acts, draws, anchors, tension or climax.
   Done when `lb validate` reports no error for `books/01/plan.md`.

9. **Memory.** For each chapter of book 1 in order, skip it when its memory file exists, else start the `ledgerbound:memory-writer` agent with its point (`1.01`, then `1.02`) and wait for it: each chapter reads the memory of the chapter before it, and writes into the same lore and character files. Keep its `warnings` for the summary in step 11.
   Done when each chapter of book 1 has its file in `books/01/memory/`, and `lb validate` reports no error in `books/01/memory/`, `lore/` or `characters/`.

10. **Drafts.** Set `status: draft` in each file in `lore/` and `characters/`: the memory writer made them from book 1, and `plan-world` and `plan-arcs` now add to them, so the user approves them at the `world` and `character-arcs` checkpoints.

11. **Bible checkpoint.** Run the checkpoint loop in `${CLAUDE_PLUGIN_ROOT}/reference/checkpoint-loop.md` for `bible`. In the summary, give the number of chapters and the files made, the `start` values (the state at the end of book 1), and the memory writer's warnings: each one is a place where book 1 contradicts itself or a lore entry.

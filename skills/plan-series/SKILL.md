---
name: plan-series
description: Plan a LitRPG series or book from the end, top down - series ending, then every book at book level with its acts, then the progression targets. Use after the bible is approved, or when `lb status` names plan-series.
---

# plan-series

Plan **from the end**. Decide what is true at the end of the series first, then work backwards: the last book, the book before it, and so on. Inside each book, the last act first. File formats: `${CLAUDE_PLUGIN_ROOT}/reference/formats.md`.

## Steps

1. Run `lb gate world`. If it is BLOCKED, stop and tell the user why.

2. Read `bible.md`, `schema.yaml`, `facts.yaml` and the lore entries in `lore/`. The locked decisions are fixed. Open decisions can change if the plan needs it; tell the user when you change one. The `draws` are the contract with the reader: the plan delivers every `gives` draw, and nothing in it touches an `excludes` draw.

3. **Series level** (skip for a standalone book). Write `series.md`: the number of books, and the four level fields:
   - `ending_state`: what is true at the end: power, relationships, and what the protagonist believes;
   - `promise`: what the reader expects from the whole series; it delivers the `gives` draws;
   - `question`: what it raises and what it answers;
   - `handoff`: what stays open (often nothing, for the last level).

4. **Book level, every book, last book first.** Write `books/NN/plan.md` for each book with the same four fields, and 3 or 4 acts, each with the same four fields. Rules:
   - each book answers at least one main question in `question.answers`, so it feels complete;
   - each book before the last one has a `handoff` for the next book;
   - `draws`: the IDs of the `gives` draws that this book delivers. Every `gives` draw is in at least one book. A draw that lasts the whole story (a series-spanning mystery) is in each book that moves it;
   - each act's ending state is concrete enough to test: a rank, an item, a relationship, a belief. "Ivo grows" fails. "Ivo is copper, pays the tithe gladly, does not know about the debt" passes.
   Only the next book to write gets chapter plans later (plan-book). The other books stay at this level.

5. **Targets.** Turn every ending state into targets in `targets.yaml`: at least one target for each act end and each book end (`lb validate` warns when one is missing). Plan the **progression curve**: levels and ranks at each anchor, with ranges for counters. Check the pace against `max_step`: the gain between two anchors must fit in the chapters between them. Give each belief change from the plan a `knowledge` target, with the fact IDs from `facts.yaml`. Use `reset: true` only for a planned loss or reset, and say why in `note`.

6. Run **the checkpoint loop** in `${CLAUDE_PLUGIN_ROOT}/reference/checkpoint-loop.md`: for a series, first for `series-plan`, then for `book-plan`; for a standalone book, only for `book-plan`.

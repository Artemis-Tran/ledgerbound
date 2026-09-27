---
name: plan-book
description: Chapter and scene plans for the next LitRPG book to write - each chapter's job, threads, arc beats, ending type and scenes, plus threads.yaml. Use after the character arcs are approved, or when `lb status` names plan-book.
---

# plan-book

Only the next book to write gets chapter plans: for phase 1 that is book 1. File formats: `${CLAUDE_PLUGIN_ROOT}/reference/formats.md`.

## Steps

1. Run `lb gate character-arcs`. If it is BLOCKED, stop and tell the user why.

2. Read `bible.md` (with its `draws`), the lore entries in `lore/`, `books/NN/plan.md` for this book (with the draws it delivers), `targets.yaml`, `facts.yaml` and every `characters/*.md`.

3. **Chapter count and act ranges.** From `chapter_words` in `project.yaml` and the scope of the book plan, decide the number of chapters and which chapters each act gets. Write down the act ranges before any chapter.
   Give a chapter its own `words` when its scenes need a different length: a set-piece fight longer, a quiet turn shorter. Keep the total of the book near the number of chapters × `chapter_words`.

4. **Threads.** List every setup, mystery, subplot, promise and relationship that the book plan, the arcs and the facts need, in `threads.yaml`: each with a `plant`, the `beats` where it moves, and a `payoff` (a point in this book, or an anchor in a later book or `series/end` for a thread that the handoff carries on).

5. **Chapter plans**, `books/NN/plan/MM.md`, one per chapter. Each chapter has a **job**:
   - `job`: the value that shifts, and its state `from` → `to`. If nothing changes, the chapter has no reason to exist: merge it or give it a shift;
   - `arc_beats`: every arc beat of this book goes in exactly one chapter, inside its act;
   - `threads`: exactly the plants, beats and payoffs that `threads.yaml` puts in this chapter;
   - `ending`: a type, and a `hook` that is the concrete last beat (a fact, a line, an arrival, a number that changed). Vary the types: never the same type twice in a row, and at most one `cliffhanger` in any three chapters;
   - `anchors`: the act ends and custom anchors that fall at the end of this chapter;
   - `scenes`: each with `goal` → `conflict` → `outcome`. Let some outcomes be worse than the goal;
   - `day`: the in-story day;
   - `lore`: the IDs of the lore entries this chapter needs that its text does not name by title or alias (for example, a custom that shapes a scene). When the chapter brings in a place, creature or custom that has no entry, write one by step 5 of `${CLAUDE_PLUGIN_ROOT}/skills/plan-world/SKILL.md`, with `status: draft`. When the chapter changes the world (a place is destroyed, a law ends), add `{ from: <this chapter's point>, text: <how it is after> }` to the entry's `changes`;
   - `characters`: the ID of each character with a part in a scene, the POV character included. When the chapter brings in a character who comes back later or speaks, write `characters/<id>.md` with `status: draft`, `role: supporting`, a name by §4, Names, in `${CLAUDE_PLUGIN_ROOT}/guidelines/writing.md`, a voice card and a body by steps 5 and 6 of `${CLAUDE_PLUGIN_ROOT}/skills/plan-arcs/SKILL.md`. The chapter's delta then creates the entity with that ID;
   - `words`: only when this chapter's length differs from `chapter_words` (see step 3);
   - `exceptions`: only when the chapter breaks a guideline on purpose, once, for a clear effect, with the `reason`.

6. **Draws.** Each draw in the book plan's `draws` gets chapters where the reader gets it, on the page: name them in the summary. No scene, thread or job touches an `excludes` draw.

7. **Targets against the plan.** For each target at an anchor in this book, check that the chapters up to it show what produces it. The guidelines ask that power has a cost the reader saw: name the chapter where each rank or big gain is paid for. If a target cannot be earned in the chapters you have, change the plan or tell the user that the target must move.

8. Run **the checkpoint loop** in `${CLAUDE_PLUGIN_ROOT}/reference/checkpoint-loop.md` for `chapter-plans`. In the summary, give a one-line table: chapter, job (from → to), ending type. List each new lore entry and each new character too; when the user approves, also run `lb approve world` for the lore and `lb approve character-arcs` for the characters.

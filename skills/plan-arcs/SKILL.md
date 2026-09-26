---
name: plan-arcs
description: Character arcs and voice cards for a planned LitRPG story - want, need, lie, how each character speaks, and arc beats mapped to acts and books. Use after the book plans are approved, or when `lb status` names plan-arcs.
---

# plan-arcs

One file per character in `characters/<id>.md`, where `<id>` is the entity ID in `schema.yaml`. File formats: `${CLAUDE_PLUGIN_ROOT}/reference/formats.md`.

## Steps

1. Run `lb gate book-plan`. If it is BLOCKED, stop and tell the user why.

2. Read `bible.md`, `series.md` (if it exists), every `books/NN/plan.md` and `targets.yaml`. The arcs must end where the ending states and the knowledge targets say. The `draws` in `bible.md` shape the cast: a `gives` draw about people (a rival of equal skill, found family) needs characters and beats that deliver it, and no arc beat or want touches an `excludes` draw.

3. **Main characters** (the protagonist, and each character who changes across the story): write `role`, `want` (what they chase on the page), `need` (what would actually fix them), and `lie` (the false belief that keeps them from the need, stated as they would think it).

4. **Arc beats.** For each main character, map beats to acts: `{id, book, act, beat}`. The beats move the lie: it is held, tested, cracks, and is dropped or doubled down on. Give the protagonist a beat in every act of every book. Each beat is one event that a chapter can show, not a mood.

5. **Voice cards**, for every character who speaks on the page, supporting ones included:
   - `vocabulary`: where their words come from (trade, class, region), with examples;
   - `sentence_length`: and when it changes;
   - `verbal_habits`: one or two, used rarely;
   - `never_says`: words or subjects they avoid. These carry subtext.
   Then do the **tag test** on the cards: write one line for each main character about the same subject (for example, a late payment), and remove the tags. If two lines could belong to either speaker, the cards are too close. Sharpen them before you continue.

6. Run **the checkpoint loop** in `${CLAUDE_PLUGIN_ROOT}/reference/checkpoint-loop.md` for `character-arcs`. Show the tag-test lines to the user with the summary.

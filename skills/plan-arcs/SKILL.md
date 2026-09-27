---
name: plan-arcs
description: Character arcs and voice cards for a planned LitRPG story - want, need, lie, how each character speaks, and arc beats mapped to acts and books. Use after the book plans are approved, or when `lb status` names plan-arcs.
---

# plan-arcs

One file per character in `characters/<id>.md`, where `<id>` is the entity ID in `schema.yaml`. File formats: `${CLAUDE_PLUGIN_ROOT}/reference/formats.md`.

## Steps

1. Run `lb gate book-plan`. If it is BLOCKED, stop and tell the user why.

2. Read `bible.md`, `series.md` (if it exists), every `books/NN/plan.md` and `targets.yaml`. The arcs must end where the ending states and the knowledge targets say. The `draws` in `bible.md` shape the cast: a `gives` draw about people (a rival of equal skill, found family) needs characters and beats that deliver it, and no arc beat or want touches an `excludes` draw.

3. **Main characters** (the protagonist, and each character who changes across the story): give each new character a name from the setting, by §4, Names, in `${CLAUDE_PLUGIN_ROOT}/guidelines/writing.md`. Write `role`, `want` (what they chase on the page), `need` (what would actually fix them), and `lie` (the false belief that keeps them from the need, stated as they would think it).

4. **Arc beats.** For each main character, map beats to acts: `{id, book, act, beat}`. The beats move the lie: it is held, tested, cracks, and is dropped or doubled down on. Give the protagonist a beat in every act of every book. Each beat is one event that a chapter can show, not a mood.

5. **Voice cards**, for every character who speaks on the page, supporting ones included:
   - `vocabulary`: where their words come from (trade, class, region), with examples;
   - `sentence_length`: and when it changes;
   - `verbal_habits`: one or two, used rarely;
   - `never_says`: words or subjects they avoid. These carry subtext;
   - `humour`: how they joke or mock (dry, crude, cruel, gentle, puns), with a short example line, or that they do not joke and how they react to a joke. Give two main characters different kinds of humour.
   Then do the **tag test** on the cards: write one line for each main character about the same subject (for example, a late payment), and remove the tags. Then write one short back-and-forth of 4 lines for each pair of main characters who talk often, and name its tone. If two lines could belong to either speaker, or a reader could not name the tone, the cards are too close. Sharpen them before you continue.

6. **Who each character is**, for every character file: write the body, 2–5 sentences of what stays true at the start of the story: what they do, how they look, how they are related to the other characters. Add `aliases` for each other name that the story uses for them (a nickname, a title). Put each relationship that changes in the story (trust, a debt, a rivalry) into a record field in `schema.yaml` and its targets, so that the ledger tracks it. Put a planned change of the character (a lost eye, a new post) into `changes`, from its point or plan anchor.
   Done when every character file has a body, and `lb validate` reports no `character-empty` warning.

7. Run **the checkpoint loop** in `${CLAUDE_PLUGIN_ROOT}/reference/checkpoint-loop.md` for `character-arcs`. Show the tag-test lines to the user with the summary.

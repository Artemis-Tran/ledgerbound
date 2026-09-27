---
name: plan-world
description: World planning for a LitRPG story - lore entries for its places, factions, history, customs, laws, creatures, and how the System works in the world. Use after the story bible is approved, when `lb status` names plan-world, or when the user wants to add or change lore.
---

# plan-world

The output is a set of **lore entries**, one per file in `lore/<id>.md`. A chapter's brief gives the writer each entry that its plan lists or names, and the continuity checker gives an error when the prose contradicts one. The bible keeps the decisions; a lore entry keeps the detail that a writer must know. File formats: `${CLAUDE_PLUGIN_ROOT}/reference/formats.md`.

## Steps

1. Run `lb gate bible`. If it is BLOCKED, stop and tell the user why.

2. **Read** `bible.md` (the `setting`, `stat-system` and `plot` decisions, the draws and the notes), `schema.yaml`, `facts.yaml`, `pitch.md` when it exists, and each file in `lore/`. Keep what the existing entries say; change it only when the user asks.

3. **Inventory.** For each area, list the entries that the story needs: each place, faction and custom that the bible names, and each thing that the plot turns on.

   | Category | An entry answers |
   |---|---|
   | `place` | What a scene there looks, sounds and smells like; who controls it; how far it is from the other places. |
   | `faction` | Who is in it, what it wants, whom it answers to, and how people recognize a member. |
   | `history` | An event before chapter 1 that people still feel: when it happened, what most people believe about it. |
   | `custom` | Daily life: greetings, food, money, faith, festivals, taboos, the words people use for common things. |
   | `law` | What is forbidden or required, who enforces it, and the punishment. |
   | `creature` | What it is, where it lives, what it does, and how dangerous it is at each rank. |
   | `system` | Who sees the System, what people believe about it, and how society uses ranks and levels. The numbers stay in `schema.yaml`. |
   | `other` | Setting knowledge that fits no other category. |

   Done when each category has its list of entries, or one line that says why the story needs none.

4. **Questions.** Ask the user about the gaps in one round: for each entry that the material does not fill, give 2–3 concrete options, each with its trade-off in one line. Ask also what the world must include or leave out. When the user says "you decide", choose the option that best serves the bible and the draws, and name it in the summary at step 7.
   - A `gives` draw about the setting (a real academy, a living dungeon) gets the entries that make it concrete.
   - Keep each entry clear of every `excludes` draw.
   Done when each entry on the list has its content, or the user removed it.

5. **Entries.** Write `lore/<id>.md` for each entry, with `status: draft`:
   - `title`, and `category` from step 3. Name each place, faction and person in the setting's own language, by §4, Names, in `${CLAUDE_PLUGIN_ROOT}/guidelines/writing.md`;
   - `aliases`: the other names that plans and characters use for it (a short form, slang, a title). A brief and `lb lore` find an entry when a text uses one of its names: any case, with or without "the", singular or plural. So each name belongs to this thing only: "the harvest" is a good alias for harvest day, "the square" is not one for the counting house;
   - `always: true` only for a short rule that holds in every scene (for example, the one law every character lives under). Give it to at most three entries: each one is in every brief;
   - the body: one to three short paragraphs of concrete facts, in the setting's own words: names, numbers, distances, dates, who and how. Write what a writer must not contradict, in the present tense of the world.

   Write each entry as it is at the start of the story. A later change goes in `changes: [{from, text}]`, with `from` the point or plan anchor after which it is true: plan-book, replan and the memory writer add them, and each brief gives only the changes before its chapter. When a thing has a value that moves often and that the prose counts (a faction's favour, a town's garrison), it is an entity in `schema.yaml` too, and the record tracks the value; the entry keeps what it is. When the world hides a truth, the entry says what people believe, and the truth goes in `facts.yaml`.
   Done when each entry on the list has a file.

6. **Consistency.** Read all the entries together, with the bible. Each date, distance, rank and name has one value everywhere. Run `lb validate`: it gives an error when two entries share a name.
   Done when the entries agree with each other and with the bible.

7. Run **the checkpoint loop** in `${CLAUDE_PLUGIN_ROOT}/reference/checkpoint-loop.md` for `world`. In the summary, give one line per entry, grouped by category, and name each option that you chose for the user.

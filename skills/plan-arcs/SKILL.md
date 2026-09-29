---
name: plan-arcs
description: Character arcs, voice cards and relationships for a planned LitRPG story - want, need, lie, wound, contradiction, how each character speaks in each emotional state, arc beats mapped to acts and books, how the voice changes with the arc, and how the main characters are together (romance included) and how that changes. Use after the book plans are approved, or when `lb status` names plan-arcs.
---

# plan-arcs

One file per character in `characters/<id>.md`, where `<id>` is the entity ID in `schema.yaml`, and one file per relationship in `relationships/<id>.md`. File formats: `${CLAUDE_PLUGIN_ROOT}/reference/formats.md`.

## Steps

1. Run `lb gate book-plan`. If it is BLOCKED, stop and tell the user why.

2. Read `bible.md`, `series.md` (if it exists), every `books/NN/plan.md` and `targets.yaml`. The arcs must end where the ending states and the knowledge targets say. The `draws` in `bible.md` shape the cast: a `gives` draw about people (a rival of equal skill, found family) needs characters and beats that deliver it, and no arc beat or want touches an `excludes` draw.

3. **Main characters** (the protagonist, and each character who changes across the story): give each new character a name from the setting, by §4, Names, in `${CLAUDE_PLUGIN_ROOT}/guidelines/writing.md`. Write `role`, `want` (what they chase on the page), `need` (what would actually fix them), and `lie` (the false belief that keeps them from the need, stated as they would think it). Then:
   - `wound`: the one event before the story that made the lie feel true, in 1–2 sentences. Make it concrete: a place, an object, a person, an age. It gives the writer what the character avoids, so connect it to `never_says`. The prose never tells it.
   - `contradiction`: one trait that goes against the character's type, in one sentence, with a thing the reader can see ("exact about every token, but burns lamp oil by daylight"). Let the reader ask why.
   Keep the wound and the contradiction true to the knowledge in `facts.yaml`: they tell what the character lived, not a truth that they do not know.
   A **supporting** character who speaks in more than one chapter gets a `want` too: one line, what they chase in each scene.

4. **Arc beats.** For each main character, map beats to acts: `{id, book, act, beat}`. The beats move the lie: it is held, tested, cracks, and is dropped or doubled down on. Give the protagonist a beat in every act of every book. Each beat is one event that a chapter can show, not a mood.

5. **Voice cards**, for every character who speaks on the page, supporting ones included:
   - `vocabulary`: where their words come from (trade, class, region), with examples;
   - `sentence_length`: and when it changes;
   - `verbal_habits`: one or two, used rarely;
   - `never_says`: words or subjects they avoid. These carry subtext;
   - `humour`: how they joke or mock (dry, crude, cruel, gentle, puns), with a short example line, or that they do not joke and how they react to a joke. Give two main characters different kinds of humour;
   - `states`, for each main character: 2–4 emotional states that the plan puts them in (`angry`, `afraid`, `lying`, `close`, `grieving`). For each one, `speech`: what changes in their words and sentence length, and `tell`: one body tell. The state changes the card and keeps the character's own voice: an exact clerk who is afraid gets more exact, not loud. Give each state of a character a different change.
   Then do the **tag test** on the cards: write one line for each main character about the same subject (for example, a late payment), and remove the tags. Write the same line again for each main character in two of their states. Then write one short back-and-forth of 4 lines for each pair of main characters who talk often, and name its tone. If two lines could belong to either speaker, two states of one character sound the same, or a reader could not name the tone, the cards are too close. Sharpen them before you continue.

6. **Who each character is**, for every character file: write the body, 2–5 sentences of what stays true at the start of the story: what they do, and how they are related to the other characters.
   - **How they look**: write `appearance`. For a protagonist or main character, fill 5 or more parts (`age`, `build`, `face`, `eyes`, `hair`, `skin`, `marks`, `dress`, `carries`, `moves`), each one concrete and from the story's world: "a crew boss's shoulders from hauling rope", not "muscular". Let the work, the class and the wound show in the body and the clothes. Add 1–3 `signature` details, the ones a reader will know the character by. A supporting character gets the parts that a scene will show (2–3 is enough).
   - **How the looks change**: for each planned change to the body or the clothes (a scar from the climax, a rank mark, a lost hand, a better coat after a rank-up), add a change with `appearance` that sets the new text of each part, from its point or plan anchor: `{ from: b1/act3/end, text: The lamp burns his hand., appearance: { marks: "Split knuckles, and a burn across the right palm." } }`. Add `aliases` for each other name that the story uses for them (a nickname, a title). Put each relationship value that changes in the story and that a scene counts (trust, a debt, a rivalry's score) into a record field in `schema.yaml` and its targets, so that the ledger tracks it. How two characters are together goes into the relationship file of step 8. Put a planned change of the character (a lost eye, a new post) into `changes`, from its point or plan anchor.

7. **The voice follows the arc.** For each arc beat where the lie cracks or is dropped, add a change to `changes` from the end of that beat's act (`b1/act2/end`): what the character now says or stops saying, or which habit or state changes. For example: "She no longer corrects Ivo's numbers aloud. She corrects them in the margin." A character who doubles down gets a change too: the habit gets stronger. The change says what is different from the voice card, so that the brief of a later chapter gives the new voice.
   Done when every character file has a body, each main character has at least one voice change, and `lb validate` reports no `character-empty`, `character-depth` or `character-appearance` warning.

8. **Relationships.** Write `relationships/<a>-<b>.md` for each pair of main characters (the protagonist included) who share scenes in the book plans. A pair of a main character and a supporting character gets a file too when the relationship carries an arc beat of the main character (a mentor, a rival, a parent). Two supporting characters get none.
   - `wants`: for each of the two, what they want from the other, in one line. Make the two wants pull against each other at least once.
   - `friction`: the source of conflict between them, from the lies of both: where the lie of one hurts the other.
   - `hides`: what one hides from the other, from the facts in `facts.yaml` and the wounds. Leave it out when neither hides anything.
   - `talk` and `never_says`: take them from the 4-line back-and-forth of the tag test in step 5: the tone, the shared jokes or private words, and what the two never say to each other.
   - `stages`: the steps of the relationship, mapped to acts like arc beats: `{id, book, act, shift, beat, state}`. `beat` is one event that a chapter can show; `state` is where the two stand after it. Put them near the arc beats of the two: a stage often happens in the same event. Give a relationship a stage that pushes the two `apart` (a lie found out, a betrayal, a choice against the other), so that it can get worse as well as better. A relationship of many books gets stages in each book.
   - The body: 1–3 sentences on how the two know each other at the start of the story.
   **Romance.** A romance comes only from the user's material or a `gives` draw, and never from a story with an `excludes` draw against it. For a romance, set `romance: true`, and plan its stages on these beats: the two meet, one notices the attraction, the obstacle holds them back, a first closeness, a turn, a rupture (`apart`), and the choice. Write `obstacle`: why they are not together now, from the lies of both, so that the romance tests the arcs. Ask the user how much the prose shows, and write it in `on_page` in their words (for example "closed door: the scene cuts at the first kiss"). For a slow burn, put the choice in a later book or at `series/end`.
   Done when each pair of main characters who share scenes has a file, each file has a stage in each book where the two share scenes, and `lb validate` reports no `relationship-*` error or warning.

9. Run **the checkpoint loop** in `${CLAUDE_PLUGIN_ROOT}/reference/checkpoint-loop.md` for `character-arcs`. Show the tag-test lines, and each main character's wound, contradiction and voice changes, to the user with the summary. For each relationship, show its friction and one line per stage (`shift`: beat → state); for a romance, also its obstacle and `on_page`.

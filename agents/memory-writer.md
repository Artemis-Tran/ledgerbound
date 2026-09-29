---
name: memory-writer
description: Writes the rolling memory file of one approved Ledgerbound chapter - summary, changes, open questions, ending type, new lore, the characters on the page and phrase log - from the chapter as written, and adds the new details to the lore entries and the character files. Started by generate-chapter or generate-book with a point.
tools: Read, Write, Edit, Bash, Glob
---

You write the rolling memory of one chapter. Later chapters read this file in place of the prose, so it must say what is on the page, not what the plan wanted. You did not write the chapter.

The point (for example `1.07`) gives the paths, where NN is the book and MM the chapter, two digits each: the chapter `books/NN/chapters/MM.md`, the memory file `books/NN/memory/MM.md`. Format: `reference/formats.md` in the ledgerbound folder (`lb where` prints it); example: `examples/tiny-standalone/books/01/memory/01.md` in the same folder.

## Steps

1. Read the chapter, the memory file of the chapter before it (its `open_questions`), each lore entry in `lore/` and each character file in `characters/`. Run `lb who books/NN/chapters/MM.md` to see the characters that the chapter names as they are at its start. A change in an entry's `changes` is true only after the chapter of its `from` (`lb lore <id> --at <point>` prints the entry as it is at the start of this chapter). Run `lb fold <point>.0 --json` and `lb fold <point> --json` to see the record at the chapter start and end.

2. Write the memory file. Frontmatter only, no body:
   - `summary`: 3–5 sentences of facts: what happened, in order. No judgment of the prose, no themes.
   - `changed`: one short line for each change that matters later: a record change (from the two folds), a relationship, a promise, a wound.
   - `open_questions`: the questions a reader holds at the end. Keep the earlier ones that are still open, drop the ones that this chapter answers, add the new ones.
   - `ending_type`: how the chapter actually ends: `action`, `dialogue`, `reveal`, `decision`, `image`, `cliffhanger` or `quiet-cut`. The type is the kind of the last new thing (the hook). One short beat after it that only reacts to it (a look, a pause) keeps its type: a last line of dialogue with a look after it is `dialogue`.
   - `lore_added`: each setting detail that the chapter states and no lore entry has, and that agrees with every entry, as `{entry, fact}`: a name, a place, a custom, a law, how a creature or the System works. `entry` is the ID of the entry that it belongs to; `fact` is one sentence. When the chapter shows the world change (a law ends, a place burns, a faction splits), add `change: true`: the fact is then how the thing is after this chapter. A detail that is a record value (a level, an item, where a character is) goes in `changed`.
   - `appeared`: the entity ID of each character on the page, in person (not only named in talk). Take the IDs from `schema.yaml` and the `create` entries of the folds.
   - `character_added`: each detail about a character that the chapter states and its file does not have, and that agrees with the file, as `{character, fact}`: how they look, what they do, a relationship, a habit. For a fact about how they look, add `part`: the part of `appearance` it belongs to (`age`, `build`, `face`, `eyes`, `hair`, `skin`, `marks`, `dress`, `carries` or `moves`). When the chapter changes the character (a wound that stays, a new post, a new scar), add `change: true`. A detail that is a record value goes in `changed`.
   - `phrase_log`: every simile, every notable image, and each character's gestures in this chapter, as short exact phrases.
   Done when every simile and gesture of the chapter is in the phrase log, and each character on the page is in `appeared`.

3. **Lore.** Write each fact of `lore_added` into its entry:
   - an entry that exists: add the fact to its body, in one sentence in the words of the entry. Keep its `status`: the approved chapter is the source of the fact;
   - a `change: true` fact: add `{ from: <point>, text: <fact> }` at the end of the entry's `changes`, and keep the body as it is;
   - a new entry: write `lore/<entry>.md` with `status: approved`, a `title`, a `category` (`place`, `faction`, `history`, `custom`, `law`, `creature`, `system` or `other`), and the fact as its body.
   A change happens on the page; a contradiction is a detail that the entry had wrong from the start (the gallery is on the west side, not the east). When the chapter contradicts an entry, leave the entry as it is: put the contradiction in `warnings` of your result, with the line and the entry (for example `line 42 contradicts lore/harvest-day.md: the pits stay open`).
   Done when each fact is in the body or the `changes` of its entry.

4. **Characters.** Write each fact of `character_added` into its character file, the same as a lore fact: into the body in one sentence, or, for `change: true`, as `{ from: <point>, text: <fact> }` at the end of `changes`. A fact with a `part` goes into that part of `appearance` instead of the body: add it to the text of the part, or write the part when it is empty. For `change: true`, the change also gets `appearance: { <part>: <the new text of the whole part> }`. Then make a file for each character in `appeared` that has no file, when the character speaks in this chapter or is in `appeared` of an earlier chapter: `characters/<id>.md` with `status: approved`, `id`, `name` (from the fold), `role: supporting`, a `want` when the page shows what they chase, a `voice` card from how the character speaks on the page (`vocabulary`, `sentence_length`, `verbal_habits`, `never_says`; `[]` when the page does not show it; `humour` when the character jokes on the page; and a `states` entry for each emotional state in which the page shows how their speech changes), a body of 1–3 sentences of what the page shows about them, and an `appearance` with each part that the page shows. Put the facts about this character of this chapter into the body, not into `character_added`. A contradiction of a character file is a warning, the same as for a lore entry (for example `line 17 contradicts characters/hale.md: Hale is the keeper of the well`).
   Done when each fact is in the body or the `changes` of its file, and each character who speaks or comes back has a file.

5. Run `lb validate`. Fix each error in the memory file, the lore entries and the character files that you changed.
   Done when it reports no error for the file, and no `character-no-file` warning. An `ending-type` warning means the chapter ends differently from its plan: keep your value, and report it.

6. Return only this JSON:

```json
{ "point": "1.07", "file": "books/01/memory/07.md", "ending_type": "decision", "lore": ["lore/harvest-day.md"], "characters": ["characters/pell.md"], "warnings": [] }
```

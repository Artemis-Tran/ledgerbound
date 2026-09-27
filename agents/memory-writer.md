---
name: memory-writer
description: Writes the rolling memory file of one approved Ledgerbound chapter - summary, changes, open questions, ending type, new lore and phrase log - from the chapter as written, and adds the new setting details to the lore entries. Started by generate-chapter or generate-book with a point.
tools: Read, Write, Edit, Bash, Glob
---

You write the rolling memory of one chapter. Later chapters read this file in place of the prose, so it must say what is on the page, not what the plan wanted. You did not write the chapter.

The point (for example `1.07`) gives the paths, where NN is the book and MM the chapter, two digits each: the chapter `books/NN/chapters/MM.md`, the memory file `books/NN/memory/MM.md`. Format: `reference/formats.md` in the ledgerbound folder (`lb where` prints it); example: `examples/tiny-standalone/books/01/memory/01.md` in the same folder.

## Steps

1. Read the chapter, the memory file of the chapter before it (its `open_questions`), and each lore entry in `lore/`. Run `lb fold <point>.0 --json` and `lb fold <point> --json` to see the record at the chapter start and end.

2. Write the memory file. Frontmatter only, no body:
   - `summary`: 3–5 sentences of facts: what happened, in order. No judgment of the prose, no themes.
   - `changed`: one short line for each change that matters later: a record change (from the two folds), a relationship, a promise, a wound.
   - `open_questions`: the questions a reader holds at the end. Keep the earlier ones that are still open, drop the ones that this chapter answers, add the new ones.
   - `ending_type`: how the last paragraph actually ends: `action`, `dialogue`, `reveal`, `decision`, `image`, `cliffhanger` or `quiet-cut`.
   - `lore_added`: each setting detail that the chapter states and no lore entry has, as `{entry, fact}`: a name, a place, a custom, a law, how a creature or the System works. `entry` is the ID of the entry that it belongs to; `fact` is one sentence. A detail that is a record value (a level, an item, where a character is) goes in `changed`.
   - `phrase_log`: every simile, every notable image, and each character's gestures in this chapter, as short exact phrases.
   Done when every simile and gesture of the chapter is in the phrase log.

3. **Lore.** Write each fact of `lore_added` into its entry:
   - an entry that exists: add the fact to its body, in one sentence in the words of the entry. Keep its `status`: the approved chapter is the source of the fact;
   - a new entry: write `lore/<entry>.md` with `status: approved`, a `title`, a `category` (`place`, `faction`, `history`, `custom`, `law`, `creature`, `system` or `other`), and the fact as its body.
   Done when each fact is in the body of its entry.

4. Run `lb validate`. Fix each error in the memory file and in the lore entries that you changed.
   Done when it reports no error for the file. An `ending-type` warning means the chapter ends differently from its plan: keep your value, and report it.

5. Return only this JSON:

```json
{ "point": "1.07", "file": "books/01/memory/07.md", "ending_type": "decision", "lore": ["lore/harvest-day.md"], "warnings": [] }
```

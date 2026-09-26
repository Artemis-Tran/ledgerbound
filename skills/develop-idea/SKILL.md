---
name: develop-idea
description: Grow a one- or two-sentence LitRPG / progression-fantasy idea into three complete premises, then develop the one the user picks into pitch.md for start-project. Use when the user has only a short idea, or start-project finds the material too thin.
---

# develop-idea

The user's short idea is the **seed**. You offer three **premises**, each a complete story in one piece. The user picks or mixes, and you develop the result into the **pitch**: `pitch.md`, which `start-project` reads as the user's material.

## Steps

1. **Seed.** Copy the user's idea word for word. List what it fixes (for example: "debt collector", "dungeon city", "the System takes a cut"). Also list the draws that it names, `gives` or `excludes` (for example "time loop", "zero romance"). Every premise keeps all of these.

2. **Three premises.** Write three premises of 150–250 words each, in chat. Each one covers:
   - the protagonist: what they want, and the lie they believe;
   - the central conflict, and why it can drive the planned length (a series or one book);
   - the setting, with two or three of its own nouns;
   - the stat system and **what power costs** on the page;
   - the tone, and a prose style with POV and tense;
   - the series shape in one line (for example "3 books: rank-up, betrayal, war").

   Make the three differ on the big axes: the protagonist's relation to the System, the kind of cost, the scale of the setting, and the tone. A premise that only changes names or details is the same premise. Each premise needs an **engine**: a pressure that makes the protagonist act again in every book. End each premise with one line: `Gets: … / Costs: …`.

   Then give each premise its **draws**: 4–7 lines, each `gives:` or `excludes:`, at least one `excludes`, in the words that a reader uses in a blurb or a tag. `${CLAUDE_PLUGIN_ROOT}/reference/draws.md` lists common ones. The draws from the seed are in all three premises; the three premises differ in at least 2 `gives` draws.
   Done when each premise has every item above and its draws, and a reader could tell the three apart from their first sentence.

3. **Choose.** Ask the user to pick one, mix them ("A, but with the cost from C"), change any part, or say "you decide". For "you decide", pick the premise with the strongest engine and say why in one line.

4. **Develop** the result into `pitch.md` (800–1,500 words). Use this shape:

   ```markdown
   ---
   working_title: "…"
   format: series            # or standalone
   premise: "B, with the stat-system cost from C"
   ---

   ## Seed
   > the user's words, unchanged

   ## Draws
   - gives: Time loop with significant variation (yours)
   - excludes: Zero romance (yours)

   ## Plot
   - The Guild sells…  (chosen)

   ## Characters
   ## Setting
   ## Stat system
   ## Themes
   ## Tone
   ## Prose style, POV and tense
   ## Series shape

   ## Other premises
   One line each for the premises not chosen.
   ```

   `## Draws` holds the draws of the result, each with its kind. The other sections match the story-bible decisions. Each bullet ends with its origin mark:
   - `(yours)`: from the seed or from a change the user asked for;
   - `(chosen)`: part of the premise the user picked;
   - `(filled)`: a detail you added while you developed it.

   Keep `(filled)` items concrete but light: they are proposals, and intake marks them `open`. Write nothing that a later plan must follow: no chapter list, no book outlines beyond the series shape.

5. **Repo.** If there is no `project.yaml`, run `lb init . --title "<working title>" --format <series|standalone>`.

6. Show the user the path to `pitch.md` and the `(filled)` items. Then start the `start-project` skill. It reads `pitch.md` as the user's material and asks only about the gaps that are left.

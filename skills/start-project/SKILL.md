---
name: start-project
description: Intake for a new LitRPG / progression-fantasy novel or series. Turns what the user has (plot, style, POV, characters, setting, stat system, or a pitch.md) into a story bible, schema and facts. Use when the user starts a new story, or `lb status` names start-project.
---

# start-project

The output is a **story bible**: the draws and every story decision, each marked `locked` (the user chose it) or `open` (you chose it and can change it later), plus the `schema.yaml` and `facts.yaml` that the record uses. File formats: `${CLAUDE_PLUGIN_ROOT}/reference/formats.md`.

## Steps

1. **Repo.** If there is no `project.yaml`, run `lb init . --title "<title>" --format series` (use `--format standalone` only when the user says standalone; with a `pitch.md`, take the title and format from its frontmatter). If `lb` is not found, tell the user to run `npm link` once in the Ledgerbound repo.

2. **Thin material.** If there is no `pitch.md` and the user's material fixes fewer than three of the eight required decisions (a one- or two-sentence idea, for example), offer the `develop-idea` skill first: it gives three complete premises that fit together, where this skill would ask about each gap on its own. If the user says yes, start `develop-idea` and stop here; it comes back to this skill. If they say no, continue.

3. **Harvest.** Read everything the user gave you, and `pitch.md` if it exists. Map it to the eight required decisions: `plot`, `prose-style`, `pov-tense`, `characters`, `setting`, `stat-system`, `themes`, `tone`. Add more decisions when the material has them (for example `magic-cost`, `system-origin`). What the user stated is `locked`, in their words, tightened but not changed. From `pitch.md`:
   - items marked `(yours)` or `(chosen)` are `locked`;
   - items marked `(filled)` are `open`, with `reason: filled in by develop-idea`;
   - the "Other premises" go into `options_considered` of the decisions they differ on;
   - the `## Draws` items become the draws (step 5), with the same marks.

4. **Fill the gaps.** For each decision that is missing or too thin to plan with, give 2–3 concrete options, each with its trade-off in one line. Ask about all the gaps in one round. When the user picks one, it is `locked`. When they say "you decide", pick the option that best serves the rest of the bible, mark it `open`, and write a one-line `reason`. Keep the rejected options in `options_considered`. Give each character you name a name from the setting's own language and class, by §4, Names, in `${CLAUDE_PLUGIN_ROOT}/guidelines/writing.md`: `lb validate` gives `name-ai-default` for the 20 names that AI fiction overuses. When the user's material has one of the 20, tell them, and offer 2–3 names from the setting in the same round as the gaps.
   Done when each required decision has a value specific enough that two writers would plan the same book from it. "Hard magic" fails that bar. "Levels 1–30, the well keeps a third of each level until harvest" passes.

5. **Draws.** Write `draws:` in the `bible.md` frontmatter: each `{id, kind: gives|excludes, text, status}`, in the words a reader uses. Take them from `pitch.md` or the user's material; a draw the user named is `locked`. Add draws that the bible makes clear (a detailed stat system, an academy setting), marked `open`, with `${CLAUDE_PLUGIN_ROOT}/reference/draws.md` as the list of common ones. Ask the user about exclusions in the same round as the gaps when the material names none: "Anything readers of this story must never get? For example, romance or a harem."
   Done when there are at least 3 draws and at least 1 is `excludes`, and every draw is concrete enough to test in a scene.

6. **Chapter length.** Set `chapter_words` in `project.yaml`. Take it from the user's material or `pitch.md` when they give one. Otherwise ask in the same round as the gaps, with these options: 2,000 (short, fast serial updates), 3,000 (the default, common for web serials), 4,000–5,000 (fewer chapters, more room per scene).

7. **Windows.** Set `windows` in `project.yaml`: `off` when a draw or the `stat-system` decision says that progression shows without status windows (for example "non-LitRPG progression"); `on` when the story has a visible System. When neither makes it clear, ask the user in the same round as the gaps.

8. **Stat system → schema.** Turn the `stat-system` decision into `schema.yaml`:
   - one `kind: character` type for people, with the tracked fields: `ladder` for ranks and tiers, `counter` for levels and resources (set `min`, `max`, and a `max_step` per chapter that fits the planned pace), `collection` for skills and inventory;
   - other types only for things whose state changes on the page (a guild, a dungeon, a relic);
   - an entity for each main character, with `start` values for book 1.
   With `windows: off`, the schema still tracks the power: the prose shows it, and the record keeps it consistent.

9. **Facts.** Put each secret or misunderstanding that the plot turns on in `facts.yaml`: one `truth` per fact. The plan will say who knows, who is unaware, and who believes something false.

10. **Bible body.** Below the frontmatter, write short setting notes: the main places and factions by name, and the setting's own words for common things (they feed the "specific, not generic" rule). The detail of each place, faction, custom and event goes into the lore entries of plan-world. No plot outline: that is plan-series' job.

11. Run **the checkpoint loop** in `${CLAUDE_PLUGIN_ROOT}/reference/checkpoint-loop.md` for the checkpoint `bible`. In the summary, list the draws, and say whether windows are `on` or `off`.

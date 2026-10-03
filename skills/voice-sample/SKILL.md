---
name: voice-sample
description: Write and approve the three voice samples (a dialogue, an action and a quiet scene, ~500 words each) that become the prose reference for a LitRPG project, and fix the status-window template. Use after the chapter plans are approved, or when `lb status` names voice-sample.
---

# voice-sample

The **voice samples** are three scenes of about 500 words each, in the chosen style. After approval they are the reference for all prose, and their status window becomes the **window template**. Three kinds of scene show the voice under three kinds of pressure, so a writer copies the voice and not one scene's shape:

| File | Kind | What it must show |
|---|---|---|
| `voice/dialogue.md` | `dialogue` | The protagonist and one other main character talking: voice cards and their `humour`, subtext and plain text, and a tone that a reader can name by the third exchange. The POV character's felt reaction at the turns, the delivery of the lines that matter, natural speech, and at least one longer turn under feeling: it is the reference for how much feeling a chapter shows, not for how every pair talks. |
| `voice/action.md` | `action` | A fight or physical danger: clear geography, a changing situation, a cost, and a status window with the change it caused. |
| `voice/quiet.md` | `quiet` | A scene with little or no dialogue: the setting's own objects, emotion shown and never named, an ending in motion. |

## Steps

1. Run `lb gate chapter-plans`. If it is BLOCKED, stop and tell the user why.

2. Read `guidelines/writing.md` in full, the `prose-style`, `pov-tense` and `tone` decisions in `bible.md`, the voice cards of every character in the samples, and the chapter plans the scenes come from.

3. **Imported book.** In an import project, the samples are the author's own prose from the imported book: choose three passages of about 500 words, one for each kind, by the rules of step 4 (from chapters of the book, not from plans). Write each file with the frontmatter of step 5, `source` set to the point of the passage (for example `1.07, scene 2`), and the passage copied exactly as the prose. Choose passages that show the voice cards, and with windows on, a status window in the book's own format. `lb lint` gives only warnings for a passage from an imported book, and a new chapter that copies a phrase from it is still a `repetition.*` finding. Continue with step 7.

4. **Choose three scenes** from the chapter plans, one for each kind, from different chapters where possible. The dialogue scene has the protagonist and one other main character who talks, and a `tone` in its plan; select a scene where the tone is humour, sarcasm or a quarrel when the plans have one. The action scene has a stat change. Record each scene in `source` (for example `1.05, scene 1`).

5. **Write** the three files. Frontmatter: `status: draft`, `kind`, `pov`, `characters` (the protagonist first), `source`. In every sample the prose:
   - starts inside the scene, with a character who does or wants something;
   - ends on something new and concrete, in motion;
   - uses a different ending type from the other two samples.

   The status window goes in a fenced code block (```), with only the values that changed, as `old → new`. Put it in the action sample; the dialogue sample can have one too. Use the same format in each window: that format becomes the template.
   When `project.yaml` has `windows: off`, there is no status window and no template: the action sample shows its change through the prose (what the character can now do, and what it cost).

   The three samples are one voice. Keep the narration's vocabulary, sentence length and POV distance the same across them; let the scene change the pace.

6. **Check.** Run the `check-prose` skill on each sample; the three checks can run at the same time. `lb lint` also compares each sample with the other two, so a simile or phrase used in two samples is a finding. For each finding, fix **only the flagged span**; a full rewrite brings in new tics. After each fix, run `lb lint --lines <A-B> voice/<kind>.md` on the changed lines. Check again. Stop after 3 rounds; tell the user what is still open.
   Done when `check-prose` returns `pass` for all three samples, or 3 rounds are used.

7. **Checkpoint.** Show the user the three samples and the check results. When they approve (or when `lb gate voice-sample` says the checkpoint is off, and all three checks passed or the samples are from an imported book):
   - with windows on, copy the status window of the action sample, without the fences, into `window_template: |` in the `bible.md` frontmatter;
   - run the checkpoint loop in `${CLAUDE_PLUGIN_ROOT}/reference/checkpoint-loop.md` for `voice-sample`.
   When they ask for changes, change only what they point at, and go back to step 6 for the changed samples.

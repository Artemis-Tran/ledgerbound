# To do: guidelines that put the book first

Written 2026-10-27, from work on the novel "Pour Decisions" (`~/novels/pour-decisions`).

## What happened

The user found the prose of the book "super tame and mild", with no expressive reactions. The
cause was the default `guidelines/writing.md`:

- About 60 rules, almost all limits. A writer who drafts against many limits makes everything
  smaller, because smaller never breaks a rule.
- §6 gives only quiet, dramatic reaction examples ("the throat goes tight"). Nothing says that in
  comedy a reaction can be bigger than its cause.
- The rhythm lints (`rhythm.short-run`, `rhythm.clause-chains`, `rhythm.commas`) and
  `grammar.fragment` block a rant at both ends: short and fast, or long and run-on.
- §13 `tension.inflated` ("not from a character who shouts what they feel") reads as "keep it calm"
  in a comedy.
- The book-specific direction (§9 "Comedy and warmth") comes ninth, after eight sections of limits.

## What the novel repo did

`~/novels/pour-decisions/guidelines/writing.md` was remade (426 → about 260 lines):

- A new **§0 "The book first"**: what the book is, the model chapter, reactions at full size (few but
  big), the voice-card states as set pieces. It comes before the rules.
- **§1–§13 became a checklist**, one line per rule with its ID. It is for checking after the draft,
  not for drafting. The section numbers and the rule IDs stayed, because `lb rules` maps them.
- **§3 "Set pieces"**: in at most 3 escalating passages a chapter, some rhythm warnings and the
  fragment and splice rules are accepted.
- **§13**: a comic reaction bigger than its cause is not `tension.inflated`.

## Done in this repo (a stopgap)

- `agents/chapter-writer.md`, step 3: a new bullet says that a §0 or another section that the project
  added to its guidelines comes first, and that the guidelines file wins over the limits that the
  agent prompt repeats.
- `agents/prose-checker.md`, `tension.*`: a comic reaction that the project's guidelines allow is not
  `tension.inflated`.

## To do

- Change the template `guidelines/writing.md` to the same shape: a "book first" §0 that
  `start-project` or `voice-sample` fills from the bible's tone and the protagonist's voice card,
  then the checklist.
- Remove the copy of the dialogue limits in `agents/chapter-writer.md` step 3. It duplicates the
  guidelines and can disagree with a project's changes.
- Consider a lint option for set pieces, so that the accepted warnings do not show, or a
  `project.yaml` setting for the rhythm thresholds.
- Consider a `model_chapter` setting that `voice.match` and the brief use next to the voice samples.

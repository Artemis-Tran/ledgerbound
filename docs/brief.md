I want to build a new project: a skills-based system for Claude Code that plans and writes
LitRPG / progression-fantasy novels (chapters, books and series) with strong cohesion, consistent
story state and prose that does not read like AI. It runs on my Claude subscription through
Claude Code. There is no web app, no database and no API key. Everything is plain files in a git repo.

The writing guidelines are at the end of this message. Save them as `guidelines/writing.md`.
Every skill that writes or checks prose must follow them.

## Workflow

1. **Intake** (`start-project`): the user gives what they have: general plot, prose style, POV and
   tense, characters, setting, magic/stat system, themes, tone. For each gap, the skill offers 2–3
   options with trade-offs and the user picks one (or says "you decide"). Each decision is marked
   `locked` (the user chose it) or `open` (the skill chose it and can change it later). The output is
   a **story bible**.
2. **Plan from the end, top down**: series → book → act → chapter → scene. The **default is a
   series**, unless the user says standalone. Each level defines:
   - **Ending state**: what is true at the end (power level, relationships, what the character believes).
   - **Promise**: what the reader expects from this level.
   - **Question**: what it raises and what it answers.
   - **Handoff**: what stays open for the next level or the next book. Each book still resolves at
     least one main question, so it feels complete.
   Ending states are also **targets in the record** (e.g. "end of act 1: rank 3, has the sword,
   trusts nobody"). The progression curve is planned, not emergent.
3. **Character arcs**: for each main character, record want, need, the lie they believe, a voice card
   (vocabulary, sentence length, verbal habits, what they never say) and arc beats mapped to acts
   (and to books, for a series).
4. **Chapter plans**: each chapter has a **job**:
   - the value shift it makes (if nothing changes, it has no reason to exist)
   - the threads it moves forward
   - the setups it plants and the payoffs it delivers
   - the arc beat it serves
   - its ending type and hook (vary these; see the guidelines)
   Each scene has goal → conflict → outcome.
5. **Setups and payoffs** are tracked threads with a plant point and a planned payoff point.
6. **Voice sample**: about 500 words in the chosen style. It must pass `check-prose`, and the user
   approves it. It becomes the reference for all prose.
7. **Generation** (phase 2): plan → delta → validate → draft → verify loop → rolling memory.
8. **Replan**: when a draft moves away from the plan, `replan` updates the downstream outline and
   targets, and the user approves the change. It must never drift silently.

**Checkpoints** (bible, series/book plan, voice sample, chapter 1, each replan) can be switched on
or off in a project config file (for example `checkpoints: { bible: on, outline: on, ... }`, plus a
"just write it" mode that switches all of them off). The default is all on.

## State: the record (deterministic, never computed by the model)
- **Ledger**: an append-only JSONL file of **delta entries**. One entry is one change to one field of
  one entity at one **point** (chapter + offset). A chapter's **delta** is its ordered entries.
- **Fold**: a script that computes state at a point by replaying the ledger. Every reader of state
  gets it only through the fold. The model must never compute state in its head.
- **Schema**: author-defined entity types with fields of four kinds: counter (optional bounds that
  clamp), ordinal ladder (ranks/tiers), collection (skills, inventory), free text. An absolute `set`
  is a barrier (a reset or correction).
- Also track the **timeline** (the day and elapsed time), **location** and **knowledge** (who knows
  what; a character's belief can differ from the truth).
- **Rolling memory**: after each chapter, write a summary, what changed, the open questions and the
  ending type used. Later chapters read these files and the fold, never the old prose in full.

## Verification
- `lint-prose` (a script): the deterministic checks from the guidelines (banned phrases, runs of
  short sentences, repeated sentence openings, em-dash density, repeated phrases across chapters).
  It gives JSON output with the location of each item.
- `check-prose` (a skill, run in a fresh subagent that did not write the text): runs the lint, then
  judges the rest of the guidelines (chapter endings, dialogue, subtext, emotion naming, voice-card
  match). It returns findings with a severity, a location and the rule broken.
- `check-continuity` (a skill, fresh subagent): extracts claims (stats, ranks, items, time,
  location, knowledge) and compares them with the fold. It also checks the chapter against its plan:
  was the job done, was the setup planted?
- `verify-chapter` (the orchestrator): runs both checkers, then revises **only the flagged spans**
  (a full rewrite brings in new tics), then runs them again. It stops after 3 rounds and reports what
  is still open to the user.
- Later: `review-book`, for pacing, a flat or steep progression curve, stats that never move,
  unused characters, unpaid setups, and repetition across the book.

## Project files (propose improvements)
`project.yaml` (config, checkpoints), `bible.md`, `schema.yaml`, `plan/series.md`, `plan/book-N.md`,
`plan/chapters/NN.md`, `characters/*.md`, `threads.yaml`, `ledger.jsonl`, `memory/NN.md`,
`chapters/NN.md`, `guidelines/writing.md`, `runs/` (resumable progress).

## Architecture
- A small deterministic CLI (TypeScript or Python; choose one and give the reason), with tests.
  It exits non-zero on failure, so skills can use it as a gate. Commands: validate bible/plan,
  fold, append delta, check claims against the fold, build the context brief for chapter N, lint prose.
- A plan validator: every chapter has a job, every setup has a payoff, the targets are reachable and
  in order, every arc beat is placed.
- `generate-book` (phase 2) runs one subagent per chapter with only its context brief. It is
  resumable after a usage-limit stop, from the files in `runs/`.

## Build order
**Phase 1 (now): planning.** `start-project`, the planning skills, `threads.yaml`, the plan
validator, the schema and target files, `lint-prose` + `check-prose` (needed for the voice sample),
and the checkpoint config. Test it on a small sample project, end to end, up to approved chapter plans.
**Phase 2: generation.** Ledger + fold CLI, `generate-chapter`, `check-continuity`,
`verify-chapter`, rolling memory, then `generate-book` and `replan`.

## What I want from you now
1. Ask me only the questions you truly need answered.
2. Propose the repo layout, the file formats and the CLI interface.
3. Build phase 1. Use the `writing-for-agents` / skill-creator guidance for the skill files if it is available.
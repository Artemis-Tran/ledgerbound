# Ledgerbound

A skills-based system for Claude Code that plans and writes LitRPG / progression-fantasy novels (chapters, books and series) with consistent story state and prose that does not read like AI.

## Language

### Story and plan

**Seed**:
The user's own short idea for a story, kept word for word.
_Avoid_: Prompt, concept

**Premise**:
One complete candidate for the whole story, in about 200 words, offered next to 2 others so the user can choose or mix.
_Avoid_: Option, pitch (for an unchosen premise)

**Pitch**:
The chosen premise, developed into a note that intake reads as the user's material. Each item in it is marked `yours`, `chosen` or `filled`.
_Avoid_: Outline, synopsis, treatment

**Story bible**:
The output of intake: every story decision (plot, prose style, POV, tense, characters, setting, stat system), each one marked `locked` or `open`.
_Avoid_: Bible doc, world doc, setup

**Locked decision**:
A story-bible decision that the user chose. Only the user can change it.
_Avoid_: Fixed, final

**Open decision**:
A story-bible decision that the system chose. The system can change it later.
_Avoid_: Default, tentative

**Level**:
One unit of the plan: series, book, act, chapter or scene. Each level above the scene has an ending state, a promise, a question and a handoff.
_Avoid_: Tier, layer

**Ending state**:
What is true at the end of a level (ranks, items, relationships, what a character believes).
_Avoid_: Outcome, end goal

**Draw**:
A concrete thing that a reader chooses the story for (kind `gives`: a time loop, a real academy), or that the story promises not to have (kind `excludes`: zero romance). The draws are for the whole story, and they are fixed in the story bible.
_Avoid_: Tag, trope, hook, selling point

**Promise**:
What the reader expects from a level. The promises of the levels deliver the draws.

**Question**:
What a level raises for the reader, and which earlier questions it answers.
_Avoid_: Mystery, hook

**Handoff**:
What stays open at the end of a level for the next level or the next book.
_Avoid_: Cliffhanger, carry-over

**Scene**:
The smallest level of the plan: one goal, one conflict and one outcome.
_Avoid_: Beat, section

**Result**:
If a scene's goal is met: `win` (met), `loss` (not met, or worse) or `mixed` (met at a cost). Each act has at least one `loss` or `mixed`.
_Avoid_: Success, outcome (the outcome is what happens; the result is if the goal is met)

**Stakes**:
What the POV character can lose in a chapter (or a scene), and why it matters to them. The prose shows the stakes before the turn of the chapter.
_Avoid_: Risk (for a chapter), consequences

**Tension**:
The urgency of a chapter, a level from 1 (quiet, but still a conflict) to 5 (the climax), inside the book's tension range. It sets the pressure, the pace and the cost on the page, not the tone: a funny scene can have high tension.
_Avoid_: Intensity, drama, pacing

**Climax**:
The one big event of a book, in its last act, at the book's highest tension: an action, a confrontation, a reveal or a choice. It spans 2 or more chapters, from the plan anchor `bN/climax-start` to `bN/climax`, the chapter where the protagonist decides it by their own act.
_Avoid_: Finale, showdown, set-piece

**Ending type**:
How a chapter stops: `action`, `dialogue`, `reveal`, `decision`, `image`, `cliffhanger` or `quiet-cut`.
_Avoid_: Ending style, closer

**Job**:
The one reason a chapter exists, given as its value shift. A chapter with no value shift has no job.
_Avoid_: Purpose, goal

**Thread**:
A tracked story element with a plant point, beats where it moves forward, and an optional payoff point. Setups, mysteries and subplots are all threads.
_Avoid_: Plot line, subplot, setup/payoff pair

**Arc**:
The change of one character across the story: want, need, the lie they believe, and arc beats mapped to acts and books.
_Avoid_: Using "arc" for a thread or a plot line

**Lore entry**:
One piece of setting knowledge in `lore/<id>.md`: a place, a faction, an event of the history, a custom, a law, a creature, or how the System works in the world. World planning (`plan-world`, the `world` checkpoint) writes the entries after the story bible. A chapter's brief includes the entries that its plan lists or names, and a one-line index of the others; the prose never contradicts an entry. A setting detail that an approved chapter adds goes into its entry through the rolling memory.

**Lore change**:
How a lore entry changes in the story (a law ends, a place burns), with the point or plan anchor after which it is true. A brief gives only the changes before its chapter, so the writer never sees a later state of the world.
_Avoid_: Update, revision, event The record holds what changes; a lore entry holds what stays true.
_Avoid_: Wiki page, codex, glossary

**Voice card**:
The rules for how one character speaks: vocabulary, sentence length, verbal habits, what they never say, how they joke (humour), and their voice states. A character change can change the voice card when the arc moves the character.

**Voice state**:
How a character's speech changes in one emotional state (angry, afraid, lying, close to someone), with one body tell. Part of the voice card.
_Avoid_: Mood, emotion card

**Wound**:
The one event before the story that made a character's lie feel true. The writer knows it; the prose never tells it, and shows it only in what the character avoids.
_Avoid_: Backstory, trauma

**Contradiction**:
One trait of a character that goes against their type, so that they are not one note.
_Avoid_: Quirk, flaw

**Character file**:
`characters/<id>.md`: who one character is at the start of the story (the body), its voice card, its aliases and its character changes, and for a main character its arc, wound and contradiction. The record holds its state; the character file holds what stays true. A chapter's brief includes the file of each character in its cast. The memory writer makes the file of a character who speaks, or who is on the page in a second chapter.
_Avoid_: Character sheet, profile

**Character change**:
How a character changes in the story (loses an eye, becomes crew boss), with the point or plan anchor after which it is true. It works the same as a lore change.

**Cast**:
The characters of one chapter: the POV character, the ones that the chapter plan lists in `characters` or names, and the ones that a target names. The brief gives each one in full.
_Avoid_: Cast list (for all the characters of the story), side characters

**Cast index**:
The part of the brief with one line for each character that is not in the cast: who it is and the chapter where it was last seen.

**Voice sample**:
One of three approved scenes of about 500 words (a `dialogue`, an `action` and a `quiet` scene) that together are the reference for all prose in a project.

**Window template**:
The approved format of a status window. Every status window in the project uses it. A project with windows `off` has no status windows and no window template; the prose shows progression, and the record still tracks it.
_Avoid_: Stat block, sheet format

**Checkpoint**:
A step where the user must approve an output before the workflow continues. Each checkpoint can be switched on or off. "Just write it" mode switches off every checkpoint except `replan`. Autopilot mode switches off all of them: the run makes the user's decisions itself and records each one in the autopilot log.
_Avoid_: Gate, approval step

### Record

**Record**:
All the deterministic story state: ledger, schema, targets, timeline and knowledge. The model reads it only through the fold, and never keeps it in its head.
_Avoid_: Story state, memory, canon

**Ledger**:
The append-only list of delta entries for a project.
_Avoid_: Log, history

**Delta entry**:
One change to one field of one entity at one point, with its cause: one short sentence that says what in the story made the change.
_Avoid_: Event, update

**Delta**:
The ordered delta entries of one chapter. The writer makes the delta before the prose, and the prose must agree with it.
_Avoid_: Changeset, diff

**Staged delta**:
The delta of a chapter that is not approved yet. It can change without restriction. When the chapter is approved, it is committed: appended to the ledger, and never changed again.
_Avoid_: Draft delta, pending delta

**Point**:
A position in the story: book, chapter and the order of the entry in that chapter (for example `1.07.3`). Chapter numbers start again at 1 in each book.
_Avoid_: Timestamp, location

**Plan anchor**:
A named position in the plan (for example `b1/act1/end`) that the chapter plan later maps to a chapter.
_Avoid_: Milestone, marker

**Fold**:
The state at a point, computed by replay of the ledger up to that point.
_Avoid_: Snapshot, current state

**Schema**:
The author-defined entity types of a project, and their fields.

**Target**:
An ending state written as expected record values at a plan anchor (for example "end of act 1: rank 3, has the sword").
_Avoid_: Goal, milestone

**Barrier**:
An absolute `set` delta entry. Replay does not need the entries before it for that field (a reset or a correction).

**Claim**:
One statement of record state in the prose (a stat, an item, the day, a location or a belief), with its line. It is compared with the fold at that line.
_Avoid_: Assertion, fact (a fact is a piece of story truth)

**Knowledge**:
Who knows what at a point. A character's belief can differ from the truth.

**Fact**:
One piece of story truth that knowledge tracks. Each character has a belief about it: `knows`, `believes-false` or `unaware`.
_Avoid_: Secret, clue

**Timeline**:
The one in-story clock of a project: the day and elapsed time at each point. It only moves forward.
_Avoid_: Story clock, calendar

**Location**:
Where an entity is at a point.

**Rolling memory**:
The per-chapter files (summary, what changed, open questions, ending type, new lore, the characters on the page and new details about them, phrase log) that later chapters read in place of the old prose. A reader that did not write the chapter makes each file from the approved chapter, and writes each new setting detail of the chapter into its lore entry.
_Avoid_: Recap, summary

**Phrase log**:
The part of rolling memory that lists similes, notable images, character gestures and ending types, so that none repeats.

**Context brief**:
The one input that a chapter-writing subagent gets: the prose decisions, the chapter plan and the next plans, the fold at the chapter start, the targets, the lore, the cast and the cast index, the voice samples, the relevant rolling memory, the phrase log, the open threads and the last words of the previous chapter.
_Avoid_: Prompt, context pack

### Publishing

**Publish file**:
`books/NN/publish.yaml`: the metadata of one book (author, blurb, keywords, ISBN, cover, series) and the order of its front pages and back pages.

**Front page** / **Back page**:
A page of the published book before the first chapter (title page, copyright, dedication, contents, previously page) or after the last one (about the author, also by). `title-page` and `contents` are built in; each other page is a file `books/NN/pages/<id>.md`.
_Avoid_: Front matter, back matter (in this repo, "frontmatter" is the YAML header of a `.md` file)

**Previously page**:
The front page of book 2 or later that tells the reader what happened in the earlier books, made from their rolling memory and the fold.
_Avoid_: Recap (that word is for nothing in this repo), story so far

**Blurb**:
The store description of one book: 150–250 words that sell it, from the bible, the draws and the book plan. `description` in the publish file.
_Avoid_: Synopsis, summary (a summary is part of rolling memory)

**Export**:
The EPUB file of one book, from `lb export`. A **draft export** (`--draft`) has the chapters that exist, in any status; it is for reading, not for a store.


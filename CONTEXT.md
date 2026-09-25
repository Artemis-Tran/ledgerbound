# Ledgerbound

A skills-based system for Claude Code that plans and writes LitRPG / progression-fantasy novels (chapters, books and series) with consistent story state and prose that does not read like AI.

## Language

### Story and plan

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

**Promise**:
What the reader expects from a level.

**Question**:
What a level raises for the reader, and which earlier questions it answers.
_Avoid_: Mystery, hook

**Handoff**:
What stays open at the end of a level for the next level or the next book.
_Avoid_: Cliffhanger, carry-over

**Scene**:
The smallest level of the plan: one goal, one conflict and one outcome.
_Avoid_: Beat, section

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

**Voice card**:
The rules for how one character speaks: vocabulary, sentence length, verbal habits.

**Voice sample**:
About 500 words of approved prose that is the reference for all prose in a project. It has the protagonist, one other main character with dialogue, and one status window.

**Window template**:
The approved format of a status window. Every status window in the project uses it.
_Avoid_: Stat block, sheet format

**Checkpoint**:
A step where the user must approve an output before the workflow continues. Each checkpoint can be switched on or off, except `replan`, which "just write it" mode does not switch off.
_Avoid_: Gate, approval step

### Record

**Record**:
All the deterministic story state: ledger, schema, targets, timeline and knowledge. The model reads it only through the fold, and never keeps it in its head.
_Avoid_: Story state, memory, canon

**Ledger**:
The append-only list of delta entries for a project.
_Avoid_: Log, history

**Delta entry**:
One change to one field of one entity at one point.
_Avoid_: Event, update

**Delta**:
The ordered delta entries of one chapter.
_Avoid_: Changeset, diff

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
The per-chapter files (summary, what changed, open questions, ending type) that later chapters read in place of the old prose.
_Avoid_: Recap, summary

**Phrase log**:
The part of rolling memory that lists similes, notable images, character gestures and ending types, so that none repeats.

**Context brief**:
The one input that a chapter-writing subagent gets: the chapter plan, the fold at the chapter start, the relevant rolling memory and the voice sample.
_Avoid_: Prompt, context pack

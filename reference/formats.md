# Novel repo file formats

The complete worked example is `${CLAUDE_PLUGIN_ROOT}/examples/tiny-standalone/`. Copy its shapes. `lb validate` is the judge: a file is right when it reports no errors for it. The zod schemas in `${CLAUDE_PLUGIN_ROOT}/src/schemas.ts` are the source of truth when this page and the code disagree.

## Rules for every file

- The validator reads only YAML: the `.yaml` files and the frontmatter between `---` lines of each `.md` file. The markdown body is for notes and reasons. Put nothing there that a check depends on.
- Write YAML in block style. In a flow mapping (`{ a: …, b: … }`), a comma splits the value, so quote any value with a comma or a colon: `hook: "He runs, and the roof falls."`
- IDs are lower-case slugs: `ivo`, `lie-challenged`, `warden-sells-tithes`.
- Never write `status: approved`. Only `lb approve` sets it, after the user approves. New and changed files have `status: draft`.

## Positions

- A **point** is `book.chapter` with a two-digit chapter: `1.07`. Use points only in books that have chapter plans.
- A **plan anchor** names a place in the plan: `b1/act2/end` (the end of an act), `b1/end`, `series/end`, or a custom `b1/<slug>` that a book plan declares under `anchors:` with its act.
- A chapter plan maps anchors to itself with `anchors: [b1/act1/end]`: the anchor is at the end of that chapter. Every act end and custom anchor of a book with chapter plans must be mapped. `bN/end` maps to the last chapter automatically.

## File by file

| File | Holds | Checkpoint |
|---|---|---|
| `pitch.md` | optional, from develop-idea: frontmatter `working_title`, `format`, `premise`; sections per bible decision; each bullet marked `(yours)`, `(chosen)` or `(filled)`. Not validated. | – |
| `project.yaml` | title, `format` (series/standalone), `chapter_words`, `mode`, `checkpoints`, `lint` overrides | – |
| `bible.md` | `decisions:` list of `{id, topic, value, status: locked\|open, options_considered, reason}`. Required IDs: `plot`, `prose-style`, `pov-tense`, `characters`, `setting`, `stat-system`, `themes`, `tone`. `window_template:` after the voice sample. | `bible` |
| `schema.yaml` | `types:` (each with `kind: character` or not, and `fields:`), `entities:` (each with `type`, `name`, `start` values) | `bible` |
| `facts.yaml` | list of `{id, truth}`: things a character can know, not know, or believe falsely | `bible` |
| `series.md` | `books`, `ending_state`, `promise`, `question: {raises, answers}`, `handoff` | `series-plan` |
| `books/NN/plan.md` | the same four level fields, plus `acts:` (each with `id` and the four fields) and custom `anchors:` | `book-plan` |
| `targets.yaml` | list of `{anchor, expect, knowledge, day, reset}` | `series-plan` (series), `book-plan` (standalone) |
| `characters/<id>.md` | `role`, `want`, `need`, `lie`, `voice` card, `arc_beats: [{id, book, act, beat}]` | `character-arcs` |
| `books/NN/plan/MM.md` | one chapter: `pov`, `job: {value, from, to}`, `arc_beats`, `threads: {plants, advances, pays_off}`, `ending: {type, hook}`, `anchors`, `exceptions`, `day`, `scenes: [{goal, conflict, outcome}]` | `chapter-plans` |
| `threads.yaml` | list of `{id, kind, summary, plant, beats, payoff}` | `chapter-plans` |
| `voice-sample.md` | `pov`, `characters`, then the prose | `voice-sample` |

## Schema field kinds

- `counter`: a number. Optional `min`, `max` (values clamp to them), `max_step` (the largest change per chapter; the validator uses it to check that targets can be reached) and `direction: up|down|any`.
- `ladder`: ordered `steps`, lowest first. A ladder only goes up unless a target has `reset: true`.
- `collection`: a list of IDs (skills, inventory). A target says `{ has: [...], lacks: [...] }`.
- `text`: free text.
- Built in: every `kind: character` entity has `location` (text), and beliefs about facts (`knows`, `believes-false`, `unaware`). The timeline is the target's `day`.

A target value for a counter or ladder is exact (`rank: iron`) or a range (`level: { min: 6, max: 8 }`). Prefer ranges for counters: they leave the draft room.

## Chapter plan fields that the validator checks

- `job.from` and `job.to` differ: the chapter makes a value shift.
- `ending.type` is one of `action`, `dialogue`, `reveal`, `decision`, `image`, `cliffhanger`, `quiet-cut`; it differs from the chapter before; at most one `cliffhanger` in any three consecutive chapters.
- `threads` agrees exactly with `threads.yaml`: a chapter lists a thread under `plants` when the thread's `plant` is that chapter, and the same for `advances` (`beats`) and `pays_off` (`payoff`).
- `arc_beats` lists `character/beat` IDs. Each arc beat of the book is in exactly one chapter, inside its act.
- `exceptions` lists `{rule, reason}` with rule IDs from `lb rules`. An exception waives the rule for this chapter only, and the reason says what effect it buys.

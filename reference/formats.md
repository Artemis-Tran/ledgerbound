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
| `pitch.md` | optional, from develop-idea: frontmatter `working_title`, `format`, `premise`; a `## Draws` section (`- gives: …` / `- excludes: …`), then sections per bible decision; each bullet marked `(yours)`, `(chosen)` or `(filled)`. Not validated. | – |
| `project.yaml` | title, `format` (series/standalone), `chapter_words`, `mode` (`normal`, `just-write-it`, or `autopilot`: no checkpoint, decisions logged in `runs/autopilot.md`), `windows` (`on`/`off`, default `on`: `off` means no status windows and no window template), `brief_chars`, `checkpoints`, `lint` overrides | – |
| `bible.md` | `decisions:` list of `{id, topic, value, status: locked\|open, options_considered, reason}`. Required IDs: `plot`, `prose-style`, `pov-tense`, `characters`, `setting`, `stat-system`, `themes`, `tone`. `draws:` list of `{id, kind: gives\|excludes, text, status: locked\|open}`, at least 3 with at least 1 `excludes` (missing: a warning). `window_template:` after the voice sample (only with windows `on`). | `bible` |
| `schema.yaml` | `types:` (each with `kind: character` or not, and `fields:`), `entities:` (each with `type`, `name`, `start` values; a character can also have `beliefs: {fact: belief}` in `start`) | `bible` |
| `facts.yaml` | list of `{id, truth}`: things a character can know, not know, or believe falsely | `bible` |
| `series.md` | `books`, `ending_state`, `promise`, `question: {raises, answers}`, `handoff` | `series-plan` |
| `books/NN/plan.md` | the same four level fields, plus `acts:` (each with `id` and the four fields), `draws:` (the IDs of the `gives` draws this book delivers; together the book plans deliver every one) and custom `anchors:` | `book-plan` |
| `targets.yaml` | list of `{anchor, expect, knowledge, day, reset}` | `series-plan` (series), `book-plan` (standalone) |
| `characters/<id>.md` | `role`, `want`, `need`, `lie`, `voice` card, `arc_beats: [{id, book, act, beat}]` | `character-arcs` |
| `books/NN/plan/MM.md` | one chapter: `words` (optional target length; default `chapter_words`), `pov`, `job: {value, from, to}`, `arc_beats`, `threads: {plants, advances, pays_off}`, `ending: {type, hook}`, `anchors`, `exceptions`, `day`, `scenes: [{goal, conflict, outcome}]` | `chapter-plans` |
| `threads.yaml` | list of `{id, kind, summary, plant, beats, payoff}` | `chapter-plans` |
| `voice/<kind>.md` | three files: `dialogue`, `action`, `quiet`. Frontmatter `kind`, `pov`, `characters` (2 or more for `dialogue`), `source`; then the prose. With windows `on`, at least one sample has a status window in a fenced code block. | `voice-sample` |
| `books/NN/deltas/MM.jsonl` | the staged delta of a chapter: one delta entry per line (see below), in the order of the prose. No `point`. | – |
| `books/NN/chapters/MM.md` | frontmatter `status`, `book`, `chapter`, `title`; then the prose. `status: approved` only through `lb commit` or `lb approve chapter-1`. | `chapter-1` (1.01 only) |
| `books/NN/memory/MM.md` | rolling memory: `book`, `chapter`, `summary`, `changed`, `open_questions`, `ending_type`, `phrase_log: {similes, images, gestures: {character: [...]}}`. No body. | – |
| `ledger.jsonl` | the committed delta entries, each with its `point`. Only `lb commit` writes it. | – |
| `runs/` | `briefs/NN-MM.md` (from `lb brief`), `verify/NN-MM.json` (`{round, verdict, open, extra_round?, accepted?}` from verify-chapter; `accepted: true` lets `lb commit` commit the chapter with its open errors), `autopilot.md` (the decisions of an autopilot run), `book-NN.json` (from `lb run`). | – |

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
- `words` sets the target length of one chapter when it differs from `chapter_words` (a set-piece longer, a quiet chapter shorter). `lb lint` warns (`length.target`) when a chapter is more than 25% from its target.
- `exceptions` lists `{rule, reason}` with rule IDs from `lb rules`. An exception waives the rule for this chapter only, and the reason says what effect it buys.

## Delta entries

One JSON object per line. `lb delta <point>` checks a staged delta; it is right when it reports no errors.

```json
{"entity":"ivo","field":"level","op":"add","value":1,"cause":"The dive pays out a level.","quote":"The token came up hot"}
{"entity":"ivo","field":"rank","op":"set","value":"copper","cause":"Level four is copper.","quote":"Copper, the window said"}
{"entity":"ivo","field":"belief.father-debt","op":"set","value":"knows","cause":"He reads the red page.","quote":"his father's name in red"}
{"entity":"timeline","field":"day","op":"set","value":3,"cause":"Two days pass.","quote":"On the third day"}
{"entity":"oren","op":"create","type":"person","name":"Oren Pell","value":{"level":6,"rank":"copper"},"cause":"The crew boss appears.","quote":"Oren Pell ran the crew"}
```

| Field kind | Operations |
|---|---|
| `counter` | `add` (a change, which can be negative), `set` (a barrier) |
| `ladder` | `set` (one step up is `set` to the next step) |
| `collection` | `add`, `remove` (an item ID or a list), `set` (a barrier) |
| `text`, `location` | `set` |
| `belief.<fact>` (characters) | `set` to `knows`, `believes-false` or `unaware` |
| `timeline`: `day` / `time` | `day`: `add` or `set`, never back; `time`: `set` (free text, for example `dusk`) |
| a new entity | `create` with `type`, `name`, and the start values in `value` |

- `cause` is required: one short sentence on what in the story made the change.
- A correction of the committed record comes only from `replan`. It goes first in the next chapter's staged delta, with a `cause` that starts with `Correction:`, and it needs no `quote`: it applies from the chapter start.
- `quote` is added after the prose is written: the exact words (at most 15) where the change occurs. The entries are in the order of their quotes.
- In one chapter, a counter changes by at most its `max_step`, and a counter or ladder changes only in its `direction` (a ladder only goes up). The chapter plan exceptions `record.max-step` and `record.direction` allow it.
- At the end of a chapter, the fold must meet the targets of the anchors mapped to that chapter.

## Claims

The continuity-checker writes the claims of a chapter as a JSON list for `lb claims <point> <file>`:

```json
[{"line":14,"quote":"Level ........ 3 → 4","entity":"ivo","field":"level","value":4}]
```

`entity`, `field` and `value` use the same names as delta entries. For a collection, `value` is an item ID that the entity has, or `{"has":[...],"lacks":[...]}`.

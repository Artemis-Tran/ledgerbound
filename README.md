# ledgerbound

A Claude Code plugin that plans and writes LitRPG / progression-fantasy novels (chapters, books, series) with consistent story state and prose that does not read like AI. It runs on a Claude subscription through Claude Code. Everything is plain files in git.

- Terms: [`CONTEXT.md`](CONTEXT.md)
- Design: [`docs/design.md`](docs/design.md), decisions in [`docs/adr/`](docs/adr/)
- File formats: [`reference/formats.md`](reference/formats.md), worked example in [`examples/tiny-standalone/`](examples/tiny-standalone/)
- Writing rules: [`guidelines/writing.md`](guidelines/writing.md) (`lb init` copies it into each novel repo)

## Install (once)

Needs Node 22.18 or later.

```sh
cd ~/projects/ledgerbound
npm install
npm link            # puts `lb` on your PATH
```

In Claude Code:

```
/plugin marketplace add ~/projects/ledgerbound
/plugin install ledgerbound@ledgerbound-local
```

## Start a novel

```sh
mkdir ~/novels/my-story && cd ~/novels/my-story && git init
claude
```

Then run `/ledgerbound:start-project` followed by what you have (plot, style, POV, characters, setting, stat system). With only a one- or two-sentence idea, run `/ledgerbound:develop-idea <idea>` instead: it offers three premises, develops the one you pick into `pitch.md`, and hands over to `start-project`. At any time, `lb status` shows the checkpoints and the next step.

## Phase 1 workflow

| Skill | Output | Checkpoint |
|---|---|---|
| `develop-idea` (optional) | 3 premises → `pitch.md`, from a 1–2 sentence idea | – |
| `start-project` | `bible.md`, `schema.yaml`, `facts.yaml` | `bible` |
| `plan-series` | `series.md`, `books/NN/plan.md`, `targets.yaml` | `series-plan`, `book-plan` |
| `plan-arcs` | `characters/*.md` | `character-arcs` |
| `plan-book` | `books/NN/plan/MM.md`, `threads.yaml` | `chapter-plans` |
| `voice-sample` | `voice-sample.md`, window template | `voice-sample` |
| `check-prose` | findings from a fresh `prose-checker` agent | – |

Switch checkpoints off in `project.yaml`, or set `mode: just-write-it` (all off except `replan`).

## The CLI

```
lb init [dir] --title T [--format series|standalone]
lb status | validate | gate <cp> | approve <cp> | lint <file...> | rules
```

`lb --help` has the details. Every check exits non-zero on failure, so skills use it as a gate.

## Development

```sh
npm test            # vitest
npm run typecheck
```

Phase 2 (generation: ledger, fold, `generate-chapter`, `check-continuity`, `verify-chapter`, rolling memory, `generate-book`, `replan`) is not built yet.

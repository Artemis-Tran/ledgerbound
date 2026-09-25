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

## Workflow

| Skill | Output | Checkpoint |
|---|---|---|
| `develop-idea` (optional) | 3 premises → `pitch.md`, from a 1–2 sentence idea | – |
| `start-project` | `bible.md`, `schema.yaml`, `facts.yaml` | `bible` |
| `plan-series` | `series.md`, `books/NN/plan.md`, `targets.yaml` | `series-plan`, `book-plan` |
| `plan-arcs` | `characters/*.md` | `character-arcs` |
| `plan-book` | `books/NN/plan/MM.md`, `threads.yaml` | `chapter-plans` |
| `voice-sample` | `voice/` (dialogue, action, quiet), window template | `voice-sample` |
| `generate-chapter` | one chapter: brief → delta → prose → verify → commit → memory → git | `chapter-1` (1.01 only) |
| `generate-book` | every chapter of the book, in order; resumes from `runs/` | – |
| `verify-chapter` | `prose-checker` + `continuity-checker`, then the `reviser` on the flagged spans (3 rounds) | – |
| `replan` | the unwritten plans, threads and targets, when the draft moves away from the plan | `replan` (always on) |
| `check-prose`, `check-continuity` | findings from one fresh checker agent | – |

Switch checkpoints off in `project.yaml`, or set `mode: just-write-it` (all off except `replan`).

## The CLI

```
lb init [dir] --title T [--format series|standalone]
lb status | validate | gate <cp> | approve <cp> | lint <file...> | rules | where
lb run | brief <point> | delta <point> | fold [point] | claims <point> <file> | commit <point>
```

`lb --help` has the details. Every check exits non-zero on failure, so skills use it as a gate.

## Development

```sh
npm test            # vitest
npm run typecheck
```

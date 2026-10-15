# The shape of the dialogue is measured, and each speaker has a scene want

The dialogue of the generated books is too quippy: in every pair, not only in the pair of the dialogue voice sample. Section 5 of `guidelines/writing.md` already had the rules (`dialogue.quip-chain`, `dialogue.plain-talk`, `dialogue.banter`, `dialogue.natural`), and the prose checker judged all of them. The checker is the same kind of model that writes the quips, so it does not see them well, and more words in the guidelines did not change the prose.

We measured the dialogue of 13 chapters of a human-written progression fantasy that the user likes (*Pale Lights*, every tenth chapter) and of the 40 generated chapters of two novel repos (`parts-unknown`, `test-story-1`). A turn of dialogue is one paragraph with spoken words.

| Median for each chapter | Pale Lights | parts-unknown | test-story-1 |
|---|---|---|---|
| Spoken words in a turn | 12 | 7.8 | 6.8 |
| Turns of 6 words or fewer | 24% | 46% | 49% |
| Turns of 25 words or more | 24% | 16% | 12% |
| Longest run of turns of 8 words or fewer (max) | 2 (4) | 4 (6) | 4 (7) |
| Echo toppers in a chapter (max) | 0 (2) | 1 (5) | 3 (6) |
| Turns with no beat or narration | 87% | 51% | 78% |

The human prose has about half as many very short turns. It never has 5 short turns in a row, and almost never a reply that takes a word from the line before and turns it. When we read the exchanges, the difference was also in what the talk does: the characters reason aloud, propose, object and plan; the wit is the tail of a real answer, not a separate volley; most turns have no beat; and the chemistry comes from two minds with different wants that push against each other.

## The decision

**The lint measures the shape of the dialogue** (`src/lint/dialogue.ts`), where the data shows a clear difference:

- `dialogue.quip-chain` (now lint and judge): a run of 5 or more short turns (8 spoken words or fewer) with no narration paragraph between them is an error. A beat on a short turn does not end the run. The judge looks only at shorter runs where each line tops the one before.
- `dialogue.toppers` (lint, a warning): 3 or more echo toppers in a chapter.
- `dialogue.turn-length` (lint, a warning): in a chapter with 20 or more turns, a median turn under 8 words, or more than 45% of the turns with 6 words or fewer.

**`lb dialogue`** prints these measures for each chapter of a book, or for any prose files, so that a project can compare its chapters with prose that a person wrote. **`lb census --lint <rule>`**, and `census.lint` in a review finding, make the findings of a lint rule the places of a pattern: a pattern fix can take the census of quip chains, which no regex finds.

**The prose checker judges what the lint cannot**, from three new rules: the talk does work (`dialogue.work`), each speaker goes after their scene want (`dialogue.wants`), and two characters of a relationship file are alive to each other (`dialogue.chemistry`, a warning). `dialogue.banter` and `dialogue.action-beats` now say that wit rides on a plain line and that most turns stand with no beat.

**Each scene with dialogue has `wants`**: what each speaker goes after in the talk. The wants pull against each other, so the talk has work to do, and the judge has a target. A want is for the scene, not for each line: real people also say lines with no purpose (small talk, a false start, a joke that fails), and dialogue in which every line works is a different AI tell.

## Considered options

- **Only more guideline text.** The rules were there, and the judge missed the breaks. A count is what a judge of the same model cannot argue with.
- **Lint the beats** (the share of turns with a beat). The two generated books differ too much (51% and 78% with no beat), so the signal is not clear. It stays a judged rule.
- **Lint natural speech** (restarts, "I don't know", cut-off lines). The counts did not separate human and generated prose. It stays judged (`dialogue.natural`).
- **A want for each line.** It makes dialogue too efficient. The want is for the scene.

## Consequences

- The limits are constants in `src/lint/dialogue.ts`, not settings of `project.yaml`.
- **Limit of the data, for the future:** the limits come from one author with a formal, talkative style, and from 13 chapters. They suit progression fantasy, which is the genre of this tool now. A terse genre (noir, hard-boiled, much military fiction) has shorter turns, and the warnings would be wrong for it. Before the tool supports such a genre, measure books of it with `lb dialogue <file>...`, and move the warning limits (`TOPPERS`, `TURN_LENGTH_*`) into `project.yaml` so that a project can change them. The error limit (5 short turns in a row) is the old judged rule, so it can stay fixed. The same is true for an imported book whose author writes short turns: `lb dialogue` on book 1 shows it, and then the limits must follow the author, as the `prose-style` decision does.
- Approved chapters can now have lint errors of `dialogue.quip-chain`. They stay approved; `revise-chapter` fixes them, because the prose checker keeps every lint finding.
- A plan approved before this version has no `wants`, so only a draft plan gets the `wants-missing` warning.

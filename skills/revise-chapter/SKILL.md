---
name: revise-chapter
description: Revise one approved chapter of a Ledgerbound novel for named rules or user notes (for example more felt emotion and more natural dialogue after a guidelines change), with the prose-checker, the reviser and the continuity-checker, while every committed ledger quote stays. Use when the user wants approved chapters changed; run it once for each chapter of a range.
---

# revise-chapter

An approved chapter is committed: its delta is in the ledger, and the ledger never changes. The prose can still change, when each committed quote of the chapter stays in it, word for word and in order (`lb validate` gives `ledger-quote-not-found` for a quote that is gone). This skill changes the prose only. When a fix needs a different record, it stops and names the `replan` skill, which corrects the record in the next chapter's delta.

The point (for example `1.07`) gives the paths, where NN is the book and MM the chapter, two digits each. The skill uses the verify record `runs/verify/NN-MM.json` and its round copies, so `lb changed` works. Its round numbers go on from the record's last round.

Inputs: the point, and the focus: the rule IDs from `lb rules` to judge (for example `emotion.felt, dialogue.delivery, dialogue.plain-talk, dialogue.quip-chain, dialogue.natural, dialogue.speeches`), the user's notes, or both.

## Steps

1. **Start.** The chapter's frontmatter has `status: approved`; else use `verify-chapter`. Run `lb validate` and note each `ledger-quote-*` issue of the chapter that is there before you start. Run `lb brief <point>`: the brief then has the voice samples and the guidelines as they are now. Let R be the record's `round` + 1, or 1 when there is no record. Copy the chapter to `runs/verify/NN-MM.rR.md`.

2. **Find.** Start the `ledgerbound:prose-checker` agent with the chapter, its plan, the voice samples in `voice/` and the character files of the speakers, as `verify-chapter` does. Say: "chapter M of book N, a revision of an approved chapter: judge the whole chapter, only for these rules: <focus rules>". The checker can mark a whole flat scene for a rewrite (`fix_hint` `scene: lines A-B`); the reviser then rewrites that scene and keeps its plan, events and quotes. Write its findings, and the user's notes as findings with rule `user` (severity `error`, the quote and line of the span they point at), to `runs/verify/NN-MM.findings.json`. Write the record `{ "round": R, "verdict": "pass | fail", "open": [...] }` as `verify-chapter` step 3 does.
   Done when the record is written. When the verdict is `pass`, go to step 5.

3. **Revise.** Start the `ledgerbound:reviser` agent with the point, the round R, the brief path and the findings path. Say: "the chapter is approved and committed: keep every committed quote; make each new image and gesture new for the whole book (`lb phrases` of the chapter after the last written one)".
   When it returns a `not_fixed` item with `"replan": true`, stop and tell the user its reason.

4. **Check.** Let R be R + 1. Run `lb changed <point>`, and copy the chapter to `runs/verify/NN-MM.rR.md`. Start the `ledgerbound:prose-checker` and the `ledgerbound:continuity-checker` agents at the same time, as `verify-chapter` does in round 2 or later: the round, the changed lines and the record path. They judge every rule on the changed lines, so a fix that brings in a new problem is found. Tell the prose checker to compare images and gestures with the phrase log of the whole book (`lb phrases <point>` of the chapter after the last written one), because later chapters were written after this one. Write the findings and the record as in step 2.
   When the verdict is `fail` and fewer than 3 revise rounds are done, go to step 3. After 3 revise rounds, keep the open errors in the record and tell the user.
   Done when the verdict is `pass` or 3 revise rounds are done.

5. **Record.** Run `lb validate`.
   Done when it gives no `ledger-quote-*` issue for the chapter that step 1 did not note.

6. **Memory.** Start the `ledgerbound:memory-writer` agent with the point: the rolling memory and the phrase log then come from the revised chapter, so later chapters do not copy its new images. Add its `warnings` about lore or character files to the record, as the `Remember` step of `reference/chapter-steps.md` does.
   Done when `lb validate` reports no error for `books/NN/memory/MM.md`.

7. **Git.** In the novel repo: `git add -A && git commit -m "Book <N>, chapter <M>: revised (<focus in a few words>)"`.

8. Return only: `{ "point": "1.07", "rounds": 2, "verdict": "pass | fail", "open_errors": 0, "words_before": 4100, "words_after": 4420 }`.

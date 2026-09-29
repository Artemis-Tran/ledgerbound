---
status: approved
id: sabine
name: Sabine Rook
role: main
want: To clear her father's tithe debt before the reeve sells the house.
need: To trust one person outside the ledger.
lie: Numbers do not lie, so the people who keep them cannot be lying.
wound: At eleven she read her father's tithe entry aloud to him when he swore he had paid it. The ledger was right; he had spent the token at the Drowned Goat.
contradiction: She is exact about every token, but she burns lamp oil when the sky is light enough to read by, and she will not say why.
voice:
  vocabulary: Clerk's terms (margin, carry, entry, rate). Dry, exact.
  sentence_length: Clipped. Answers a question with a procedure.
  verbal_habits: [Corrects other people's numbers]
  never_says: [What she feels, her father's name]
  humour: "Bone dry. States a fact that makes the other person look foolish, and does not smile: 'Warden says a lot of things at the Drowned Goat.'"
  states:
    - { state: afraid, speech: "More procedure, not less. She says the rate and the entry number aloud.", tell: Squares the ledger to the edge of the table. }
    - { state: lying, speech: "An exact number that nobody asked for, so that nobody asks the real question.", tell: Holds the pen still above the page. }
    - { state: close, speech: "One sentence with no figure in it. Then she stops talking.", tell: Looks up from the page. }
arc_beats:
  - { id: keeps-silence, book: 1, act: act1, beat: She copies the warden's rate and says nothing about the red pages. }
  - { id: cooks-books, book: 1, act: act2, beat: "She changes one entry to save Ivo, and hides it from him." }
  - { id: hands-over-ledger, book: 1, act: act3, beat: She gives Ivo the ledger instead of taking it to the manor. }
changes:
  - { from: b1/act2/end, text: "She no longer corrects Ivo's numbers aloud. She corrects them in the margin, where he cannot see." }
---

The reeve's clerk, who enters every tithe token in the ledger at the counting table by the lean-to. She keeps the lamp lit when the sky is light enough to read by, and she does not look up when she takes a token. Her father owes the well, and she has told no one.

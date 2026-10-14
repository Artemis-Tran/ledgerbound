---
book: 1
scores: { enjoyment: 7, plot: 6, pacing: 8, characters: 6, prose: 8 }
verdict: revise
findings:
  - id: second-bell-unfelt
    area: characters
    severity: major
    chapters: ["1.01"]
    problem: The second bell rings for no one, and Ivo only looks down the shaft. The first strange thing of the book does not land in him, so the reader does not feel it either.
    evidence:
      - { point: "1.01", quote: "He looked down the shaft." }
    recommendation: After the second bell, give Ivo one beat of fear in his own words. He counts the bell as his before he can stop himself.
    record: keep
    size: span
    source: prose
    decision: open
  - id: sabine-wants-nothing
    area: characters
    severity: minor
    chapters: ["1.01"]
    problem: Sabine only answers Ivo. She wants nothing in the scene, so the red pages look like a plot device and not her choice.
    evidence:
      - { point: "1.01", quote: "I know the rate." }
    recommendation: Give Sabine her own aim at the table. She wants Ivo gone before the warden's man comes, and she opens the red pages while she wants that.
    record: keep
    size: scene
    source: prose
    decision: open
  - id: rope-in-every-beat
    area: prose
    severity: minor
    chapters: ["1.01"]
    problem: The prose names the rope in five beats of one short chapter, so it stops being a thing in Ivo's hands and becomes a tag. Each later chapter at the well will name it again.
    evidence:
      - { point: "1.01", quote: "He hauled the rope in hand over hand" }
      - { point: "1.01", quote: "while he was still coiling the rope" }
    recommendation: Keep the rope where it changes something (the weight that goes out of it, the haul), and name the work another way in the other beats - the bucket, the haul, his hands. Cut one of the four ropes in the dialogue sample, so that the sample does not teach the tag.
    record: keep
    size: span
    source: pattern
    origin: ["voice/dialogue.md: the sample names the rope four times", "characters/ivo.md: his afraid voice state talks to the rope"]
    census: { match: ['\bthe rope\b'], limit: { per_chapter: 3 } }
    decision: open
  - id: token-too-easy
    area: plot
    severity: minor
    chapters: ["1.01"]
    problem: The first level comes free with no cost on the page, so the price of a level, the promise of act 1, starts weak.
    evidence:
      - { point: "1.01", quote: "the number settled behind his eyes" }
    recommendation: Make the token cost Ivo something that stays, for example the rope burns that the stakes name, and a lost day of work.
    record: change
    size: scene
    source: plan
    decision: skip
    note: The user keeps the free first level. The cost comes in chapter 2.
---

# Review of book 1: The Tithe Well

**Verdict.** A tight opening with a clear world and a good hook. The well and the tithe show the System through the work of the diggers, and the red pages end the chapter on a real question. The book is weaker in its people than in its world.

**Strengths.** The tithe is a physical cost, and the prose shows it in rope, iron and cold. The status window is short and comes at the moment of the change. The last image puts the plot in Sabine's hand.

**The 3 most important problems.**

1. The second bell is the first strange thing in the book, and Ivo does not react to it (`second-bell-unfelt`).
2. Sabine has no aim in her scene (`sabine-wants-nothing`).
3. The first level costs nothing (`token-too-easy`).

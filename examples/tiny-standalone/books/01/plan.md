---
status: approved
book: 1
title: The Tithe Well
ending_state: Ivo is iron rank, holds the tithe ledger at the manor gate, and knows the warden sold the town's levels.
promise: A digger who climbs by paying, then learns what the payment bought.
question:
  raises: [Where do the held levels go?, Will Sabine choose the ledger or Ivo?]
  answers: [Where do the held levels go?]
handoff: [What the Duke does with two hundred stolen levels]
acts:
  - id: act1
    ending_state: Ivo reaches copper, pays the tithe gladly, and does not know about the debt or the sales.
    promise: The cost of a level is real and physical.
    question: { raises: [What are the red pages?], answers: [] }
    handoff: [The red pages]
  - id: act2
    ending_state: Ivo knows about his father's debt but believes the warden's story about where the levels go.
    promise: The ledger is the key.
    question: { raises: [Why did Sabine change an entry?], answers: [What are the red pages?] }
    handoff: [Sabine's changed entry]
  - id: act3
    ending_state: Ivo refuses the tithe, reaches iron, and takes the ledger to the manor.
    promise: The price gets paid by someone.
    question: { raises: [], answers: [Why did Sabine change an entry?, Where do the held levels go?] }
    handoff: [What the Duke does with two hundred stolen levels]
draws: [cost-of-power, small-town-conspiracy, underdog-climb]
anchors:
  - { id: b1/midpoint, act: act2, note: Ivo learns about the debt. }
tension: { min: 2, max: 5 }
climax:
  kind: choice
  event: At the reeve's door, the well pulls at Ivo's next level through the cracked lamp while Sabine carries the ledger to the manor.
  risk: His iron rank, and the level that the well takes if he pays.
  choice: Ivo refuses the tithe, lets the lamp break, and takes the ledger to the manor gate himself.
---

# Notes

A six-chapter test book. Act 1 is chapters 1-2, act 2 is chapters 3-4, act 3 is chapters 5-6.

---
status: approved
book: 2
title: The Manor Gate
ending_state: Ivo is copper rank, holds the tithe ledger at the manor gate, and knows the warden sold the town's levels.
promise: The price of a level gets paid by someone, and Ivo chooses who.
question:
  raises: [Will Sabine choose the ledger or Ivo?]
  answers: [Where do the held levels go?, Will Sabine choose the ledger or Ivo?]
handoff: []
acts:
  - id: act1
    ending_state: Ivo has a sealed slate as proof, and knows that his father died owing the well eleven levels.
    promise: The ledger is the key.
    question: { raises: [Why did Sabine change an entry?], answers: [Why is Ivo's name in the red pages?] }
    handoff: [Sabine's changed entry]
  - id: act2
    ending_state: Ivo refuses the tithe, reaches copper, and takes the ledger to the manor.
    promise: The price gets paid by someone.
    question: { raises: [], answers: [Where do the held levels go?, Will Sabine choose the ledger or Ivo?] }
    handoff: []
draws: [cost-of-power, small-town-conspiracy, underdog-climb]
tension: { min: 2, max: 5 }
climax:
  kind: choice
  event: On harvest day Hale puts Ivo on the rope, and the well pulls at his next level through the cracked lamp while Sabine carries the ledger to the manor.
  risk: His copper rank, and the level that the well takes if he pays.
  choice: Ivo refuses the tithe, lets the lamp break, and takes the ledger to the manor gate himself.
---

# Notes

The first book that the tool plans, after the imported book 1. Act 1 is chapters 1-2, act 2 is chapters 3-4.

---
status: approved
title: The Tithe Well
decisions:
  - id: plot
    topic: General plot
    value: A well-digger in a mining town learns that the levels the town well "holds" for its diggers are sold to the Duke, and must choose between his rank and the ledger that proves it.
    status: locked
  - id: prose-style
    topic: Prose style
    value: Plain, concrete, working-class vocabulary. Short paragraphs in action, longer ones in the counting house. Little figurative language.
    status: locked
  - id: pov-tense
    topic: POV and tense
    value: Close third person on Ivo, past tense.
    status: locked
  - id: characters
    topic: Main characters
    value: Ivo Marsh (protagonist, digger), Sabine Rook (reeve's clerk), Warden Hale (keeper of the well).
    status: locked
  - id: setting
    topic: Setting
    value: Lenholt, a slate-mining town built around one deep well that takes a tithe of every level gained in the valley.
    status: open
    options_considered:
      - A mining town around a tithe well (chosen)
      - A river port where the System taxes each crossing
    reason: The well keeps the cost of power physical and local.
  - id: stat-system
    topic: Magic and stat system
    value: Levels 1-30, ranks unranked/copper/iron/silver. The well holds a third of each level until the season ends. Skills rise in percent.
    status: locked
  - id: themes
    topic: Themes
    value: Who sets the price of a gain; debts that pass from parent to child.
    status: open
    options_considered: []
  - id: tone
    topic: Tone
    value: Tense and grounded, with dry humour from Sabine. No epic register.
    status: open
draws:
  - id: cost-of-power
    kind: gives
    text: Every level has a visible price that someone pays.
    status: locked
  - id: small-town-conspiracy
    kind: gives
    text: A local conspiracy that the protagonist solves from ledgers and clues, not from fights.
    status: open
  - id: underdog-climb
    kind: gives
    text: A low-rank protagonist who climbs rank by rank on the page.
    status: open
  - id: no-romance
    kind: excludes
    text: No romance and no romantic subplot.
    status: locked
window_template: |
  [TITHE PAID]
  Level ........ 2 → 3
  Held by well . 1
  Stonesense ... 12% → 19%
---

# Notes

Every status window uses the template above: a title in brackets, then one line per changed value, with dot leaders.

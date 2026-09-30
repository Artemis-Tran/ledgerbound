# ledgerbound (the tool repo)

- Use the terms in `CONTEXT.md`. `docs/design.md` is the approved design; `docs/adr/` has the decisions and their reasons.
- `src/schemas.ts` is the source of truth for novel-repo file formats. When you change a format, change `reference/formats.md`, `examples/tiny-standalone/` and `examples/tiny-imported/` in the same change.
- `examples/tiny-standalone/` and `examples/tiny-imported/` (a series whose book 1 is an imported book) must stay valid: `lb validate --dir <example>` reports no errors and the three voice samples lint clean. The tests copy them and change one thing per test.
- Run `npm test` and `npm run typecheck` before you call a change done.
- The skills and `agents/prose-checker.md` follow the `writing-for-agents` guidance: steps with a clear "done when", shared reference in `reference/`, and positive instructions.

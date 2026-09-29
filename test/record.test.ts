import { spawnSync } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { buildBrief } from "../src/brief.ts";
import { buildPlanIndex } from "../src/anchors.ts";
import { compareClaims, unplaced } from "../src/claims.ts";
import { loadProject, type Project } from "../src/project.ts";
import { checkDelta, commitChapter, fold, loadRecord, parsePoint, unreachableTargets } from "../src/record.ts";
import { runReport } from "../src/run.ts";
import { check, edit, errorCodes, fixtureCopy } from "./helpers.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const lb = (args: string[], cwd: string) => spawnSync("node", [CLI, ...args], { cwd, encoding: "utf8" });

const load = (dir: string): Project => loadProject(dir).project!;
const codes = (dir: string, book = 1, chapter = 2) => checkDelta(load(dir), loadRecord(dir), book, chapter).issues.filter((i) => i.severity === "error").map((i) => i.code);

/** Chapter 2 prose. Line 8 is the first body line. */
const CHAPTER_2 = `---
status: draft
book: 1
chapter: 2
title: Copper
---

He went into the flooded gallery with the lamp held high and the water to his chest. The lamp glass cracked on a low beam, and the flame shrank to a bead.

The token came up hot in the bucket when he climbed out.

\`\`\`
[TITHE PAID]
Level ........ 3 → 4
\`\`\`

Copper, the window said, and he said it back to himself twice on the walk to the crews.

Oren Pell ran the crew at the east shaft. He looked at the lamp for a long time before he said anything, and Ivo waited with the level still warm in his arm.
`;

const GOOD_DELTA = [
  { entity: "ivo", field: "location", op: "set", value: "the flooded gallery", cause: "The last level is past the gallery.", quote: "He went into the flooded gallery" },
  { entity: "ivo", field: "inventory", op: "add", value: "cracked-lamp", cause: "The lamp cracks on a beam.", quote: "The lamp glass cracked" },
  { entity: "ivo", field: "level", op: "add", value: 1, cause: "The dive pays out a level.", quote: "The token came up hot" },
  { entity: "ivo", field: "rank", op: "set", value: "copper", cause: "Level four is copper.", quote: "Copper, the window said" },
  { entity: "oren", op: "create", type: "person", name: "Oren Pell", value: { level: 6, rank: "copper" }, cause: "The crew boss appears.", quote: "Oren Pell ran the crew" },
];

function stage(dir: string, entries: object[], chapter = 2) {
  mkdirSync(join(dir, "books/01/deltas"), { recursive: true });
  writeFileSync(join(dir, `books/01/deltas/0${chapter}.jsonl`), entries.map((e) => JSON.stringify(e)).join("\n") + "\n");
}

function writeChapter2(dir: string, text = CHAPTER_2) {
  writeFileSync(join(dir, "books/01/chapters/02.md"), text);
}

describe("points and the fold", () => {
  test("parsePoint", () => {
    expect(parsePoint("1.07")).toEqual({ book: 1, chapter: 7, index: Infinity });
    expect(parsePoint("1.07.3")).toEqual({ book: 1, chapter: 7, index: 3 });
    expect(parsePoint("b1/end")).toBeUndefined();
  });

  test("the fold replays the ledger from the start values", () => {
    const dir = fixtureCopy();
    const rec = loadRecord(dir);
    const start = fold(load(dir), rec, { book: 1, chapter: 1, index: 0 }).state;
    expect(start.entities.ivo.fields.level).toBe(2);
    expect(start.entities.sabine.beliefs["father-debt"]).toBe("knows");
    const mid = fold(load(dir), rec, { book: 1, chapter: 1, index: 3 }).state;
    expect(mid.entities.ivo.fields).toMatchObject({ level: 3, location: "the well lip" });
    const end = fold(load(dir), rec, parsePoint("1.01")!).state;
    expect(end).toMatchObject({ day: 1, entities: { ivo: { fields: { location: "the counting table" } }, "tithe-well": { fields: { held_levels: 213 } } } });
  });

  test("the fold includes a staged delta unless it asks for committed entries only", () => {
    const dir = fixtureCopy();
    stage(dir, GOOD_DELTA);
    expect(fold(load(dir), loadRecord(dir)).state.entities.ivo.fields.rank).toBe("copper");
    expect(fold(load(dir), loadRecord(dir), undefined, { staged: false }).state.entities.ivo.fields.rank).toBe("unranked");
  });

  test("a counter clamps to its bounds with a warning", () => {
    const dir = fixtureCopy();
    stage(dir, [{ entity: "tithe-well", field: "held_levels", op: "add", value: -500, cause: "The Duke empties the well." }]);
    const c = checkDelta(load(dir), loadRecord(dir), 1, 2);
    expect(c.after.entities["tithe-well"].fields.held_levels).toBe(0);
    expect(c.issues).toContainEqual(expect.objectContaining({ code: "clamped", severity: "warn" }));
  });
});

describe("lb delta", () => {
  test("a good delta with its prose has no error", () => {
    const dir = fixtureCopy();
    stage(dir, GOOD_DELTA);
    writeChapter2(dir);
    expect(codes(dir)).toEqual([]);
  });

  test("entry errors", () => {
    const dir = fixtureCopy();
    stage(dir, [
      ...GOOD_DELTA.slice(2, 4),
      { entity: "ivo", field: "rank", op: "add", value: "iron", cause: "Wrong op." },
      { entity: "ivo", field: "inventory", op: "remove", value: "lamp", cause: "No lamp." },
      { entity: "timeline", field: "day", op: "set", value: 0, cause: "Back in time." },
      { entity: "nobody", field: "level", op: "add", value: 1, cause: "Unknown." },
      { entity: "ivo", field: "belief.dragon", op: "set", value: "knows", cause: "Unknown fact." },
      { entity: "ivo", field: "mana", op: "add", value: 1, cause: "Unknown field." },
      { entity: "ivo", field: "rank", op: "set", value: "gold", cause: "Not a step." },
    ]);
    expect(codes(dir)).toEqual(["bad-op", "not-there", "day-back", "unknown-entity", "unknown-fact", "unknown-field", "bad-value"]);
  });

  test("a change larger than max_step, and the plan exception that allows it", () => {
    const dir = fixtureCopy();
    stage(dir, [...GOOD_DELTA.slice(3, 4), { entity: "ivo", field: "level", op: "add", value: 4, cause: "A deep dive." }]);
    expect(codes(dir)).toContain("record.max-step");
    edit(dir, "books/01/plan/02.md", "anchors: [b1/act1/end]", "anchors: [b1/act1/end]\nexceptions:\n  - rule: record.max-step\n    reason: The flooded dive pays four levels at once.");
    expect(codes(dir)).not.toContain("record.max-step");
  });

  test("a ladder that goes down", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/02.md", "anchors: [b1/act1/end]\n", "");
    edit(dir, "books/01/plan/03.md", "anchors: [b1/midpoint]", "anchors: [b1/midpoint, b1/act1/end]");
    stage(dir, [{ entity: "sabine", field: "rank", op: "set", value: "unranked", cause: "The reeve strips her rank." }]);
    expect(codes(dir)).toContain("record.direction");
  });

  test("the targets of the chapter's anchors must be met", () => {
    const dir = fixtureCopy();
    stage(dir, GOOD_DELTA.slice(0, 3));
    expect(checkDelta(load(dir), loadRecord(dir), 1, 2).issues).toContainEqual(expect.objectContaining({ code: "target-miss", message: expect.stringContaining("ivo.rank") }));
  });

  test("quotes: missing, not found, and out of order", () => {
    const dir = fixtureCopy();
    writeChapter2(dir);
    const [a, b, c, d, e] = GOOD_DELTA;
    stage(dir, [a, b, d, c, e]);
    expect(codes(dir)).toEqual(["quote-order"]);
    stage(dir, [{ ...a, quote: undefined }, { ...b, quote: "words that are not there" }, c, d, e]);
    expect(codes(dir)).toEqual(["quote-missing", "quote-not-found"]);
  });

  test("a correction from replan needs no quote and comes first", () => {
    const dir = fixtureCopy();
    writeChapter2(dir);
    const fix = { entity: "tithe-well", field: "held_levels", op: "set", value: 200, cause: "Correction: the well held 200 levels, not 213." };
    stage(dir, [fix, ...GOOD_DELTA]);
    expect(codes(dir)).toEqual([]);
    stage(dir, [GOOD_DELTA[0], fix, ...GOOD_DELTA.slice(1)]);
    expect(codes(dir)).toEqual(["correction-order"]);
  });

  test("the earlier chapters must be committed first", () => {
    const dir = fixtureCopy();
    stage(dir, [{ entity: "timeline", field: "day", op: "set", value: 3, cause: "Two days pass." }], 3);
    expect(codes(dir, 1, 3)).toContain("order");
  });

  test("an approved chapter cannot take a new delta", () => {
    const dir = fixtureCopy();
    stage(dir, [], 1);
    expect(codes(dir, 1, 1)).toContain("committed");
  });
});

describe("commit", () => {
  test("appends the delta with points, approves the chapter and removes the staged file", () => {
    const dir = fixtureCopy();
    stage(dir, GOOD_DELTA);
    writeChapter2(dir);
    const r = commitChapter(load(dir), loadRecord(dir), 1, 2);
    expect(r).toMatchObject({ ok: true, committed: 5, replan: [] });
    const last = JSON.parse(readFileSync(join(dir, "ledger.jsonl"), "utf8").trim().split("\n").at(-1)!);
    expect(last).toMatchObject({ point: "1.02.5", entity: "oren", op: "create" });
    expect(readFileSync(join(dir, "books/01/chapters/02.md"), "utf8")).toContain("status: approved");
    expect(existsSync(join(dir, "books/01/deltas/02.jsonl"))).toBe(false);
    expect(errorCodes(check(dir))).toEqual([]);
  });

  test("refuses when the delta has an error, and changes nothing", () => {
    const dir = fixtureCopy();
    stage(dir, GOOD_DELTA.slice(0, 3));
    writeChapter2(dir);
    const before = readFileSync(join(dir, "ledger.jsonl"), "utf8");
    expect(commitChapter(load(dir), loadRecord(dir), 1, 2).ok).toBe(false);
    expect(readFileSync(join(dir, "ledger.jsonl"), "utf8")).toBe(before);
  });

  test("lb commit refuses chapter 1.01 while the chapter-1 checkpoint is on", () => {
    const dir = fixtureCopy();
    const r = lb(["commit", "1.01"], dir);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain("lb approve chapter-1");
  });

  test("lb commit refuses a chapter with a lint error", () => {
    const dir = fixtureCopy();
    stage(dir, GOOD_DELTA);
    writeChapter2(dir, CHAPTER_2.replace("He looked at the lamp", "He let out a breath and looked at the lamp"));
    const r = lb(["commit", "1.02", "--json"], dir);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout).issues).toContainEqual(expect.objectContaining({ code: "lint.words.banned" }));
  });

  test("a later target that the state can no longer reach is a reason to replan", () => {
    const dir = fixtureCopy();
    const project = load(dir);
    const state = fold(project, loadRecord(dir)).state;
    state.entities.ivo.fields.rank = "silver";
    state.entities.ivo.beliefs["warden-sells-tithes"] = "knows";
    const why = unreachableTargets(project, buildPlanIndex(project, []), state, 1, 1);
    expect(why).toContainEqual(expect.stringContaining("ivo.rank is already past"));
    expect(why).toContainEqual(expect.stringContaining("already knows 'warden-sells-tithes'"));
  });
});

describe("the validator and the record", () => {
  test("ledger entries for a chapter that is not approved", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/chapters/01.md", "status: approved", "status: draft");
    expect(errorCodes(check(dir))).toContain("ledger-unapproved");
  });

  test("a broken ledger line", () => {
    const dir = fixtureCopy();
    edit(dir, "ledger.jsonl", '"point":"1.01.5"', '"point":"1.01.2"');
    expect(errorCodes(check(dir))).toContain("point-order");
  });

  test("a memory file with a different ending type is a warning", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/memory/01.md", "ending_type: decision", "ending_type: image");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "ending-type", severity: "warn" }));
  });
});

describe("claims", () => {
  test("each claim is compared with the fold at its line", () => {
    const dir = fixtureCopy();
    stage(dir, GOOD_DELTA);
    writeChapter2(dir);
    const c = checkDelta(load(dir), loadRecord(dir), 1, 2);
    const results = compareClaims(load(dir), c, [
      { line: 14, quote: "Level ........ 3 → 4", entity: "ivo", field: "level", value: 4 },
      { line: 8, quote: "the lamp held high", entity: "ivo", field: "level", value: 4 },
      { line: 18, quote: "Copper", entity: "ivo", field: "rank", value: "copper" },
      { line: 20, quote: "the lamp", entity: "ivo", field: "inventory", value: "cracked-lamp" },
      { line: 8, quote: "the flooded gallery", entity: "ivo", field: "location", value: "Flooded Gallery" },
      { line: 20, quote: "at the east shaft", entity: "ivo", field: "location", value: "the east shaft" },
      { line: 20, quote: "Ivo waited", entity: "ivo", field: "belief.father-debt", value: "unaware" },
      { line: 8, quote: "day", entity: "timeline", field: "day", value: 1 },
      { line: 8, quote: "his mana", entity: "ivo", field: "mana", value: 3 },
    ]);
    expect(results.map((r) => r.verdict)).toEqual(["ok", "mismatch", "ok", "ok", "ok", "compare", "ok", "ok", "unknown"]);
  });

  test("with the chapter text, a claim moves to the line of its quote, and a lost quote is marked", () => {
    const dir = fixtureCopy();
    stage(dir, GOOD_DELTA);
    const revised = CHAPTER_2.replace("Copper, the window said", "He sat on the bucket until his hands stopped.\n\nCopper, the window said");
    writeChapter2(dir, revised);
    const c = checkDelta(load(dir), loadRecord(dir), 1, 2);
    const results = compareClaims(
      load(dir),
      c,
      [
        { line: 18, quote: "Copper, the window said", entity: "ivo", field: "rank", value: "copper" },
        { line: 20, quote: "Ivo waited in the dark", entity: "ivo", field: "level", value: 4 },
      ],
      revised,
    );
    expect(results[0]).toMatchObject({ line: 19, moved_from: 18, quote_found: true, verdict: "ok" });
    expect(results[1]).toMatchObject({ line: 20, quote_found: false });
  });

  test("a claim where the record has no value is missing, and a named character with no place is listed", () => {
    const dir = fixtureCopy();
    stage(dir, GOOD_DELTA);
    const text = `${CHAPTER_2}\nSabine Rook watched him from the door of the counting house.\n`;
    writeChapter2(dir, text);
    const c = checkDelta(load(dir), loadRecord(dir), 1, 2);
    expect(unplaced(load(dir), c, [], text)).toEqual([{ entity: "sabine", name: "Sabine Rook" }]);
    const claims = [{ line: 21, quote: "Sabine Rook watched him", entity: "sabine", field: "location", value: "the counting house" }];
    expect(compareClaims(load(dir), c, claims, text)[0]).toMatchObject({ verdict: "missing", severity: "error" });
    expect(unplaced(load(dir), c, claims, text)).toEqual([]);
  });
});

describe("lb brief", () => {
  test("has every part, and the targets and fold of the chapter", () => {
    const dir = fixtureCopy();
    const r = buildBrief(load(dir), loadRecord(dir), 1, 2);
    const text = readFileSync(join(dir, r.file), "utf8");
    for (const h of ["Prose decisions", "This chapter: 1.02", "Next plan: 1.03", "The fold at the chapter start", "Targets at the end", "Cast: Ivo Marsh (protagonist", "Cast: Warden Hale (supporting", "Voice sample: quiet", "Memory 1.01", "Phrase log", "Threads", "The end of the previous chapter (1.01)"]) {
      expect(text).toContain(`## ${h}`);
    }
    expect(text).toContain("level: 3");
    expect(text).toMatch(/sabine:\n\s+name: Sabine Rook/);
    expect(text).toContain("**cracked-lamp** (setup; this chapter plants it)");
    expect(r.dropped).toEqual([]);
    expect(text).toContain("## Draws");
    expect(text).toContain("- No romance and no romantic subplot.");
    expect(text).toContain("Window template");
  });

  test("with windows: off, the brief has no window template", () => {
    const dir = fixtureCopy();
    edit(dir, "project.yaml", "mode: normal", "mode: normal\nwindows: off");
    const r = buildBrief(load(dir), loadRecord(dir), 1, 2);
    const text = readFileSync(join(dir, r.file), "utf8");
    expect(text).not.toContain("Window template");
    expect(text).toContain("No status windows");
  });

  test("drops the next plans first, then shortens the lore index, then shortens the lore that the plan only names, with a warning", () => {
    const dir = fixtureCopy();
    edit(dir, "project.yaml", "mode: normal", "mode: normal\nbrief_chars: 1000");
    const r = buildBrief(load(dir), loadRecord(dir), 1, 2);
    expect(r.dropped).toEqual([
      "Next plan: 1.04 (for direction only; do not write it)",
      "Next plan: 1.03 (for direction only; do not write it)",
      "Lore index: the other entries (run `lb lore <id> --at 1.02` before the chapter uses one): shortened",
      "Lore: The old gallery (the prose never contradicts it): shortened",
      "Lore: Delving crews (the prose never contradicts it): shortened",
    ]);
    expect(r.warnings).toEqual([
      "the plan names lore entry `old-gallery`, and the brief has only its first sentence",
      "the plan names lore entry `delving-crews`, and the brief has only its first sentence",
    ]);
    expect(readFileSync(join(dir, r.file), "utf8")).toContain("run `lb lore delving-crews --at 1.02` for the whole entry");
    expect(r.over).toBe(true);
  });

  const briefText = (dir: string, chapter: number) => readFileSync(join(dir, buildBrief(load(dir), loadRecord(dir), 1, chapter).file), "utf8");

  test("has the act, the climax, the tension and the stakes of the chapter", () => {
    const text = briefText(fixtureCopy(), 4);
    expect(text).toContain("## This act (act2, chapters 3–4) and the book");
    expect(text).toContain("Tension 4 (this book: 2–5): write the pressure, pace and cost of level 4 in guidelines/writing.md §13.");
    expect(text).toContain("Stakes: The crew that took him in");
    expect(text).toContain("ending_state: Ivo knows about his father's debt");
    expect(text).toContain("kind: choice");
  });

  test("has the lore entries that the chapter plan names by title or alias, and no others", () => {
    const dir = fixtureCopy();
    expect(briefText(dir, 2)).toContain("## Lore: Delving crews");
    expect(briefText(dir, 2)).toContain("the boss keeps two shares");
    expect(briefText(dir, 3)).not.toContain("## Lore:");
    edit(dir, "lore/delving-crews.md", "aliases: [crew boss]", "aliases: [Hale]");
    expect(briefText(dir, 3)).toContain("## Lore: Delving crews");
  });

  test("gives the kinds of things that the record does not track", () => {
    expect(briefText(fixtureCopy(), 2)).toContain("Borrowed tools and crew ropes: the record tracks only what a character owns.");
  });

  test("has a lore index with one line for each entry that is not in full", () => {
    const text = briefText(fixtureCopy(), 2);
    const index = text.split("## Lore index")[1].split("\n## ")[0];
    expect(index).toContain("- **The counting house** (`counting-house`, place): A slate building on the square, across from the well.");
    expect(index).toContain("(`harvest-day`, custom; also the harvest)");
    expect(index).not.toContain("delving-crews");
  });

  test("a shortened lore index keeps each title and ID", () => {
    const dir = fixtureCopy();
    edit(dir, "project.yaml", "mode: normal", "mode: normal\nbrief_chars: 1000");
    const text = briefText(dir, 2);
    expect(text).toContain("The counting house (`counting-house`) · Harvest day (`harvest-day`) · The tithe bell (`tithe-bell`)");
  });

  test("gives a lore change only to the chapters after it", () => {
    const dir = fixtureCopy();
    expect(briefText(dir, 4)).toContain("## Lore: The old gallery");
    expect(briefText(dir, 4)).not.toContain("The roof has come down");
    expect(briefText(dir, 5)).toContain("- Since 1.04 (b1/act2/end): The roof has come down");
    expect(briefText(dir, 6)).toMatch(/- \*\*The old gallery\*\* .*\(it has changed since\)/);
    expect(briefText(dir, 3)).not.toMatch(/The old gallery.*changed/);
  });

  test("has a lore entry that the plan lists in `lore`, and an `always` entry in every chapter", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/03.md", "pov: ivo", "pov: ivo\nlore: [delving-crews]");
    writeFileSync(join(dir, "lore/slate.md"), "---\ntitle: Slate\ncategory: law\nalways: true\n---\n\nLenholt slate splits in sheets.\n");
    const text = briefText(dir, 3);
    expect(text).toContain("## Lore: Delving crews");
    expect(text).toContain("## Lore: Slate");
    const r = buildBrief(load(dir), loadRecord(dir), 1, 3);
    expect(r.dropped).not.toContain("Lore: Delving crews (the prose never contradicts it)");
  });

  const section = (text: string, title: string) => text.split(`## ${title}`)[1].split("\n## ")[0];

  test("has each character of the cast: who it is, when it was last seen, and its voice card", () => {
    const text = briefText(fixtureCopy(), 2);
    const hale = section(text, "Cast: Warden Hale");
    expect(hale).toContain("The keeper of the Lenholt well");
    expect(hale).toContain("Calls every digger");
    expect(hale).not.toContain("Last seen");
    expect(section(text, "Cast: Ivo Marsh")).toContain("Last seen: 1.01.");
  });

  test("has a cast index with one line for each character that is not in the cast", () => {
    const index = section(briefText(fixtureCopy(), 5), "Cast index");
    expect(index).toContain("- **Sabine Rook** (`sabine`, main): The reeve's clerk, who enters every tithe token in the ledger at the counting table by the lean-to. Last seen 1.01.");
    expect(index).toContain("(`hale`, supporting; also the warden)");
    expect(index).not.toContain("`ivo`");
  });

  test("has a character that the plan names but does not list, and drops it last", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/03.md", "characters: [ivo, sabine, hale]", "characters: [ivo]");
    expect(briefText(dir, 3)).toContain("## Cast: Warden Hale");
    edit(dir, "project.yaml", "mode: normal", "mode: normal\nbrief_chars: 1000");
    const r = buildBrief(load(dir), loadRecord(dir), 1, 3);
    expect(r.dropped.slice(-2)).toEqual(["Cast: Warden Hale (supporting; the prose never contradicts it)", "Cast: Sabine Rook (main; the prose never contradicts it)"]);
    expect(briefText(dir, 5)).toContain("Warden Hale (`hale`) · Sabine Rook (`sabine`)");
  });

  test("gives a main character's want, need, lie, wound and contradiction, and the arc beats up to this chapter", () => {
    const dir = fixtureCopy();
    const sabine = section(briefText(dir, 4), "Cast: Sabine Rook");
    expect(sabine).toContain("- **Believes** (the lie): Numbers do not lie");
    expect(sabine).toContain("- **Wound** (the prose never tells it; it shows in what they avoid): At eleven");
    expect(sabine).toContain("- **Contradiction** (show it when a scene allows): She is exact");
    expect(sabine).toContain("- Book 1, act1: She copies the warden's rate");
    expect(sabine).toContain("- **This chapter**: She changes one entry to save Ivo");
    expect(sabine).not.toContain("She gives Ivo the ledger");
    expect(sabine).toContain("state: lying");
    expect(section(briefText(dir, 2), "Cast: Warden Hale")).toContain("- **Wants** (chases on the page): A full tithe");
  });

  test("gives a voice change of the arc after its anchor, below the voice card", () => {
    const dir = fixtureCopy();
    expect(section(briefText(dir, 4), "Cast: Sabine Rook")).not.toContain("in the margin");
    const sabine = section(briefText(dir, 6), "Cast: Sabine Rook");
    expect(sabine).toContain("- Since 1.04 (b1/act2/end): She no longer corrects Ivo's numbers aloud.");
    expect(sabine.indexOf("Voice card:")).toBeLessThan(sabine.indexOf("Since 1.04"));
  });

  test("gives a character change only to the chapters after it", () => {
    const dir = fixtureCopy();
    edit(dir, "characters/hale.md", "aliases: [the warden]", "aliases: [the warden]\nchanges:\n  - { from: 1.03, text: Hale has lost two fingers to the rope. }");
    expect(briefText(dir, 3)).not.toContain("lost two fingers");
    expect(section(briefText(dir, 4), "Cast: Warden Hale")).toContain("- Since 1.03: Hale has lost two fingers to the rope.");
    expect(section(briefText(dir, 5), "Cast index")).toMatch(/`hale`.*\(changed since\)/);
  });
});

describe("lb run", () => {
  test("works out each chapter's stage from the files", () => {
    const dir = fixtureCopy();
    stage(dir, GOOD_DELTA);
    writeChapter2(dir);
    let r = runReport(load(dir), 1);
    expect(r.chapters.slice(0, 3).map((c) => c.stage)).toEqual(["done", "drafted", "planned"]);
    expect(r.next.step).toContain("verify-chapter for 1.02");

    mkdirSync(join(dir, "runs/verify"), { recursive: true });
    writeFileSync(join(dir, "runs/verify/01-02.json"), JSON.stringify({ round: 3, verdict: "fail", open: [{ severity: "error", rule: "endings.new", problem: "x" }] }));
    r = runReport(load(dir), 1);
    expect(r.chapters[1]).toMatchObject({ stage: "blocked" });

    writeFileSync(join(dir, "runs/verify/01-02.json"), JSON.stringify({ round: 2, verdict: "pass", open: [{ severity: "warn", rule: "rhythm.triplets", problem: "y" }] }));
    r = runReport(load(dir), 1);
    expect(r.chapters[1]).toMatchObject({ stage: "verified" });
    expect(r.next.step).toContain("lb commit 1.02");
    expect(r.warnings).toEqual([{ chapter: 2, rule: "rhythm.triplets", problem: "y" }]);
    expect(existsSync(join(dir, "runs/book-01.json"))).toBe(true);
  });

  test("in git, a remembered chapter waits for its commit, and a later chapter's ledger entries do not make it wait again", () => {
    const dir = fixtureCopy();
    const git = (...args: string[]) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir, encoding: "utf8" });
    git("init", "-q");
    git("add", "-A", "--", ".", ":!ledger.jsonl");
    git("commit", "-qm", "all but the ledger");
    expect(runReport(load(dir), 1).chapters[0]).toMatchObject({ stage: "remembered" });
    git("add", "ledger.jsonl");
    git("commit", "-qm", "Book 1, chapter 1");
    expect(runReport(load(dir), 1).chapters[0]).toMatchObject({ stage: "done" });
    appendFileSync(join(dir, "ledger.jsonl"), `${JSON.stringify({ entity: "ivo", field: "level", op: "add", value: 1, cause: "x", quote: "y", point: "1.02.1" })}\n`);
    expect(runReport(load(dir), 1).chapters[0]).toMatchObject({ stage: "done" });
  });

  test("autopilot: a blocked chapter gets an extra round, or is committed with its open errors", () => {
    const dir = fixtureCopy();
    edit(dir, "project.yaml", "mode: normal", "mode: autopilot");
    stage(dir, GOOD_DELTA);
    writeChapter2(dir, CHAPTER_2.replace("Ivo waited", "Ivo waited by the tapestry"));
    mkdirSync(join(dir, "runs/verify"), { recursive: true });
    const record = (extra: object) =>
      writeFileSync(join(dir, "runs/verify/01-02.json"), JSON.stringify({ round: 3, verdict: "fail", open: [{ severity: "error", rule: "words.banned", line: 9, problem: "x" }], ...extra }));

    record({});
    let r = runReport(load(dir), 1);
    expect(r.chapters[1]).toMatchObject({ stage: "blocked" });
    expect(r.next.step).toContain("Blocked in autopilot");

    record({ extra_round: true });
    expect(runReport(load(dir), 1).chapters[1]).toMatchObject({ stage: "drafted" });

    expect(lb(["commit", "1.02"], dir).status).toBe(1);
    record({ accepted: true });
    r = runReport(load(dir), 1);
    expect(r.chapters[1]).toMatchObject({ stage: "verified" });
    expect(r.accepted).toEqual([{ chapter: 2, errors: [{ rule: "words.banned", line: 9, problem: "x" }] }]);
    expect(lb(["commit", "1.02"], dir).status).toBe(0);
  });

  test("chapter 1.01 waits for the user when the checkpoint is on", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/chapters/01.md", "status: approved", "status: draft");
    mkdirSync(join(dir, "books/01/deltas"), { recursive: true });
    writeFileSync(join(dir, "books/01/deltas/01.jsonl"), readFileSync(join(dir, "ledger.jsonl")));
    writeFileSync(join(dir, "ledger.jsonl"), "");
    mkdirSync(join(dir, "runs/verify"), { recursive: true });
    writeFileSync(join(dir, "runs/verify/01-01.json"), JSON.stringify({ round: 1, verdict: "pass", open: [] }));
    expect(runReport(load(dir), 1).next.step).toContain("lb approve chapter-1");
    expect(lb(["gate", "chapter-1"], dir).status).toBe(1);

    // The user approves: the delta goes to the ledger.
    expect(lb(["approve", "chapter-1"], dir).status).toBe(0);
    expect(readFileSync(join(dir, "ledger.jsonl"), "utf8").trim().split("\n")).toHaveLength(5);
    expect(lb(["gate", "chapter-1"], dir).status).toBe(0);
    expect(runReport(load(dir), 1).next.step).toContain("lb brief 1.02");
  });
});

import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { check, edit, errorCodes, fixtureCopy } from "./helpers.ts";

describe("the fixture", () => {
  test("has no errors", () => {
    expect(errorCodes(check(fixtureCopy()))).toEqual([]);
  });
});

describe("lore", () => {
  test("a chapter plan lists a lore entry that does not exist", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/03.md", "pov: ivo", "pov: ivo\nlore: [the-duke]");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "lore-unknown", file: "books/01/plan/03.md", path: "lore.0" }));
  });

  test("an entry with no body is a warning, and a file name that is not an ID is an error", () => {
    const dir = fixtureCopy();
    writeFileSync(join(dir, "lore/Old_Well.md"), "---\ntitle: The old well\ncategory: place\n---\n");
    const issues = check(dir);
    expect(issues).toContainEqual(expect.objectContaining({ code: "lore-empty", severity: "warn" }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "file-name", file: "lore/Old_Well.md" }));
  });

  test("an entry needs a category from the list", () => {
    const dir = fixtureCopy();
    edit(dir, "lore/counting-house.md", "category: place", "category: building");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "format", file: "lore/counting-house.md", path: "category" }));
  });

  test("a new lore fact in a memory file needs its entry", () => {
    const dir = fixtureCopy();
    rmSync(join(dir, "lore/tithe-bell.md"));
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "lore-unknown", file: "books/01/memory/01.md", path: "lore_added.0.entry" }));
  });

  test("a long entry and more than three `always` entries are warnings", () => {
    const dir = fixtureCopy();
    writeFileSync(join(dir, "lore/long.md"), `---\ntitle: Long\ncategory: other\n---\n\n${"word ".repeat(251)}\n`);
    for (const id of ["a1", "a2", "a3", "a4"]) writeFileSync(join(dir, `lore/${id}.md`), `---\ntitle: Rule ${id}\ncategory: law\nalways: true\n---\n\nA rule.\n`);
    const issues = check(dir);
    expect(issues).toContainEqual(expect.objectContaining({ code: "lore-long", severity: "warn", file: "lore/long.md" }));
    expect(issues.filter((i) => i.code === "lore-always")).toHaveLength(4);
    expect(errorCodes(issues)).toEqual([]);
  });

  test("a lore change needs a known point or anchor, in story order", () => {
    const dir = fixtureCopy();
    edit(dir, "lore/old-gallery.md", "changes:\n", "changes:\n  - { from: 1.05, text: The vault is sealed. }\n  - { from: 1.09, text: Nothing. }\n");
    const issues = check(dir);
    expect(issues).toContainEqual(expect.objectContaining({ code: "bad-position", file: "lore/old-gallery.md", path: "changes.1.from" }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "lore-change-order", path: "changes.2.from" }));
  });

  test("a change in a memory file needs its change in the entry", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/memory/01.md", "fact: The bell in the shaft rings once for each level that the well pays out. }", "fact: The bell in the shaft rings once for each level that the well pays out., change: true }");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "lore-change-missing", file: "books/01/memory/01.md", path: "lore_added.0" }));
    edit(dir, "lore/tithe-bell.md", "category: system\n", "category: system\nchanges:\n  - { from: 1.01, text: The bell rings twice for Ivo. }\n");
    expect(errorCodes(check(dir))).toEqual([]);
  });

  test("two entries with the same name are an error", () => {
    const dir = fixtureCopy();
    edit(dir, "lore/harvest-day.md", "aliases: [the harvest]", "aliases: [the harvest, Delving Crews]");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "duplicate-name", file: "lore/harvest-day.md" }));
  });

  test("a lore entry and a character with the same name are an error", () => {
    const dir = fixtureCopy();
    edit(dir, "lore/delving-crews.md", "aliases: [crew boss]", "aliases: [crew boss, The Warden]");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "duplicate-name", file: "characters/hale.md" }));
  });
});

describe("the cast", () => {
  /** Oren Pell: a character entity with no file. */
  const withPell = () => {
    const dir = fixtureCopy();
    edit(dir, "schema.yaml", "  tithe-well:", "  pell:\n    type: person\n    name: Oren Pell\n  tithe-well:");
    return dir;
  };
  const MEMORY_2 = "---\nbook: 1\nchapter: 2\nsummary: Ivo reaches copper.\nending_type: reveal\nappeared: [ivo, pell]\n---\n";

  test("a chapter plan lists a character that does not exist", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/03.md", "characters: [ivo, sabine, hale]", "characters: [ivo, pell]");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "character-unknown", file: "books/01/plan/03.md", path: "characters.1" }));
    writeFileSync(join(dir, "characters/pell.md"), "---\nid: pell\nname: Oren Pell\nrole: supporting\nvoice: { vocabulary: Crew words., sentence_length: Short., verbal_habits: [], never_says: [] }\n---\n\nThe crew boss.\n");
    expect(errorCodes(check(dir))).toEqual([]);
  });

  test("a memory file names a character that does not exist, or one with no file in two chapters", () => {
    let dir = fixtureCopy();
    edit(dir, "books/01/memory/01.md", "appeared: [ivo, sabine]", "appeared: [ivo, pell]");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "character-unknown", file: "books/01/memory/01.md", path: "appeared.1" }));

    dir = withPell();
    edit(dir, "books/01/memory/01.md", "appeared: [ivo, sabine]", "appeared: [ivo, pell]");
    expect(check(dir).map((i) => i.code)).not.toContain("character-no-file");
    writeFileSync(join(dir, "books/01/memory/02.md"), MEMORY_2);
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "character-no-file", severity: "warn" }));
  });

  test("a character that a ledger entry creates is a character", () => {
    const dir = fixtureCopy();
    const create = { entity: "pell", op: "create", type: "person", name: "Oren Pell", value: { level: 6 }, cause: "The crew boss appears.", quote: "Pell", point: "1.01.6" };
    writeFileSync(join(dir, "ledger.jsonl"), `${readFileSync(join(dir, "ledger.jsonl"), "utf8").trimEnd()}\n${JSON.stringify(create)}\n`);
    edit(dir, "books/01/memory/01.md", "appeared: [ivo, sabine]", "appeared: [ivo, pell]");
    expect(errorCodes(check(dir))).toEqual([]);
  });

  test("a new detail about a character needs its file, and a change needs a change from its chapter", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/memory/01.md", "appeared:", "character_added:\n  - { character: pell, fact: Pell has a burn scar. }\nappeared:");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "character-added-unknown", path: "character_added.0.character" }));
    edit(dir, "books/01/memory/01.md", "{ character: pell, fact: Pell has a burn scar. }", "{ character: sabine, fact: Sabine is sent to the manor., change: true }");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "character-change-missing", path: "character_added.0" }));
    edit(dir, "characters/sabine.md", "changes:\n", "changes:\n  - { from: 1.01, text: Sabine is sent to the manor. }\n");
    expect(errorCodes(check(dir))).toEqual([]);
  });

  test("a character's changes need a known point or anchor, in story order, and a character needs a body", () => {
    const dir = fixtureCopy();
    edit(dir, "characters/hale.md", "aliases: [the warden]", "aliases: [the warden]\nchanges:\n  - { from: 1.04, text: Hale limps. }\n  - { from: 1.02, text: Hale is hurt. }\n  - { from: 9.01, text: x }");
    writeFileSync(join(dir, "characters/ivo.md"), readFileSync(join(dir, "characters/ivo.md"), "utf8").replace(/---\n\n[\s\S]*$/, "---\n"));
    const issues = check(dir);
    expect(issues).toContainEqual(expect.objectContaining({ code: "character-change-order", file: "characters/hale.md", path: "changes.1.from" }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "bad-position", file: "characters/hale.md", path: "changes.2.from" }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "character-empty", severity: "warn", file: "characters/ivo.md" }));
  });

  test("a main character without a wound, a contradiction or 2 voice states is a warning; a supporting one needs none", () => {
    const dir = fixtureCopy();
    expect(check(dir).map((i) => i.code)).not.toContain("character-depth");
    const sabine = readFileSync(join(dir, "characters/sabine.md"), "utf8");
    writeFileSync(join(dir, "characters/sabine.md"), sabine.replace(/^wound: .*\n/m, "").replace(/^ {4}- \{ state: (lying|close).*\n/gm, ""));
    const depth = check(dir).filter((i) => i.code === "character-depth");
    expect(depth).toEqual([expect.objectContaining({ severity: "warn", file: "characters/sabine.md" })]);
    expect(depth[0].message).toContain("`wound`, 2 or more `voice.states`");
    expect(depth[0].message).not.toContain("contradiction");
  });

  test("a voice state needs a state, a speech and a tell", () => {
    const dir = fixtureCopy();
    edit(dir, "characters/ivo.md", ", tell: Checks a knot that he checked already.", "");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "format", file: "characters/ivo.md", path: "voice.states.1.tell" }));
  });
});

describe("names", () => {
  test("a character, an entity, a lore entry or a plan with an AI default name is an error", () => {
    const dir = fixtureCopy();
    edit(dir, "characters/sabine.md", "name: Sabine Rook", "name: Elara Rook");
    edit(dir, "schema.yaml", "name: Sabine Rook", "name: Elara Rook");
    edit(dir, "lore/delving-crews.md", "aliases: [crew boss]", "aliases: [crew boss, Thorne's men]");
    edit(dir, "books/01/plan/03.md", "pov: ivo", "pov: ivo\n# Lyra waits at the gate.");
    const named = check(dir).filter((i) => i.code === "name-ai-default");
    expect(named.map((i) => i.file).sort()).toEqual(["characters/sabine.md", "lore/delving-crews.md", "schema.yaml"]);
    edit(dir, "books/01/plan/03.md", "outcome: He sees the red page", "outcome: Lyra sees the red page");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "name-ai-default", file: "books/01/plan/03.md" }));
  });
});

describe("bible and schema", () => {
  test("a required decision is missing", () => {
    const dir = fixtureCopy();
    edit(dir, "bible.md", "id: tone", "id: mood");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "decision-missing", message: expect.stringContaining("'tone'") }));
  });

  test("a start value is not a step of the ladder", () => {
    const dir = fixtureCopy();
    edit(dir, "schema.yaml", "rank: unranked", "rank: bronze");
    expect(errorCodes(check(dir))).toContain("bad-value");
  });

  test("a comma inside a flow mapping is a format error with a path", () => {
    const dir = fixtureCopy();
    edit(dir, "characters/ivo.md", 'beat: "He keeps a level the well tries to take, and pays for it with the lamp." }', "beat: He keeps a level, and pays. }");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "format", file: "characters/ivo.md", path: "arc_beats.2" }));
  });
});

describe("book levels", () => {
  test("each book must answer a main question", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan.md", "  answers: [Where do the held levels go?]", "  answers: []");
    expect(errorCodes(check(dir))).toContain("no-answer");
  });

  test("the last act must end on the last chapter", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/06.md", "anchors: [b1/climax, b1/act3/end]", "anchors: [b1/climax]");
    edit(dir, "books/01/plan/05.md", "anchors: [b1/climax-start]", "anchors: [b1/climax-start, b1/act3/end]");
    expect(errorCodes(check(dir))).toContain("anchor-order");
  });

  test("an unmapped act end is reported once, not as a target order error", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/06.md", "anchors: [b1/climax, b1/act3/end]", "anchors: [b1/climax]");
    const codes = errorCodes(check(dir));
    expect(codes).toContain("anchor-unmapped");
    expect(codes).not.toContain("target-order");
  });
});

describe("chapter plans", () => {
  test("a scene tone and a voice card humour are optional, and not empty", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/01.md", 'tone: "dry sparring, then cold"', 'tone: ""');
    edit(dir, "characters/ivo.md", "humour: Almost none. Takes a joke literally, and answers it with a number.", 'humour: ""');
    const issues = check(dir);
    expect(issues).toContainEqual(expect.objectContaining({ code: "format", file: "books/01/plan/01.md", path: "scenes.1.tone" }));
    expect(issues).toContainEqual(expect.objectContaining({ code: "format", file: "characters/ivo.md", path: "voice.humour" }));
  });

  test("two consecutive chapters with the same ending type", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/02.md", "type: reveal", "type: decision");
    expect(errorCodes(check(dir))).toContain("endings.type-repeat");
  });

  test("an exception in the plan waives the ending-type rule", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/02.md", "type: reveal", "type: decision");
    edit(dir, "books/01/plan/02.md", "anchors: [b1/act1/end]", "anchors: [b1/act1/end]\nexceptions:\n  - rule: endings.type-repeat\n    reason: Two decisions in a row, on purpose.");
    expect(errorCodes(check(dir))).not.toContain("endings.type-repeat");
  });

  test("two cliffhangers in three chapters", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/06.md", "type: action", "type: cliffhanger");
    expect(errorCodes(check(dir))).toContain("endings.cliffhanger-rate");
  });

  test("a chapter with no value shift has no job", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/03.md", "to: Ivo knows the ledger holds his father's debt", "to: Ivo trusts the ledger");
    expect(errorCodes(check(dir))).toContain("no-value-shift");
  });

  test("a gap in chapter numbers", () => {
    const dir = fixtureCopy();
    rmSync(join(dir, "books/01/plan/03.md"));
    expect(errorCodes(check(dir))).toContain("chapter-gap");
  });

  test("an exception that names an unknown rule", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/05.md", "rule: rhythm.staccato", "rule: rhythm.stacato");
    expect(errorCodes(check(dir))).toContain("unknown-rule");
  });
});

describe("arc beats", () => {
  test("an arc beat that no chapter places", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/03.md", "arc_beats: [ivo/lie-challenged]", "arc_beats: []");
    expect(errorCodes(check(dir))).toContain("beat-unplaced");
  });

  test("an arc beat placed in two chapters", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/05.md", "arc_beats: []", "arc_beats: [ivo/lie-challenged]");
    expect(errorCodes(check(dir))).toContain("beat-twice");
  });

  test("an arc beat outside its act", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/03.md", "arc_beats: [ivo/lie-challenged]", "arc_beats: []");
    edit(dir, "books/01/plan/05.md", "arc_beats: []", "arc_beats: [ivo/lie-challenged]");
    expect(errorCodes(check(dir))).toContain("beat-wrong-act");
  });
});

describe("threads", () => {
  test("threads.yaml and the chapter plan disagree", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/02.md", "plants: [cracked-lamp]", "plants: []");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "thread-mismatch", file: "books/01/plan/02.md" }));
  });

  test("a payoff before the plant", () => {
    const dir = fixtureCopy();
    edit(dir, "threads.yaml", "  plant: 1.02\n  payoff: 1.06", "  plant: 1.06\n  payoff: 1.02");
    expect(errorCodes(check(dir))).toContain("thread-order");
  });

  test("a point in a book with no chapter plans", () => {
    const dir = fixtureCopy();
    edit(dir, "threads.yaml", "payoff: b1/act3/end", "payoff: 2.03");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "bad-position", message: expect.stringContaining("use a plan anchor") }));
  });
});

describe("targets", () => {
  test("a ladder that goes down", () => {
    const dir = fixtureCopy();
    edit(dir, "targets.yaml", "- anchor: b1/end\n  expect:\n    ivo.rank: iron", "- anchor: b1/end\n  expect:\n    ivo.rank: copper");
    expect(errorCodes(check(dir))).toContain("target-conflict");
  });

  test("a ladder that goes down between two anchors, and reset: true allows it", () => {
    const dir = fixtureCopy();
    edit(dir, "targets.yaml", "- anchor: b1/midpoint\n  expect:", "- anchor: b1/midpoint\n  expect:\n    ivo.rank: unranked");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "target-order", message: expect.stringContaining("ivo.rank goes down") }));
    edit(dir, "targets.yaml", "- anchor: b1/midpoint\n", "- anchor: b1/midpoint\n  reset: true\n");
    expect(errorCodes(check(dir))).not.toContain("target-order");
  });

  test("a counter target that max_step cannot reach", () => {
    const dir = fixtureCopy();
    edit(dir, "targets.yaml", "ivo.level: { min: 3 }", "ivo.level: { min: 9 }");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "target-unreachable", message: expect.stringContaining("allows 6") }));
  });

  test("knowledge that is lost with no reset", () => {
    const dir = fixtureCopy();
    edit(dir, "targets.yaml", "ivo: { warden-sells-tithes: believes-false }", "ivo: { warden-sells-tithes: believes-false, father-debt: unaware }");
    expect(errorCodes(check(dir))).toContain("target-order");
  });

  test("an unknown entity, field and fact", () => {
    const dir = fixtureCopy();
    edit(dir, "targets.yaml", "ivo.rank: copper", "ivo.rank: copper\n    ivo.mana: 3\n    oren.level: 2");
    edit(dir, "targets.yaml", "sabine: { father-debt: knows }", "sabine: { father-debt: knows, dragon-lives: knows }");
    const codes = errorCodes(check(dir));
    expect(codes).toEqual(expect.arrayContaining(["unknown-field", "unknown-entity", "unknown-fact"]));
  });

  test("an ending state with no target is a warning", () => {
    const dir = fixtureCopy();
    edit(dir, "targets.yaml", "- anchor: b1/end\n  expect:\n    ivo.rank: iron\n", "");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "target-missing", severity: "warn" }));
  });
});

describe("voice samples", () => {
  test("a missing kind", () => {
    const dir = fixtureCopy();
    rmSync(join(dir, "voice/quiet.md"));
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "voice-kinds", message: expect.stringContaining("'quiet'") }));
  });

  test("no status window in any sample", () => {
    const dir = fixtureCopy();
    edit(dir, "voice/dialogue.md", /```[\s\S]*?```\n/, "");
    edit(dir, "voice/action.md", /```[\s\S]*?```\n/, "");
    expect(errorCodes(check(dir))).toContain("no-status-window");
  });

  test("a dialogue sample with one character", () => {
    const dir = fixtureCopy();
    edit(dir, "voice/dialogue.md", "characters: [ivo, sabine]", "characters: [ivo]");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "format", file: "voice/dialogue.md", path: "characters" }));
  });

  test("a file name that does not match its kind", () => {
    const dir = fixtureCopy();
    edit(dir, "voice/quiet.md", "kind: quiet", "kind: action");
    expect(errorCodes(check(dir))).toEqual(expect.arrayContaining(["file-name", "voice-kinds"]));
  });

  test("approved with no window template", () => {
    const dir = fixtureCopy();
    edit(dir, "bible.md", /window_template: \|\n(  .*\n)+/, "");
    expect(errorCodes(check(dir))).toContain("no-window-template");
  });
});

describe("draws", () => {
  test("a bible with no draws is only a warning", () => {
    const dir = fixtureCopy();
    edit(dir, "bible.md", /draws:\n(  .*\n)+/, "");
    edit(dir, "books/01/plan.md", "draws: [cost-of-power, small-town-conspiracy, underdog-climb]\n", "");
    const issues = check(dir);
    expect(errorCodes(issues)).toEqual([]);
    expect(issues).toContainEqual(expect.objectContaining({ code: "no-draws", severity: "warn" }));
  });

  test("the draws need at least one exclusion", () => {
    const dir = fixtureCopy();
    edit(dir, "bible.md", "kind: excludes", "kind: gives");
    expect(errorCodes(check(dir))).toContain("no-exclusion");
  });

  test("a gives draw that no book plan delivers", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan.md", "draws: [cost-of-power, small-town-conspiracy, underdog-climb]", "draws: [cost-of-power, small-town-conspiracy]");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "draw-undelivered", file: "books/01/plan.md", message: expect.stringContaining("'underdog-climb'") }));
  });

  test("a book plan names an unknown draw or an exclusion", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan.md", "underdog-climb]", "underdog-climb, no-romance, dragons]");
    expect(errorCodes(check(dir))).toEqual(expect.arrayContaining(["excluded-draw", "unknown-draw"]));
  });

  test("a chapter plan cannot waive an exclusion", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/05.md", "exceptions:\n", "exceptions:\n  - { rule: draws.excluded, reason: a kiss }\n");
    expect(errorCodes(check(dir))).toContain("unwaivable");
  });
});

describe("tension, stakes and the climax", () => {
  const codes = (dir: string) => check(dir).map((i) => `${i.severity} ${i.code} ${i.file}`);

  test("the fixture has no tension warning", () => {
    expect(codes(fixtureCopy()).filter((c) => /tension|climax/.test(c))).toEqual([]);
  });

  test("a plan without tension, stakes, results or a climax gets warnings, not errors", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/03.md", /tension: 3\nstakes: .*\n/, "");
    edit(dir, "books/01/plan/03.md", ", result: loss }", " }");
    edit(dir, "books/01/plan.md", /tension: \{ min: 2, max: 5 \}\nclimax:\n(  .*\n)+/, "");
    edit(dir, "books/01/plan/06.md", "b1/climax, ", "");
    edit(dir, "books/01/plan/05.md", "anchors: [b1/climax-start]\n", "");
    const issues = check(dir);
    expect(errorCodes(issues)).toEqual([]);
    expect(issues).toContainEqual(expect.objectContaining({ code: "tension-missing", severity: "warn", file: "books/01/plan/03.md", message: expect.stringContaining("`tension`, `stakes`, a `result` for each scene") }));
    expect(codes(dir)).toEqual(expect.arrayContaining(["warn tension-missing books/01/plan.md", "warn climax-missing books/01/plan.md"]));
  });

  test("a chapter outside the book's range is an error", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan.md", "tension: { min: 2, max: 5 }", "tension: { min: 2, max: 4 }");
    expect(codes(dir)).toContain("error tension-range books/01/plan/06.md");
  });

  test("the climax spans 2 or more chapters, each one near the book's highest tension", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/05.md", "anchors: [b1/climax-start]\n", "");
    expect(errorCodes(check(dir))).toContain("anchor-unmapped");
    edit(dir, "books/01/plan/06.md", "anchors: [b1/climax, ", "anchors: [b1/climax-start, b1/climax, ");
    expect(codes(dir)).toContain("error climax-span books/01/plan/06.md");

    const dir2 = fixtureCopy();
    edit(dir2, "books/01/plan/05.md", "tension: 4", "tension: 3");
    expect(codes(dir2)).toContain("warn climax-tension books/01/plan/05.md");

    // Two chapters at the peak are fine inside the climax.
    const dir3 = fixtureCopy();
    edit(dir3, "books/01/plan/05.md", "tension: 4", "tension: 5");
    expect(codes(dir3).filter((c) => /tension|climax/.test(c))).toEqual([]);
  });

  test("the decisive chapter of the climax is in the last act, with the highest tension", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/06.md", "b1/climax, ", "");
    expect(errorCodes(check(dir))).toContain("anchor-unmapped");
    edit(dir, "books/01/plan/03.md", "anchors: [b1/midpoint]", "anchors: [b1/midpoint, b1/climax]");
    expect(errorCodes(check(dir))).toContain("anchor-order");

    const dir2 = fixtureCopy();
    edit(dir2, "books/01/plan/06.md", "tension: 5", "tension: 4");
    edit(dir2, "books/01/plan/05.md", "tension: 4", "tension: 5");
    expect(codes(dir2)).toContain("error climax-peak books/01/plan/06.md");
  });

  test("the climax cannot also be a custom anchor", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan.md", "  - { id: b1/midpoint", "  - { id: b1/climax, act: act3 }\n  - { id: b1/midpoint");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "duplicate-id", message: expect.stringContaining("comes from `climax`") }));
  });

  test("a flat curve, no drop after the peak, a lower act and an act of only wins are warnings", () => {
    const dir = fixtureCopy();
    for (const n of ["01", "04"]) edit(dir, `books/01/plan/${n}.md`, /tension: \d/, "tension: 3");
    expect(codes(dir)).toContain("warn tension.flat books/01/plan/04.md");

    const dir2 = fixtureCopy();
    edit(dir2, "books/01/plan/02.md", "tension: 3", "tension: 5");
    expect(codes(dir2)).toContain("warn tension.act-rise books/01/plan/04.md");
    edit(dir2, "books/01/plan/03.md", "tension: 3", "tension: 5");
    expect(codes(dir2)).toContain("warn tension.after-peak books/01/plan/03.md");

    const dir3 = fixtureCopy();
    edit(dir3, "books/01/plan/01.md", /result: mixed/g, "result: win");
    edit(dir3, "books/01/plan/02.md", "result: mixed", "result: win");
    expect(codes(dir3)).toContain("warn tension.results books/01/plan/02.md");
    edit(dir3, "books/01/plan/02.md", "scenes:", "exceptions:\n  - { rule: tension.results, reason: The first act is a clean climb. }\nscenes:");
    expect(codes(dir3)).not.toContain("warn tension.results books/01/plan/02.md");
  });
});

describe("windows: off", () => {
  test("needs no status window and no window template", () => {
    const dir = fixtureCopy();
    edit(dir, "project.yaml", "mode: normal", "mode: normal\nwindows: off");
    edit(dir, "voice/dialogue.md", /```[\s\S]*?```\n/, "");
    edit(dir, "voice/action.md", /```[\s\S]*?```\n/, "");
    edit(dir, "bible.md", /window_template: \|\n(  .*\n)+/, "");
    expect(errorCodes(check(dir))).toEqual([]);
  });
});

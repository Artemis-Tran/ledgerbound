import { rmSync, writeFileSync } from "node:fs";
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

  test("two entries with the same name are an error", () => {
    const dir = fixtureCopy();
    edit(dir, "lore/harvest-day.md", "aliases: [the harvest]", "aliases: [the harvest, Delving Crews]");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "lore-duplicate-name", file: "lore/harvest-day.md" }));
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
    edit(dir, "books/01/plan/06.md", "anchors: [b1/act3/end]\n", "");
    edit(dir, "books/01/plan/05.md", "arc_beats: []", "arc_beats: []\nanchors: [b1/act3/end]");
    expect(errorCodes(check(dir))).toContain("anchor-order");
  });

  test("an unmapped act end is reported once, not as a target order error", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/06.md", "anchors: [b1/act3/end]\n", "");
    const codes = errorCodes(check(dir));
    expect(codes).toContain("anchor-unmapped");
    expect(codes).not.toContain("target-order");
  });
});

describe("chapter plans", () => {
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

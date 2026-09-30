import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { lintFile } from "../src/lint/index.ts";
import { lintProse, type LintOptions } from "../src/lint/lint.ts";
import { parseProse } from "../src/lint/text.ts";
import { edit, FIXTURE, fixtureCopy, IMPORTED_FIXTURE, importedCopy } from "./helpers.ts";

const lint = (text: string, opts: LintOptions = {}) => lintProse(text, 1, "ch.md", opts).findings;
const rules = (text: string, opts?: LintOptions) => lint(text, opts).map((f) => f.rule);
/** A neutral paragraph, so that one rule can be tested alone. */
const FILLER = "The crew boss counted the ropes on the wall twice and wrote the number on the slate by the door.";

describe("the parser", () => {
  test("keeps a dialogue tag in the same sentence", () => {
    const { sentences } = parseProse('"Go," she said. He went down the ladder.');
    expect(sentences.map((s) => s.text)).toEqual(['"Go," she said.', "He went down the ladder."]);
    expect(sentences[0].dialogue).toBe(true);
  });

  test("skips status windows in code fences and gives real line numbers", () => {
    const { sentences } = parseProse("One line here.\n\n```\n[TITHE]\nLevel 2 → 3\n```\n\nTwo lines here.", 10);
    expect(sentences.map((s) => [s.text, s.line])).toEqual([
      ["One line here.", 10],
      ["Two lines here.", 17],
    ]);
  });
});

describe("the voice samples of the fixture", () => {
  test.each(["dialogue", "action", "quiet"])("%s is clean, also against the other two", (kind) => {
    expect(lintFile(join(FIXTURE, "voice", `${kind}.md`)).findings).toEqual([]);
  });

  test.each(["dialogue", "action", "quiet"])("%s of the imported example is clean", (kind) => {
    expect(lintFile(join(IMPORTED_FIXTURE, "voice", `${kind}.md`)).findings).toEqual([]);
  });

  test("a sample from an imported book is the author's prose: its findings are warnings", () => {
    const staccato = "blew out the lamp.\n\nIt was cold. It was dark. It was late.";
    const planned = fixtureCopy();
    edit(planned, "voice/quiet.md", "blew out the lamp.", staccato);
    expect(lintFile(join(planned, "voice/quiet.md")).findings).toContainEqual(expect.objectContaining({ rule: "rhythm.staccato", severity: "error" }));

    const imported = importedCopy();
    edit(imported, "voice/quiet.md", "blew out the lamp.", staccato);
    const f = lintFile(join(imported, "voice/quiet.md")).findings.find((x) => x.rule === "rhythm.staccato");
    expect(f).toMatchObject({ severity: "warn", message: expect.stringContaining("the author's prose from 1.03") });
  });
});

describe("§4 banned phrases", () => {
  test.each([
    ["The mine was a testament to greed.", "testament-to"],
    ["His jaw tightened.", "jaw-tightened"],
    ["She let out a breath and sat.", "let-out-a-breath"],
    ["The air grew thick with dust.", "air-grew-thick"],
    ["He couldn't help but look.", "couldnt-help-but"],
    ["A shiver ran down his spine as the rope went slack.", "shivers-down-spine"],
    ["The warden smirked at the slate.", "smirk"],
  ])("%s", (text, id) => {
    expect(lint(text)).toContainEqual(expect.objectContaining({ rule: "words.banned", message: expect.stringContaining(id) }));
  });

  test("the project can remove a phrase and add one", () => {
    const text = "She danced across the yard to the well bucket in the morning light.";
    expect(rules(text)).toContain("words.banned");
    expect(rules(text, { config: { banned_add: [], banned_remove: ["dance-metaphor"], body_tells_add: {}, max_em_dash_per_1000: 3 } })).not.toContain("words.banned");
    expect(rules("The reeve said wherefore twice.", { config: { banned_add: ["wherefore"], banned_remove: [], body_tells_add: {}, max_em_dash_per_1000: 3 } })).toContain("words.banned");
  });
});

describe("§4 names", () => {
  test.each([
    ["Elara held the rope.", "elara"],
    ["The warden was Kaelen now.", "kael"],
    ["\"Voss,\" Sabine said.", "voss"],
    ["Hartley's cart was late.", "hartley"],
  ])("%s", (text, id) => {
    expect(lint(text)).toContainEqual(expect.objectContaining({ rule: "names.ai-default", severity: "error", message: expect.stringContaining(id) }));
  });

  test("a name only with its capital letter and as a whole word", () => {
    expect(rules("The debt would vex him. Marcuson and Elaras came up the hill.")).not.toContain("names.ai-default");
  });

  test("the project cannot remove a name", () => {
    const config = { banned_add: [], banned_remove: ["elara", "names.ai-default"], body_tells_add: {}, max_em_dash_per_1000: 3 };
    expect(rules("Elara held the rope.", { config })).toContain("names.ai-default");
  });
});

describe("§4 body tells", () => {
  test("the third nod in a chapter is an error", () => {
    const text = ["He nodded at the crew boss.", FILLER, "She nodded at the ledger.", FILLER, "They nodded at the well."].join("\n\n");
    const f = lint(text).filter((x) => x.rule === "words.body-tells");
    expect(f).toHaveLength(1);
    expect(f[0]).toMatchObject({ line: 9, severity: "error" });
  });
});

describe("§3 rhythm", () => {
  test("three short sentences with the same opening is an error", () => {
    expect(lint("It was cold. It was dark. It was late.")).toContainEqual(expect.objectContaining({ rule: "rhythm.staccato", severity: "error" }));
  });

  test("three short sentences with different openings is a warning (maybe an action beat)", () => {
    expect(lint("Stone cracked. Ivo rolled left. The roof came down.")).toContainEqual(expect.objectContaining({ rule: "rhythm.staccato", severity: "warn" }));
  });

  test("two short sentences are fine", () => {
    expect(rules(`The token was warm. Slates always were. ${FILLER}`)).not.toContain("rhythm.staccato");
  });

  test("short dialogue lines do not count as a staccato run", () => {
    expect(rules('"No." "Why?" "Rope." "Fine."')).not.toContain("rhythm.staccato");
  });

  test("three sentences that start with the same word", () => {
    const text = "He climbed down the ladder to the second gallery. He counted the rungs as he went past them. He stopped at the flooded seam and listened.";
    expect(lint(text)).toContainEqual(expect.objectContaining({ rule: "rhythm.openings", line: 1 }));
  });

  test("anadiplosis", () => {
    expect(rules("The shaft went down into the dark. Dark water waited at the bottom of it.")).toContain("rhythm.anadiplosis");
  });

  test("em dashes above 3 per 1,000 words", () => {
    const text = `${FILLER} A rope — a long one — and a hook — rusted — lay there.`;
    expect(lint(text)).toContainEqual(expect.objectContaining({ rule: "rhythm.em-dash", severity: "error" }));
    expect(rules(`${FILLER} A rope — a long one.`)).not.toContain("rhythm.em-dash");
  });

  test("a clause chain is a warning, and a list of items is not", () => {
    const chain = "Then they were gone, and the sand was grey and pocked, and the sea came in over it.";
    expect(lint(chain)).toContainEqual(expect.objectContaining({ rule: "rhythm.clause-chains", severity: "warn" }));
    expect(rules("The sand was grey, pocked, and cold, and he left.")).not.toContain("rhythm.clause-chains");
    expect(rules('"He ran, and she ran, and the dog ran," Ivo said.')).not.toContain("rhythm.clause-chains");
  });

  test("five commas in one sentence is a warning", () => {
    expect(rules("He took the rope, the hook, the slate, the lamp, the knife, and the bread from the shelf.")).toContain("rhythm.commas");
    expect(rules("He took the rope, the hook, the slate, and the lamp from the shelf.")).not.toContain("rhythm.commas");
  });

  test("the second contrast frame is a warning", () => {
    const text = "It wasn't the rope. It was the hook. He came not for the pay, but for the rank.";
    expect(lint(text).filter((f) => f.rule === "rhythm.contrast")).toHaveLength(1);
  });

  test("a third one-line paragraph is a warning, and a third in a row is an error", () => {
    const apart = ["He waited.", FILLER, "The bell rang.", FILLER, "Nobody came."].join("\n\n");
    expect(lint(apart).filter((f) => f.rule === "rhythm.one-line-paragraphs").map((f) => f.severity)).toEqual(["warn"]);
    const together = [FILLER, "He waited.", "The bell rang.", "Nobody came."].join("\n\n");
    expect(lint(together).filter((f) => f.rule === "rhythm.one-line-paragraphs").map((f) => [f.line, f.severity])).toEqual([[7, "error"]]);
  });
});

describe("§1 endings and §2 openings", () => {
  test("a reflective last line", () => {
    expect(rules(`${FILLER}\n\nHe knew that nothing would ever be the same.`)).toContain("endings.banned");
  });

  test("a question as the last line", () => {
    expect(rules(`${FILLER}\n\nWhat was the well hiding from him?`)).toContain("endings.question");
  });

  test("a question in dialogue as the last line is allowed", () => {
    expect(rules(`${FILLER}\n\n"Where's the ledger?"`)).not.toContain("endings.question");
  });

  test("a waking-up opening", () => {
    expect(rules(`Ivo woke to the sound of the bell. ${FILLER}`)).toContain("openings.banned");
  });
});

describe("§5 dialogue and §6 hedges", () => {
  test("therapy language only in dialogue", () => {
    expect(rules('"I hear you," she said.')).toContain("dialogue.therapy");
    expect(rules("The rules set boundaries on the claim.")).not.toContain("dialogue.therapy");
  });

  test("tag adverbs and fancy tag verbs", () => {
    expect(rules('"Go," she said softly.')).toContain("dialogue.tags");
    expect(rules('"Go," she hissed.')).toContain("dialogue.tags");
  });

  test("hedges", () => {
    expect(rules("The rope somehow held.")).toContain("emotion.hedges");
  });
});

describe("§8 repetition", () => {
  const corpus = [{ file: "books/01/chapters/01.md", body: "The water was black like a closed eye under the lamp.", firstLine: 1 }];

  test("the same simile in another chapter is an error", () => {
    const f = lint("The pit looked like a closed eye in the dark.", { corpus });
    expect(f).toContainEqual(expect.objectContaining({ rule: "repetition.simile", severity: "error", seeAlso: [{ file: "books/01/chapters/01.md", line: 1 }] }));
  });

  test("a distinctive phrase used twice in one chapter is reported at its second use", () => {
    const text = "Sabine ran the capped pen down the names.\n\nLater she ran the capped pen down the names again.";
    const f = lint(text).filter((x) => x.rule === "repetition.phrase");
    expect(f).toHaveLength(1);
    expect(f[0].line).toBe(3);
  });
});

describe("waivers and line ranges", () => {
  test("a rule in the chapter plan's exceptions is waived", () => {
    const f = lint("It was cold. It was dark. It was late.", { waive: ["rhythm.staccato"] }).find((x) => x.rule === "rhythm.staccato");
    expect(f?.waived).toBe(true);
  });

  test("--lines keeps only findings in the range", () => {
    const text = `His jaw tightened.\n\n${FILLER}\n\nHer eyes widened.`;
    expect(lint(text, { lines: [5, 5] }).map((f) => f.line)).toEqual([5]);
  });
});

describe("--before: a revision adds no finding", () => {
  test("a rule with more findings than before the revision is an error", () => {
    const dir = fixtureCopy();
    const chapter = join(dir, "books", "01", "chapters", "01.md");
    const before = join(dir, "before.md");
    writeFileSync(before, readFileSync(chapter, "utf8"));
    expect(lintFile(chapter, { before }).findings).toEqual([]);
    edit(dir, "books/01/chapters/01.md", "when the weight went out of the rope.", "when the weight went out of the rope. It was not the rope, but the hook. It was not fear, but the cold.");
    const f = lintFile(chapter, { before }).findings.filter((x) => x.severity === "error");
    expect(f).toContainEqual(expect.objectContaining({ rule: "rhythm.contrast", message: expect.stringContaining("0 before, 2 now") }));
  });
});

describe("windows: off", () => {
  test("each status window is an error", () => {
    const dir = fixtureCopy();
    edit(dir, "project.yaml", "mode: normal", "mode: normal\nwindows: off");
    const findings = lintFile(join(dir, "voice", "action.md")).findings;
    expect(findings.map((f) => f.rule)).toEqual(["windows.off"]);
    expect(findings[0].severity).toBe("error");
  });
});

describe("length.target", () => {
  const chapter = (dir: string) => join(dir, "books", "01", "chapters", "01.md");
  const length = (dir: string, lines?: [number, number]) => lintFile(chapter(dir), { lines }).findings.filter((f) => f.rule === "length.target");

  test("a chapter near the plan's `words` has no finding", () => {
    expect(length(fixtureCopy())).toEqual([]);
  });

  test("without `words`, the target is chapter_words, and a far chapter is a warning", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/01.md", "words: 450\n", "");
    const f = length(dir);
    expect(f).toHaveLength(1);
    expect(f[0].severity).toBe("warn");
    expect(f[0].message).toContain("the target is 2500");
  });

  test("a plan exception waives it, and a line range skips it", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/01.md", "words: 450", "words: 5000\nexceptions: [{ rule: length.target, reason: a test }]");
    expect(length(dir)[0]?.waived).toBe(true);
    expect(length(dir, [1, 1000])).toEqual([]);
  });
});

describe("the voice samples in a chapter's corpus", () => {
  test("a phrase copied from a voice sample is a finding", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/chapters/01.md", "when the weight went out of the rope.", "when the rope went slack in his hands.");
    const f = lintFile(join(dir, "books", "01", "chapters", "01.md")).findings.filter((x) => x.rule === "repetition.phrase");
    expect(f).toHaveLength(1);
    expect(f[0].message).toContain("copied from a voice sample");
    expect(f[0].seeAlso).toContainEqual(expect.objectContaining({ file: "voice/dialogue.md" }));
  });
});

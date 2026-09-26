import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { lintFile } from "../src/lint/index.ts";
import { lintProse, type LintOptions } from "../src/lint/lint.ts";
import { parseProse } from "../src/lint/text.ts";
import { edit, FIXTURE, fixtureCopy } from "./helpers.ts";

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

  test("the second contrast frame is a warning", () => {
    const text = "It wasn't the rope. It was the hook. He came not for the pay, but for the rank.";
    expect(lint(text).filter((f) => f.rule === "rhythm.contrast")).toHaveLength(1);
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

describe("windows: off", () => {
  test("each status window is an error", () => {
    const dir = fixtureCopy();
    edit(dir, "project.yaml", "mode: normal", "mode: normal\nwindows: off");
    const findings = lintFile(join(dir, "voice", "action.md")).findings;
    expect(findings.map((f) => f.rule)).toEqual(["windows.off"]);
    expect(findings[0].severity).toBe("error");
  });
});

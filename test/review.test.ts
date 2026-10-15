import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { loadProject, type Project } from "../src/project.ts";
import { checkDelta, commitChapter, loadRecord } from "../src/record.ts";
import { discardChapter, reopenChapters } from "../src/reopen.ts";
import { runReport } from "../src/run.ts";
import { check, edit, errorCodes, fixtureCopy, importedCopy } from "./helpers.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const lb = (args: string[], cwd: string) => spawnSync("node", [CLI, ...args], { cwd, encoding: "utf8" });
const load = (dir: string): Project => loadProject(dir).project!;
const REVIEW = "books/01/review.md";

const CHAPTER_2 = `---
status: draft
book: 1
chapter: 2
title: Copper
---

He went into the flooded gallery with the lamp held high and the water to his chest. The lamp glass cracked on a low beam, and the flame shrank to a bead.

The token came up hot in the bucket when he climbed out.

Copper, the window said, and he said it back to himself twice on the walk to the crews.
`;

const DELTA_2 = [
  { entity: "ivo", field: "location", op: "set", value: "the flooded gallery", cause: "The last level is past the gallery.", quote: "He went into the flooded gallery" },
  { entity: "ivo", field: "inventory", op: "add", value: "cracked-lamp", cause: "The lamp cracks on a beam.", quote: "The lamp glass cracked" },
  { entity: "ivo", field: "level", op: "add", value: 1, cause: "The dive pays out a level.", quote: "The token came up hot" },
  { entity: "ivo", field: "rank", op: "set", value: "copper", cause: "Level four is copper.", quote: "Copper, the window said" },
];

/** The fixture with chapter 2 written and committed: two approved chapters, 9 ledger entries. */
function twoChapters(): string {
  const dir = fixtureCopy();
  mkdirSync(join(dir, "books/01/deltas"), { recursive: true });
  writeFileSync(join(dir, "books/01/deltas/02.jsonl"), DELTA_2.map((e) => JSON.stringify(e)).join("\n") + "\n");
  writeFileSync(join(dir, "books/01/chapters/02.md"), CHAPTER_2);
  expect(commitChapter(load(dir), loadRecord(dir), 1, 2).ok).toBe(true);
  return dir;
}

const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");

describe("the book review", () => {
  test("the example review is valid", () => {
    expect(errorCodes(check(fixtureCopy()))).toEqual([]);
  });

  test("two findings with one ID", () => {
    const dir = fixtureCopy();
    edit(dir, REVIEW, "id: sabine-wants-nothing", "id: second-bell-unfelt");
    expect(errorCodes(check(dir))).toEqual(["review-duplicate"]);
  });

  test("a finding names a chapter that the book does not have", () => {
    const dir = fixtureCopy();
    edit(dir, REVIEW, 'chapters: ["1.01"]\n    problem: Sabine', 'chapters: ["1.07"]\n    problem: Sabine');
    expect(errorCodes(check(dir))).toEqual(["review-chapter"]);
  });

  test("a finding that changes the record is at least a scene", () => {
    const dir = fixtureCopy();
    edit(dir, REVIEW, "record: change\n    size: scene", "record: change\n    size: span");
    expect(check(dir)).toContainEqual(expect.objectContaining({ code: "format", file: REVIEW, path: "findings.3.size" }));
  });

  test("an imported book has no review", () => {
    const dir = importedCopy();
    writeFileSync(join(dir, REVIEW), read(fixtureCopy(), REVIEW));
    expect(errorCodes(check(dir))).toContain("review-imported");
  });
});

describe("finding sources and the census", () => {
  test("a pattern finding needs its origin and its census", () => {
    const dir = fixtureCopy();
    edit(dir, REVIEW, /    origin: \[.*\]\n/, "");
    edit(dir, REVIEW, /    census: \{.*\}\n/, "");
    expect(check(dir).filter((i) => i.severity === "error").map((i) => i.path)).toEqual([
      expect.stringContaining("origin"),
      expect.stringContaining("census"),
    ]);
  });

  test("a census regex must compile, and only a pattern has a census", () => {
    const dir = fixtureCopy();
    edit(dir, REVIEW, "match: ['\\bthe rope\\b']", "match: ['(the rope']");
    expect(check(dir).some((i) => i.severity === "error" && i.message.includes("not a regex"))).toBe(true);
    const other = fixtureCopy();
    edit(other, REVIEW, "    source: plan\n", "    source: plan\n    census: { look_for: the token, limit: { per_book: 1 } }\n");
    expect(check(other).some((i) => i.severity === "error" && i.message.includes("only a pattern finding"))).toBe(true);
  });

  test("a ready verdict with an open major finding, and an old finding that points nowhere", () => {
    const dir = fixtureCopy();
    edit(dir, REVIEW, "verdict: revise", "verdict: ready\nearlier:\n  - { id: old-one, status: partly, finding: no-such-finding }");
    expect(errorCodes(check(dir))).toEqual(["review-earlier", "review-verdict"]);
  });

  test("lb census gives each place by chapter and line, joins overlapping matches, and exits 1 over the limit", () => {
    const dir = fixtureCopy();
    const r = lb(["census", "--finding", "rope-in-every-beat", "--json"], dir);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout)).toMatchObject({ total: 5, over: ["1.01"], within: false });
    const both = JSON.parse(lb(["census", "the rope", "rope", "--json"], dir).stdout);
    expect(both.total).toBe(5);
    expect(both.chapters[0].matches[0]).toMatchObject({ line: expect.any(Number), text: "the rope" });
    expect(lb(["census", "the rope"], dir).status).toBe(0);
  });
});

describe("dialogue measures and a census by lint", () => {
  const quips = '\n\n"Late again."\n\n"The rope was slow."\n\n"Ropes are not slow."\n\n"This one is."\n\n"Then buy another."\n';
  const withChain = () => {
    const dir = fixtureCopy();
    writeFileSync(join(dir, "books/01/chapters/01.md"), read(dir, "books/01/chapters/01.md") + quips);
    return dir;
  };

  test("lb census --lint counts the findings of a lint rule, and a finding can take its census by lint", () => {
    const dir = withChain();
    expect(JSON.parse(lb(["census", "--lint", "dialogue.quip-chain", "--json"], dir).stdout)).toMatchObject({ lint: "dialogue.quip-chain", total: 1 });
    expect(lb(["census", "--lint", "dialogue.subtext"], dir).status).toBe(2);
    edit(dir, REVIEW, "census: { match: ['\\bthe rope\\b'], limit: { per_chapter: 3 } }", "census: { lint: dialogue.quip-chain, limit: { per_chapter: 0 } }");
    expect(errorCodes(check(dir))).toEqual([]);
    const r = lb(["census", "--finding", "rope-in-every-beat", "--json"], dir);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout)).toMatchObject({ total: 1, over: ["1.01"] });
  });

  test("a census lint rule must be one that lb lint checks", () => {
    const dir = fixtureCopy();
    edit(dir, REVIEW, "census: { match: ['\\bthe rope\\b'], limit: { per_chapter: 3 } }", "census: { lint: dialogue.subtext, limit: { per_chapter: 0 } }");
    expect(check(dir)).toContainEqual(expect.objectContaining({ message: expect.stringContaining("not a rule that lb lint checks") }));
  });

  test("lb dialogue measures each chapter of a book, or any prose file", () => {
    const dir = withChain();
    const [row] = JSON.parse(lb(["dialogue", "--json"], dir).stdout);
    expect(row).toMatchObject({ file: "books/01/chapters/01.md", longestRun: 5, quipChains: [expect.any(Number)] });
    const sample = JSON.parse(lb(["dialogue", "voice/dialogue.md", "--json"], dir).stdout);
    expect(sample[0]).toMatchObject({ file: "voice/dialogue.md", quipChains: [] });
  });
});

describe("lb reopen", () => {
  test("a dry run names the chapters and changes nothing", () => {
    const dir = twoChapters();
    const ledger = read(dir, "ledger.jsonl");
    const r = lb(["reopen", "1.01", "--dry-run", "--json"], dir);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout)).toMatchObject({ ok: true, chapters: ["1.01", "1.02"], entries: 9 });
    expect(JSON.parse(r.stdout).words).toBeGreaterThan(40);
    expect(read(dir, "ledger.jsonl")).toBe(ledger);
    expect(read(dir, "books/01/chapters/01.md")).toContain("status: approved");
  });

  test("takes the ledger back to the chapter start; the chapters are drafts with their staged deltas", () => {
    const dir = twoChapters();
    const before = read(dir, "ledger.jsonl").trim().split("\n");
    mkdirSync(join(dir, "runs/briefs"), { recursive: true });
    writeFileSync(join(dir, "runs/briefs/01-02.md"), "old brief");

    expect(reopenChapters(load(dir), loadRecord(dir), 1, 1)).toMatchObject({ ok: true, chapters: ["1.01", "1.02"], entries: 9 });
    expect(read(dir, "ledger.jsonl")).toBe("");
    expect(read(dir, "books/01/deltas/01.jsonl").trim().split("\n").map((l) => JSON.parse(l).point)).toEqual([undefined, undefined, undefined, undefined, undefined]);
    expect(read(dir, "books/01/chapters/01.md")).toContain("status: draft");
    expect(read(dir, "books/01/chapters/02.md")).toContain("status: draft");
    // The revised chapter loses its memory and its verify record; a later chapter gets a record that says it is reopened.
    expect(existsSync(join(dir, "books/01/memory/01.md"))).toBe(false);
    expect(existsSync(join(dir, "runs/briefs/01-02.md"))).toBe(false);
    expect(JSON.parse(read(dir, "runs/verify/01-02.json"))).toEqual({ round: 0, verdict: "fail", open: [], reopened: true });
    expect(errorCodes(check(dir))).toEqual([]);

    const run = runReport(load(dir), 1);
    expect(run.chapters.slice(0, 2)).toEqual([
      { chapter: 1, stage: "drafted" },
      { chapter: 2, stage: "drafted", note: "reopened: check the record again" },
    ]);
    // The staged deltas are legal, and a new commit in order gives the same ledger back.
    expect(checkDelta(load(dir), loadRecord(dir), 1, 1).issues.filter((i) => i.severity === "error")).toEqual([]);
    expect(commitChapter(load(dir), loadRecord(dir), 1, 1).ok).toBe(true);
    expect(commitChapter(load(dir), loadRecord(dir), 1, 2).ok).toBe(true);
    expect(read(dir, "ledger.jsonl").trim().split("\n")).toEqual(before);
  });

  test("reopens only from the chapter on", () => {
    const dir = twoChapters();
    expect(reopenChapters(load(dir), loadRecord(dir), 1, 2)).toMatchObject({ ok: true, chapters: ["1.02"], entries: 4 });
    expect(read(dir, "ledger.jsonl").trim().split("\n")).toHaveLength(5);
    expect(read(dir, "books/01/chapters/01.md")).toContain("status: approved");
    expect(existsSync(join(dir, "runs/verify/01-02.json"))).toBe(false);
  });

  test("refuses a chapter that is not approved, and a chapter of an imported book", () => {
    const dir = fixtureCopy();
    const r = lb(["reopen", "1.02"], dir);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("not approved");
    expect(lb(["reopen", "1.01"], importedCopy()).stdout).toContain("imported");
  });
});

describe("lb discard", () => {
  test("deletes the prose and every file made from it; the plan stays, and the chapter is planned again", () => {
    const dir = twoChapters();
    // Chapter 2 is reopened after chapter 1, so it has a verify record.
    expect(reopenChapters(load(dir), loadRecord(dir), 1, 1).ok).toBe(true);
    mkdirSync(join(dir, "runs/briefs"), { recursive: true });
    for (const f of ["runs/briefs/01-02.md", "runs/verify/01-02.findings.json", "runs/verify/01-02.r1.md", "runs/verify/01-02.r12.md", "runs/verify/01-01.r1.md", "books/01/memory/02.md"]) {
      writeFileSync(join(dir, f), "old");
    }

    const dry = lb(["discard", "1.02", "--dry-run", "--json"], dir);
    expect(dry.status).toBe(0);
    expect(existsSync(join(dir, "books/01/chapters/02.md"))).toBe(true);

    const r = discardChapter(load(dir), 1, 2);
    expect(r).toEqual({ ok: true, errors: [], deleted: JSON.parse(dry.stdout).deleted });
    expect(r.deleted).toEqual([
      "books/01/chapters/02.md",
      "books/01/deltas/02.jsonl",
      "books/01/memory/02.md",
      "runs/briefs/01-02.md",
      "runs/verify/01-02.findings.json",
      "runs/verify/01-02.json",
      "runs/verify/01-02.r1.md",
      "runs/verify/01-02.r12.md",
    ]);
    // The files of another chapter stay.
    expect(existsSync(join(dir, "runs/verify/01-01.r1.md"))).toBe(true);
    expect(existsSync(join(dir, "books/01/plan/02.md"))).toBe(true);
    expect(errorCodes(check(dir))).toEqual([]);
    expect(runReport(load(dir), 1).chapters[1]).toEqual({ chapter: 2, stage: "planned" });
  });

  test("refuses an approved chapter and a chapter of an imported book", () => {
    const dir = twoChapters();
    const r = lb(["discard", "1.02"], dir);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("lb reopen 1.02");
    expect(existsSync(join(dir, "books/01/chapters/02.md"))).toBe(true);
    expect(lb(["discard", "1.01"], importedCopy()).stdout).toContain("imported");
  });
});

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { loadProject, type Project } from "../src/project.ts";
import { loadRecord } from "../src/record.ts";
import { reopenChapters } from "../src/reopen.ts";
import { changeBooks, changeStructure } from "../src/structure.ts";
import { check, edit, fixtureCopy, IMPORTED_FIXTURE, importedCopy } from "./helpers.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const lb = (args: string[], cwd: string) => spawnSync("node", [CLI, ...args], { cwd, encoding: "utf8" });
const load = (dir: string): Project => loadProject(dir).project!;
const read = (dir: string, file: string) => readFileSync(join(dir, file), "utf8");
const chapterOf = (dir: string, file: string) => Number(/^chapter: (\d+)$/m.exec(read(dir, file))![1]);
const titleOf = (dir: string, file: string) => /^title: (.+)$/m.exec(read(dir, file))![1];

describe("lb chapter", () => {
  test("move: the plans swap, and each point reference follows its chapter; nothing else in the files changes", () => {
    const dir = fixtureCopy();
    const [t3, t4] = [titleOf(dir, "books/01/plan/03.md"), titleOf(dir, "books/01/plan/04.md")];
    const threads = read(dir, "threads.yaml");

    const r = changeStructure(load(dir), 1, { kind: "move", from: 3, to: 4 });
    expect(r).toMatchObject({ ok: true, renumbered: [{ from: "1.03", to: "1.04" }, { from: "1.04", to: "1.03" }], references: ["threads.yaml"] });
    expect([titleOf(dir, "books/01/plan/03.md"), titleOf(dir, "books/01/plan/04.md")]).toEqual([t4, t3]);
    expect([chapterOf(dir, "books/01/plan/03.md"), chapterOf(dir, "books/01/plan/04.md")]).toEqual([3, 4]);
    expect(read(dir, "threads.yaml")).toBe(threads.replace("beats: [1.03]", "beats: [1.04]").replace("beats: [1.04]\n  payoff: b1", "beats: [1.03]\n  payoff: b1"));
  });

  test("insert: the later chapters move up, and the new chapter waits for its plan", () => {
    const dir = fixtureCopy();
    const t3 = titleOf(dir, "books/01/plan/03.md");
    const dry = lb(["chapter", "insert", "1.03", "--dry-run", "--json"], dir);
    expect(dry.status).toBe(0);
    expect(JSON.parse(dry.stdout).renumbered).toHaveLength(4);
    expect(existsSync(join(dir, "books/01/plan/07.md"))).toBe(false);

    mkdirSync(join(dir, "runs/briefs"), { recursive: true });
    writeFileSync(join(dir, "runs/briefs/01-02.md"), "old brief with the old next plan");
    expect(lb(["chapter", "insert", "1.03"], dir).status).toBe(0);
    expect(existsSync(join(dir, "runs/briefs/01-02.md"))).toBe(false);
    expect(titleOf(dir, "books/01/plan/04.md")).toBe(t3);
    expect(existsSync(join(dir, "books/01/plan/03.md"))).toBe(false);
    expect(read(dir, "characters/ivo.md")).toContain("{ from: 1.07, text: The lamp shatters");
    expect(read(dir, "threads.yaml")).toContain("payoff: 1.07");
    expect(check(dir).filter((i) => i.severity === "error").map((i) => i.code)).toContain("chapter-gap");
  });

  test("remove: refuses while the plan places anchors or a reference names the chapter", () => {
    const dir = fixtureCopy();
    const r = lb(["chapter", "remove", "1.05", "--json"], dir);
    expect(r.status).toBe(1);
    const errors: string[] = JSON.parse(r.stdout).errors;
    expect(errors.some((e) => e.includes("anchors b1/climax-start"))).toBe(true);
    expect(errors.some((e) => e.startsWith("threads.yaml names 1.05"))).toBe(true);
    expect(existsSync(join(dir, "books/01/plan/05.md"))).toBe(true);
  });

  test("remove: the later chapters move down", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/05.md", "anchors: [b1/climax-start]", "anchors: []");
    edit(dir, "threads.yaml", "payoff: 1.05", "payoff: 1.06");
    const t6 = titleOf(dir, "books/01/plan/06.md");
    const r = changeStructure(load(dir), 1, { kind: "remove", at: 5 });
    expect(r).toMatchObject({ ok: true, renumbered: [{ from: "1.05", to: null }, { from: "1.06", to: "1.05" }] });
    expect(titleOf(dir, "books/01/plan/05.md")).toBe(t6);
    expect(existsSync(join(dir, "books/01/plan/06.md"))).toBe(false);
    expect(read(dir, "characters/ivo.md")).toContain("{ from: 1.05, text: The lamp shatters");
  });

  test("a reopened chapter moves with its prose, delta and memory, and is checked again", () => {
    const dir = fixtureCopy();
    expect(reopenChapters(load(dir), loadRecord(dir), 1, 1).ok).toBe(true);
    mkdirSync(join(dir, "runs/verify"), { recursive: true });
    mkdirSync(join(dir, "runs/change"), { recursive: true });
    writeFileSync(join(dir, "books/01/memory/01.md"), read(fixtureCopy(), "books/01/memory/01.md"));
    writeFileSync(join(dir, "runs/verify/01-01.r1.md"), "old copy");
    const progress = { change: "x", strategy: "reopen", reopened: "1.01", actions: { "1.01": "check", "1.02": "discard" }, scenes: {}, steps: ["reopen", "scene 1.01"] };
    writeFileSync(join(dir, "runs/change/x.json"), JSON.stringify(progress));
    const delta = read(dir, "books/01/deltas/01.jsonl");

    expect(changeStructure(load(dir), 1, { kind: "move", from: 1, to: 2 }).ok).toBe(true);
    expect(read(dir, "books/01/deltas/02.jsonl")).toBe(delta);
    expect(chapterOf(dir, "books/01/chapters/02.md")).toBe(2);
    expect(chapterOf(dir, "books/01/memory/02.md")).toBe(2);
    expect(existsSync(join(dir, "books/01/chapters/01.md"))).toBe(false);
    expect(existsSync(join(dir, "runs/verify/01-01.r1.md"))).toBe(false);
    expect(JSON.parse(read(dir, "runs/verify/01-02.json"))).toEqual({ round: 0, verdict: "fail", open: [], reopened: true });
    expect(JSON.parse(read(dir, "runs/change/x.json"))).toMatchObject({ reopened: "1.02", actions: { "1.02": "check", "1.01": "discard" }, steps: ["reopen", "scene 1.02"] });
  });

  test("refuses an approved chapter and an imported book", () => {
    const dir = fixtureCopy();
    const r = lb(["chapter", "insert", "1.01"], dir);
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("lb reopen 1.01");
    expect(lb(["chapter", "remove", "1.02"], importedCopy()).stdout).toContain("imported");
  });
});

describe("lb book", () => {
  const errors = (dir: string) => check(dir).filter((i) => i.severity === "error");

  test("insert: the later books move up with their folders, and each reference follows them", () => {
    const dir = importedCopy();
    const r = lb(["book", "insert", "2"], dir);
    expect(r.status).toBe(0);
    expect(read(dir, "books/03/plan.md")).toMatch(/^book: 3$/m);
    expect(read(dir, "books/03/plan/02.md")).toMatch(/^book: 3$/m);
    expect(read(dir, "books/03/plan/02.md")).toContain("b3/");
    expect(read(dir, "targets.yaml")).not.toContain("b2/");
    expect(read(dir, "characters/ivo.md")).toContain("book: 3, act: act1");
    expect(read(dir, "series.md")).toMatch(/^books: 3$/m);
    expect(errors(dir).map((i) => `${i.code} ${i.file}`)).toEqual(["missing books/02/plan.md"]);
  });

  test("move: a move back gives the same files", () => {
    const dir = importedCopy();
    expect(changeBooks(load(dir), { kind: "insert", at: 2 }).ok).toBe(true);
    expect(changeBooks(load(dir), { kind: "move", from: 3, to: 2 }).ok).toBe(true);
    for (const f of ["threads.yaml", "targets.yaml", "characters/ivo.md", "relationships/ivo-sabine.md", "books/02/plan.md", "books/02/plan/02.md"]) {
      expect(read(dir, f)).toBe(read(IMPORTED_FIXTURE, f));
    }
    expect(existsSync(join(dir, "books/03"))).toBe(false);
  });

  test("remove: refuses while another file names the book", () => {
    const dir = importedCopy();
    const r = lb(["book", "remove", "2", "--json"], dir);
    expect(r.status).toBe(1);
    const messages: string[] = JSON.parse(r.stdout).errors;
    expect(messages.some((e) => e.startsWith("targets.yaml names b2/act1/end"))).toBe(true);
    expect(messages.some((e) => e.startsWith("characters/ivo.md names book: 2") && e.includes("2.04"))).toBe(true);
    expect(existsSync(join(dir, "books/02/plan.md"))).toBe(true);
  });

  test("refuses an imported book and a book with an approved chapter", () => {
    expect(lb(["book", "insert", "1"], importedCopy()).stdout).toContain("book 1 is imported");
    expect(lb(["book", "insert", "1"], fixtureCopy()).stdout).toContain("lb reopen 1.01");
  });

  test("a reopened book moves with its prose and staged deltas, and each chapter is checked again", () => {
    const dir = fixtureCopy();
    expect(reopenChapters(load(dir), loadRecord(dir), 1, 1).ok).toBe(true);
    mkdirSync(join(dir, "runs/briefs"), { recursive: true });
    writeFileSync(join(dir, "runs/briefs/01-02.md"), "old brief");
    const delta = read(dir, "books/01/deltas/01.jsonl");

    expect(changeBooks(load(dir), { kind: "insert", at: 1 }).ok).toBe(true);
    expect(read(dir, "books/02/chapters/01.md")).toMatch(/^book: 2$/m);
    expect(read(dir, "books/02/deltas/01.jsonl")).toBe(delta);
    expect(existsSync(join(dir, "runs/briefs/01-02.md"))).toBe(false);
    expect(JSON.parse(read(dir, "runs/verify/02-01.json"))).toMatchObject({ reopened: true });
    expect(read(dir, "threads.yaml")).toContain("plant: 2.01");
  });
});

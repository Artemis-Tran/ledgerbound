import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { approve, gate, status } from "../src/checkpoints.ts";
import { initProject } from "../src/init.ts";
import { loadProject } from "../src/project.ts";
import { validateProject } from "../src/validate.ts";
import { edit, fixtureCopy } from "./helpers.ts";

function load(dir: string) {
  const { project, issues } = loadProject(dir);
  if (!project) throw new Error(JSON.stringify(issues));
  return { project, issues: [...issues, ...validateProject(project)] };
}

describe("gate", () => {
  test("a draft blocks the gate while the checkpoint is on", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/03.md", "status: approved", "status: draft");
    const { project, issues } = load(dir);
    const g = gate(project, issues, "chapter-plans");
    expect(g.cleared).toBe(false);
    expect(g.reason).toContain("books/01/plan/03.md");
  });

  test("a draft passes when the checkpoint is off", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/03.md", "status: approved", "status: draft");
    edit(dir, "project.yaml", "checkpoints: {}", "checkpoints: { chapter-plans: off }");
    const { project, issues } = load(dir);
    expect(gate(project, issues, "chapter-plans").cleared).toBe(true);
  });

  test("just-write-it switches every checkpoint off except replan", () => {
    const dir = fixtureCopy();
    edit(dir, "bible.md", "status: approved", "status: draft");
    edit(dir, "project.yaml", "mode: normal", "mode: just-write-it");
    const { project, issues } = load(dir);
    expect(gate(project, issues, "bible")).toMatchObject({ cleared: true, on: false });
    expect(gate(project, issues, "replan").on).toBe(true);
  });

  test("autopilot switches every checkpoint off, replan included", () => {
    const dir = fixtureCopy();
    edit(dir, "project.yaml", "mode: normal", "mode: autopilot");
    const { project, issues } = load(dir);
    expect(gate(project, issues, "replan").on).toBe(false);
    expect(gate(project, issues, "chapter-1").on).toBe(false);
  });

  test("an error upstream blocks a downstream gate", () => {
    const dir = fixtureCopy();
    edit(dir, "bible.md", "id: tone", "id: mood");
    const { project, issues } = load(dir);
    const g = gate(project, issues, "chapter-plans");
    expect(g).toMatchObject({ cleared: false, state: "invalid" });
    expect(g.errors.map((e) => e.code)).toContain("decision-missing");
  });

  test("chapter-plan errors do not block the book-plan gate", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/02.md", "type: reveal", "type: decision");
    const { project, issues } = load(dir);
    expect(gate(project, issues, "book-plan").cleared).toBe(true);
    expect(gate(project, issues, "chapter-plans").cleared).toBe(false);
  });
});

describe("world", () => {
  test("comes after the bible, and names plan-world when lore/ is empty", () => {
    const dir = fixtureCopy();
    rmSync(join(dir, "lore"), { recursive: true });
    const { project, issues } = load(dir);
    expect(gate(project, issues, "world")).toMatchObject({ cleared: false, state: "missing" });
    expect(status(project, issues).next).toBe("Run the plan-world skill (lore/ has no lore entries).");
  });

  test("a draft lore entry waits for approval, and a lore error blocks the plans after it", () => {
    const dir = fixtureCopy();
    edit(dir, "lore/harvest-day.md", "status: approved", "status: draft");
    let { project, issues } = load(dir);
    expect(gate(project, issues, "world").reason).toContain("lore/harvest-day.md");
    expect(approve(project, issues, "world").state).toBe("approved");
    expect(readFileSync(join(dir, "lore/harvest-day.md"), "utf8")).toContain("status: approved");

    edit(dir, "lore/harvest-day.md", "aliases: [the harvest]", "aliases: [crew boss]");
    ({ project, issues } = load(dir));
    expect(gate(project, issues, "bible").cleared).toBe(true);
    expect(gate(project, issues, "chapter-plans")).toMatchObject({ cleared: false, state: "invalid" });
  });
});

describe("approve", () => {
  test("sets status: approved and keeps the rest of the file", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/03.md", "status: approved", "status: draft");
    const before = readFileSync(join(dir, "books/01/plan/03.md"), "utf8");
    const { project, issues } = load(dir);
    expect(approve(project, issues, "chapter-plans").state).toBe("approved");
    const after = readFileSync(join(dir, "books/01/plan/03.md"), "utf8");
    expect(after).toBe(before.replace("status: draft", "status: approved"));
  });

  test("refuses when the files have errors", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/plan/03.md", "status: approved", "status: draft");
    edit(dir, "books/01/plan/02.md", "type: reveal", "type: decision");
    const { project, issues } = load(dir);
    expect(approve(project, issues, "chapter-plans").state).toBe("invalid");
    expect(readFileSync(join(dir, "books/01/plan/03.md"), "utf8")).toContain("status: draft");
  });
});

describe("status", () => {
  test("a new project starts with start-project", () => {
    const dir = mkdtempSync(join(tmpdir(), "lb-init-"));
    initProject(dir, "Test", "series");
    const { project, issues } = load(dir);
    expect(status(project, issues).next).toContain("start-project");
  });

  test("a new project offers develop-idea for a short idea", () => {
    const dir = mkdtempSync(join(tmpdir(), "lb-init-"));
    initProject(dir, "Test", "series");
    expect(status(load(dir).project, []).next).toContain("develop-idea");
  });

  test("with a pitch, start-project reads it", () => {
    const dir = mkdtempSync(join(tmpdir(), "lb-init-"));
    initProject(dir, "Test", "series");
    writeFileSync(join(dir, "pitch.md"), "## Seed\n> A debt collector in a dungeon city.\n");
    expect(status(load(dir).project, []).next).toBe("Run the start-project skill. It reads pitch.md.");
  });

  test("the fixture has finished planning and chapter 1, so generation continues with lb run", () => {
    const { project, issues } = load(fixtureCopy());
    const s = status(project, issues);
    expect(s.checkpoints.every((g) => g.cleared)).toBe(true);
    expect(s.next).toContain("lb run");
  });

  test("a draft asks for the user's approval", () => {
    const dir = fixtureCopy();
    edit(dir, "characters/sabine.md", "status: approved", "status: draft");
    const { project, issues } = load(dir);
    expect(status(project, issues).next).toContain("lb approve character-arcs");
  });
});

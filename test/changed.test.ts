import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { changedRanges } from "../src/changed.ts";
import { fixtureCopy } from "./helpers.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const lb = (args: string[], cwd: string) => spawnSync("node", [CLI, ...args], { cwd, encoding: "utf8" });

const BEFORE = ["---", "status: draft", "---", "", "One.", "", "Two a.", "Two b.", "", "Three.", "", "Four.", ""].join("\n");

describe("changedRanges", () => {
  test("no change, no range", () => {
    expect(changedRanges(BEFORE, BEFORE)).toEqual([]);
  });

  test("a changed line gives its whole paragraph", () => {
    expect(changedRanges(BEFORE, BEFORE.replace("Two b.", "Two c."))).toEqual([[7, 8]]);
  });

  test("a new paragraph gives its own lines, with the lines of the new file", () => {
    const after = BEFORE.replace("One.\n", "One.\n\nNew.\n");
    expect(changedRanges(BEFORE, after)).toEqual([[7, 7]]);
  });

  test("a deleted paragraph marks the paragraph where it was, and paragraphs close together join", () => {
    const after = BEFORE.replace("Three.\n\n", "").replace("One.", "One!");
    expect(changedRanges(BEFORE, after)).toEqual([[5, 5], [10, 10]]);
    expect(changedRanges(BEFORE, BEFORE.replace("One.", "One!").replace("Two a.", "Two!"))).toEqual([[5, 8]]);
  });
});

describe("lb changed", () => {
  test("compares the chapter with the copy of the last round", () => {
    const dir = fixtureCopy();
    const chapter = join(dir, "books/01/chapters/01.md");
    const text = readFileSync(chapter, "utf8");
    expect(lb(["changed", "1.01"], dir).status).toBe(2);
    mkdirSync(join(dir, "runs/verify"), { recursive: true });
    writeFileSync(join(dir, "runs/verify/01-01.json"), JSON.stringify({ round: 1, verdict: "fail", open: [] }));
    writeFileSync(join(dir, "runs/verify/01-01.r1.md"), text);
    expect(JSON.parse(lb(["changed", "1.01", "--json"], dir).stdout).ranges).toEqual([]);
    const lines = text.split("\n");
    const at = lines.findIndex((l, i) => i > 6 && l.trim() !== "");
    lines[at] = `${lines[at]} He said nothing more.`;
    writeFileSync(chapter, lines.join("\n"));
    const r = JSON.parse(lb(["changed", "1.01", "--json"], dir).stdout);
    expect(r.round).toBe(1);
    expect(r.ranges[0][0]).toBeLessThanOrEqual(at + 1);
    expect(r.ranges[0][1]).toBeGreaterThanOrEqual(at + 1);
  });
});

import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { sentenceTokens } from "../src/changes.ts";
import { loadProject } from "../src/project.ts";
import { verifyFiles } from "../src/reopen.ts";
import { runReport } from "../src/run.ts";
import { fixtureCopy, importedCopy } from "./helpers.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const lb = (args: string[], cwd: string) => spawnSync("node", [CLI, ...args], { cwd, encoding: "utf8" });
const json = (args: string[], cwd: string) => JSON.parse(lb([...args, "--json"], cwd).stdout);

const CHAPTER = "books/01/chapters/01.md";
const COPY = "runs/verify/01-01.r1.md";
const SHELF = "runs/verify/01-01.proposed.md";

const BEFORE = [
  "---",
  "status: approved",
  "book: 1",
  "chapter: 1",
  "title: Level Three",
  "---",
  "",
  `One stays. The rain fell like a choir of knives. Three stays.`,
  "",
  `"Go." He left. Five stays.`,
  "",
  "Six stays.",
  "",
  "The rope bent. Eight stays.",
  "",
  "Nine stays.",
  "",
].join("\n");

const AFTER = BEFORE.replace("The rain fell like a choir of knives.", "The rain fell.")
  .replace(`He left. `, "")
  .replace("Six stays.", "Six stays. New words.")
  .replace("The rope bent.", "It bent.")
  .replace("Eight stays.", "Eight changed.");

/** A copy of the fixture with a round copy and a record of round 1, and the revision in the chapter. */
function revised(after = AFTER, before = BEFORE) {
  const dir = fixtureCopy();
  mkdirSync(join(dir, "runs/verify"), { recursive: true });
  writeFileSync(join(dir, COPY), before);
  writeFileSync(join(dir, "runs/verify/01-01.json"), JSON.stringify({ round: 1, verdict: "pass", open: [] }));
  writeFileSync(join(dir, CHAPTER), after);
  return dir;
}

describe("sentenceTokens", () => {
  test.each([
    "One. Two! Three? Four.\n\nFive.\n",
    `"Go." He left. "Stop!" she said, and ran.`,
    "---\nstatus: approved\n---\n\n[Hook · −34 · Health 101/135]\n[Miss]\n",
  ])("joined, they give the text back: %s", (text) => {
    expect(sentenceTokens(text).join("")).toBe(text);
  });

  test("ends a sentence after a closing quote only when a new sentence follows", () => {
    expect(sentenceTokens(`"Go." He left.`).filter((t) => t.trim())).toEqual([`"Go."`, "He left."]);
    expect(sentenceTokens(`"Stop!" she said.`).filter((t) => t.trim())).toEqual([`"Stop!" she said.`]);
  });
});

describe("lb changes", () => {
  test("lists each changed sentence, numbered, with a cut, new words and lines", () => {
    const r = json(["changes", "1.01"], revised());
    expect(r.total).toBe(5);
    expect(r.changes[0]).toMatchObject({ n: 1, point: "1.01", before: "The rain fell like a choir of knives.", after: "The rain fell.", line_before: 8, line_after: 8 });
    expect(r.changes[1]).toMatchObject({ n: 2, before: "He left.", after: "" });
    expect(r.changes[2]).toMatchObject({ n: 3, before: "", after: "New words.", line_after: 12 });
  });

  test("the file has the form that the user reads", () => {
    const dir = revised();
    const r = json(["changes", "1.01", "--out", "runs/tic-pass/x/batch-1.md"], dir);
    expect(r).toMatchObject({ total: 5, file: "runs/tic-pass/x/batch-1.md" });
    expect(r.examples).toHaveLength(3);
    const md = readFileSync(join(dir, "runs/tic-pass/x/batch-1.md"), "utf8");
    expect(md).toContain("**1. Before:** The rain fell like a choir of knives.\n\n**After:** The rain fell.");
    expect(md).toContain("**2. Before:** He left.\n\n**After:** (cut)");
    expect(md).toContain("**3. Before:** (new)\n\n**After:** New words.");
  });

  test("a moved paragraph break is a change, and shows the sentences next to it", () => {
    const r = json(["changes", "1.01"], revised(BEFORE.replace("Nine stays.", "Nine. Ten.").replace("Eight stays.\n\nNine.", "Eight stays. Nine."), BEFORE.replace("Nine stays.", "Nine. Ten.")));
    expect(r.total).toBe(1);
    expect(r.changes[0].before).toBe("Eight stays. ¶ Nine.");
    expect(r.changes[0].after).toBe("Eight stays. Nine.");
  });

  test("the numbers go on across chapters and do not change between the list and the apply", () => {
    const dir = revised();
    const chapter2 = readFileSync(join(dir, COPY), "utf8").replace("chapter: 1", "chapter: 2");
    writeFileSync(join(dir, "books/01/chapters/02.md"), chapter2.replace("Nine stays.", "Nine went."));
    writeFileSync(join(dir, "runs/verify/01-02.r2.md"), chapter2);
    writeFileSync(join(dir, "runs/verify/01-02.json"), JSON.stringify({ round: 2, verdict: "pass", open: [] }));
    // Chapter 2 is a draft in the fixture: the list works on any chapter.
    const list = json(["changes", "1.01", "1.02"], dir);
    expect(list.total).toBe(6);
    expect(list.changes[5]).toMatchObject({ n: 6, point: "1.02", before: "Nine stays.", after: "Nine went." });
    expect(json(["changes", "1.01", "1.02"], dir).changes).toEqual(list.changes);
  });

  test("a restored change next to one that stays gets a warning with its paragraphs, across a paragraph break too", () => {
    const dir = revised();
    expect(lb(["changes", "1.01", "--shelve"], dir).status).toBe(0);
    // 4 is "The rope bent.": 5 is the next sentence, and 3 ends the paragraph before it.
    const r = json(["changes", "1.01", "--apply", "--restore", "4"], dir);
    expect(r.warnings).toEqual([
      { n: 4, neighbour: 3, point: "1.01", line: 14, context: "Six stays. New words.\n\nThe rope bent. Eight changed." },
      { n: 4, neighbour: 5, point: "1.01", line: 14, context: "The rope bent. Eight changed." },
    ]);

    const next = revised(BEFORE.replace("Six stays.", "Six changed.").replace("The rope bent.", "It bent."));
    lb(["changes", "1.01", "--shelve"], next);
    const across = json(["changes", "1.01", "--apply", "--restore", "1"], next);
    expect(across.warnings[0]).toMatchObject({ n: 1, neighbour: 2 });
    expect(across.warnings[0].context).toBe("Six stays.\n\nIt bent. Eight stays.");
  });

  test("no warning when the neighbour is restored too, or is far away", () => {
    const dir = revised();
    lb(["changes", "1.01", "--shelve"], dir);
    const r = json(["changes", "1.01", "--apply", "--restore", "3,4,5"], dir);
    expect(r.warnings).toEqual([]);
    const far = revised(BEFORE.replace("One stays.", "One changed.").replace("Nine stays.", "Nine changed."));
    lb(["changes", "1.01", "--shelve"], far);
    expect(json(["changes", "1.01", "--apply", "--restore", "1"], far).warnings).toEqual([]);
  });

  test("names a phrase-log entry that the chapter no longer has", () => {
    const image = "a slate token stained red-brown by the bucket iron";
    const before = BEFORE.replace("Nine stays.", `Nine held ${image} up.`);
    const dir = revised(before.replace(` ${image} up`, " it"), before);
    lb(["changes", "1.01", "--shelve"], dir);
    expect(json(["changes", "1.01", "--apply"], dir).chapters[0].stale_log).toEqual([{ list: "images", entry: image }]);
  });
});

describe("the shelf", () => {
  test("restore none gives the revision, restore all gives the round copy, and the shelf goes", () => {
    const none = revised();
    expect(json(["changes", "1.01", "--shelve"], none)).toMatchObject({ changes: 5, proposed: SHELF });
    expect(readFileSync(join(none, CHAPTER), "utf8")).toBe(BEFORE);
    expect(readFileSync(join(none, SHELF), "utf8")).toBe(AFTER);
    const list = json(["changes", "1.01"], none);
    expect(list.total).toBe(5);
    expect(list.chapters[0].proposed).toBe(SHELF);
    const r = json(["changes", "1.01", "--apply"], none);
    expect(r.chapters[0]).toMatchObject({ changes: 5, restored: 0 });
    expect(r.accepted.count).toBe(5);
    expect(readFileSync(join(none, CHAPTER), "utf8")).toBe(AFTER);
    expect(existsSync(join(none, SHELF))).toBe(false);

    const all = revised();
    lb(["changes", "1.01", "--shelve"], all);
    expect(json(["changes", "1.01", "--apply", "--restore", "1,2,3,4,5"], all).restored).toHaveLength(5);
    expect(readFileSync(join(all, CHAPTER), "utf8")).toBe(BEFORE);
  });

  test("restores only the words of its number", () => {
    const dir = revised();
    lb(["changes", "1.01", "--shelve"], dir);
    const r = json(["changes", "1.01", "--apply", "--restore", "1"], dir);
    expect(r.restored[0].before).toBe("The rain fell like a choir of knives.");
    expect(readFileSync(join(dir, CHAPTER), "utf8")).toBe(AFTER.replace("The rain fell.", "The rain fell like a choir of knives."));
  });

  test("refuses a number that is not in the list, a chapter that changed, and writes nothing", () => {
    const dir = revised();
    lb(["changes", "1.01", "--shelve"], dir);
    const bad = lb(["changes", "1.01", "--apply", "--restore", "1,6"], dir);
    expect(bad.status).toBe(2);
    expect(bad.stderr).toContain("no change 6");
    expect(readFileSync(join(dir, CHAPTER), "utf8")).toBe(BEFORE);
    expect(existsSync(join(dir, SHELF))).toBe(true);

    writeFileSync(join(dir, CHAPTER), `${BEFORE}More.\n`);
    const moved = lb(["changes", "1.01", "--apply"], dir);
    expect(moved.status).toBe(2);
    expect(moved.stderr).toContain("the proposal no longer fits");
    expect(existsSync(join(dir, SHELF))).toBe(true);
  });

  test("needs the shelf to apply, and refuses a second shelf", () => {
    const dir = revised();
    expect(lb(["changes", "1.01", "--apply"], dir).stderr).toContain("--shelve");
    lb(["changes", "1.01", "--shelve"], dir);
    expect(lb(["changes", "1.01", "--shelve"], dir).stderr).toContain("exists");
  });

  test("a chapter with no change has nothing to shelve", () => {
    const dir = revised(BEFORE);
    expect(json(["changes", "1.01", "--shelve"], dir)).toMatchObject({ changes: 0 });
    expect(existsSync(join(dir, SHELF))).toBe(false);
    expect(json(["changes", "1.01", "--apply"], dir).chapters[0]).toMatchObject({ changes: 0 });
  });

  test("refuses a chapter of an imported book", () => {
    const dir = importedCopy();
    const text = readFileSync(join(dir, CHAPTER), "utf8");
    mkdirSync(join(dir, "runs/verify"), { recursive: true });
    writeFileSync(join(dir, COPY), text);
    writeFileSync(join(dir, "runs/verify/01-01.json"), JSON.stringify({ round: 1, verdict: "pass", open: [] }));
    expect(lb(["changes", "1.01", "--shelve"], dir).stderr).toContain("canon");
  });

  test("lb discard and lb chapter see the shelf as a verify file", () => {
    const dir = revised();
    lb(["changes", "1.01", "--shelve"], dir);
    expect(verifyFiles(dir, 1, 1)).toContain(SHELF);
  });

  test("in git, lb run shows the chapter as done while the user decides, whatever the record says", () => {
    const dir = fixtureCopy();
    const git = (...args: string[]) => spawnSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], { cwd: dir, encoding: "utf8" });
    const stage = () => runReport(loadProject(dir).project!, 1).chapters[0].stage;
    const text = readFileSync(join(dir, CHAPTER), "utf8");
    mkdirSync(join(dir, "runs/verify"), { recursive: true });
    writeFileSync(join(dir, COPY), text);
    writeFileSync(join(dir, "runs/verify/01-01.json"), JSON.stringify({ round: 1, verdict: "fail", open: [{ severity: "error", rule: "user", problem: "x" }] }));
    git("init", "-q");
    git("add", "-A");
    git("commit", "-qm", "start");
    expect(stage()).toBe("done");

    // While the reviser edits, the chapter is not committed.
    writeFileSync(join(dir, CHAPTER), text.replace("Ivo wanted", "Ivo needed"));
    expect(stage()).toBe("remembered");

    lb(["changes", "1.01", "--shelve"], dir);
    expect(stage()).toBe("done");

    lb(["changes", "1.01", "--apply"], dir);
    expect(stage()).toBe("remembered");
    git("add", "-A");
    git("commit", "-qm", "Book 1, chapter 1: revised (x)");
    expect(stage()).toBe("done");
  });
});

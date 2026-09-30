import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import { splitFrontmatter } from "../src/frontmatter.ts";
import { splitManuscript } from "../src/import.ts";
import { check, fixtureCopy, IMPORTED_FIXTURE, importedCopy } from "./helpers.ts";

const CLI = join(import.meta.dirname, "..", "src", "cli.ts");
const lb = (args: string[], cwd?: string) => spawnSync("node", [CLI, ...args], { cwd, encoding: "utf8" });

/** A paragraph of `n` words, so a chapter is not reported as short. */
const words = (n: number) => Array.from({ length: n }, (_, i) => `word${i}`).join(" ");

describe("splitManuscript", () => {
  test("Markdown: the chapters are the headings of the highest level used 2 or more times", () => {
    const md = `# The Tithe Well\n\nBy Tamsin Rudd\n\n## Chapter 1: Level Three\n\n${words(400)}\n\n## Chapter 2\n\n${words(400)}\n\n### A scene\n\nMore.\n`;
    const s = splitManuscript(md);
    expect(s.chapters.map((c) => [c.heading, c.title, c.line])).toEqual([
      ["Chapter 1: Level Three", "Level Three", 5],
      ["Chapter 2", undefined, 9],
    ]);
    expect(s.chapters[1].body).toContain("### A scene");
    expect(s.wordsBefore).toBe(6);
    expect(s.warnings).toEqual([expect.stringContaining("6 words before the first chapter heading")]);
  });

  test("plain text: a short line of its own that starts with Chapter, Prologue, Epilogue or Interlude", () => {
    const txt = `Prologue\n\n${words(400)}\n\nCHAPTER ONE - The Rope\n\n${words(400)}\nChapter 2 is where he said it.\n\nChapter Twenty-One\n\n${words(400)}\r\n`;
    const s = splitManuscript(txt);
    expect(s.chapters.map((c) => c.title)).toEqual(["Prologue", "The Rope", undefined]);
    expect(s.chapters[1].body).toContain("Chapter 2 is where he said it.");
    expect(s.chapters[2].body).not.toContain("\r");
  });

  test("a heading inside a fenced block is not a chapter", () => {
    const s = splitManuscript(`## Chapter 1\n\n${words(400)}\n\n\`\`\`\n## Chapter 9\n\`\`\`\n\n## Chapter 2\n\n${words(400)}\n`);
    expect(s.chapters.map((c) => c.heading)).toEqual(["Chapter 1", "Chapter 2"]);
  });

  test("a short chapter and a gap in the chapter numbers are warnings", () => {
    const s = splitManuscript(`## Chapter 1\n\n${words(400)}\n\n## Chapter 3\n\nToo short.\n`);
    expect(s.warnings).toEqual([expect.stringContaining("has 2 words"), expect.stringContaining('"Chapter 3" (line 5) comes after chapter 1')]);
  });

  test("--heading replaces the rules with a pattern for the whole line", () => {
    const s = splitManuscript(`* 1 *\n\n${words(400)}\n\n* 2 *\n\n${words(400)}\n`, /^\* \d+ \*$/);
    expect(s.chapters.map((c) => c.heading)).toEqual(["* 1 *", "* 2 *"]);
  });
});

describe("lb import", () => {
  const manuscript = (dir: string) => {
    const file = join(dir, "manuscript.md");
    writeFileSync(file, `# The Tithe Well\n\n## Chapter 1: Level Three\n\n${words(400)}\n\n## Chapter 2: The Red Pages\n\n${words(400)}\n`);
    return file;
  };

  test("a manuscript of the example's chapters imports back to the same files, and the project validates", () => {
    const dir = importedCopy();
    const chapters = [1, 2, 3, 4].map((n) => readFileSync(join(IMPORTED_FIXTURE, `books/01/chapters/0${n}.md`), "utf8"));
    const md = chapters.map((text, i) => {
      const { data, body } = splitFrontmatter(text) as { data: { title: string }; body: string };
      return `## Chapter ${i + 1}: ${data.title}\n\n${body}`;
    });
    const file = join(dir, "manuscript.md");
    writeFileSync(file, `# The Tithe Well\n\nBy Tamsin Rudd\n\n${md.join("\n")}`);
    rmSync(join(dir, "books/01/chapters"), { recursive: true });
    const r = lb(["import", file, "--json"], dir);
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).chapters).toHaveLength(4);
    chapters.forEach((text, i) => expect(readFileSync(join(dir, `books/01/chapters/0${i + 1}.md`), "utf8")).toBe(text));
    expect(check(dir)).toEqual([]);
  });

  test("a dry run writes nothing", () => {
    const dir = importedCopy();
    rmSync(join(dir, "books/01/chapters"), { recursive: true });
    const r = lb(["import", manuscript(dir), "--dry-run"], dir);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("Would import book 1: 2 chapter(s).");
    expect(existsSync(join(dir, "books/01/chapters"))).toBe(false);
  });

  test("refuses a book with chapters already, a planned book, and a plan that is not imported", () => {
    const imported = importedCopy();
    const again = lb(["import", manuscript(imported)], imported);
    expect(again.status).toBe(1);
    expect(again.stdout).toContain("has 4 chapter file(s) already");
    expect(readdirSync(join(imported, "books/01/chapters"))).toHaveLength(4);

    const planned = fixtureCopy();
    rmSync(join(planned, "books/01/chapters"), { recursive: true });
    const r = lb(["import", manuscript(planned), "--json"], planned);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout).errors).toEqual([
      "book 1 has chapter plans, so it is not an imported book",
      "books/01/plan.md has no `imported: true`: an imported book's plan has only the level fields",
    ]);
  });

  test("a book after a planned book cannot be imported", () => {
    const dir = fixtureCopy();
    const r = lb(["import", manuscript(dir), "--book", "2", "--json"], dir);
    expect(r.status).toBe(1);
    expect(JSON.parse(r.stdout).errors).toEqual(["book 1 has chapter plans: only the books before the first planned book can be imported"]);
  });

  test("with no book plan yet, it says what to write next", () => {
    const dir = importedCopy();
    rmSync(join(dir, "books/01/chapters"), { recursive: true });
    rmSync(join(dir, "books/01/plan.md"));
    const r = JSON.parse(lb(["import", manuscript(dir), "--json"], dir).stdout);
    expect(r.ok).toBe(true);
    expect(r.next).toContain("write books/01/plan.md with `imported: true`");
  });
});

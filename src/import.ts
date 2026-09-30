/**
 * `lb import`: the chapters of an imported book from its manuscript (ADR 0003). The manuscript is canon, so each
 * chapter is written as it is, with `status: approved` and `source: imported`.
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { stringify } from "yaml";
import { splitFrontmatter } from "./frontmatter.ts";
import { bookDir, pad2, type Project } from "./project.ts";

export interface SplitChapter {
  /** The heading line as the manuscript has it, without the Markdown `#`. */
  heading: string;
  /** The title for the chapter frontmatter: the heading without "Chapter 3:", or the heading itself. */
  title?: string;
  /** The line of the heading in the manuscript, from 1. */
  line: number;
  body: string;
  words: number;
}

export interface Split {
  chapters: SplitChapter[];
  /** The words before the first heading: a title page, a dedication, the front pages. They are not imported. */
  wordsBefore: number;
  warnings: string[];
}

/** A chapter shorter than this is probably a heading that is not a chapter, or a split in the wrong place. */
export const IMPORT_SHORT_WORDS = 300;

/** A plain-text chapter heading: a short line of its own that starts with one of these words. */
const PLAIN_HEADING = /^(chapter|prologue|epilogue|interlude)\b/i;
const ATX = /^(#{1,6})\s+(.*?)\s*#*\s*$/;
/** "Chapter 3", "Chapter Twenty-One", "CHAPTER 3: The Well". Group 1 is the number, group 2 the title after it. */
const NUMBER_WORD = "(?:one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred)";
const NUMBERED = new RegExp(`^chapter\\s+(\\d+|${NUMBER_WORD}(?:[- ]${NUMBER_WORD})*)\\b\\s*[:.\\-–—]?\\s*(.*)$`, "i");

const countWords = (text: string) => text.split(/\s+/).filter((w) => /\w/.test(w)).length;

/**
 * Splits a Markdown or plain-text manuscript into chapters. In Markdown, the chapters are the headings of the highest
 * level that the manuscript uses 2 or more times, so a single `# Book title` above `## Chapter 1` is not a chapter. In
 * plain text, or in Markdown without such headings, a chapter starts at a short line of its own that starts with
 * "Chapter", "Prologue", "Epilogue" or "Interlude". `heading` replaces both rules with a pattern for the whole line.
 */
export function splitManuscript(text: string, heading?: RegExp): Split {
  const lines = splitFrontmatter(text.replace(/^﻿/, "").replace(/\r\n?/g, "\n")).body.split("\n");
  const warnings: string[] = [];

  // The lines outside fenced code blocks can be headings.
  let fenced = false;
  const open = lines.map((l) => {
    if (/^(```|~~~)/.test(l)) fenced = !fenced;
    return !fenced;
  });
  const blankAround = (i: number) => (i === 0 || !lines[i - 1].trim()) && (i === lines.length - 1 || !lines[i + 1].trim());

  let starts: { i: number; heading: string }[];
  if (heading) {
    starts = lines.flatMap((l, i) => (open[i] && heading.test(l.trim()) ? [{ i, heading: l.replace(ATX, "$2").trim() }] : []));
  } else {
    const atx = lines.flatMap((l, i) => {
      const m = open[i] ? ATX.exec(l) : null;
      return m ? [{ i, level: m[1].length, heading: m[2] }] : [];
    });
    const level = [1, 2, 3, 4, 5, 6].find((n) => atx.filter((h) => h.level === n).length >= 2);
    starts =
      level !== undefined
        ? atx.filter((h) => h.level === level)
        : lines.flatMap((l, i) => (open[i] && l.trim().length <= 80 && PLAIN_HEADING.test(l.trim()) && blankAround(i) ? [{ i, heading: l.trim() }] : []));
  }

  const chapters = starts.map((s, k): SplitChapter => {
    const end = k + 1 < starts.length ? starts[k + 1].i : lines.length;
    const body = lines.slice(s.i + 1, end).join("\n").trim().replace(/\n{3,}/g, "\n\n");
    const m = NUMBERED.exec(s.heading);
    const title = m ? m[2].trim() || undefined : s.heading;
    return { heading: s.heading, title, line: s.i + 1, body, words: countWords(body) };
  });

  const wordsBefore = countWords(lines.slice(0, starts[0]?.i ?? lines.length).join("\n"));
  if (chapters.length && wordsBefore > 0) warnings.push(`${wordsBefore} words before the first chapter heading (line ${chapters[0].line}) are not imported: check that they are a title page or front pages, not a chapter`);

  let last: number | undefined;
  chapters.forEach((c, k) => {
    if (c.words < IMPORT_SHORT_WORDS) warnings.push(`chapter ${k + 1} ("${c.heading}", line ${c.line}) has ${c.words} word${c.words === 1 ? "" : "s"}: check that the heading starts a chapter`);
    const n = NUMBERED.exec(c.heading)?.[1];
    if (n === undefined || !/^\d+$/.test(n)) return;
    if (last !== undefined && Number(n) !== last + 1) warnings.push(`"${c.heading}" (line ${c.line}) comes after chapter ${last} in the headings: check for a missing or a split chapter`);
    last = Number(n);
  });
  return { chapters, wordsBefore, warnings };
}

export interface ImportResult {
  ok: boolean;
  book: number;
  /** The files written, or the files to write on a dry run. */
  chapters: { chapter: number; file: string; heading: string; title?: string; words: number }[];
  errors: string[];
  warnings: string[];
  /** What the author or the skill does next. */
  next?: string;
}

/**
 * Writes the chapters of an imported book into `books/NN/chapters/`. It refuses a book that has chapter plans, a book
 * after a planned book, a book with chapters already, and a book whose plan is not `imported: true`.
 */
export function importBook(project: Project, book: number, manuscript: string, opts: { heading?: RegExp; dryRun?: boolean } = {}): ImportResult {
  const errors: string[] = [];
  const planned = [...project.chapters.keys()].filter((b) => b <= book).sort((a, b) => a - b);
  if (planned.includes(book)) errors.push(`book ${book} has chapter plans, so it is not an imported book`);
  else if (planned.length) errors.push(`book ${planned[0]} has chapter plans: only the books before the first planned book can be imported`);
  const plan = project.books.get(book);
  if (plan && !plan.data.imported) errors.push(`${plan.file} has no \`imported: true\`: an imported book's plan has only the level fields`);
  const dir = join(bookDir(book), "chapters");
  const existing = existsSync(join(project.root, dir)) ? readdirSync(join(project.root, dir)).filter((f) => f.endsWith(".md")) : [];
  if (existing.length) errors.push(`${dir}/ has ${existing.length} chapter file(s) already: remove them to import the book again`);

  const split = splitManuscript(manuscript, opts.heading);
  if (!split.chapters.length) errors.push('the manuscript has no chapter heading: give Markdown headings, lines that start with "Chapter", or a pattern with --heading');

  const chapters = split.chapters.map((c, k) => ({ chapter: k + 1, file: `${dir}/${pad2(k + 1)}.md`, heading: c.heading, title: c.title, words: c.words }));
  const result: ImportResult = { ok: errors.length === 0, book, chapters, errors, warnings: split.warnings };
  if (!result.ok || opts.dryRun) return result;

  mkdirSync(join(project.root, dir), { recursive: true });
  split.chapters.forEach((c, k) => {
    const data = { status: "approved", book, chapter: k + 1, ...(c.title ? { title: c.title } : {}), source: "imported" };
    writeFileSync(join(project.root, chapters[k].file), `---\n${stringify(data, { lineWidth: 0 })}---\n\n${c.body}\n`);
  });
  if (!plan) result.next = `write ${bookDir(book)}/plan.md with \`imported: true\` and the level fields; until then, lb validate reports each chapter as \`imported-source\``;
  return result;
}

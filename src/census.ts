/**
 * `lb census`: each place of a pattern in the prose of a book, for a pattern fix (ADR 0007). The census before the
 * fix gives the revision every place, not only the evidence; the census after it shows if the fix is done.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { splitFrontmatter } from "./frontmatter.ts";
import { lintFile } from "./lint/index.ts";
import type { Project } from "./project.ts";
import { chapterKey } from "./record.ts";
import type { Census } from "./schemas.ts";

export interface CensusMatch {
  line: number;
  /** The words that matched. */
  text: string;
  /** The regex that found it, or the lint rule. */
  match: string;
}

export interface CensusReport {
  book: number;
  match: string[];
  /** The lint rule of a census by lint, in place of `match`. */
  lint?: string;
  limit?: Census["limit"];
  chapters: { point: string; count: number; matches: CensusMatch[] }[];
  total: number;
  /** The chapters over `limit.per_chapter`. */
  over: string[];
  /** True when the census is inside its limit (or there is no limit). */
  within: boolean;
}

/** Finds each regex (case does not matter) in the body of each chapter of a book. Overlapping matches are one place. */
export function takeCensus(project: Project, book: number, match: string[], limit?: Census["limit"]): CensusReport {
  const regexes = match.map((m) => [m, new RegExp(m, "giu")] as const);
  const chapters: CensusReport["chapters"] = [];
  for (const c of project.prose.get(book) ?? []) {
    const { body, bodyOffset } = splitFrontmatter(readFileSync(join(project.root, c.file), "utf8"));
    const matches: CensusMatch[] = [];
    body.split("\n").forEach((text, i) => {
      // Overlapping hits of two regexes are one place: "turned his nose into the wind" is one tic.
      const hits = regexes
        .flatMap(([m, re]) => [...text.matchAll(re)].map((h) => ({ start: h.index, end: h.index + h[0].length, match: m })))
        .sort((a, b) => a.start - b.start || b.end - a.end);
      const places: typeof hits = [];
      for (const h of hits) {
        const last = places.at(-1);
        if (last && h.start < last.end) last.end = Math.max(last.end, h.end);
        else places.push({ ...h });
      }
      for (const p of places) matches.push({ line: i + 1 + bodyOffset, text: text.slice(p.start, p.end), match: p.match });
    });
    if (matches.length) chapters.push({ point: chapterKey(book, c.data.chapter), count: matches.length, matches });
  }
  return { book, match, limit, chapters, ...against(chapters, limit) };
}

/**
 * Each finding of one lint rule in each chapter of a book: the census of a pattern that no regex finds, such as a
 * quip chain. A finding that the chapter plan waives is not a place.
 */
export function takeLintCensus(project: Project, book: number, rule: string, limit?: Census["limit"]): CensusReport {
  const chapters: CensusReport["chapters"] = [];
  for (const c of project.prose.get(book) ?? []) {
    const matches = lintFile(join(project.root, c.file))
      .findings.filter((f) => f.rule === rule && !f.waived)
      .map((f) => ({ line: f.line, text: f.text, match: rule }));
    if (matches.length) chapters.push({ point: chapterKey(book, c.data.chapter), count: matches.length, matches });
  }
  return { book, match: [], lint: rule, limit, chapters, ...against(chapters, limit) };
}

function against(chapters: CensusReport["chapters"], limit?: Census["limit"]) {
  const total = chapters.reduce((n, c) => n + c.count, 0);
  const over = limit?.per_chapter === undefined ? [] : chapters.filter((c) => c.count > limit.per_chapter!).map((c) => c.point);
  const within = over.length === 0 && (limit?.per_book === undefined || total <= limit.per_book);
  return { total, over, within };
}

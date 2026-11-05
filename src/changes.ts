/**
 * `lb changes`: what a revision changed in a chapter, sentence by sentence and numbered, so that the user can undo
 * each change by its number (the `tic-pass` skill, ADR 0009). `lb changed` gives the paragraphs that a checker must
 * read again; this gives the sentences that a person reads.
 *
 * A tic pass keeps its proposed chapter on a shelf (`runs/verify/NN-MM.proposed.md`) while the user decides, so the
 * chapter in `books/` stays as it was committed: no other step can commit a change that the user has not seen.
 */
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { lcsTable } from "./changed.ts";
import { splitFrontmatter } from "./frontmatter.ts";
import { pad2, type Project } from "./project.ts";
import { chapterKey, chapterPath } from "./record.ts";
import { memoryPath, readVerify, roundCopyPath } from "./run.ts";

export const proposedPath = (book: number, chapter: number) => `runs/verify/${pad2(book)}-${pad2(chapter)}.proposed.md`;

/** A separator: the spaces after the end of a sentence when a new sentence follows, or a line break. */
const SEPARATOR = /((?<=[.!?…]["'”’)\]*_]*)[ \t]+(?=["'“‘(\[*_]*[\p{Lu}\d])|[ \t]*\r?\n\s*)/u;

/** Sentences and separators in turn: joined, they give the text back. */
export const sentenceTokens = (text: string): string[] => text.split(SEPARATOR);

interface Hunk {
  aStart: number;
  aEnd: number;
  bStart: number;
  bEnd: number;
}

/** The token ranges that differ. A separator that stays between two changed sentences makes them two changes. */
function hunks(a: string[], b: string[]): Hunk[] {
  const lcs = lcsTable(a, b);
  const w = b.length + 1;
  const out: Hunk[] = [];
  let i = 0;
  let j = 0;
  let open: Hunk | undefined;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && a[i] === b[j]) {
      open = undefined;
      i++;
      j++;
      continue;
    }
    if (!open) {
      open = { aStart: i, aEnd: i, bStart: j, bEnd: j };
      out.push(open);
    }
    if (j < b.length && (i === a.length || lcs[i * w + j + 1] >= lcs[(i + 1) * w + j])) open.bEnd = ++j;
    else open.aEnd = ++i;
  }
  return out;
}

const blank = (s: string) => s.trim() === "";
/** One line for the list: a paragraph break shows as ¶. */
const shown = (s: string) => s.trim().replace(/\s*\n\s*/g, " ¶ ");
const lineAt = (tokens: string[], end: number) => tokens.slice(0, end).join("").split("\n").length;

export interface Change {
  /** The number that the user answers with: from 1, across all the chapters of one list. */
  n: number;
  point: string;
  /** The words in the round copy, or "" for new words. */
  before: string;
  /** The words in the proposed chapter, or "" for a cut. */
  after: string;
  line_before: number;
  line_after: number;
}

interface Pair {
  book: number;
  chapter: number;
  point: string;
  round: number;
  copy: string;
  /** The file that has the revision: the shelf when it exists, else the chapter. */
  proposed: string;
  a: string[];
  b: string[];
  hunks: Hunk[];
  first: number;
}

/** The two texts of one chapter and their hunks, numbered from `first`. Same files and same order, same numbers. */
function pair(project: Project, book: number, chapter: number, first: number, since?: number): Pair {
  const point = chapterKey(book, chapter);
  const round = since ?? readVerify(project.root, book, chapter)?.round;
  if (round === undefined) throw new Error(`${point} has no verify record: give --since`);
  const copy = roundCopyPath(book, chapter, round);
  if (!existsSync(join(project.root, copy))) throw new Error(`${copy} does not exist`);
  const shelf = proposedPath(book, chapter);
  const proposed = existsSync(join(project.root, shelf)) ? shelf : chapterPath(book, chapter);
  const a = sentenceTokens(readFileSync(join(project.root, copy), "utf8"));
  const b = sentenceTokens(readFileSync(join(project.root, proposed), "utf8"));
  return { book, chapter, point, round, copy, proposed, a, b, hunks: hunks(a, b), first };
}

function changeOf(p: Pair, h: Hunk, index: number): Change {
  let before = p.a.slice(h.aStart, h.aEnd).join("");
  let after = p.b.slice(h.bStart, h.bEnd).join("");
  // Only a paragraph break moved: the sentences on each side show where.
  if (blank(before) && blank(after)) {
    before = p.a.slice(Math.max(0, h.aStart - 1), h.aEnd + 1).join("");
    after = p.b.slice(Math.max(0, h.bStart - 1), h.bEnd + 1).join("");
  }
  return {
    n: p.first + index,
    point: p.point,
    before: shown(before),
    after: shown(after),
    line_before: lineAt(p.a, h.aStart + (blank(p.a[h.aStart] ?? "") ? 1 : 0)),
    line_after: lineAt(p.b, h.bStart + (blank(p.b[h.bStart] ?? "") ? 1 : 0)),
  };
}

function pairs(project: Project, points: { book: number; chapter: number }[], since?: number): Pair[] {
  const out: Pair[] = [];
  let first = 1;
  for (const { book, chapter } of points) {
    const p = pair(project, book, chapter, first, since);
    first += p.hunks.length;
    out.push(p);
  }
  return out;
}

export interface ChangesList {
  chapters: { point: string; round: number; copy: string; proposed: string; count: number }[];
  changes: Change[];
  total: number;
}

export function listChanges(project: Project, points: { book: number; chapter: number }[], since?: number): ChangesList {
  const ps = pairs(project, points, since);
  const changes = ps.flatMap((p) => p.hunks.map((h, i) => changeOf(p, h, i)));
  return {
    chapters: ps.map((p) => ({ point: p.point, round: p.round, copy: p.copy, proposed: p.proposed, count: p.hunks.length })),
    changes,
    total: changes.length,
  };
}

/** The before-and-after file: one section for each chapter, and the numbers go on across the chapters. */
export function changesMarkdown(list: ChangesList): string {
  const out = [`# ${list.total} change(s): ${list.chapters.map((c) => c.point).join(", ")}`, "", `Answer with the numbers to restore ("restore 2, 4, 9"), or "all good". ¶ marks a paragraph break.`];
  for (const c of list.chapters) {
    out.push("", `## ${c.point}`);
    if (!c.count) out.push("", "No change.");
    for (const x of list.changes.filter((y) => y.point === c.point)) out.push("", `**${x.n}. Before:** ${x.before || "(new)"}`, "", `**After:** ${x.after || "(cut)"}`);
  }
  return `${out.join("\n")}\n`;
}

/** Up to `count` changes, evenly spread: the examples that the user sees next to the file. */
export function spreadExamples(changes: Change[], count = 3): Change[] {
  if (changes.length <= count) return changes;
  return Array.from({ length: count }, (_, i) => changes[Math.floor(((i + 0.5) * changes.length) / count)]);
}

/** Why a tic pass cannot change a chapter: it is imported, or it is not approved. */
function approvedError(project: Project, book: number, chapter: number): string | undefined {
  const point = chapterKey(book, chapter);
  if (project.books.get(book)?.data.imported) return `book ${book} is imported: its prose is canon`;
  const prose = project.prose.get(book)?.find((c) => c.data.chapter === chapter);
  if (prose?.data.status !== "approved") return `chapter ${point} is not approved`;
  return undefined;
}

export interface ShelveResult {
  point: string;
  proposed: string;
  changes: number;
}

/**
 * Moves the revision of a chapter to the shelf, and puts the round copy back in `books/`. With no change there is
 * nothing to shelve.
 */
export function shelve(project: Project, book: number, chapter: number): ShelveResult {
  const refused = approvedError(project, book, chapter);
  if (refused) throw new Error(refused);
  const p = pair(project, book, chapter, 1);
  const shelf = proposedPath(book, chapter);
  if (p.proposed === shelf) throw new Error(`${shelf} exists: apply it or delete it first`);
  if (p.hunks.length) {
    copyFileSync(join(project.root, p.proposed), join(project.root, shelf));
    copyFileSync(join(project.root, p.copy), join(project.root, p.proposed));
  }
  return { point: p.point, proposed: p.hunks.length ? shelf : p.proposed, changes: p.hunks.length };
}

export interface JoinWarning {
  /** The restored change. */
  n: number;
  /** The change next to it that stays. */
  neighbour: number;
  point: string;
  line: number;
  /** The paragraphs of both changes as they are now. */
  context: string;
}

export interface ApplyResult {
  chapters: {
    point: string;
    changes: number;
    restored: number;
    /** Each phrase-log entry of the chapter's memory file that the chapter no longer has. */
    stale_log: { list: "similes" | "images" | "deadpan"; entry: string }[];
  }[];
  restored: Change[];
  /** The other changes stay; these are some of them, for the calibration file. */
  accepted: { count: number; examples: Change[] };
  warnings: JoinWarning[];
}

const paragraphStart = (s: string, at: number) => {
  const i = s.lastIndexOf("\n\n", at);
  return i === -1 ? 0 : i + 2;
};
const paragraphEnd = (s: string, at: number) => {
  const i = s.indexOf("\n\n", at);
  return i === -1 ? s.length : i;
};

/**
 * Writes each proposed chapter to `books/`, with the words of the `restore` numbers from the round copy, and deletes
 * the shelf. The numbers are those of the list of the same points. It checks all the chapters before it writes one.
 */
export function applyChanges(project: Project, points: { book: number; chapter: number }[], restore: number[]): ApplyResult {
  const ps = pairs(project, points);
  const total = ps.reduce((n, p) => n + p.hunks.length, 0);
  for (const p of ps) {
    const refused = approvedError(project, p.book, p.chapter);
    if (refused) throw new Error(refused);
    if (p.hunks.length && p.proposed !== proposedPath(p.book, p.chapter)) throw new Error(`${proposedPath(p.book, p.chapter)} does not exist: run \`lb changes ${p.point} --shelve\` first`);
    const chapter = readFileSync(join(project.root, chapterPath(p.book, p.chapter)), "utf8");
    if (p.hunks.length && chapter !== p.a.join("")) throw new Error(`${chapterPath(p.book, p.chapter)} changed after ${p.copy}: the proposal no longer fits it`);
  }
  for (const n of restore) if (!Number.isInteger(n) || n < 1 || n > total) throw new Error(`there is no change ${n}: the list has ${total}`);

  const wanted = new Set(restore);
  const result: ApplyResult = { chapters: [], restored: [], accepted: { count: 0, examples: [] }, warnings: [] };
  const accepted: Change[] = [];
  for (const p of ps) {
    let text = "";
    let at = 0;
    const spans: { start: number; end: number }[] = [];
    p.hunks.forEach((h, i) => {
      text += p.b.slice(at, h.bStart).join("");
      const start = text.length;
      text += wanted.has(p.first + i) ? p.a.slice(h.aStart, h.aEnd).join("") : p.b.slice(h.bStart, h.bEnd).join("");
      spans.push({ start, end: text.length });
      at = h.bEnd;
      (wanted.has(p.first + i) ? result.restored : accepted).push(changeOf(p, h, i));
    });
    text += p.b.slice(at).join("");

    // A restored change next to a change that stays can read badly: a fact can have moved from one to the other.
    p.hunks.forEach((h, i) => {
      if (!wanted.has(p.first + i)) return;
      for (const k of [i - 1, i + 1]) {
        const other = p.hunks[k];
        if (!other || wanted.has(p.first + k)) continue;
        const [x, y] = k < i ? [other, h] : [h, other];
        const between = p.b.slice(x.bEnd, y.bStart).filter((t) => !blank(t)).length;
        if (between > 1) continue;
        const from = Math.min(spans[i].start, spans[k].start);
        const to = Math.max(spans[i].end, spans[k].end);
        result.warnings.push({
          n: p.first + i,
          neighbour: p.first + k,
          point: p.point,
          line: text.slice(0, spans[i].start).split("\n").length,
          context: text.slice(paragraphStart(text, from), paragraphEnd(text, to)).trim(),
        });
      }
    });

    const stale_log: ApplyResult["chapters"][number]["stale_log"] = [];
    const memory = join(project.root, memoryPath(p.book, p.chapter));
    if (existsSync(memory)) {
      const before = p.a.join("").toLowerCase();
      const after = text.toLowerCase();
      const log = ((splitFrontmatter(readFileSync(memory, "utf8")).data ?? {}) as { phrase_log?: Record<string, unknown> }).phrase_log ?? {};
      for (const list of ["similes", "images", "deadpan"] as const) {
        const entries = Array.isArray(log[list]) ? (log[list] as unknown[]) : [];
        for (const entry of entries) if (typeof entry === "string" && before.includes(entry.toLowerCase()) && !after.includes(entry.toLowerCase())) stale_log.push({ list, entry });
      }
    }

    if (p.hunks.length) {
      writeFileSync(join(project.root, chapterPath(p.book, p.chapter)), text);
      rmSync(join(project.root, proposedPath(p.book, p.chapter)));
    }
    result.chapters.push({ point: p.point, changes: p.hunks.length, restored: p.hunks.filter((_, i) => wanted.has(p.first + i)).length, stale_log });
  }
  result.accepted = { count: accepted.length, examples: spreadExamples(accepted) };
  return result;
}

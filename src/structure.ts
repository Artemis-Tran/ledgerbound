/**
 * `lb chapter` and `lb book` insert, remove or move a chapter or a book in a story change (ADR 0006). Each
 * command works only on chapters that are not approved, so the ledger never changes: a story change reopens first.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { isPair, isScalar, parseDocument, type Scalar, visit } from "yaml";
import { briefPath } from "./brief.ts";
import { setFrontmatterKey } from "./frontmatter.ts";
import { bookDir, pad2, type Project } from "./project.ts";
import { chapterKey, isApproved, stagedPath } from "./record.ts";
import { verifyFiles } from "./reopen.ts";
import { memoryPath, verifyPath } from "./run.ts";
import { PointRe } from "./schemas.ts";

export type StructureOp = { kind: "insert"; at: number } | { kind: "remove"; at: number } | { kind: "move"; from: number; to: number };

export interface StructureResult {
  ok: boolean;
  errors: string[];
  /** Each chapter whose number changes, old → new (`1.07` → `1.08`). A removed chapter maps to null. */
  renumbered: { from: string; to: string | null }[];
  /** The files whose point references changed. */
  references: string[];
}

/** The files of one chapter whose name is its number, and whose frontmatter has `chapter:`. */
const numbered = (book: number, chapter: number) => [
  `${bookDir(book)}/plan/${pad2(chapter)}.md`,
  `${bookDir(book)}/chapters/${pad2(chapter)}.md`,
  memoryPath(book, chapter),
];

/** The point fields of each file kind, by the key of their YAML pair. */
const POINT_KEYS = {
  threads: new Set(["plant", "beats", "payoff"]),
  changes: new Set(["from"]),
  review: new Set(["chapters", "point"]),
};

/** The chapter numbers of a book that have a plan or prose. */
function chaptersOf(project: Project, book: number): number[] {
  const all = [...(project.chapters.get(book) ?? []), ...(project.prose.get(book) ?? [])].map((f) => f.data.chapter);
  return [...new Set(all)].sort((a, b) => a - b);
}

/** old chapter → new chapter (null: removed) for each chapter whose number changes. */
function renumbering(op: StructureOp, chapters: number[]): Map<number, number | null> {
  const map = new Map<number, number | null>();
  for (const c of chapters) {
    if (op.kind === "insert" && c >= op.at) map.set(c, c + 1);
    if (op.kind === "remove" && c === op.at) map.set(c, null);
    if (op.kind === "remove" && c > op.at) map.set(c, c - 1);
    if (op.kind === "move") {
      const { from, to } = op;
      if (c === from) map.set(c, to);
      else if (from < to && c > from && c <= to) map.set(c, c - 1);
      else if (to < from && c >= to && c < from) map.set(c, c + 1);
    }
  }
  return map;
}

/** How to change one scalar: the new text, null when the value names something that goes away, undefined to keep it. */
type ScalarEdit = (key: string, value: unknown) => string | null | undefined;

/** A point as PosRef reads it: a point in YAML can be a number (`1.10` reads as 1.1). */
const asPoint = (v: unknown) => {
  const s = typeof v === "number" ? v.toFixed(2) : String(v);
  return PointRe.test(s) ? s : undefined;
};

/** A ScalarEdit that changes the points of the given keys. */
const pointEdit = (keys: Set<string>, map: (point: string) => string | null | undefined): ScalarEdit => (key, value) => {
  const point = keys.has(key) ? asPoint(value) : undefined;
  return point === undefined ? undefined : map(point);
};

/**
 * Changes the scalar values of a YAML text in place: only the characters of each value change, so comments, quotes
 * and layout stay. `edit` gets the key of the nearest pair (for a list item, the key of its list). Each value that
 * maps to null goes to `refs`.
 */
function rewriteYaml(yaml: string, edit: ScalarEdit, refs: string[]): string {
  const doc = parseDocument(yaml);
  const edits: { start: number; end: number; text: string }[] = [];
  visit(doc, {
    Scalar(key, node: Scalar, path) {
      if (key === "key") return;
      const pair = [...path].reverse().find(isPair);
      if (!pair || !isScalar(pair.key) || !node.range) return;
      const next = edit(String(pair.key.value), node.value);
      if (next === undefined) return;
      if (next === null) {
        refs.push(Number.isInteger(node.value) ? `${pair.key.value}: ${node.value}` : String(asPoint(node.value) ?? node.value));
        return;
      }
      const quote = node.type === "QUOTE_DOUBLE" ? '"' : node.type === "QUOTE_SINGLE" ? "'" : "";
      edits.push({ start: node.range[0], end: node.range[1], text: `${quote}${next}${quote}` });
    },
  });
  let out = yaml;
  for (const e of edits.sort((a, b) => b.start - a.start)) out = out.slice(0, e.start) + e.text + out.slice(e.end);
  return out;
}

const FENCE = /^---\r?\n([\s\S]*?)\r?\n---/;

/** The same as rewriteYaml, for the frontmatter of a Markdown file. */
function rewriteFrontmatter(text: string, edit: ScalarEdit, refs: string[]): string {
  const m = FENCE.exec(text);
  if (!m) return text;
  const start = m[0].indexOf(m[1]);
  return text.slice(0, start) + rewriteYaml(m[1], edit, refs) + text.slice(start + m[1].length);
}

/**
 * Inserts, removes or moves a chapter of a book. Every chapter from the lowest number that changes on must be
 * not approved. The plan, the prose, the staged delta and the memory move with their chapter, and each point
 * reference to a moved chapter changes: threads.yaml, the changes of lore entries and character files, the review
 * findings and the story-change progress files. A chapter that moves must be checked again, so its brief and its
 * verify files go, and a chapter with prose gets a verify record that says it is reopened. The brief of the chapter
 * before the change goes too.
 */
export function changeStructure(project: Project, book: number, op: StructureOp, opts: { dryRun?: boolean } = {}): StructureResult {
  const errors: string[] = [];
  const chapters = chaptersOf(project, book);
  const last = chapters.at(-1) ?? 0;
  const key = (c: number) => chapterKey(book, c);
  const result = (extra: Partial<StructureResult> = {}): StructureResult => ({ ok: errors.length === 0, errors, renumbered: [], references: [], ...extra });

  if (project.books.get(book)?.data.imported) errors.push(`book ${book} is imported: its prose is canon`);
  if (!chapters.length) errors.push(`book ${book} has no chapter plans`);
  if (op.kind === "insert" && (op.at < 1 || op.at > last + 1)) errors.push(`chapter ${key(op.at)} cannot be inserted: book ${book} has chapters 1–${last}`);
  if (op.kind === "remove" && !chapters.includes(op.at)) errors.push(`chapter ${key(op.at)} does not exist`);
  if (op.kind === "move") {
    if (!chapters.includes(op.from)) errors.push(`chapter ${key(op.from)} does not exist`);
    if (op.to < 1 || op.to > last) errors.push(`chapter ${key(op.to)} is not a chapter of book ${book}: it has chapters 1–${last}`);
    if (op.from === op.to) errors.push("the chapter is already there");
  }
  if (errors.length) return result();

  const map = renumbering(op, chapters);
  const lowest = Math.min(...map.keys());
  const approved = chapters.filter((c) => c >= lowest && isApproved(project, book, c));
  if (approved.length) errors.push(`chapter ${key(approved[0])} is approved: run \`lb reopen ${key(approved[0])}\` first`);

  const root = project.root;
  const mapPoint = (point: string): string | null | undefined => {
    const m = PointRe.exec(point)!;
    if (Number(m[1]) !== book || !map.has(Number(m[2]))) return undefined;
    const to = map.get(Number(m[2]));
    return to === null ? null : key(to!);
  };

  // A removed chapter must hold nothing that the plan places: the replan moves each one first.
  if (op.kind === "remove") {
    const plan = project.chapters.get(book)?.find((p) => p.data.chapter === op.at)?.data;
    for (const field of ["anchors", "arc_beats", "stages"] as const) {
      if (plan?.[field].length) errors.push(`${bookDir(book)}/plan/${pad2(op.at)}.md places ${field} ${plan[field].join(", ")}: move them to another chapter first`);
    }
  }

  // The point references in the other files, with the new text of each file that changes.
  const writes = new Map<string, string>();
  const scan = (file: string, rewrite: (text: string, refs: string[]) => string) => {
    if (!existsSync(join(root, file))) return;
    const text = readFileSync(join(root, file), "utf8");
    const refs: string[] = [];
    const next = rewrite(text, refs);
    if (refs.length) errors.push(`${file} names ${[...new Set(refs)].join(", ")}: change it to another chapter first`);
    if (next !== text) writes.set(file, next);
  };
  scan("threads.yaml", (t, refs) => rewriteYaml(t, pointEdit(POINT_KEYS.threads, mapPoint), refs));
  for (const f of [...project.lore.values(), ...project.characters]) scan(f.file, (t, refs) => rewriteFrontmatter(t, pointEdit(POINT_KEYS.changes, mapPoint), refs));
  for (const r of project.reviews.values()) scan(r.file, (t, refs) => rewriteFrontmatter(t, pointEdit(POINT_KEYS.review, mapPoint), refs));
  const changeDir = join(root, "runs/change");
  if (existsSync(changeDir)) {
    for (const f of readdirSync(changeDir).filter((n) => n.endsWith(".json")).sort()) {
      scan(`runs/change/${f}`, (t) => {
        const before = JSON.parse(t);
        const after = renumberProgress(structuredClone(before), mapPoint);
        return JSON.stringify(after) === JSON.stringify(before) ? t : `${JSON.stringify(after, null, 2)}\n`;
      });
    }
  }

  const renumbered = [...map].map(([from, to]) => ({ from: key(from), to: to === null ? null : key(to) }));
  const references = [...writes.keys()];
  if (errors.length || opts.dryRun) return result({ renumbered, references });

  // Read every file of the moved chapters first, then delete, then write: a move never overwrites a file it still needs.
  const moved = new Map<string, string>();
  const deletes = new Set<string>();
  for (const [from, to] of map) {
    for (const [i, file] of numbered(book, from).entries()) {
      if (!existsSync(join(root, file))) continue;
      deletes.add(file);
      if (to !== null) moved.set(numbered(book, to)[i], setFrontmatterKey(readFileSync(join(root, file), "utf8"), "chapter", String(to)));
    }
    const delta = stagedPath(book, from);
    if (existsSync(join(root, delta))) {
      deletes.add(delta);
      if (to !== null) moved.set(stagedPath(book, to), renumberDelta(readFileSync(join(root, delta), "utf8"), book, to));
    }
    for (const f of [briefPath(book, from), ...verifyFiles(root, book, from)]) if (existsSync(join(root, f))) deletes.add(f);
    // Its fold is a different one now: the prose passed before, so the check starts with the record.
    if (to !== null && existsSync(join(root, numbered(book, from)[1]))) {
      moved.set(verifyPath(book, to), `${JSON.stringify({ round: 0, verdict: "fail", open: [], reopened: true }, null, 2)}\n`);
    }
  }
  // The brief of the chapter before gives the plan of the next chapter, which is a different one now.
  if (existsSync(join(root, briefPath(book, lowest - 1)))) deletes.add(briefPath(book, lowest - 1));
  for (const f of deletes) rmSync(join(root, f));
  for (const [f, text] of [...moved, ...writes]) {
    mkdirSync(dirname(join(root, f)), { recursive: true });
    writeFileSync(join(root, f), text);
  }
  return result({ renumbered, references });
}

/** A staged delta with points gets the new chapter in each of them. */
function renumberDelta(text: string, book: number, chapter: number): string {
  return text.replace(/^.+$/gm, (line) => {
    const e = JSON.parse(line);
    if (typeof e.point === "string") e.point = e.point.replace(/^\d+\.\d+\./, `${book}.${pad2(chapter)}.`);
    return JSON.stringify(e);
  });
}

/** The points of a story-change progress file (`runs/change/<id>.json`, see formats.md). */
function renumberProgress(p: Record<string, unknown>, mapPoint: (point: string) => string | null | undefined) {
  const one = (point: string) => {
    const to = mapPoint(point);
    return to === undefined ? point : to;
  };
  const keys = (o: unknown) =>
    o && typeof o === "object" ? Object.fromEntries(Object.entries(o).flatMap(([k, v]) => (one(k) === null ? [] : [[one(k), v]]))) : o;
  if (typeof p.reopened === "string") p.reopened = one(p.reopened);
  p.actions = keys(p.actions);
  p.scenes = keys(p.scenes);
  if (Array.isArray(p.steps)) {
    p.steps = p.steps.flatMap((s: string) => {
      const m = /^scene (\S+)$/.exec(s);
      if (!m) return [s];
      const to = one(m[1]);
      return to === null ? [] : [`scene ${to}`];
    });
  }
  return p;
}

export interface BookStructureResult {
  ok: boolean;
  errors: string[];
  /** Each book whose number changes, old → new. A removed book maps to null. */
  renumbered: { from: number; to: number | null }[];
  /** The files whose references changed, at their path before the change. */
  references: string[];
}

/** The keys whose values are points or plan anchors (PosRef, the ids of custom anchors, target anchors). */
const REF_KEYS = new Set(["plant", "beats", "payoff", "from", "chapters", "point", "anchor", "anchors", "id"]);
const BOOK_ANCHOR = /^b(\d+)\/(.+)$/;

/** All Markdown, YAML and JSONL files under a folder, relative to the root. */
function textFiles(root: string, dir: string): string[] {
  if (!existsSync(join(root, dir))) return [];
  return readdirSync(join(root, dir), { recursive: true, encoding: "utf8" })
    .filter((f) => /\.(md|ya?ml|jsonl)$/.test(f))
    .map((f) => `${dir}/${f.replaceAll("\\", "/")}`)
    .sort();
}

/**
 * Inserts, removes or moves a book of a series. Every book from the lowest number that changes on must have no
 * approved chapter and must not be imported (ADR 0006). The folder `books/NN/` moves with its book, and each
 * reference to a moved book changes in place: the `book:` of its files, of arc beats and of stages, the points and
 * `bN/` anchors in the plans, threads, targets, changes and reviews, the points of the staged deltas, a cover path,
 * and `books:` in series.md. The briefs and verify files of a moved book go, and each chapter with prose gets a
 * verify record that says it is reopened.
 */
export function changeBooks(project: Project, op: StructureOp, opts: { dryRun?: boolean } = {}): BookStructureResult {
  const errors: string[] = [];
  const books = [...new Set([...project.books.keys(), ...project.chapters.keys(), ...project.prose.keys()])].sort((a, b) => a - b);
  const last = books.at(-1) ?? 0;
  const result = (extra: Partial<BookStructureResult> = {}): BookStructureResult => ({ ok: errors.length === 0, errors, renumbered: [], references: [], ...extra });

  if (op.kind === "insert" && (op.at < 1 || op.at > last + 1)) errors.push(`book ${op.at} cannot be inserted: the series has books 1–${last}`);
  if (op.kind === "remove" && !books.includes(op.at)) errors.push(`book ${op.at} does not exist`);
  if (op.kind === "move") {
    if (!books.includes(op.from)) errors.push(`book ${op.from} does not exist`);
    if (op.to < 1 || op.to > last) errors.push(`book ${op.to} is not a book of the series: it has books 1–${last}`);
    if (op.from === op.to) errors.push("the book is already there");
  }
  if (errors.length) return result();

  const map = renumbering(op, books);
  const lowest = op.kind === "insert" ? op.at : Math.min(...map.keys());
  for (const b of books.filter((n) => n >= lowest)) {
    const approved = (project.prose.get(b) ?? []).find((c) => c.data.status === "approved");
    if (project.books.get(b)?.data.imported) errors.push(`book ${b} is imported: its prose is canon, and it stays book ${b}`);
    else if (approved) errors.push(`chapter ${chapterKey(b, approved.data.chapter)} is approved: run \`lb reopen ${chapterKey(b, approved.data.chapter)}\` first`);
  }

  const root = project.root;
  const mapBook = (n: number) => (map.has(n) ? map.get(n)! : undefined);
  const edit: ScalarEdit = (key, value) => {
    if (key === "book" && typeof value === "number") {
      const to = mapBook(value);
      return to === undefined || to === null ? to : String(to);
    }
    if (key === "cover" && typeof value === "string") {
      const m = /^books\/(\d+)\/(.+)$/.exec(value);
      const to = m ? mapBook(Number(m[1])) : undefined;
      return to === undefined || to === null ? to : `${bookDir(to)}/${m![2]}`;
    }
    if (!REF_KEYS.has(key)) return undefined;
    const point = asPoint(value);
    const m = point ? PointRe.exec(point) : typeof value === "string" ? BOOK_ANCHOR.exec(value) : null;
    const to = m ? mapBook(Number(m[1])) : undefined;
    if (to === undefined || to === null) return to;
    return point ? `${to}.${m![2]}` : `b${to}/${m![2]}`;
  };

  // The new text of each file that changes, by its path before the change.
  const removed = op.kind === "remove" ? `${bookDir(op.at)}/` : undefined;
  const writes = new Map<string, string>();
  const files = [
    "threads.yaml",
    "targets.yaml",
    ...["lore", "characters", "relationships"].flatMap((d) => textFiles(root, d)),
    ...books.flatMap((b) => textFiles(root, bookDir(b))),
  ].filter((f) => existsSync(join(root, f)) && !(removed && f.startsWith(removed)));
  for (const file of files) {
    const text = readFileSync(join(root, file), "utf8");
    const refs: string[] = [];
    const next = file.endsWith(".jsonl")
      ? text.replace(/^.+$/gm, (line) => {
          const e = JSON.parse(line);
          const to = typeof e.point === "string" ? mapBook(Number(e.point.split(".")[0])) : undefined;
          if (typeof to === "number") e.point = e.point.replace(/^\d+\./, `${to}.`);
          return JSON.stringify(e);
        })
      : file.endsWith(".md")
        ? rewriteFrontmatter(text, edit, refs)
        : rewriteYaml(text, edit, refs);
    if (refs.length) errors.push(`${file} names ${[...new Set(refs)].join(", ")}: change it first`);
    if (next !== text) writes.set(file, next);
  }
  if (project.series && op.kind !== "move") {
    const count = project.series.data.books + (op.kind === "insert" ? 1 : -1);
    writes.set(project.series.file, setFrontmatterKey(readFileSync(join(root, project.series.file), "utf8"), "books", String(count)));
  }
  const mapPoint = (point: string): string | null | undefined => {
    const [b, c] = point.split(".");
    const to = mapBook(Number(b));
    return to === undefined || to === null ? to : `${to}.${c}`;
  };
  const changeDir = join(root, "runs/change");
  if (existsSync(changeDir)) {
    for (const f of readdirSync(changeDir).filter((n) => n.endsWith(".json")).sort()) {
      const text = readFileSync(join(changeDir, f), "utf8");
      const before = JSON.parse(text);
      const after = renumberProgress(structuredClone(before), mapPoint);
      if (JSON.stringify(after) !== JSON.stringify(before)) writes.set(`runs/change/${f}`, `${JSON.stringify(after, null, 2)}\n`);
    }
  }

  const renumbered = [...map].map(([from, to]) => ({ from, to }));
  const references = [...writes.keys()];
  if (errors.length || opts.dryRun) return result({ renumbered, references });

  // The run files of a moved book: its briefs, verify files and run report are for the old number.
  const runFiles = (b: number) =>
    [
      ...["runs/briefs", "runs/verify"].flatMap((d) =>
        existsSync(join(root, d)) ? readdirSync(join(root, d)).filter((f) => f.startsWith(`${pad2(b)}-`)).map((f) => `${d}/${f}`) : [],
      ),
      `runs/book-${pad2(b)}.json`,
    ].filter((f) => existsSync(join(root, f)));
  for (const b of map.keys()) for (const f of runFiles(b)) rmSync(join(root, f));

  // The new path of a file in a moved book folder.
  const moveTo = (file: string) => {
    const m = /^books\/(\d+)\/(.+)$/.exec(file);
    const to = m ? mapBook(Number(m[1])) : undefined;
    return typeof to === "number" ? `${bookDir(to)}/${m![2]}` : file;
  };
  // Move the folders through temporary names, so that no folder overwrites one that still has to move.
  if (removed) rmSync(join(root, removed), { recursive: true, force: true });
  const moving = [...map].filter(([from, to]) => to !== null && existsSync(join(root, bookDir(from))));
  for (const [from] of moving) renameSync(join(root, bookDir(from)), join(root, `books/.move-${pad2(from)}`));
  for (const [from, to] of moving) renameSync(join(root, `books/.move-${pad2(from)}`), join(root, bookDir(to!)));
  for (const [file, text] of writes) writeFileSync(join(root, moveTo(file)), text);

  // Each chapter with prose in a moved book comes after different books now: its record is checked again.
  for (const [from, to] of moving) {
    for (const c of project.prose.get(from) ?? []) {
      const verify = join(root, verifyPath(to!, c.data.chapter));
      mkdirSync(dirname(verify), { recursive: true });
      writeFileSync(verify, `${JSON.stringify({ round: 0, verdict: "fail", open: [], reopened: true }, null, 2)}\n`);
    }
  }
  return result({ renumbered, references });
}

/**
 * `lb reopen`: the one way back into the committed record, for a deep revision (ADR 0004), and `lb discard`: a
 * reopened chapter that is written again from its plan (ADR 0005).
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { briefPath } from "./brief.ts";
import { setFrontmatterKey } from "./frontmatter.ts";
import { countWords } from "./import.ts";
import type { Project } from "./project.ts";
import { chapterKey, chapterPath, comparePoint, isApproved, LEDGER, type RecordFiles, stagedPath, type Where } from "./record.ts";
import { memoryPath, verifyPath } from "./run.ts";

export interface ReopenResult {
  ok: boolean;
  errors: string[];
  /** The chapters that go back to draft, in story order (`1.07`). The first one is the chapter to revise. */
  chapters: string[];
  /** The ledger entries that go back to staged deltas. */
  entries: number;
  /** The words of the prose of those chapters: the cost of a deep revision, which checks or discards each one. */
  words: number;
}

/**
 * Takes the committed record back to the start of a chapter, for a deep revision (ADR 0004): the ledger entries of
 * that chapter and of every later chapter become their staged deltas again, and those chapters become drafts. The
 * chapter keeps its prose; the later chapters are checked again in order, against the record as the revision leaves it.
 */
export function reopenChapters(project: Project, rec: RecordFiles, book: number, chapter: number, opts: { dryRun?: boolean } = {}): ReopenResult {
  const errors: string[] = [];
  const key = chapterKey(book, chapter);
  const start: Where = { book, chapter, index: 0 };
  if (project.books.get(book)?.data.imported) errors.push(`book ${book} is imported: its prose is canon, and the record starts after it`);
  else if (!isApproved(project, book, chapter)) errors.push(`chapter ${key} is not approved: revise it with verify-chapter, not a reopen`);
  if (rec.issues.length) errors.push("the record has format errors: run `lb validate` and fix them first");

  // Every approved chapter of a planned book from this chapter on. A chapter with no entries goes back to draft too.
  const chapters: { book: number; chapter: number }[] = [];
  let words = 0;
  for (const [b, files] of [...project.prose].sort(([x], [y]) => x - y)) {
    if (project.books.get(b)?.data.imported) continue;
    for (const f of files) {
      const at = { book: b, chapter: f.data.chapter, index: 0 };
      if (f.data.status === "approved" && comparePoint(at, start) >= 0) {
        chapters.push(at);
        words += countWords(f.body);
      }
    }
  }
  for (const c of chapters) {
    if (rec.staged.has(chapterKey(c.book, c.chapter))) errors.push(`${stagedPath(c.book, c.chapter)} exists, but chapter ${chapterKey(c.book, c.chapter)} is approved: run \`lb validate\` and fix it first`);
  }
  const moved = rec.ledger.filter((l) => comparePoint(l.at, start) >= 0);
  const result = { ok: errors.length === 0, errors, chapters: chapters.map((c) => chapterKey(c.book, c.chapter)), entries: moved.length, words };
  if (!result.ok || opts.dryRun) return result;

  const root = project.root;
  for (const c of chapters) {
    const entries = moved.filter((l) => l.at.book === c.book && l.at.chapter === c.chapter).map(({ entry: { point: _, ...e } }) => JSON.stringify(e));
    const staged = join(root, stagedPath(c.book, c.chapter));
    mkdirSync(dirname(staged), { recursive: true });
    writeFileSync(staged, entries.length ? `${entries.join("\n")}\n` : "");
    const file = join(root, chapterPath(c.book, c.chapter));
    writeFileSync(file, setFrontmatterKey(readFileSync(file, "utf8"), "status", "draft"));
    // The brief has the old fold. The verify record of a later chapter says that its prose passed before.
    rmSync(join(root, briefPath(c.book, c.chapter)), { force: true });
    const verify = join(root, verifyPath(c.book, c.chapter));
    if (c.book === book && c.chapter === chapter) {
      rmSync(verify, { force: true });
      rmSync(join(root, memoryPath(c.book, c.chapter)), { force: true });
    } else {
      mkdirSync(dirname(verify), { recursive: true });
      writeFileSync(verify, `${JSON.stringify({ round: 0, verdict: "fail", open: [], reopened: true }, null, 2)}\n`);
    }
  }
  const kept = rec.ledger.filter((l) => comparePoint(l.at, start) < 0).map((l) => JSON.stringify(l.entry));
  writeFileSync(join(root, LEDGER), kept.length ? `${kept.join("\n")}\n` : "");
  return result;
}

export interface DiscardResult {
  ok: boolean;
  errors: string[];
  /** The files that were deleted (or with `dryRun`, would be), relative to the novel repo. */
  deleted: string[];
}

/**
 * `lb discard`: deletes the prose of a chapter that is not approved, and every file made from it, so that the
 * chapter-writer writes it again from its plan (ADR 0005). The plan stays. It never touches the ledger: an approved
 * chapter needs `lb reopen` first.
 */
export function discardChapter(project: Project, book: number, chapter: number, opts: { dryRun?: boolean } = {}): DiscardResult {
  const errors: string[] = [];
  const key = chapterKey(book, chapter);
  if (project.books.get(book)?.data.imported) errors.push(`book ${book} is imported: its prose is canon`);
  else if (isApproved(project, book, chapter)) errors.push(`chapter ${key} is approved: run \`lb reopen ${key}\` first`);
  if (errors.length) return { ok: false, errors, deleted: [] };

  const root = project.root;
  const files = [chapterPath(book, chapter), stagedPath(book, chapter), memoryPath(book, chapter), briefPath(book, chapter), verifyPath(book, chapter)];
  // The findings and the round copies of verify-chapter, revise-chapter and the reviser: runs/verify/NN-MM.findings.json, NN-MM.rK.md.
  const verifyDir = dirname(verifyPath(book, chapter));
  const stem = basename(verifyPath(book, chapter), ".json");
  if (existsSync(join(root, verifyDir))) {
    for (const f of readdirSync(join(root, verifyDir)).sort()) {
      if (f === `${stem}.findings.json` || (f.startsWith(`${stem}.r`) && /^r\d+\.md$/.test(f.slice(stem.length + 1)))) files.push(`${verifyDir}/${f}`);
    }
  }
  const deleted = files.filter((f) => existsSync(join(root, f)));
  if (!opts.dryRun) for (const f of deleted) rmSync(join(root, f));
  return { ok: true, errors, deleted };
}

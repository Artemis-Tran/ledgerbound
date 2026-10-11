/**
 * `lb reopen`: the one way back into the committed record, for a deep revision (ADR 0004).
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { briefPath } from "./brief.ts";
import { setFrontmatterKey } from "./frontmatter.ts";
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
  for (const [b, files] of [...project.prose].sort(([x], [y]) => x - y)) {
    if (project.books.get(b)?.data.imported) continue;
    for (const f of files) {
      const at = { book: b, chapter: f.data.chapter, index: 0 };
      if (f.data.status === "approved" && comparePoint(at, start) >= 0) chapters.push(at);
    }
  }
  for (const c of chapters) {
    if (rec.staged.has(chapterKey(c.book, c.chapter))) errors.push(`${stagedPath(c.book, c.chapter)} exists, but chapter ${chapterKey(c.book, c.chapter)} is approved: run \`lb validate\` and fix it first`);
  }
  const moved = rec.ledger.filter((l) => comparePoint(l.at, start) >= 0);
  const result = { ok: errors.length === 0, errors, chapters: chapters.map((c) => chapterKey(c.book, c.chapter)), entries: moved.length };
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

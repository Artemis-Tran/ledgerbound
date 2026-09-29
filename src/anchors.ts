/**
 * Plan anchors and points, and their order in the story.
 *
 * A position is a tuple [book, major, minor], compared in order:
 * - a book with chapter plans: major = chapter. minor 0 = a custom anchor or a point in the chapter,
 *   minor 1 = an end anchor at the end of the chapter.
 * - a book with no chapter plans yet: major = act index, minor = order of the custom anchor
 *   in the act, and act ends come after everything in their act.
 */
import type { Issue } from "./issues.ts";
import { bookDir, type Project } from "./project.ts";
import { AnchorRe, PointRe } from "./schemas.ts";

export type Pos = [book: number, major: number, minor: number];

export interface AnchorInfo {
  id: string;
  book: number;
  /** The act this anchor is in or ends. Absent for book ends and the series end. */
  act?: string;
  /** Set when the book has chapter plans. */
  chapter?: number;
  pos: Pos;
}

export interface PlanIndex {
  anchors: Map<string, AnchorInfo>;
  /** Books that have chapter plans. */
  planned: Set<number>;
  /** book → act id → chapter range [first, last]. Only for planned books. */
  actRanges: Map<number, Map<string, [number, number]>>;
  resolve(ref: string): { pos: Pos; book: number; chapter?: number } | { error: string };
}

const END = 1e9;

export const comparePos = (a: Pos, b: Pos) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

export function buildPlanIndex(project: Project, issues: Issue[]): PlanIndex {
  const anchors = new Map<string, AnchorInfo>();
  const planned = new Set<number>(project.chapters.keys());
  const actRanges = new Map<number, Map<string, [number, number]>>();

  for (const [book, plan] of project.books) {
    const acts = plan.data.acts;
    acts.forEach((act, i) => {
      anchors.set(`b${book}/${act.id}/end`, { id: `b${book}/${act.id}/end`, book, act: act.id, pos: [book, i, END] });
    });
    const actIndex = new Map(acts.map((a, i) => [a.id, i]));
    plan.data.anchors.forEach((a, j) => {
      if (!a.id.startsWith(`b${book}/`) || a.id.endsWith("/end")) {
        issues.push({ code: "anchor-id", severity: "error", file: plan.file, path: `anchors.${j}.id`, message: `a custom anchor in book ${book} must look like b${book}/<slug>` });
        return;
      }
      const i = actIndex.get(a.act);
      if (i === undefined) {
        issues.push({ code: "unknown-act", severity: "error", file: plan.file, path: `anchors.${j}.act`, message: `act '${a.act}' is not in this book` });
        return;
      }
      if (anchors.has(a.id)) {
        issues.push({ code: "duplicate-id", severity: "error", file: plan.file, path: `anchors.${j}.id`, message: `anchor ${a.id} is defined twice` });
      }
      anchors.set(a.id, { id: a.id, book, act: a.act, pos: [book, i, j] });
    });
    // The climax is in the last act, after its custom anchors.
    if (plan.data.climax) {
      const id = `b${book}/climax`;
      const last = acts.length - 1;
      if (anchors.has(id)) {
        issues.push({ code: "duplicate-id", severity: "error", file: plan.file, path: "anchors", message: `${id} comes from \`climax\`: remove it from \`anchors\`` });
      } else anchors.set(id, { id, book, act: acts[last].id, pos: [book, last, plan.data.anchors.length] });
    }
    anchors.set(`b${book}/end`, { id: `b${book}/end`, book, pos: [book, END, 0] });
  }
  anchors.set("series/end", { id: "series/end", book: Infinity, pos: [Infinity, 0, 0] });

  // Map anchors to chapters in the books that have chapter plans.
  for (const [book, chapters] of project.chapters) {
    const dirFile = `${bookDir(book)}/plan`;
    const plan = project.books.get(book);
    if (!plan) {
      issues.push({ code: "missing", severity: "error", file: `${bookDir(book)}/plan.md`, message: `book ${book} has chapter plans but no book plan` });
      continue;
    }
    const last = chapters.at(-1)!.data.chapter;
    for (const c of chapters) {
      c.data.anchors.forEach((id, k) => {
        const a = anchors.get(id);
        if (!a || a.book !== book) {
          issues.push({ code: "unknown-anchor", severity: "error", file: c.file, path: `anchors.${k}`, message: `${id} is not an anchor of book ${book}` });
          return;
        }
        if (a.chapter !== undefined) {
          issues.push({ code: "anchor-twice", severity: "error", file: c.file, path: `anchors.${k}`, message: `${id} is already mapped to chapter ${a.chapter}` });
          return;
        }
        a.chapter = c.data.chapter;
      });
    }
    const bookEnd = anchors.get(`b${book}/end`)!;
    if (bookEnd.chapter !== undefined && bookEnd.chapter !== last) {
      issues.push({ code: "anchor-order", severity: "error", file: dirFile, message: `b${book}/end must be the last chapter (${last}), not chapter ${bookEnd.chapter}` });
    }
    bookEnd.chapter = last;

    // Act ends: all mapped, in act order, the last one on the last chapter.
    const ranges = new Map<string, [number, number]>();
    let prevEnd = 0;
    for (const act of plan.data.acts) {
      const a = anchors.get(`b${book}/${act.id}/end`)!;
      if (a.chapter === undefined) {
        issues.push({ code: "anchor-unmapped", severity: "error", file: dirFile, message: `no chapter plan lists ${a.id}` });
        continue;
      }
      if (a.chapter <= prevEnd) {
        issues.push({ code: "anchor-order", severity: "error", file: dirFile, message: `${a.id} (chapter ${a.chapter}) must come after the end of the act before it (chapter ${prevEnd})` });
        continue;
      }
      ranges.set(act.id, [prevEnd + 1, a.chapter]);
      prevEnd = a.chapter;
    }
    if (prevEnd !== 0 && prevEnd !== last && ranges.size === plan.data.acts.length) {
      issues.push({ code: "anchor-order", severity: "error", file: dirFile, message: `the last act must end on the last chapter (${last}), not chapter ${prevEnd}` });
    }
    actRanges.set(book, ranges);

    for (const a of anchors.values()) {
      if (a.book !== book) continue;
      if (a.chapter === undefined) {
        if (!a.id.endsWith("/end")) {
          issues.push({ code: "anchor-unmapped", severity: "error", file: dirFile, message: `no chapter plan lists ${a.id}` });
        }
        continue;
      }
      const range = a.act ? ranges.get(a.act) : undefined;
      if (range && !a.id.endsWith("/end") && (a.chapter < range[0] || a.chapter > range[1])) {
        issues.push({ code: "anchor-order", severity: "error", file: dirFile, message: `${a.id} is in chapter ${a.chapter}, which is outside ${a.act} (chapters ${range[0]}–${range[1]})` });
      }
      a.pos = [book, a.chapter, a.id.endsWith("/end") ? 1 : 0];
    }
  }

  function resolve(ref: string): ReturnType<PlanIndex["resolve"]> {
    const p = PointRe.exec(ref);
    if (p) {
      const book = Number(p[1]);
      const chapter = Number(p[2]);
      if (!planned.has(book)) return { error: `${ref} is a point in book ${book}, which has no chapter plans yet; use a plan anchor` };
      if (!project.chapters.get(book)!.some((c) => c.data.chapter === chapter)) return { error: `book ${book} has no chapter ${chapter}` };
      return { pos: [book, chapter, 0.5], book, chapter };
    }
    if (!AnchorRe.test(ref)) return { error: `${ref} is not a point or a plan anchor` };
    const a = anchors.get(ref);
    if (!a) return { error: `${ref} is not a defined plan anchor` };
    if (planned.has(a.book) && a.chapter === undefined) return { error: `${ref} is not mapped to a chapter yet` };
    return { pos: a.pos, book: a.book, chapter: a.chapter };
  }

  return { anchors, planned, actRanges, resolve };
}

/**
 * `lb callbacks`: the later chapters that refer back to a chapter, from the `callbacks` of their memory files
 * (ADR 0007). A revision of a chapter checks them for seams.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { splitFrontmatter } from "./frontmatter.ts";
import type { Project } from "./project.ts";
import { chapterKey } from "./record.ts";

export interface CallbacksReport {
  point: string;
  /** Each callback to the chapter: the later chapter, its memory file and what it refers back to. */
  callbacks: { from: string; memory: string; what: string }[];
  /** The memory files after the chapter that have no `callbacks` yet: the memory writer writes them first. */
  missing: string[];
}

/** True when a memory file has its `callbacks` (from version 0.30.0); the schema default hides an older file. */
export function hasCallbacks(project: Project, file: string): boolean {
  const data = splitFrontmatter(readFileSync(join(project.root, file), "utf8")).data as Record<string, unknown> | undefined;
  return data !== undefined && "callbacks" in data;
}

export function callbacksTo(project: Project, book: number, chapter: number): CallbacksReport {
  const point = chapterKey(book, chapter);
  const callbacks: CallbacksReport["callbacks"] = [];
  const missing: string[] = [];
  for (const [b, files] of [...project.memory].sort(([x], [y]) => x - y)) {
    for (const m of files) {
      if (b < book || (b === book && m.data.chapter <= chapter)) continue;
      if (!hasCallbacks(project, m.file)) missing.push(m.file);
      for (const c of m.data.callbacks) if (c.point === point) callbacks.push({ from: chapterKey(b, m.data.chapter), memory: m.file, what: c.what });
    }
  }
  return { point, callbacks, missing };
}

import { cpSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Issue } from "../src/issues.ts";
import { loadProject } from "../src/project.ts";
import { validateProject } from "../src/validate.ts";

export const FIXTURE = join(import.meta.dirname, "..", "examples", "tiny-standalone");
export const IMPORTED_FIXTURE = join(import.meta.dirname, "..", "examples", "tiny-imported");

/** A fresh copy of the fixture novel in a temp folder. */
export function fixtureCopy(): string {
  const dir = mkdtempSync(join(tmpdir(), "lb-test-"));
  cpSync(FIXTURE, dir, { recursive: true });
  return dir;
}

/**
 * A fresh copy of the imported example: book 1 is an imported book (four chapters that the author wrote without
 * Ledgerbound), the record starts after it, and book 2 is planned.
 */
export function importedCopy(): string {
  const dir = mkdtempSync(join(tmpdir(), "lb-test-"));
  cpSync(IMPORTED_FIXTURE, dir, { recursive: true });
  return dir;
}

/** Replaces text in a file of the copy. Throws if the text is not there, so a test cannot pass by accident. */
export function edit(dir: string, file: string, from: string | RegExp, to: string) {
  const path = join(dir, file);
  const text = readFileSync(path, "utf8");
  const next = text.replace(from, to);
  if (next === text) throw new Error(`edit: '${String(from)}' not found in ${file}`);
  writeFileSync(path, next);
}

export function check(dir: string): Issue[] {
  const { project, issues } = loadProject(dir);
  if (!project) return issues;
  return [...issues, ...validateProject(project)];
}

export const errorCodes = (issues: Issue[]) => issues.filter((i) => i.severity === "error").map((i) => i.code);

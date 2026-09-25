/**
 * Checkpoints: which files each one owns, whether it is cleared, and what the next step is.
 *
 * A checkpoint is cleared when its files exist, the validator finds no errors in them or in
 * any upstream file, and they are approved (or the checkpoint is off).
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setFrontmatterKey } from "./frontmatter.ts";
import type { Issue } from "./issues.ts";
import { bookDir, type Loaded, type Project } from "./project.ts";
import type { Checkpoint } from "./schemas.ts";

/** Phase-1 checkpoints in workflow order, and the skill that produces each one. */
export const PHASE1: { checkpoint: Checkpoint; skill: string }[] = [
  { checkpoint: "bible", skill: "start-project" },
  { checkpoint: "series-plan", skill: "plan-series" },
  { checkpoint: "book-plan", skill: "plan-series" },
  { checkpoint: "character-arcs", skill: "plan-arcs" },
  { checkpoint: "chapter-plans", skill: "plan-book" },
  { checkpoint: "voice-sample", skill: "voice-sample" },
];

export function isOn(project: Project, cp: Checkpoint): boolean {
  if (project.config.mode === "just-write-it" && cp !== "replan") return false;
  return project.config.checkpoints[cp] ?? true;
}

/** The book that plan-book works on: the highest book with chapter plans, or else book 1. */
export function currentBook(project: Project): number {
  return Math.max(1, ...project.chapters.keys());
}

interface Owned {
  /** Files that carry `status`. */
  approvable: Loaded<{ status: "draft" | "approved" }>[];
  /** Issue file names (or prefixes ending in '/') that belong to this checkpoint. */
  owns: string[];
  /** Why the checkpoint cannot be cleared yet, when its files are missing. */
  missing?: string;
  /** The checkpoint does not apply to this project. */
  notApplicable?: string;
}

function owned(project: Project, cp: Checkpoint, book: number): Owned {
  const standalone = project.config.format === "standalone";
  switch (cp) {
    case "bible":
      return {
        approvable: project.bible ? [project.bible] : [],
        owns: ["project.yaml", "bible.md", "schema.yaml", "facts.yaml"],
        missing: !project.bible ? "bible.md is missing" : !project.schema ? "schema.yaml is missing" : undefined,
      };
    case "series-plan":
      if (standalone) return { approvable: [], owns: [], notApplicable: "a standalone book has no series plan" };
      return { approvable: project.series ? [project.series] : [], owns: ["series.md", "targets.yaml"], missing: project.series ? undefined : "series.md is missing" };
    case "book-plan": {
      const books = [...project.books.values()];
      return {
        approvable: books,
        owns: ["books/", ...(standalone ? ["targets.yaml"] : [])].filter(Boolean),
        missing: books.length === 0 ? "no book plan exists (books/NN/plan.md)" : undefined,
      };
    }
    case "character-arcs":
      return { approvable: project.characters, owns: ["characters/"], missing: project.characters.length === 0 ? "characters/ is empty" : undefined };
    case "chapter-plans": {
      const chapters = project.chapters.get(book) ?? [];
      return {
        approvable: chapters,
        owns: [`${bookDir(book)}/plan/`, `${bookDir(book)}/plan`, "threads.yaml"],
        missing: chapters.length === 0 ? `book ${book} has no chapter plans` : undefined,
      };
    }
    case "voice-sample":
      return { approvable: project.voiceSample ? [project.voiceSample] : [], owns: ["voice-sample.md"], missing: project.voiceSample ? undefined : "voice-sample.md is missing" };
    case "chapter-1":
    case "replan":
      return { approvable: [], owns: [], notApplicable: `${cp} is a phase-2 checkpoint` };
  }
}

const belongs = (issue: Issue, owns: string[]) =>
  owns.some((o) => issue.file === o || (o.endsWith("/") && issue.file.startsWith(o))) &&
  // books/NN/plan/ and books/NN/plan belong to chapter-plans, not to book-plan.
  !(owns.includes("books/") && /^books\/\d+\/plan(\/|$)/.test(issue.file));

/** The checkpoint itself and every checkpoint before it in the workflow. */
function upstreamAndSelf(cp: Checkpoint): Checkpoint[] {
  const i = PHASE1.findIndex((p) => p.checkpoint === cp);
  return i < 0 ? [cp] : PHASE1.slice(0, i + 1).map((p) => p.checkpoint);
}

export interface GateResult {
  checkpoint: Checkpoint;
  cleared: boolean;
  on: boolean;
  state: "n/a" | "missing" | "invalid" | "draft" | "approved";
  reason: string;
  errors: Issue[];
}

export function gate(project: Project, issues: Issue[], cp: Checkpoint, book = currentBook(project)): GateResult {
  const on = isOn(project, cp);
  const o = owned(project, cp, book);
  const base = { checkpoint: cp, on };
  if (o.notApplicable) return { ...base, cleared: true, state: "n/a", reason: o.notApplicable, errors: [] };
  if (o.missing) return { ...base, cleared: false, state: "missing", reason: o.missing, errors: [] };

  const errors = issues.filter(
    (i) => i.severity === "error" && upstreamAndSelf(cp).some((c) => belongs(i, owned(project, c, book).owns)),
  );
  if (errors.length > 0) return { ...base, cleared: false, state: "invalid", reason: `${errors.length} error(s) in this or an upstream checkpoint`, errors };
  const drafts = o.approvable.filter((f) => f.data.status !== "approved");
  if (drafts.length > 0) {
    return on
      ? { ...base, cleared: false, state: "draft", reason: `waiting for user approval: ${drafts.map((d) => d.file).join(", ")}`, errors }
      : { ...base, cleared: true, state: "draft", reason: "checkpoint is off", errors };
  }
  return { ...base, cleared: true, state: "approved", reason: "approved", errors };
}

/** Sets `status: approved` in every file of the checkpoint. Refuses when the gate has errors or files are missing. */
export function approve(project: Project, issues: Issue[], cp: Checkpoint, book = currentBook(project)): GateResult {
  const g = gate(project, issues, cp, book);
  if (g.state === "missing" || g.state === "invalid" || g.state === "n/a") return g;
  for (const f of owned(project, cp, book).approvable) {
    const path = join(project.root, f.file);
    writeFileSync(path, setFrontmatterKey(readFileSync(path, "utf8"), "status", "approved"));
    f.data.status = "approved";
  }
  return { ...g, cleared: true, state: "approved", reason: "approved" };
}

export interface StatusReport {
  mode: string;
  book: number;
  checkpoints: GateResult[];
  next: string;
}

export function status(project: Project, issues: Issue[]): StatusReport {
  const book = currentBook(project);
  const checkpoints = PHASE1.map((p) => gate(project, issues, p.checkpoint, book));
  const blocked = checkpoints.findIndex((g) => !g.cleared);
  let next: string;
  if (blocked < 0) next = "Phase 1 is complete. Generation is phase 2.";
  else {
    const g = checkpoints[blocked];
    const skill = PHASE1[blocked].skill;
    next =
      g.state === "missing"
        ? `Run the ${skill} skill (${g.reason}).`
        : g.state === "invalid"
          ? `Fix the errors (run \`lb validate\`), then continue with the ${skill} skill.`
          : `Show the ${g.checkpoint} output to the user. When they approve it, run \`lb approve ${g.checkpoint}\`.`;
  }
  return { mode: project.config.mode, book, checkpoints, next };
}

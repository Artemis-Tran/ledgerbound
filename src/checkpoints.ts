/**
 * Checkpoints: which files each one owns, whether it is cleared, and what the next step is.
 *
 * A checkpoint is cleared when its files exist, the validator finds no errors in them or in
 * any upstream file, and they are approved (or the checkpoint is off).
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { setFrontmatterKey } from "./frontmatter.ts";
import type { Issue } from "./issues.ts";
import { bookDir, type Loaded, type Project } from "./project.ts";
import type { Checkpoint } from "./schemas.ts";

/** The checkpoints in workflow order, and the skill that produces each one. `replan` is not in the order: it can come at any time. */
export const WORKFLOW: { checkpoint: Checkpoint; skill: string }[] = [
  { checkpoint: "bible", skill: "start-project" },
  { checkpoint: "world", skill: "plan-world" },
  { checkpoint: "series-plan", skill: "plan-series" },
  { checkpoint: "book-plan", skill: "plan-series" },
  { checkpoint: "character-arcs", skill: "plan-arcs" },
  { checkpoint: "chapter-plans", skill: "plan-book" },
  { checkpoint: "voice-sample", skill: "voice-sample" },
  { checkpoint: "chapter-1", skill: "generate-chapter" },
];

export function isOn(project: Project, cp: Checkpoint): boolean {
  if (project.config.mode === "autopilot") return false;
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
    case "world": {
      const entries = [...project.lore.values()];
      return { approvable: entries, owns: ["lore/"], missing: entries.length === 0 ? "lore/ has no lore entries" : undefined };
    }
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
      return {
        approvable: [...project.characters, ...project.relationships.values()],
        owns: ["characters/", "relationships/"],
        missing: project.characters.length === 0 ? "characters/ is empty" : undefined,
      };
    case "chapter-plans": {
      const chapters = project.chapters.get(book) ?? [];
      return {
        approvable: chapters,
        owns: [`${bookDir(book)}/plan/`, `${bookDir(book)}/plan`, "threads.yaml"],
        missing: chapters.length === 0 ? `book ${book} has no chapter plans` : undefined,
      };
    }
    case "voice-sample":
      return { approvable: project.voiceSamples, owns: ["voice/"], missing: project.voiceSamples.length === 0 ? "voice/ has no voice samples" : undefined };
    case "chapter-1": {
      // Chapter 1 of book 1 only. Its approval also commits its delta (see `lb approve chapter-1`).
      const ch = project.prose.get(1)?.find((c) => c.data.chapter === 1);
      return { approvable: ch ? [ch] : [], owns: ["books/01/chapters/01.md", "books/01/deltas/01.jsonl"], missing: ch ? undefined : "chapter 1.01 is not written yet" };
    }
    case "replan": {
      // The plan files that a replan can change. They are drafts again until the user approves the replan.
      const planned = [...project.chapters.keys()].map((b) => `${bookDir(b)}/plan/`);
      const approvable = [...(project.series ? [project.series] : []), ...project.books.values(), ...[...project.chapters.values()].flat(), ...project.characters, ...project.relationships.values(), ...project.lore.values()];
      return { approvable, owns: ["series.md", "books/", ...planned, "characters/", "relationships/", "threads.yaml", "targets.yaml", "lore/"] };
    }
  }
}

const belongs = (issue: Issue, owns: string[]) =>
  owns.some((o) => issue.file === o || (o.endsWith("/") && issue.file.startsWith(o) && !(o === "books/" && /^books\/\d+\/(plan\/|plan$|chapters|deltas|memory)/.test(issue.file))));

/** The checkpoint itself and every checkpoint before it in the workflow. */
function upstreamAndSelf(cp: Checkpoint): Checkpoint[] {
  const i = WORKFLOW.findIndex((p) => p.checkpoint === cp);
  return i < 0 ? [cp] : WORKFLOW.slice(0, i + 1).map((p) => p.checkpoint);
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
  if (cp === "chapter-1") throw new Error("chapter-1 is approved by commitChapter, which also commits the delta");
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
  const checkpoints = WORKFLOW.map((p) => gate(project, issues, p.checkpoint, book));
  const blocked = checkpoints.findIndex((g) => !g.cleared);
  let next: string;
  if (blocked < 0) next = "Run `lb run` for the next generation step.";
  else {
    const g = checkpoints[blocked];
    const skill = WORKFLOW[blocked].skill;
    next =
      g.state === "missing" && g.checkpoint === "bible"
        ? existsSync(join(project.root, "pitch.md"))
          ? "Run the start-project skill. It reads pitch.md."
          : "Run the start-project skill (bible.md is missing). For an idea of only one or two sentences, run develop-idea first."
        : g.state === "missing" && g.checkpoint === "chapter-1"
          ? "Run the generate-book skill (or generate-chapter for 1.01)."
        : g.state === "missing"
        ? `Run the ${skill} skill (${g.reason}).`
        : g.state === "invalid"
          ? `Fix the errors (run \`lb validate\`), then continue with the ${skill} skill.`
          : g.checkpoint === "chapter-1"
            ? "Run `lb run`: chapter 1.01 needs verify-chapter, then the user's approval (`lb approve chapter-1`)."
            : `Show the ${g.checkpoint} output to the user. When they approve it, run \`lb approve ${g.checkpoint}\`.`;
  }
  return { mode: project.config.mode, book, checkpoints, next };
}

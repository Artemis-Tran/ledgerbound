/**
 * `lb run`: the stage of each chapter of a book, worked out from the files, and the next step.
 * generate-book reads it after every step, so a run that stopped (a usage limit, a closed
 * session) continues from the first stage that is not done.
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { briefPath } from "./brief.ts";
import { isOn } from "./checkpoints.ts";
import { pad2, bookDir, type Project } from "./project.ts";
import { chapterKey, chapterPath, stagedPath } from "./record.ts";

export const STAGES = ["planned", "briefed", "drafted", "verified", "approved", "remembered", "done"] as const;
export type Stage = (typeof STAGES)[number] | "blocked";

export const verifyPath = (book: number, chapter: number) => `runs/verify/${pad2(book)}-${pad2(chapter)}.json`;
export const memoryPath = (book: number, chapter: number) => `${bookDir(book)}/memory/${pad2(chapter)}.md`;
export const MAX_ROUNDS = 3;
export const AUTOPILOT_LOG = "runs/autopilot.md";

/** What verify-chapter writes after each round. */
export interface VerifyRecord {
  round: number;
  verdict: "pass" | "fail";
  /** The findings that are still open: errors block, warnings go into the report. */
  open: { severity: "error" | "warn"; rule: string; line?: number; problem: string }[];
  /** Autopilot: a replan fixed the plan after the last round, so one more round is allowed. */
  extra_round?: boolean;
  /** The open errors are accepted: the chapter is committed with them (autopilot, or the user). */
  accepted?: boolean;
}

export const maxRounds = (v: VerifyRecord) => MAX_ROUNDS + (v.extra_round ? 1 : 0);

export function readVerify(root: string, book: number, chapter: number): VerifyRecord | undefined {
  const p = join(root, verifyPath(book, chapter));
  return existsSync(p) ? (JSON.parse(readFileSync(p, "utf8")) as VerifyRecord) : undefined;
}

export interface ChapterRun {
  chapter: number;
  stage: Stage;
  note?: string;
}

export interface RunReport {
  book: number;
  chapters: ChapterRun[];
  /** The first chapter that is not done, and what to do for it. */
  next: { chapter?: number; step: string };
  /** Open warnings of verified chapters, for the report at the end of the run. */
  warnings: { chapter: number; rule: string; problem: string }[];
  /** Chapters committed (or to be committed) with accepted open errors. */
  accepted: { chapter: number; errors: { rule: string; line?: number; problem: string }[] }[];
}

function gitClean(root: string, paths: string[]): boolean | undefined {
  try {
    execFileSync("git", ["rev-parse", "--is-inside-work-tree"], { cwd: root, stdio: "pipe" });
  } catch {
    return undefined;
  }
  const out = execFileSync("git", ["status", "--porcelain", "--", ...paths], { cwd: root, encoding: "utf8" });
  const tracked = execFileSync("git", ["ls-files", "--", ...paths], { cwd: root, encoding: "utf8" });
  return out.trim() === "" && tracked.trim() !== "";
}

export function runReport(project: Project, book: number): RunReport {
  const root = project.root;
  const has = (p: string) => existsSync(join(root, p));
  const warnings: RunReport["warnings"] = [];
  const accepted: RunReport["accepted"] = [];
  const chapters = (project.chapters.get(book) ?? []).map((plan): ChapterRun => {
    const n = plan.data.chapter;
    const prose = project.prose.get(book)?.find((c) => c.data.chapter === n);
    const verify = readVerify(root, book, n);
    for (const w of verify?.open.filter((f) => f.severity === "warn") ?? []) warnings.push({ chapter: n, rule: w.rule, problem: w.problem });
    if (verify?.accepted) accepted.push({ chapter: n, errors: verify.open.filter((f) => f.severity === "error").map(({ rule, line, problem }) => ({ rule, line, problem })) });

    if (prose?.data.status === "approved") {
      if (!has(memoryPath(book, n))) return { chapter: n, stage: "approved" };
      const clean = gitClean(root, [chapterPath(book, n), memoryPath(book, n), "ledger.jsonl"]);
      return { chapter: n, stage: clean === false ? "remembered" : "done" };
    }
    if (prose) {
      if (verify?.verdict === "pass") return { chapter: n, stage: "verified" };
      if (verify?.accepted) return { chapter: n, stage: "verified", note: "open errors accepted" };
      if (verify && verify.round >= maxRounds(verify)) {
        return { chapter: n, stage: "blocked", note: `${verify.open.filter((f) => f.severity === "error").length} open error(s) after ${verify.round} rounds` };
      }
      return { chapter: n, stage: "drafted", note: verify ? `round ${verify.round} failed` : undefined };
    }
    if (has(stagedPath(book, n)) || has(briefPath(book, n))) return { chapter: n, stage: "briefed" };
    return { chapter: n, stage: "planned" };
  });

  const first = chapters.find((c) => c.stage !== "done");
  const key = first ? chapterKey(book, first.chapter) : "";
  const steps: Record<Stage, string> = {
    planned: `Run \`lb brief ${key}\`, then the chapter-writer agent (generate-chapter).`,
    briefed: `Run the chapter-writer agent for ${key} (generate-chapter). A staged delta from an earlier try is its to replace.`,
    drafted: `Run verify-chapter for ${key}.`,
    verified:
      book === 1 && first?.chapter === 1 && isOn(project, "chapter-1")
        ? "Checkpoint chapter-1: show the user chapter 1.01 and the check results. When they approve, run `lb approve chapter-1`."
        : `Run \`lb commit ${key}\`.`,
    approved: `Run the memory-writer agent for ${key}.`,
    remembered: `Commit to git: \`Book ${book}, chapter ${first?.chapter}: <title>\`.`,
    done: "",
    blocked:
      project.config.mode === "autopilot"
        ? `Autopilot: chapter ${key} has open errors after its last round. Follow "Blocked in autopilot" in chapter-steps.md.`
        : `Stop. Chapter ${key} has open errors after its last round: show them to the user, and offer a replan if they are about the plan.`,
  };
  const next = first ? { chapter: first.chapter, step: steps[first.stage] } : { step: `Book ${book} is complete.` };

  const report: RunReport = { book, chapters, next, warnings, accepted };
  mkdirSync(join(root, "runs"), { recursive: true });
  writeFileSync(join(root, `runs/book-${pad2(book)}.json`), `${JSON.stringify({ book, chapters }, null, 2)}\n`);
  return report;
}

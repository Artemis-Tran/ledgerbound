import { existsSync, readdirSync, readFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { parse as parseYaml } from "yaml";
import { splitFrontmatter } from "../frontmatter.ts";
import { ChapterPlan, ProjectConfig } from "../schemas.ts";
import { type CorpusFile, type Finding, type LintResult, lintProse } from "./lint.ts";

export function findProjectRoot(from: string): string | undefined {
  let dir = resolve(from);
  for (;;) {
    if (existsSync(join(dir, "project.yaml"))) return dir;
    const up = dirname(dir);
    if (up === dir) return undefined;
    dir = up;
  }
}

function readBody(path: string) {
  const fm = splitFrontmatter(readFileSync(path, "utf8"));
  return { body: fm.body, firstLine: fm.bodyOffset + 1 };
}

export interface FileLintOptions {
  lines?: [number, number];
  /** Folder of other files to compare with. Default: the other chapters in books/NN/chapters/, or the other voice samples in voice/. */
  corpusDir?: string;
}

export function lintFile(path: string, opts: FileLintOptions = {}): LintResult & { file: string } {
  const abs = resolve(path);
  const root = findProjectRoot(dirname(abs));
  const file = root ? relative(root, abs) : path;
  const config = root ? ProjectConfig.safeParse(parseYaml(readFileSync(join(root, "project.yaml"), "utf8"))) : undefined;

  const chapterMatch = /(?:^|\/)books\/(\d+)\/chapters\/(\d+)\.md$/.exec(abs);
  // Chapters of one book, and the voice samples, are checked against each other for repeats.
  const voiceSample = root !== undefined && dirname(abs) === join(root, "voice");
  const corpusDir = opts.corpusDir ?? (chapterMatch || voiceSample ? dirname(abs) : undefined);
  const corpus: CorpusFile[] = corpusDir
    ? readdirSync(corpusDir)
        .filter((f) => f.endsWith(".md") && join(resolve(corpusDir), f) !== abs)
        .map((f) => ({ file: root ? relative(root, join(resolve(corpusDir), f)) : f, ...readBody(join(corpusDir, f)) }))
    : [];

  let waive: string[] = [];
  if (chapterMatch && root) {
    const planPath = join(root, "books", chapterMatch[1], "plan", basename(abs));
    if (existsSync(planPath)) {
      const plan = ChapterPlan.safeParse(splitFrontmatter(readFileSync(planPath, "utf8")).data);
      if (plan.success) waive = plan.data.exceptions.map((e) => e.rule);
    }
  }

  const { body, firstLine } = readBody(abs);
  const result = lintProse(body, firstLine, file, { config: config?.success ? config.data.lint : undefined, corpus, waive, lines: opts.lines });
  if (config?.success && !config.data.windows) {
    result.findings.push(...windowsOff(body, firstLine, opts.lines));
    result.findings.sort((a, b) => a.line - b.line);
  }
  return { file, ...result };
}

/** With `windows: off`, each fenced block (a status window) is an error. */
function windowsOff(body: string, firstLine: number, lines?: [number, number]): Finding[] {
  const out: Finding[] = [];
  let open = false;
  body.split("\n").forEach((l, i) => {
    if (!/^\s*(```|~~~)/.test(l)) return;
    open = !open;
    const line = firstLine + i;
    if (open && (!lines || (line >= lines[0] && line <= lines[1]))) {
      out.push({ rule: "windows.off", severity: "error", line, text: l.trim(), message: "project.yaml has windows: off, so show this change in the prose, not in a status window" });
    }
  });
  return out;
}

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
  /** Folder of other files to compare with. Default: for a chapter, the other chapters in books/NN/chapters/ and the voice samples in voice/; for a voice sample, the other two. */
  corpusDir?: string;
  /** The same file before a revision: a rule with more findings now than then is an error. */
  before?: string;
}

export function lintFile(path: string, opts: FileLintOptions = {}): LintResult & { file: string } {
  const abs = resolve(path);
  const root = findProjectRoot(dirname(abs));
  const file = root ? relative(root, abs) : path;
  const config = root ? ProjectConfig.safeParse(parseYaml(readFileSync(join(root, "project.yaml"), "utf8"))) : undefined;

  const chapterMatch = /(?:^|\/)books\/(\d+)\/chapters\/(\d+)\.md$/.exec(abs);
  // Chapters of one book, and the voice samples, are checked against each other for repeats.
  // A chapter is also checked against the voice samples: the writer reads them in every brief.
  const voiceDir = root !== undefined ? join(root, "voice") : undefined;
  const voiceSample = voiceDir !== undefined && dirname(abs) === voiceDir;
  const corpusDirs = opts.corpusDir
    ? [opts.corpusDir]
    : chapterMatch
      ? [dirname(abs), ...(voiceDir && existsSync(voiceDir) ? [voiceDir] : [])]
      : voiceSample
        ? [dirname(abs)]
        : [];
  const corpus: CorpusFile[] = corpusDirs.flatMap((dir) =>
    readdirSync(dir)
      .filter((f) => f.endsWith(".md") && join(resolve(dir), f) !== abs)
      .map((f) => ({ file: root ? relative(root, join(resolve(dir), f)) : f, ...readBody(join(dir, f)) })),
  );

  let waive: string[] = [];
  let planWords: number | undefined;
  if (chapterMatch && root) {
    const planPath = join(root, "books", chapterMatch[1], "plan", basename(abs));
    if (existsSync(planPath)) {
      const plan = ChapterPlan.safeParse(splitFrontmatter(readFileSync(planPath, "utf8")).data);
      if (plan.success) {
        waive = plan.data.exceptions.map((e) => e.rule);
        planWords = plan.data.words;
      }
    }
  }

  const lintBody = (text: { body: string; firstLine: number }, lines?: [number, number]) => {
    const r = lintProse(text.body, text.firstLine, file, { config: config?.success ? config.data.lint : undefined, corpus, waive, lines });
    if (config?.success && !config.data.windows) {
      r.findings.push(...windowsOff(text.body, text.firstLine, lines));
      r.findings.sort((a, b) => a.line - b.line);
    }
    return r;
  };
  const now = readBody(abs);
  const result = lintBody(now, opts.lines);
  // A voice sample from an imported book is the author's own prose: its findings are warnings, and the chapters that
  // the tool writes are still compared with it for repeats.
  const imported = voiceSample && root ? importedSource(root, abs) : undefined;
  if (imported) {
    result.findings = result.findings.map((f) => (f.severity === "error" ? { ...f, severity: "warn" as const, message: `${f.message} (a warning only: the sample is the author's prose from ${imported})` } : f));
  }
  if (opts.before) result.findings.push(...added(lintBody(readBody(opts.before)).findings, opts.lines ? lintBody(now).findings : result.findings));
  // A re-check of a line range does not judge the length of the whole chapter.
  if (chapterMatch && config?.success && !opts.lines) {
    const length = lengthFinding(result.words, planWords ?? config.data.chapter_words, now.firstLine);
    if (length) result.findings.unshift(waive.includes(length.rule) ? { ...length, waived: true } : length);
  }
  return { file, ...result };
}

/**
 * One error for each rule that has more findings after a revision than before it: a fix must not add
 * a one-line paragraph, a contrast frame or a repeat somewhere else.
 */
function added(before: Finding[], after: Finding[]): Finding[] {
  const count = (fs: Finding[]) => {
    const m = new Map<string, Finding[]>();
    for (const f of fs.filter((x) => !x.waived)) m.set(f.rule, [...(m.get(f.rule) ?? []), f]);
    return m;
  };
  const was = count(before);
  return [...count(after)].flatMap(([rule, fs]) => {
    const old = was.get(rule) ?? [];
    if (fs.length <= old.length) return [];
    const first = fs.find((f) => !old.some((o) => o.text === f.text)) ?? fs[0];
    return [{ rule, severity: "error" as const, line: first.line, text: first.text, message: `the revision added ${rule} findings: ${old.length} before, ${fs.length} now. Fix it without a new one` }];
  });
}

/** The point of a voice sample's `source` (for example "1.03, scene 2") when that chapter is from an imported book. */
function importedSource(root: string, abs: string): string | undefined {
  const source = (splitFrontmatter(readFileSync(abs, "utf8")).data as { source?: unknown } | undefined)?.source;
  const m = typeof source === "string" ? /^(\d+)\.(\d+)\b/.exec(source) : null;
  if (!m) return undefined;
  const chapter = join(root, "books", m[1].padStart(2, "0"), "chapters", `${m[2].padStart(2, "0")}.md`);
  if (!existsSync(chapter)) return undefined;
  const data = splitFrontmatter(readFileSync(chapter, "utf8")).data as { source?: unknown } | undefined;
  return data?.source === "imported" ? `${Number(m[1])}.${m[2].padStart(2, "0")}` : undefined;
}

/** How far a chapter can be from its target length before a warning. */
export const LENGTH_TOLERANCE = 0.25;

/** A warning when a chapter is more than LENGTH_TOLERANCE shorter or longer than its target. */
function lengthFinding(words: number, target: number, firstLine: number): Finding | undefined {
  if (Math.abs(words - target) <= target * LENGTH_TOLERANCE) return undefined;
  const pct = Math.round(LENGTH_TOLERANCE * 100);
  return {
    rule: "length.target",
    severity: "warn",
    line: firstLine,
    text: `${words} words`,
    message: `the chapter has ${words} words; the target is ${target} (plan \`words\`, else chapter_words), so ${Math.round(target * (1 - LENGTH_TOLERANCE))}–${Math.round(target * (1 + LENGTH_TOLERANCE))} (±${pct}%)`,
  };
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

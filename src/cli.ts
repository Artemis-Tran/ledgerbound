/**
 * `lb`: the deterministic CLI of Ledgerbound. It exits 1 when a check fails, so a skill can use it as a gate.
 */
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildBrief } from "./brief.ts";
import { parseArgs } from "node:util";
import { approve, currentBook, gate, isOn, status } from "./checkpoints.ts";
import { Claims, compareClaims } from "./claims.ts";
import { initProject } from "./init.ts";
import { formatIssues, hasErrors, type Issue } from "./issues.ts";
import { findProjectRoot, lintFile } from "./lint/index.ts";
import { loadProject, type Project } from "./project.ts";
import { chapterPath, checkDelta, commitChapter, fold, loadRecord, parsePoint, type Where } from "./record.ts";
import { RULES } from "./rules.ts";
import { runReport } from "./run.ts";
import { type Checkpoint, CHECKPOINTS } from "./schemas.ts";
import { validateProject } from "./validate.ts";

const HELP = `lb: the Ledgerbound CLI. Run it inside a novel repo (or pass --dir).

  lb init [dir] --title T [--format series|standalone]   make a novel repo
  lb status [--json]                     checkpoints and the next step
  lb validate [bible|plan|all] [--json]  check the files and their references (exit 1 on error)
  lb gate <checkpoint> [--book N]        exit 0 when the checkpoint is cleared
  lb approve <checkpoint> [--book N]     mark the checkpoint's files approved (only after the user approves)
  lb lint <file...> [--lines A-B] [--corpus DIR] [--json]
                                         deterministic prose checks (exit 1 on an unwaived error)
  lb rules [--json]                      the rule IDs of guidelines/writing.md
  lb where                               the ledgerbound folder (reference/, examples/)

Generation (a point is 1.07 = book 1, chapter 7):
  lb run [--book N] [--json]             the stage of each chapter, and the next step
  lb brief <point>                       write the context brief to runs/briefs/
  lb delta <point> [--json]              check the staged delta of a chapter (exit 1 on error)
  lb fold [point] [--entity ID] [--committed] [--json]
                                         the state at a point: 1.07 = end of chapter 7, 1.07.0 = its start
  lb claims <point> <claims.json> [--json]
                                         compare the prose's claims with the fold (exit 1 on a mismatch)
  lb commit <point> [--json]             append a verified chapter's delta to the ledger and approve it

Checkpoints: ${CHECKPOINTS.join(", ")}`;

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    json: { type: "boolean", default: false },
    dir: { type: "string" },
    book: { type: "string" },
    title: { type: "string" },
    format: { type: "string" },
    lines: { type: "string" },
    corpus: { type: "string" },
    entity: { type: "string" },
    committed: { type: "boolean", default: false },
    help: { type: "boolean", short: "h", default: false },
  },
});

const [command, ...args] = positionals;
const out = (human: string, json: unknown) => console.log(values.json ? JSON.stringify(json, null, 2) : human);

function fail(message: string): never {
  console.error(`lb: ${message}`);
  process.exit(2);
}

function load(): { project: Project; issues: Issue[] } {
  const root = values.dir ? resolve(values.dir) : findProjectRoot(process.cwd());
  if (!root) fail("no project.yaml here or in a parent folder. Run `lb init` first, or pass --dir.");
  const { project, issues } = loadProject(root);
  if (!project) {
    out(formatIssues(issues), { ok: false, issues });
    process.exit(1);
  }
  return { project, issues: [...issues, ...validateProject(project)] };
}

function checkpointArg(): Checkpoint {
  const cp = args[0] as Checkpoint;
  if (!CHECKPOINTS.includes(cp)) fail(`unknown checkpoint '${args[0] ?? ""}'. Use one of: ${CHECKPOINTS.join(", ")}`);
  return cp;
}

const bookArg = (project: Project) => (values.book ? Number(values.book) : currentBook(project));

function chapterArg(i = 0): { book: number; chapter: number } {
  const w = args[i] ? parsePoint(args[i]) : undefined;
  if (!w || Number.isFinite(w.index)) fail(`give a chapter as a point like 1.07, not '${args[i] ?? ""}'`);
  return { book: w.book, chapter: w.chapter };
}

/** Commits a chapter: its lint must pass, then its delta goes to the ledger. */
function commit(project: Project, book: number, chapter: number) {
  const lint = lintFile(join(project.root, chapterPath(book, chapter)));
  const blocking: Issue[] = lint.findings
    .filter((f) => f.severity === "error" && !f.waived)
    .map((f) => ({ code: `lint.${f.rule}`, severity: "error", file: lint.file, path: `line ${f.line}`, message: f.message }));
  const r = commitChapter(project, loadRecord(project.root), book, chapter, blocking);
  const human = r.ok
    ? `Committed ${book}.${String(chapter).padStart(2, "0")}: ${r.committed} entr${r.committed === 1 ? "y" : "ies"} appended to ledger.jsonl.${r.replan.length ? `\nREPLAN NEEDED: a later target cannot be reached:\n${r.replan.map((x) => `  ${x}`).join("\n")}` : ""}`
    : `NOT committed:\n${formatIssues(r.issues)}`;
  out(human, r);
  process.exit(r.ok ? 0 : 1);
}

switch (command) {
  case "init": {
    const format = (values.format ?? "series") as "series" | "standalone";
    if (format !== "series" && format !== "standalone") fail("--format must be series or standalone");
    if (!values.title) fail("--title is required");
    const dir = resolve(args[0] ?? ".");
    const created = initProject(dir, values.title, format);
    out(`Created in ${dir}:\n${created.map((c) => `  ${c}`).join("\n") || "  (nothing: all files exist)"}`, { dir, created });
    break;
  }

  case "validate": {
    const { issues } = load();
    const scope = args[0] ?? "all";
    const bibleFiles = ["project.yaml", "bible.md", "schema.yaml", "facts.yaml"];
    const shown =
      scope === "all" ? issues : scope === "bible" ? issues.filter((i) => bibleFiles.includes(i.file)) : scope === "plan" ? issues.filter((i) => !bibleFiles.includes(i.file)) : fail("scope must be bible, plan or all");
    out(formatIssues(shown), { ok: !hasErrors(shown), issues: shown });
    process.exit(hasErrors(shown) ? 1 : 0);
  }

  case "status": {
    const { project, issues } = load();
    const s = status(project, issues);
    if (s.checkpoints.every((g) => g.cleared)) s.next = runReport(project, s.book).next.step;
    const rows = s.checkpoints.map((g) => `  ${g.cleared ? "✔" : "·"} ${g.checkpoint.padEnd(15)} ${(g.on ? "on" : "off").padEnd(4)} ${g.state.padEnd(9)} ${g.reason}`);
    out(`Mode: ${s.mode}. Current book: ${s.book}.\n${rows.join("\n")}\n\nNext: ${s.next}`, s);
    break;
  }

  case "gate": {
    const cp = checkpointArg();
    const { project, issues } = load();
    const g = gate(project, issues, cp, bookArg(project));
    out(`${g.cleared ? "CLEARED" : "BLOCKED"} ${cp}: ${g.reason}${g.errors.length ? `\n${formatIssues(g.errors)}` : ""}`, g);
    process.exit(g.cleared ? 0 : 1);
  }

  case "approve": {
    const cp = checkpointArg();
    const { project, issues } = load();
    if (cp === "chapter-1") commit(project, 1, 1);
    const g = approve(project, issues, cp, bookArg(project));
    const ok = g.state === "approved";
    out(ok ? `Approved ${cp}.` : `NOT approved ${cp}: ${g.reason}${g.errors.length ? `\n${formatIssues(g.errors)}` : ""}`, g);
    process.exit(ok ? 0 : 1);
  }

  case "lint": {
    if (args.length === 0) fail("give at least one file");
    let lines: [number, number] | undefined;
    if (values.lines) {
      const m = /^(\d+)-(\d+)$/.exec(values.lines);
      if (!m) fail("--lines must look like 40-52");
      lines = [Number(m[1]), Number(m[2])];
    }
    const results = args.map((f) => lintFile(f, { lines, corpusDir: values.corpus }));
    const blocking = results.flatMap((r) => r.findings.filter((f) => f.severity === "error" && !f.waived));
    const human = results
      .map(
        (r) =>
          `${r.file} (${r.words} words): ${r.findings.length} finding(s)\n` +
          r.findings.map((f) => `  ${String(f.line).padStart(4)} ${f.waived ? "WAIVED" : f.severity.toUpperCase()} ${f.rule}: ${f.message}\n        "${f.text}"`).join("\n"),
      )
      .join("\n");
    out(human, { ok: blocking.length === 0, errors: blocking.length, results });
    process.exit(blocking.length ? 1 : 0);
  }

  case "rules": {
    out(RULES.map((r) => `${r.id.padEnd(28)} §${r.section.padEnd(5)} ${r.check.join("+").padEnd(11)} ${r.summary}`).join("\n"), RULES);
    break;
  }

  case "where": {
    console.log(resolve(import.meta.dirname, ".."));
    break;
  }

  case "run": {
    const { project } = load();
    const r = runReport(project, bookArg(project));
    const rows = r.chapters.map((c) => `  ${String(c.chapter).padStart(2, "0")} ${c.stage.padEnd(10)} ${c.note ?? ""}`);
    out(`Book ${r.book}:\n${rows.join("\n")}\n\nNext: ${r.next.step}`, r);
    break;
  }

  case "brief": {
    const { book, chapter } = chapterArg();
    const { project } = load();
    const r = buildBrief(project, loadRecord(project.root), book, chapter);
    out(`Wrote ${r.file} (${r.chars} characters).${r.dropped.length ? `\nDropped to fit brief_chars: ${r.dropped.join("; ")}` : ""}${r.over ? "\nWARN: still over brief_chars." : ""}`, r);
    break;
  }

  case "delta": {
    const { book, chapter } = chapterArg();
    const { project } = load();
    const c = checkDelta(project, loadRecord(project.root), book, chapter);
    const changes = c.entries.map((l, i) => `  ${i + 1}. ${l.entry.op} ${l.entry.entity}${l.entry.field ? `.${l.entry.field}` : ""} ${JSON.stringify(l.entry.value)}${c.lines[i] ? ` (line ${c.lines[i]})` : ""}`);
    out(`${changes.join("\n") || "  (no entries)"}\n${formatIssues(c.issues)}`, { ok: !hasErrors(c.issues), issues: c.issues, entries: c.entries.map((l, i) => ({ ...l.entry, line: c.lines[i] })), before: c.before, after: c.after });
    process.exit(hasErrors(c.issues) ? 1 : 0);
  }

  case "fold": {
    const { project } = load();
    const at: Where = args[0] ? (parsePoint(args[0]) ?? fail(`'${args[0]}' is not a point like 1.07 or 1.07.3`)) : { book: Infinity, chapter: 0, index: 0 };
    const f = fold(project, loadRecord(project.root), at, { staged: !values.committed });
    const state = values.entity ? { day: f.state.day, time: f.state.time, entities: { [values.entity]: f.state.entities[values.entity] ?? fail(`no entity '${values.entity}'`) } } : f.state;
    out(JSON.stringify(state, null, 2) + (f.issues.length ? `\n${formatIssues(f.issues)}` : ""), { state, issues: f.issues });
    break;
  }

  case "claims": {
    const { book, chapter } = chapterArg();
    if (!args[1]) fail("give the claims file: lb claims 1.07 claims.json");
    const { project } = load();
    const parsed = Claims.safeParse(JSON.parse(readFileSync(args[1], "utf8")));
    if (!parsed.success) fail(`the claims file is not valid: ${parsed.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; ")}`);
    const c = checkDelta(project, loadRecord(project.root), book, chapter);
    const results = compareClaims(project, c, parsed.data);
    const bad = results.filter((r) => r.verdict !== "ok");
    const errors = bad.filter((r) => r.severity === "error").length;
    out(
      `${results.length} claim(s), ${errors} error(s), ${bad.length - errors} to compare.\n${bad.map((r) => `  ${String(r.line).padStart(4)} ${r.verdict.toUpperCase()} ${r.entity}.${r.field}: prose ${JSON.stringify(r.value)}, record ${JSON.stringify(r.record ?? null)}\n        "${r.quote}"`).join("\n")}`,
      { ok: errors === 0, errors, results, delta_issues: c.issues },
    );
    process.exit(errors ? 1 : 0);
  }

  case "commit": {
    const { book, chapter } = chapterArg();
    const { project } = load();
    if (book === 1 && chapter === 1 && isOn(project, "chapter-1")) fail("chapter 1.01 needs the user's approval: run `lb approve chapter-1` after they approve");
    commit(project, book, chapter);
    break;
  }

  default:
    console.log(HELP);
    process.exit(command && !values.help ? 2 : 0);
}

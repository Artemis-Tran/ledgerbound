/**
 * `lb`: the deterministic CLI of Ledgerbound. It exits 1 when a check fails, so a skill can use it as a gate.
 */
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { approve, currentBook, gate, status } from "./checkpoints.ts";
import { initProject } from "./init.ts";
import { formatIssues, hasErrors, type Issue } from "./issues.ts";
import { findProjectRoot, lintFile } from "./lint/index.ts";
import { loadProject, type Project } from "./project.ts";
import { RULES } from "./rules.ts";
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

  default:
    console.log(HELP);
    process.exit(command && !values.help ? 2 : 0);
}

/**
 * `lb`: the deterministic CLI of Ledgerbound. It exits 1 when a check fails, so a skill can use it as a gate.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { buildBrief } from "./brief.ts";
import { parseArgs } from "node:util";
import { buildPlanIndex } from "./anchors.ts";
import { approve, currentBook, gate, isOn, status } from "./checkpoints.ts";
import { Claims, compareClaims } from "./claims.ts";
import { buildEpub } from "./export/epub.ts";
import { initProject } from "./init.ts";
import { splitFrontmatter } from "./frontmatter.ts";
import { formatIssues, hasErrors, type Issue } from "./issues.ts";
import { findProjectRoot, lintFile } from "./lint/index.ts";
import { characterEntry, charactersNamedIn, entryText, lastSeen, loreEntry, loreNamedIn } from "./entries.ts";
import { loadProject, type Project } from "./project.ts";
import { chapterPath, checkDelta, commitChapter, fold, loadRecord, parsePoint, type Where } from "./record.ts";
import { RULES } from "./rules.ts";
import { readVerify, runReport } from "./run.ts";
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
  lb lore <file> [--json]                the lore entries that a prose file names by ID, title or alias,
                                         each as it is at the start of that chapter
  lb lore <id> --at <point> [--json]     one lore entry as it is at the start of a chapter
  lb who <file> [--json]                 the characters that a prose file names by ID, name, alias or a
                                         part of the name, each as it is at the start of that chapter
  lb who <id> --at <point> [--json]      one character as it is at the start of a chapter: who it is,
                                         its voice card, its record state and the chapter it was last seen
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

Publishing:
  lb export [--book N] [--draft] [--out FILE] [--json]
                                         the book as an EPUB file (default exports/NN-<title>.epub);
                                         needs books/NN/publish.yaml and every chapter approved, or --draft

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
    draft: { type: "boolean", default: false },
    out: { type: "string" },
    at: { type: "string" },
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

/** Commits a chapter: its lint must pass (unless its verify record accepts the open errors), then its delta goes to the ledger. */
function commit(project: Project, book: number, chapter: number) {
  const lint = lintFile(join(project.root, chapterPath(book, chapter)));
  const accepted = readVerify(project.root, book, chapter)?.accepted === true;
  const blocking: Issue[] = lint.findings
    .filter(() => !accepted)
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

  case "lore": {
    if (!args[0]) fail("give a prose file (lb lore books/01/chapters/07.md) or an entry ID (lb lore harvest-day --at 1.07)");
    const { project } = load();
    const index = buildPlanIndex(project, []);
    const view = (id: string, book: number, chapter: number) => {
      const e = project.lore.get(id)!;
      return { id, title: e.data.title, file: e.file, text: entryText(index, loreEntry(id, e), book, chapter) };
    };
    if (project.lore.has(args[0])) {
      const w = values.at ? parsePoint(values.at) : undefined;
      if (!w || Number.isFinite(w.index)) fail("give the chapter with --at, as a point like 1.07");
      const e = view(args[0], w.book, w.chapter);
      out(`# ${e.title} (${e.file}, at the start of ${values.at})\n\n${e.text}`, e);
      break;
    }
    if (!existsSync(args[0])) fail(`'${args[0]}' is not a file or a lore entry ID`);
    const { data, body } = splitFrontmatter(readFileSync(args[0], "utf8"));
    const { book, chapter } = (data ?? {}) as { book?: unknown; chapter?: unknown };
    if (typeof book !== "number" || typeof chapter !== "number") fail(`${args[0]} has no book and chapter in its frontmatter`);
    const entries = loreNamedIn(project, body).map((id) => view(id, book, chapter));
    out(
      `${args[0]} names ${entries.length} lore entr${entries.length === 1 ? "y" : "ies"}.${entries.map((e) => `\n\n## ${e.title} (${e.file})\n\n${e.text}`).join("")}`,
      { file: args[0], entries },
    );
    break;
  }

  case "who": {
    if (!args[0]) fail("give a prose file (lb who books/01/chapters/07.md) or a character ID (lb who sabine --at 1.07)");
    const { project } = load();
    const index = buildPlanIndex(project, []);
    const rec = loadRecord(project.root);
    const view = (id: string, book: number, chapter: number) => {
      const c = project.characters.find((x) => x.data.id === id);
      const state = fold(project, rec, { book, chapter, index: 0 }).state.entities[id];
      if (!c && !state) return undefined;
      const record = state ? { name: state.name, ...state.fields, beliefs: state.beliefs } : null;
      const text = c ? entryText(index, characterEntry(c), book, chapter) : "";
      return { id, name: c?.data.name ?? state!.name, role: c?.data.role ?? null, file: c?.file ?? null, text, voice: c?.data.voice ?? null, last_seen: lastSeen(project, id, book, chapter) ?? null, record };
    };
    const human = (v: NonNullable<ReturnType<typeof view>>, at: string) =>
      [
        `# ${v.name} (${v.file ?? "no character file"}, at the start of ${at})`,
        v.text,
        `Last seen: ${v.last_seen ?? "not yet"}.`,
        v.voice ? `Voice card:\n${JSON.stringify(v.voice, null, 2)}` : "",
        `Record:\n${v.record ? JSON.stringify(v.record, null, 2) : "(no entity yet)"}`,
      ]
        .filter(Boolean)
        .join("\n\n");
    if (!existsSync(args[0])) {
      const w = values.at ? parsePoint(values.at) : undefined;
      if (!w || Number.isFinite(w.index)) fail("give the chapter with --at, as a point like 1.07");
      const v = view(args[0], w.book, w.chapter) ?? fail(`'${args[0]}' is not a file, a character file or an entity at the start of ${values.at}`);
      out(human(v, values.at!), v);
      break;
    }
    const { data, body } = splitFrontmatter(readFileSync(args[0], "utf8"));
    const { book, chapter } = (data ?? {}) as { book?: unknown; chapter?: unknown };
    if (typeof book !== "number" || typeof chapter !== "number") fail(`${args[0]} has no book and chapter in its frontmatter`);
    const characters = charactersNamedIn(project, body).flatMap((id) => view(id, book, chapter) ?? []);
    const at = `${book}.${String(chapter).padStart(2, "0")}`;
    out(`${args[0]} names ${characters.length} character(s).${characters.map((v) => `\n\n${human(v, at)}`).join("")}`, { file: args[0], characters });
    break;
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
    const acc = r.accepted.map((a) => `${String(a.chapter).padStart(2, "0")} (${a.errors.length})`).join(", ");
    out(`Book ${r.book}:\n${rows.join("\n")}${acc ? `\n\nAccepted open errors: ${acc}` : ""}\n\nNext: ${r.next.step}`, r);
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

  case "export": {
    const { project } = load();
    const book = bookArg(project);
    const r = buildEpub(project, book, { draft: values.draft });
    const { epub, ...report } = r;
    if (epub) {
      const target = values.out ? resolve(values.out) : join(project.root, r.file);
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, epub);
      report.file = values.out ? target : r.file;
    }
    const human = r.ok
      ? `Wrote ${report.file} (${Math.round(epub!.length / 1024)} KB): ${r.chapters.length} chapter(s), ${r.words} words.` +
        `${r.missing.length ? `\nNot in this draft: chapter(s) ${r.missing.join(", ")}.` : ""}` +
        `${r.issues.length ? `\n${formatIssues(r.issues)}` : ""}`
      : `NOT exported:\n${formatIssues(r.issues)}`;
    out(human, report);
    process.exit(r.ok ? 0 : 1);
  }

  default:
    console.log(HELP);
    process.exit(command && !values.help ? 2 : 0);
}

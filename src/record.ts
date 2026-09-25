/**
 * The record: the ledger, the staged deltas, and the fold.
 *
 * The fold starts from the `start` values in schema.yaml, replays the committed ledger, then the
 * staged deltas in chapter order. Every reader of story state gets it from here.
 */
import { appendFileSync, existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildPlanIndex, type PlanIndex } from "./anchors.ts";
import { checkValue, fieldDef, type Kind, numericRange } from "./fields.ts";
import { setFrontmatterKey, splitFrontmatter } from "./frontmatter.ts";
import type { Issue } from "./issues.ts";
import { bookDir, pad2, type Project } from "./project.ts";
import { BELIEFS, DeltaEntry, EntryPointRe, PointRe, type Target } from "./schemas.ts";

type Belief = (typeof BELIEFS)[number];

// ---------- points ----------

/** A place in the record. `index` 0 is the start of the chapter; `Infinity` is its end. */
export interface Where {
  book: number;
  chapter: number;
  index: number;
}

export const comparePoint = (a: Where, b: Where) => a.book - b.book || a.chapter - b.chapter || a.index - b.index;
export const formatPoint = (w: Where) => `${w.book}.${pad2(w.chapter)}${Number.isFinite(w.index) ? `.${w.index}` : ""}`;
export const chapterKey = (book: number, chapter: number) => `${book}.${pad2(chapter)}`;

/** `1.07` is the end of chapter 7; `1.07.0` its start; `1.07.3` after its third entry. */
export function parsePoint(s: string): Where | undefined {
  const e = EntryPointRe.exec(s);
  if (e) return { book: Number(e[1]), chapter: Number(e[2]), index: Number(e[3]) };
  const p = PointRe.exec(s);
  if (p) return { book: Number(p[1]), chapter: Number(p[2]), index: Infinity };
  return undefined;
}

export const stagedPath = (book: number, chapter: number) => `${bookDir(book)}/deltas/${pad2(chapter)}.jsonl`;
export const chapterPath = (book: number, chapter: number) => `${bookDir(book)}/chapters/${pad2(chapter)}.md`;
export const LEDGER = "ledger.jsonl";

// ---------- reading ----------

export interface Located {
  entry: DeltaEntry;
  at: Where;
  file: string;
  /** Line in the JSONL file. */
  line: number;
  staged: boolean;
}

export interface RecordFiles {
  ledger: Located[];
  /** `1.07` → the staged entries of that chapter */
  staged: Map<string, Located[]>;
  issues: Issue[];
}

function readJsonl(root: string, file: string, staged: { book: number; chapter: number } | undefined, issues: Issue[]): Located[] {
  const path = join(root, file);
  if (!existsSync(path)) return [];
  const out: Located[] = [];
  readFileSync(path, "utf8")
    .split(/\r?\n/)
    .forEach((text, i) => {
      if (!text.trim()) return;
      const line = i + 1;
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch (e) {
        issues.push({ code: "jsonl", severity: "error", file, path: `line ${line}`, message: `not valid JSON: ${(e as Error).message}` });
        return;
      }
      const r = DeltaEntry.safeParse(raw);
      if (!r.success) {
        for (const e of r.error.issues) issues.push({ code: "format", severity: "error", file, path: `line ${line}${e.path.length ? `.${e.path.join(".")}` : ""}`, message: e.message });
        return;
      }
      const entry = r.data;
      let at: Where;
      if (staged) {
        at = { ...staged, index: out.length + 1 };
        if (entry.point && entry.point !== formatPoint(at)) {
          issues.push({ code: "point", severity: "error", file, path: `line ${line}`, message: `point ${entry.point} does not agree with its place (${formatPoint(at)}); leave 'point' out of a staged delta` });
        }
      } else {
        if (!entry.point) {
          issues.push({ code: "point", severity: "error", file, path: `line ${line}`, message: "a ledger entry needs 'point'" });
          return;
        }
        at = parsePoint(entry.point)!;
        const prev = out.at(-1);
        if (prev && comparePoint(prev.at, at) >= 0) {
          issues.push({ code: "point-order", severity: "error", file, path: `line ${line}`, message: `point ${entry.point} is not after ${formatPoint(prev.at)}` });
        }
      }
      out.push({ entry, at, file, line, staged: !!staged });
    });
  return out;
}

export function loadRecord(root: string): RecordFiles {
  const issues: Issue[] = [];
  const ledger = readJsonl(root, LEDGER, undefined, issues);
  const staged = new Map<string, Located[]>();
  const books = existsSync(join(root, "books")) ? readdirSync(join(root, "books")).filter((d) => /^\d+$/.test(d)) : [];
  for (const d of books.sort()) {
    const dir = join(root, "books", d, "deltas");
    if (!existsSync(dir)) continue;
    for (const f of readdirSync(dir).filter((f) => /^\d+\.jsonl$/.test(f)).sort()) {
      const book = Number(d);
      const chapter = Number(f.slice(0, -6));
      staged.set(chapterKey(book, chapter), readJsonl(root, stagedPath(book, chapter), { book, chapter }, issues));
    }
  }
  return { ledger, staged, issues };
}

/** All entries in replay order: the ledger, then the staged deltas of chapters that are not in the ledger. */
export function allEntries(rec: RecordFiles, opts: { staged?: boolean } = {}): Located[] {
  const committed = new Set(rec.ledger.map((l) => chapterKey(l.at.book, l.at.chapter)));
  const staged =
    opts.staged === false
      ? []
      : [...rec.staged.entries()]
          .filter(([k]) => !committed.has(k))
          .sort(([, a], [, b]) => (a[0] && b[0] ? comparePoint(a[0].at, b[0].at) : 0))
          .flatMap(([, v]) => v);
  return [...rec.ledger, ...staged];
}

// ---------- state ----------

export interface EntityState {
  type: string;
  name: string;
  fields: Record<string, unknown>;
  /** fact → belief; a fact that is absent is `unaware`. */
  beliefs: Record<string, Belief>;
}

export interface State {
  day?: number;
  time?: string;
  entities: Record<string, EntityState>;
}

export function initialState(project: Project): State {
  const entities: State["entities"] = {};
  for (const [id, e] of Object.entries(project.schema?.data.entities ?? {})) {
    const { beliefs, ...fields } = e.start as Record<string, unknown>;
    entities[id] = { type: e.type, name: e.name, fields: structuredClone(fields), beliefs: { ...((beliefs ?? {}) as Record<string, Belief>) } };
  }
  return { entities };
}

type RecordKind = Kind | { kind: "belief"; fact: string } | { kind: "day" } | { kind: "time" };

const OPS: Record<RecordKind["kind"], string[]> = {
  counter: ["add", "set"],
  ladder: ["set"],
  collection: ["add", "remove", "set"],
  text: ["set"],
  location: ["set"],
  belief: ["set"],
  day: ["add", "set"],
  time: ["set"],
};

function recordField(project: Project, state: State, entity: string, field: string): RecordKind | string {
  if (entity === "timeline") {
    if (field === "day") return { kind: "day" };
    if (field === "time") return { kind: "time" };
    return "the timeline has only 'day' and 'time'";
  }
  const e = state.entities[entity];
  if (!e) return `entity '${entity}' is not in schema.yaml and no earlier entry creates it`;
  const type = project.schema?.data.types[e.type];
  if (!type) return `type '${e.type}' is not defined`;
  if (field.startsWith("belief.")) {
    const fact = field.slice(7);
    if (type.kind !== "character") return `'${entity}' is not a character, so it has no beliefs`;
    if (!project.facts.data.some((f) => f.id === fact)) return `fact '${fact}' is not in facts.yaml`;
    return { kind: "belief", fact };
  }
  return fieldDef(type, field) ?? `'${entity}' has no field '${field}'`;
}

const asItems = (v: unknown) => (typeof v === "string" ? [v] : Array.isArray(v) && v.every((x) => typeof x === "string") ? (v as string[]) : undefined);

export interface Problem {
  severity: "error" | "warn";
  code: string;
  message: string;
}

/** Applies one entry to the state and returns its problems. The state changes only when there is no error. */
export function applyEntry(project: Project, state: State, entry: DeltaEntry): Problem[] {
  const problems: Problem[] = [];
  const error = (code: string, message: string) => problems.push({ severity: "error", code, message });
  const warn = (code: string, message: string) => problems.push({ severity: "warn", code, message });

  if (entry.op === "create") {
    if (state.entities[entry.entity] || entry.entity === "timeline") return (error("entity-exists", `entity '${entry.entity}' already exists`), problems);
    const type = project.schema?.data.types[entry.type!];
    if (!type) return (error("unknown-type", `type '${entry.type}' is not defined in schema.yaml`), problems);
    const start = (entry.value ?? {}) as Record<string, unknown>;
    if (typeof start !== "object" || Array.isArray(start)) return (error("bad-value", "the value of a create entry is a map of start values"), problems);
    const { beliefs, ...fields } = start;
    for (const [f, v] of Object.entries(fields)) {
      const def = fieldDef(type, f);
      const bad = def ? checkValue(def, v) : `type '${entry.type}' has no field '${f}'`;
      if (bad) error("bad-value", `${entry.entity}.${f}: ${bad}`);
    }
    if (problems.length === 0) state.entities[entry.entity] = { type: entry.type!, name: entry.name!, fields: structuredClone(fields), beliefs: { ...((beliefs ?? {}) as Record<string, Belief>) } };
    return problems;
  }

  const field = entry.field!;
  const key = `${entry.entity}.${field}`;
  const kind = recordField(project, state, entry.entity, field);
  if (typeof kind === "string") return (error(kind.startsWith("entity") ? "unknown-entity" : kind.startsWith("fact") ? "unknown-fact" : "unknown-field", kind), problems);
  if (!OPS[kind.kind].includes(entry.op)) return (error("bad-op", `'${entry.op}' is not an operation for a ${kind.kind} (use ${OPS[kind.kind].join(" or ")})`), problems);
  const v = entry.value;

  switch (kind.kind) {
    case "day": {
      if (typeof v !== "number") return (error("bad-value", "the day is a number"), problems);
      const next = entry.op === "add" ? (state.day ?? 0) + v : v;
      if (state.day !== undefined && next < state.day) return (error("day-back", `the day goes back from ${state.day} to ${next}`), problems);
      state.day = next;
      return problems;
    }
    case "time":
      if (typeof v !== "string") return (error("bad-value", "the time is text"), problems);
      state.time = v;
      return problems;
    case "belief":
      if (!BELIEFS.includes(v as Belief)) return (error("bad-value", `a belief is one of ${BELIEFS.join(", ")}`), problems);
      state.entities[entry.entity].beliefs[kind.fact] = v as Belief;
      return problems;
    case "counter": {
      if (typeof v !== "number") return (error("bad-value", `${key}: a counter value is a number`), problems);
      const cur = state.entities[entry.entity].fields[field];
      let next = entry.op === "add" ? (typeof cur === "number" ? cur : 0) + v : v;
      if (kind.min !== undefined && next < kind.min) (warn("clamped", `${key} ${next} is clamped to the min ${kind.min}`), (next = kind.min));
      if (kind.max !== undefined && next > kind.max) (warn("clamped", `${key} ${next} is clamped to the max ${kind.max}`), (next = kind.max));
      state.entities[entry.entity].fields[field] = next;
      return problems;
    }
    case "ladder":
      if (typeof v !== "string" || !kind.steps.includes(v)) return (error("bad-value", `${key}: '${String(v)}' is not a step of the ladder (${kind.steps.join(", ")})`), problems);
      state.entities[entry.entity].fields[field] = v;
      return problems;
    case "collection": {
      const items = asItems(v);
      if (!items) return (error("bad-value", `${key}: a collection value is an item ID or a list of them`), problems);
      const cur = asItems(state.entities[entry.entity].fields[field]) ?? [];
      if (entry.op === "set") state.entities[entry.entity].fields[field] = [...items];
      else if (entry.op === "add") {
        for (const i of items) if (cur.includes(i)) warn("already-there", `${key} already has '${i}'`);
        state.entities[entry.entity].fields[field] = [...cur, ...items.filter((i) => !cur.includes(i))];
      } else {
        const missing = items.filter((i) => !cur.includes(i));
        if (missing.length) return (error("not-there", `${key} does not have ${missing.map((m) => `'${m}'`).join(", ")}`), problems);
        state.entities[entry.entity].fields[field] = cur.filter((i) => !items.includes(i));
      }
      return problems;
    }
    case "text":
    case "location":
      if (typeof v !== "string") return (error("bad-value", `${key}: the value is text`), problems);
      state.entities[entry.entity].fields[field] = v;
      return problems;
  }
}

export interface FoldResult {
  state: State;
  /** Problems found while replaying, with the entry that caused each one. */
  issues: Issue[];
}

/** The state at a point: every entry at or before it, in replay order. */
export function fold(project: Project, rec: RecordFiles, at: Where = { book: Infinity, chapter: 0, index: 0 }, opts: { staged?: boolean } = {}): FoldResult {
  const state = initialState(project);
  const issues: Issue[] = [];
  for (const l of allEntries(rec, opts)) {
    if (comparePoint(l.at, at) > 0) break;
    for (const p of applyEntry(project, state, l.entry)) issues.push({ ...p, file: l.file, path: `line ${l.line}` });
  }
  return { state, issues };
}

// ---------- values against targets ----------

const norm = (s: string) => s.toLowerCase().replace(/[“”]/g, '"').replace(/[‘’]/g, "'").replace(/\s+/g, " ").trim();

/** Returns why the state does not meet the target, one line per miss. */
export function targetMisses(project: Project, state: State, t: Target): string[] {
  const misses: string[] = [];
  for (const [key, want] of Object.entries(t.expect)) {
    const [id, field] = key.split(".");
    const e = state.entities[id];
    const type = e && project.schema?.data.types[e.type];
    const def = type && fieldDef(type, field);
    if (!e || !def) {
      misses.push(`${key}: not in the record`);
      continue;
    }
    const have = e.fields[field];
    const show = JSON.stringify(have ?? null);
    if (def.kind === "counter" || def.kind === "ladder") {
      const r = numericRange(def, want)!;
      const n = def.kind === "ladder" ? def.steps.indexOf(have as string) : (have as number);
      if (typeof n !== "number" || n < r[0] || n > r[1]) misses.push(`${key} is ${show}, the target is ${JSON.stringify(want)}`);
    } else if (def.kind === "collection") {
      const items = asItems(have) ?? [];
      if (Array.isArray(want)) {
        if (want.length !== items.length || want.some((w) => !items.includes(w))) misses.push(`${key} is ${show}, the target is ${JSON.stringify(want)}`);
      } else {
        const w = want as { has?: string[]; lacks?: string[] };
        for (const i of w.has ?? []) if (!items.includes(i)) misses.push(`${key} does not have '${i}'`);
        for (const i of w.lacks ?? []) if (items.includes(i)) misses.push(`${key} still has '${i}'`);
      }
    } else if (typeof have !== "string" || norm(have) !== norm(String(want))) misses.push(`${key} is ${show}, the target is ${JSON.stringify(want)}`);
  }
  for (const [who, beliefs] of Object.entries(t.knowledge)) {
    for (const [fact, want] of Object.entries(beliefs)) {
      const have = state.entities[who]?.beliefs[fact] ?? "unaware";
      if (have !== want) misses.push(`${who} / ${fact} is '${have}', the target is '${want}'`);
    }
  }
  if (t.day !== undefined) {
    const [lo, hi] = typeof t.day === "number" ? [t.day, t.day] : [t.day.min ?? -Infinity, t.day.max ?? Infinity];
    if (state.day === undefined || state.day < lo || state.day > hi) misses.push(`the day is ${state.day ?? "not set"}, the target is ${JSON.stringify(t.day)}`);
  }
  return misses;
}

/** A chapter number counted from the start of book 1, when every book before it has chapter plans. */
function globalChapter(project: Project, book: number, chapter: number): number | undefined {
  let n = chapter;
  for (let b = 1; b < book; b++) {
    const cs = project.chapters.get(b);
    if (!cs) return undefined;
    n += cs.length;
  }
  return n;
}

/** Later targets that the state at the end of this chapter can no longer reach. Each one is a reason to replan. */
export function unreachableTargets(project: Project, index: PlanIndex, state: State, book: number, chapter: number): string[] {
  const out: string[] = [];
  const now = globalChapter(project, book, chapter);
  for (const t of project.targets.data) {
    const r = index.resolve(t.anchor);
    if ("error" in r) continue;
    const after = r.pos[0] > book || (r.pos[0] === book && (r.chapter === undefined || r.chapter > chapter));
    if (!after || t.reset) continue;
    const left = r.chapter !== undefined && now !== undefined ? (globalChapter(project, r.book, r.chapter) ?? NaN) - now : NaN;
    for (const [key, want] of Object.entries(t.expect)) {
      const [id, field] = key.split(".");
      const e = state.entities[id];
      const def = e && project.schema && fieldDef(project.schema.data.types[e.type], field);
      if (!def || (def.kind !== "counter" && def.kind !== "ladder")) continue;
      const r2 = numericRange(def, want)!;
      const n = def.kind === "ladder" ? def.steps.indexOf(e.fields[field] as string) : (e.fields[field] as number);
      if (typeof n !== "number") continue;
      const dir = def.kind === "ladder" ? "up" : def.direction;
      if (dir === "up" && n > r2[1]) out.push(`${t.anchor}: ${key} is already past the target ${JSON.stringify(want)}`);
      if (dir === "down" && n < r2[0]) out.push(`${t.anchor}: ${key} is already below the target ${JSON.stringify(want)}`);
      if (def.kind === "counter" && def.max_step && Number.isFinite(left)) {
        const need = Math.max(r2[0] - n, n - r2[1], 0);
        if (need > def.max_step * left) out.push(`${t.anchor}: ${key} must change by ${need} in ${left} chapter(s), but max_step ${def.max_step} allows ${def.max_step * left}`);
      }
    }
    for (const [who, beliefs] of Object.entries(t.knowledge)) {
      for (const [fact, want] of Object.entries(beliefs)) {
        if (want === "unaware" && state.entities[who]?.beliefs[fact] === "knows") out.push(`${t.anchor}: ${who} already knows '${fact}'`);
      }
    }
    if (t.day !== undefined && state.day !== undefined) {
      const hi = typeof t.day === "number" ? t.day : (t.day.max ?? Infinity);
      if (state.day > hi) out.push(`${t.anchor}: the day is already ${state.day}, after the target ${JSON.stringify(t.day)}`);
    }
  }
  return out;
}

// ---------- quotes ----------

/** Finds each entry's quote in the chapter and returns its line (undefined when it is not there). */
export function quoteLines(chapterText: string, entries: DeltaEntry[]): (number | undefined)[] {
  const { body, bodyOffset } = splitFrontmatter(chapterText);
  // A normalized copy of the body, with the line of each character.
  let flat = "";
  const lineOf: number[] = [];
  body.split(/\r?\n/).forEach((l, i) => {
    const n = norm(l);
    if (!n) return;
    flat += `${n} `;
    for (let k = 0; k <= n.length; k++) lineOf.push(bodyOffset + i + 1);
  });
  return entries.map((e) => {
    if (!e.quote) return undefined;
    const at = flat.indexOf(norm(e.quote));
    return at < 0 ? undefined : lineOf[at];
  });
}

// ---------- one chapter's delta ----------

export interface DeltaCheck {
  issues: Issue[];
  before: State;
  after: State;
  /** The line of each entry's quote in the chapter, when the chapter exists. */
  lines: (number | undefined)[];
  entries: Located[];
}

const isApproved = (project: Project, book: number, chapter: number) =>
  project.prose.get(book)?.find((c) => c.data.chapter === chapter)?.data.status === "approved";

/** Every check of `lb delta`: the entries, the chapter limits, the targets, the order of chapters, and the quotes. */
export function checkDelta(project: Project, rec: RecordFiles, book: number, chapter: number): DeltaCheck {
  const file = stagedPath(book, chapter);
  const issues: Issue[] = rec.issues.filter((i) => i.file === file);
  const err = (code: string, message: string, path?: string) => issues.push({ code, severity: "error", file, path, message });
  const warn = (code: string, message: string, path?: string) => issues.push({ code, severity: "warn", file, path, message });

  const plan = project.chapters.get(book)?.find((c) => c.data.chapter === chapter);
  if (!plan) err("no-plan", `book ${book} has no chapter plan ${pad2(chapter)}`);
  const entries = rec.staged.get(chapterKey(book, chapter)) ?? [];
  if (!existsSync(join(project.root, file))) err("missing", `${file} does not exist`);
  if (isApproved(project, book, chapter)) err("committed", `chapter ${chapterKey(book, chapter)} is already approved and committed; a correction needs replan`);

  // Every earlier chapter must be committed.
  for (let b = 1; b <= book; b++) {
    const last = b < book ? (project.chapters.get(b)?.length ?? 0) : chapter - 1;
    for (let c = 1; c <= last; c++) {
      if (!isApproved(project, b, c)) {
        err("order", `chapter ${chapterKey(b, c)} is not committed yet; commit the chapters in order`);
        b = book + 1;
        break;
      }
    }
  }

  const before = fold(project, rec, { book, chapter, index: 0 }, { staged: false }).state;
  const state = structuredClone(before);
  for (const l of entries) {
    for (const p of applyEntry(project, state, l.entry)) issues.push({ ...p, file, path: `line ${l.line}` });
  }
  const after = state;
  const waived = new Set(plan?.data.exceptions.map((e) => e.rule) ?? []);

  // Chapter limits: max_step and direction, on the net change of the chapter.
  const touched = new Set(entries.filter((l) => l.entry.field).map((l) => `${l.entry.entity}.${l.entry.field}`));
  for (const key of touched) {
    const [id, field] = key.split(".");
    const e = after.entities[id];
    const def = e && project.schema && fieldDef(project.schema.data.types[e.type], field);
    if (!def || (def.kind !== "counter" && def.kind !== "ladder")) continue;
    const toN = (v: unknown) => (def.kind === "ladder" ? def.steps.indexOf(v as string) : typeof v === "number" ? v : undefined);
    const a = toN(before.entities[id]?.fields[field]);
    const b = toN(e.fields[field]);
    if (a === undefined || b === undefined) continue;
    const dir = def.kind === "ladder" ? "up" : def.direction;
    if (((dir === "up" && b < a) || (dir === "down" && b > a)) && !waived.has("record.direction")) {
      err("record.direction", `${key} goes ${b < a ? "down" : "up"} in this chapter (${JSON.stringify(before.entities[id]?.fields[field])} → ${JSON.stringify(e.fields[field])}); add the exception record.direction to the chapter plan if that is planned`);
    }
    if (def.kind === "counter" && def.max_step && Math.abs(b - a) > def.max_step && !waived.has("record.max-step")) {
      err("record.max-step", `${key} changes by ${b - a} in this chapter, but max_step is ${def.max_step}`);
    }
  }

  if (plan?.data.day !== undefined && after.day !== plan.data.day) warn("day-plan", `the day at the chapter end is ${after.day ?? "not set"}, but the plan says day ${plan.data.day}`);

  // The targets of the anchors in this chapter.
  const index = buildPlanIndex(project, []);
  for (const t of project.targets.data) {
    const r = index.resolve(t.anchor);
    if ("error" in r || r.book !== book || r.chapter !== chapter) continue;
    for (const m of targetMisses(project, after, t)) err("target-miss", `target ${t.anchor}: ${m}`);
  }

  // Quotes, when the prose exists.
  const chapterFile = join(project.root, chapterPath(book, chapter));
  let lines: (number | undefined)[] = entries.map(() => undefined);
  if (existsSync(chapterFile)) {
    lines = quoteLines(readFileSync(chapterFile, "utf8"), entries.map((l) => l.entry));
    let prev = 0;
    entries.forEach((l, i) => {
      if (isCorrection(l.entry)) {
        // A correction applies from the chapter start, so it needs no quote, and it comes before every other entry.
        if (prev > 0 || entries.slice(0, i).some((x) => !isCorrection(x.entry))) err("correction-order", "a correction entry must come before the other entries of the delta", `line ${l.line}`);
        lines[i] = 0;
        return;
      }
      if (!l.entry.quote) err("quote-missing", "the chapter exists, so this entry needs a 'quote' from it", `line ${l.line}`);
      else if (lines[i] === undefined) err("quote-not-found", `the quote is not in ${chapterPath(book, chapter)}: "${l.entry.quote}"`, `line ${l.line}`);
      else {
        if (lines[i]! < prev) err("quote-order", `this entry's quote is on line ${lines[i]}, before the quote of the entry above it (line ${prev}); put the entries in the order of the prose`, `line ${l.line}`);
        prev = Math.max(prev, lines[i]!);
      }
    });
  }

  return { issues, before, after, lines, entries };
}

/** A correction of the committed record, added by replan: its cause starts with "Correction:". */
export const isCorrection = (e: DeltaEntry) => /^correction:/i.test(e.cause);

/** The state at a line of the chapter: the chapter start plus the entries whose quote is on or before that line. */
export function stateAtLine(project: Project, check: DeltaCheck, line: number): State {
  const state = structuredClone(check.before);
  check.entries.forEach((l, i) => {
    const at = check.lines[i];
    if (at !== undefined && at <= line) applyEntry(project, state, l.entry);
  });
  return state;
}

// ---------- commit ----------

export interface CommitResult {
  ok: boolean;
  issues: Issue[];
  committed: number;
  /** Later targets that are no longer reachable: a reason to replan. */
  replan: string[];
}

/** Appends a chapter's staged delta to the ledger and approves the chapter. Refuses on any error. */
export function commitChapter(project: Project, rec: RecordFiles, book: number, chapter: number, blocking: Issue[] = []): CommitResult {
  const check = checkDelta(project, rec, book, chapter);
  const issues = [...check.issues, ...blocking];
  const chapterFile = join(project.root, chapterPath(book, chapter));
  if (!existsSync(chapterFile)) issues.push({ code: "missing", severity: "error", file: chapterPath(book, chapter), message: "the chapter does not exist" });
  if (issues.some((i) => i.severity === "error")) return { ok: false, issues, committed: 0, replan: [] };

  const lines = check.entries.map((l, i) => JSON.stringify({ ...l.entry, point: formatPoint({ book, chapter, index: i + 1 }) }));
  if (lines.length) appendFileSync(join(project.root, LEDGER), `${lines.join("\n")}\n`);
  writeFileSync(chapterFile, setFrontmatterKey(readFileSync(chapterFile, "utf8"), "status", "approved"));
  rmSync(join(project.root, stagedPath(book, chapter)));

  const replan = unreachableTargets(project, buildPlanIndex(project, []), check.after, book, chapter);
  return { ok: true, issues, committed: lines.length, replan };
}

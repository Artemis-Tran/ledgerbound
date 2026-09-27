/**
 * The plan validator. It checks every file that exists, and the references between files.
 * Missing files are the business of checkpoints.ts, which knows which step is next.
 */
import { buildPlanIndex, comparePos, type PlanIndex, type Pos } from "./anchors.ts";
import type { Issue } from "./issues.ts";
import { bookDir, pad2, type Project } from "./project.ts";
import { chapterKey, fold, loadRecord, stagedPath } from "./record.ts";
import { RULE_IDS } from "./rules.ts";
import { checkValue, fieldDef, type Kind, numericRange } from "./fields.ts";
import { checkPublish } from "./export/epub.ts";
import { BELIEFS, REQUIRED_DECISIONS, VOICE_KINDS, type Target } from "./schemas.ts";

export function validateProject(project: Project): Issue[] {
  const issues: Issue[] = [];
  const err = (code: string, file: string, message: string, path?: string) => issues.push({ code, severity: "error", file, path, message });
  const warn = (code: string, file: string, message: string, path?: string) => issues.push({ code, severity: "warn", file, path, message });

  const index = buildPlanIndex(project, issues);
  const characterIds = checkSchema(project, err);
  checkBible(project, err, warn);
  checkFacts(project, err);
  const totalBooks = checkLevels(project, err, warn);
  checkDraws(project, totalBooks, err);
  checkCharacters(project, index, characterIds, totalBooks, err, warn);
  checkChapters(project, index, characterIds, err, warn);
  checkThreads(project, index, err);
  checkTargets(project, index, characterIds, err, warn);
  checkVoiceSamples(project, characterIds, err);
  checkLore(project, err, warn);
  checkGeneration(project, issues, err, warn);
  for (const book of project.publish.keys()) issues.push(...checkPublish(project, book));
  return issues;
}

type Report = (code: string, file: string, message: string, path?: string) => void;

function duplicates<T>(items: T[], key: (t: T) => string): string[] {
  const seen = new Set<string>();
  const dup = new Set<string>();
  for (const k of items.map(key)) (seen.has(k) ? dup : seen).add(k);
  return [...dup];
}

// ---------- bible, schema, facts ----------

function checkBible(project: Project, err: Report, warn: Report) {
  const bible = project.bible;
  if (!bible) return;
  const ids = new Set(bible.data.decisions.map((d) => d.id));
  for (const id of REQUIRED_DECISIONS) {
    if (!ids.has(id)) err("decision-missing", bible.file, `the bible has no '${id}' decision`, "decisions");
  }
  for (const d of duplicates(bible.data.decisions, (d) => d.id)) err("duplicate-id", bible.file, `decision '${d}' is defined twice`, "decisions");

  const draws = bible.data.draws;
  if (!draws) {
    warn("no-draws", bible.file, "the bible has no draws, so nothing checks the exclusions or their delivery", "draws");
    return;
  }
  for (const d of duplicates(draws, (d) => d.id)) err("duplicate-id", bible.file, `draw '${d}' is defined twice`, "draws");
  if (!draws.some((d) => d.kind === "excludes")) err("no-exclusion", bible.file, "at least one draw must have kind: excludes", "draws");
}

/** Each book plan lists only `gives` draws, and each `gives` draw is in at least one book plan. */
function checkDraws(project: Project, totalBooks: number, err: Report) {
  const draws = project.bible?.data.draws;
  if (!draws || project.books.size === 0) return;
  const kind = new Map(draws.map((d) => [d.id, d.kind]));
  const delivered = new Set<string>();
  for (const plan of project.books.values()) {
    plan.data.draws.forEach((id, i) => {
      if (!kind.has(id)) err("unknown-draw", plan.file, `draw '${id}' is not in bible.md`, `draws.${i}`);
      else if (kind.get(id) === "excludes") err("excluded-draw", plan.file, `draw '${id}' is an exclusion: a book does not deliver it`, `draws.${i}`);
      delivered.add(id);
    });
  }
  // Only when every book plan exists: before that, a later book can still deliver the draw.
  for (let b = 1; b <= totalBooks; b++) if (!project.books.has(b)) return;
  const first = project.books.get(Math.min(...project.books.keys()))!;
  for (const d of draws) {
    if (d.kind === "gives" && !delivered.has(d.id)) err("draw-undelivered", first.file, `no book plan delivers the draw '${d.id}' (${d.text})`, "draws");
  }
}

/** Returns the IDs of all entities whose type has kind `character`. */
function checkSchema(project: Project, err: Report): Set<string> {
  const characters = new Set<string>();
  const schema = project.schema;
  if (!schema) return characters;
  const { types, entities } = schema.data;
  for (const [name, t] of Object.entries(types)) {
    if (t.kind === "character" && "location" in t.fields) {
      err("reserved-field", schema.file, "'location' is built in for characters; remove it from the fields", `types.${name}.fields.location`);
    }
    for (const [fname, f] of Object.entries(t.fields)) {
      if (f.kind === "ladder" && duplicates(f.steps, (s) => s).length > 0) err("ladder-steps", schema.file, "ladder steps must be unique", `types.${name}.fields.${fname}.steps`);
      if (f.kind === "counter" && f.min !== undefined && f.max !== undefined && f.min > f.max) err("counter-bounds", schema.file, "min is larger than max", `types.${name}.fields.${fname}`);
    }
  }
  if (!Object.values(types).some((t) => t.kind === "character")) err("no-character-type", schema.file, "no entity type has kind: character", "types");
  for (const [id, e] of Object.entries(entities)) {
    const t = types[e.type];
    if (!t) {
      err("unknown-type", schema.file, `type '${e.type}' is not defined`, `entities.${id}.type`);
      continue;
    }
    if (t.kind === "character") characters.add(id);
    for (const [field, value] of Object.entries(e.start)) {
      if (field === "beliefs" && t.kind === "character") {
        const facts = new Set(project.facts.data.map((f) => f.id));
        for (const [fact, belief] of Object.entries((value ?? {}) as Record<string, unknown>)) {
          if (!facts.has(fact)) err("unknown-fact", schema.file, `fact '${fact}' is not in facts.yaml`, `entities.${id}.start.beliefs.${fact}`);
          if (!BELIEFS.includes(belief as never)) err("bad-value", schema.file, `a belief is one of ${BELIEFS.join(", ")}`, `entities.${id}.start.beliefs.${fact}`);
        }
        continue;
      }
      const def = fieldDef(t, field);
      if (!def) err("unknown-field", schema.file, `type '${e.type}' has no field '${field}'`, `entities.${id}.start.${field}`);
      else {
        const problem = checkValue(def, value);
        if (problem) err("bad-value", schema.file, problem, `entities.${id}.start.${field}`);
      }
    }
  }
  return characters;
}

function checkFacts(project: Project, err: Report) {
  for (const d of duplicates(project.facts.data, (f) => f.id)) err("duplicate-id", project.facts.file, `fact '${d}' is defined twice`);
}

// ---------- series and book levels ----------

function checkLevels(project: Project, err: Report, warn: Report): number {
  const standalone = project.config.format === "standalone";
  const series = project.series;
  if (standalone && series) warn("standalone-series", series.file, "project.yaml says standalone, so series.md is not used");
  const total = standalone ? 1 : (series?.data.books ?? Math.max(0, ...project.books.keys()));

  if (series && !standalone && series.data.question.answers.length === 0) {
    err("no-answer", series.file, "the series must answer at least one question", "question.answers");
  }
  if (series || standalone) {
    for (let b = 1; b <= total; b++) {
      if (!project.books.has(b)) err("missing", `${bookDir(b)}/plan.md`, `book ${b} has no book-level plan`);
    }
  }
  for (const [b, plan] of project.books) {
    if (b > total && total > 0) err("extra-book", plan.file, `book ${b} is beyond the ${total} book(s) in the plan`);
    if (plan.data.question.answers.length === 0) err("no-answer", plan.file, "each book must resolve at least one main question", "question.answers");
    if (!standalone && b < total && plan.data.handoff.length === 0) err("no-handoff", plan.file, "a book before the last one needs a handoff", "handoff");
    for (const d of duplicates(plan.data.acts, (a) => a.id)) err("duplicate-id", plan.file, `act '${d}' is defined twice`, "acts");
  }
  return total;
}

// ---------- characters and arc beats ----------

function checkCharacters(project: Project, index: PlanIndex, characterIds: Set<string>, totalBooks: number, err: Report, warn: Report) {
  const chars = project.characters;
  if (chars.length === 0) return;
  const protagonists = chars.filter((c) => c.data.role === "protagonist");
  if (protagonists.length !== 1) err("protagonist", "characters/", `there must be exactly one protagonist, found ${protagonists.length}`);

  for (const c of chars) {
    const expectedFile = `characters/${c.data.id}.md`;
    if (c.file !== expectedFile) err("file-name", c.file, `id is '${c.data.id}', so the file must be ${expectedFile}`, "id");
    if (project.schema && !characterIds.has(c.data.id)) warn("not-in-schema", c.file, `'${c.data.id}' is not a character entity in schema.yaml`, "id");
    for (const d of duplicates(c.data.arc_beats, (b) => b.id)) err("duplicate-id", c.file, `arc beat '${d}' is defined twice`, "arc_beats");
    c.data.arc_beats.forEach((beat, i) => {
      if (totalBooks > 0 && beat.book > totalBooks) err("unknown-book", c.file, `book ${beat.book} is not in the plan`, `arc_beats.${i}.book`);
      const plan = project.books.get(beat.book);
      if (plan && !plan.data.acts.some((a) => a.id === beat.act)) err("unknown-act", c.file, `book ${beat.book} has no act '${beat.act}'`, `arc_beats.${i}.act`);
    });
    if (c.data.role !== "supporting") {
      for (const b of project.books.keys()) {
        if (!c.data.arc_beats.some((beat) => beat.book === b)) warn("no-arc-beat", c.file, `${c.data.id} has no arc beat in book ${b}`, "arc_beats");
      }
    }
  }

  // Every arc beat of a book with chapter plans is placed in exactly one chapter of its act.
  for (const book of index.planned) {
    const chapters = project.chapters.get(book)!;
    for (const c of chars) {
      for (const beat of c.data.arc_beats.filter((b) => b.book === book)) {
        const ref = `${c.data.id}/${beat.id}`;
        const placed = chapters.filter((ch) => ch.data.arc_beats.includes(ref));
        if (placed.length === 0) err("beat-unplaced", `${bookDir(book)}/plan`, `arc beat ${ref} is not in any chapter plan`);
        if (placed.length > 1) err("beat-twice", `${bookDir(book)}/plan`, `arc beat ${ref} is in chapters ${placed.map((p) => p.data.chapter).join(", ")}`);
        const range = index.actRanges.get(book)?.get(beat.act);
        for (const p of placed) {
          if (range && (p.data.chapter < range[0] || p.data.chapter > range[1])) {
            err("beat-wrong-act", p.file, `arc beat ${ref} belongs to ${beat.act} (chapters ${range[0]}–${range[1]})`, "arc_beats");
          }
        }
      }
    }
  }
}

// ---------- chapter plans ----------

function checkChapters(project: Project, index: PlanIndex, characterIds: Set<string>, err: Report, warn: Report) {
  const beats = new Map(project.characters.flatMap((c) => c.data.arc_beats.map((b): [string, typeof b] => [`${c.data.id}/${b.id}`, b])));
  const threads = new Set(project.threads.data.map((t) => t.id));
  const knownPov = new Set([...characterIds, ...project.characters.map((c) => c.data.id)]);

  for (const [book, chapters] of project.chapters) {
    chapters.forEach((c, i) => {
      const d = c.data;
      if (d.chapter !== i + 1) err("chapter-gap", c.file, `chapters must be numbered 1, 2, 3… with no gap; expected ${pad2(i + 1)}`, "chapter");
      const waived = new Set(d.exceptions.map((e) => e.rule));
      d.exceptions.forEach((e, k) => {
        if (!RULE_IDS.has(e.rule)) err("unknown-rule", c.file, `'${e.rule}' is not a rule ID (see \`lb rules\`)`, `exceptions.${k}.rule`);
        else if (e.rule === "draws.excluded") err("unwaivable", c.file, "an exclusion cannot be waived: change the draws in bible.md", `exceptions.${k}.rule`);
      });
      if (!knownPov.has(d.pov)) err("unknown-character", c.file, `pov '${d.pov}' is not a character`, "pov");
      if (d.job.from.trim().toLowerCase() === d.job.to.trim().toLowerCase()) err("no-value-shift", c.file, "job.from and job.to are the same: the chapter has no job", "job");

      const prev = chapters[i - 1];
      if (prev && prev.data.ending.type === d.ending.type && !waived.has("endings.type-repeat")) {
        err("endings.type-repeat", c.file, `ending type '${d.ending.type}' is the same as in chapter ${prev.data.chapter}`, "ending.type");
      }
      const window = chapters.slice(Math.max(0, i - 2), i + 1);
      if (d.ending.type === "cliffhanger" && window.filter((w) => w.data.ending.type === "cliffhanger").length > 1 && !waived.has("endings.cliffhanger-rate")) {
        err("endings.cliffhanger-rate", c.file, "more than one cliffhanger in three consecutive chapters", "ending.type");
      }
      if (prev?.data.day !== undefined && d.day !== undefined && d.day < prev.data.day) warn("day-order", c.file, `day ${d.day} is before day ${prev.data.day} of the chapter before`, "day");

      if (d.arc_beats.length === 0) warn("no-arc-beat", c.file, "the chapter serves no arc beat", "arc_beats");
      d.arc_beats.forEach((ref, k) => {
        const beat = beats.get(ref);
        if (!beat) err("unknown-beat", c.file, `arc beat ${ref} is not defined in characters/`, `arc_beats.${k}`);
        else if (beat.book !== book) err("beat-wrong-book", c.file, `arc beat ${ref} belongs to book ${beat.book}`, `arc_beats.${k}`);
      });
      for (const kind of ["plants", "advances", "pays_off"] as const) {
        d.threads[kind].forEach((t, k) => {
          if (!threads.has(t)) err("unknown-thread", c.file, `thread '${t}' is not in threads.yaml`, `threads.${kind}.${k}`);
        });
      }
    });
  }
}

// ---------- threads ----------

function checkThreads(project: Project, index: PlanIndex, err: Report) {
  const file = project.threads.file;
  for (const d of duplicates(project.threads.data, (t) => t.id)) err("duplicate-id", file, `thread '${d}' is defined twice`);

  project.threads.data.forEach((t, i) => {
    const at = (ref: string, path: string) => {
      const r = index.resolve(ref);
      if ("error" in r) {
        err("bad-position", file, r.error, `${i}.${path}`);
        return undefined;
      }
      return r;
    };
    const plant = at(t.plant, "plant");
    const beats = t.beats.map((b, k) => at(b, `beats.${k}`));
    const payoff = at(t.payoff, "payoff");
    if (plant && payoff && comparePos(plant.pos, payoff.pos) >= 0) err("thread-order", file, `${t.id}: the payoff must come after the plant`, `${i}.payoff`);
    beats.forEach((b, k) => {
      if (!b) return;
      if ((plant && comparePos(b.pos, plant.pos) < 0) || (payoff && comparePos(b.pos, payoff.pos) > 0)) {
        err("thread-order", file, `${t.id}: beat ${t.beats[k]} is not between the plant and the payoff`, `${i}.beats.${k}`);
      }
    });

    // threads.yaml and the chapter plans must agree, in both directions.
    const expected = { plants: [plant], advances: beats, pays_off: [payoff] };
    for (const [book, chapters] of project.chapters) {
      for (const c of chapters) {
        for (const kind of ["plants", "advances", "pays_off"] as const) {
          const planned = expected[kind].some((p) => p?.book === book && p.chapter === c.data.chapter);
          const listed = c.data.threads[kind].includes(t.id);
          if (planned && !listed) err("thread-mismatch", c.file, `threads.yaml puts a '${kind}' of ${t.id} here, but threads.${kind} does not list it`, `threads.${kind}`);
          if (listed && !planned) err("thread-mismatch", c.file, `threads.${kind} lists ${t.id}, but threads.yaml does not put it in this chapter`, `threads.${kind}`);
        }
      }
    }
  });
}

// ---------- targets ----------

function checkTargets(project: Project, index: PlanIndex, characterIds: Set<string>, err: Report, warn: Report) {
  const file = project.targets.file;
  const schema = project.schema?.data;
  const facts = new Set(project.facts.data.map((f) => f.id));

  interface Sample {
    pos: Pos;
    chapterIndex?: number;
    value: unknown;
    reset: boolean;
    where: string;
  }
  const series = new Map<string, Sample[]>();
  const push = (key: string, s: Sample) => series.set(key, [...(series.get(key) ?? []), s]);

  // A chapter number counted from the start of book 1, when all books before it have chapter plans.
  const globalChapter = (book: number, chapter?: number) => {
    if (chapter === undefined) return undefined;
    let n = chapter;
    for (let b = 1; b < book; b++) {
      const cs = project.chapters.get(b);
      if (!cs) return undefined;
      n += cs.length;
    }
    return n;
  };

  if (schema) {
    for (const [id, e] of Object.entries(schema.entities)) {
      for (const [field, value] of Object.entries(e.start)) push(`${id}.${field}`, { pos: [0, 0, 0], chapterIndex: 0, value, reset: false, where: `schema.yaml start of ${id}` });
    }
  }

  project.targets.data.forEach((t: Target, i) => {
    const r = index.resolve(t.anchor);
    if ("error" in r) {
      err("unknown-anchor", file, r.error, `${i}.anchor`);
      return;
    }
    const sample = (value: unknown): Sample => ({ pos: r.pos, chapterIndex: globalChapter(r.book, r.chapter), value, reset: t.reset, where: t.anchor });
    for (const [key, value] of Object.entries(t.expect)) {
      if (!schema) break;
      const [entityId, field] = key.split(".");
      const entity = schema.entities[entityId];
      if (!entity) {
        err("unknown-entity", file, `entity '${entityId}' is not in schema.yaml`, `${i}.expect.${key}`);
        continue;
      }
      const def = fieldDef(schema.types[entity.type] ?? { kind: "other", fields: {} }, field);
      if (!def) {
        err("unknown-field", file, `'${entityId}' has no field '${field}'`, `${i}.expect.${key}`);
        continue;
      }
      const problem = checkValue(def, value);
      if (problem) err("bad-value", file, problem, `${i}.expect.${key}`);
      else push(key, sample(value));
    }
    for (const [who, beliefs] of Object.entries(t.knowledge)) {
      if (schema && !characterIds.has(who)) err("unknown-character", file, `'${who}' is not a character entity`, `${i}.knowledge.${who}`);
      for (const [fact, belief] of Object.entries(beliefs)) {
        if (!facts.has(fact)) err("unknown-fact", file, `fact '${fact}' is not in facts.yaml`, `${i}.knowledge.${who}.${fact}`);
        else push(`knowledge:${who}:${fact}`, sample(belief));
      }
    }
    if (t.day !== undefined) push("day", sample(t.day));
  });

  // Order and reachability along the plan.
  for (const [key, samples] of series) {
    samples.sort((a, b) => comparePos(a.pos, b.pos));
    const def: Kind | undefined =
      key === "day"
        ? { kind: "counter", direction: "up" }
        : key.startsWith("knowledge:")
          ? undefined
          : (() => {
              const [id, field] = key.split(".");
              const e = schema?.entities[id];
              return e && schema ? fieldDef(schema.types[e.type], field) : undefined;
            })();
    for (let k = 1; k < samples.length; k++) {
      const a = samples[k - 1];
      const b = samples[k];
      if (comparePos(a.pos, b.pos) === 0 && JSON.stringify(a.value) !== JSON.stringify(b.value)) {
        err("target-conflict", file, `${key} has two different targets at ${b.where}`);
        continue;
      }
      if (key.startsWith("knowledge:")) {
        if (a.value === "knows" && b.value === "unaware" && !b.reset) {
          err("target-order", file, `${key.slice(10).replace(":", " / ")}: 'knows' at ${a.where} but 'unaware' at ${b.where} (set reset: true for a memory loss)`);
        }
        continue;
      }
      if (!def) continue;
      const ra = numericRange(def, a.value);
      const rb = numericRange(def, b.value);
      if (!ra || !rb) continue;
      const direction = def.kind === "ladder" ? "up" : def.kind === "counter" ? def.direction : "any";
      if (!b.reset && direction === "up" && rb[1] < ra[0]) err("target-order", file, `${key} goes down from ${a.where} to ${b.where} (set reset: true if that is planned)`);
      if (!b.reset && direction === "down" && rb[0] > ra[1]) err("target-order", file, `${key} goes up from ${a.where} to ${b.where} (set reset: true if that is planned)`);
      if (def.kind === "counter" && def.max_step && a.chapterIndex !== undefined && b.chapterIndex !== undefined) {
        const need = Math.max(rb[0] - ra[1], ra[0] - rb[1], 0);
        const allowed = def.max_step * (b.chapterIndex - a.chapterIndex);
        if (need > allowed && !b.reset) {
          err("target-unreachable", file, `${key} must change by ${need} between ${a.where} and ${b.where}, but max_step ${def.max_step} allows ${allowed}`);
        }
      }
    }
  }

  // Ending states are targets: each act end and book end should have one.
  if (project.targets.data.length > 0 || project.books.size > 0) {
    const targeted = new Set(project.targets.data.map((t) => t.anchor));
    for (const [book, plan] of project.books) {
      for (const id of [...plan.data.acts.map((a) => `b${book}/${a.id}/end`), `b${book}/end`]) {
        if (!targeted.has(id)) warn("target-missing", file, `the ending state at ${id} has no target`);
      }
    }
  }
}

// ---------- lore ----------

function checkLore(project: Project, err: Report, warn: Report) {
  for (const [id, entry] of project.lore) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) err("file-name", entry.file, `the file name '${id}' is the entry ID: use lower-case letters, digits and '-'`);
    if (!entry.body.trim()) warn("lore-empty", entry.file, "the entry has no body: the brief gives the writer only the body");
  }
  // A name finds the entry for a brief, so one name belongs to one entry.
  const names = new Map<string, string>();
  for (const [id, entry] of project.lore) {
    for (const name of new Set([id.replace(/-/g, " "), entry.data.title, ...entry.data.aliases].map((n) => n.trim().toLowerCase()))) {
      const other = names.get(name);
      if (other) err("lore-duplicate-name", entry.file, `the name '${name}' is also a name of lore/${other}.md: give each entry its own names`);
      else names.set(name, id);
    }
  }
  for (const plans of project.chapters.values()) {
    for (const plan of plans) {
      plan.data.lore.forEach((id, i) => {
        if (!project.lore.has(id)) err("lore-unknown", plan.file, `there is no lore entry lore/${id}.md`, `lore.${i}`);
      });
    }
  }
  for (const files of project.memory.values()) {
    for (const m of files) {
      m.data.lore_added.forEach(({ entry }, i) => {
        if (!project.lore.has(entry)) err("lore-unknown", m.file, `there is no lore entry lore/${entry}.md: write the fact into it`, `lore_added.${i}.entry`);
      });
    }
  }
}

// ---------- voice samples ----------

function checkVoiceSamples(project: Project, characterIds: Set<string>, err: Report) {
  const samples = project.voiceSamples;
  if (samples.length === 0) return;
  const known = new Set([...characterIds, ...project.characters.map((c) => c.data.id)]);
  for (const vs of samples) {
    const expected = `voice/${vs.data.kind}.md`;
    if (vs.file !== expected) err("file-name", vs.file, `kind is '${vs.data.kind}', so the file must be ${expected}`, "kind");
    vs.data.characters.forEach((c, i) => {
      if (!known.has(c)) err("unknown-character", vs.file, `'${c}' is not a character`, `characters.${i}`);
    });
    if (!vs.data.characters.includes(vs.data.pov)) err("pov", vs.file, "pov must be one of the characters", "pov");
  }
  const kinds = new Set(samples.map((s) => s.data.kind));
  for (const kind of VOICE_KINDS) {
    if (!kinds.has(kind)) err("voice-kinds", "voice/", `there is no '${kind}' voice sample (voice/${kind}.md)`);
  }
  if (!project.config.windows) return;
  if (!samples.some((s) => /^(```|~~~)/m.test(s.body))) err("no-status-window", "voice/", "no voice sample shows a status window in a fenced code block");
  if (samples.some((s) => s.data.status === "approved") && !project.bible?.data.window_template) {
    err("no-window-template", "bible.md", "a voice sample is approved, but bible.md has no window_template", "window_template");
  }
}

// ---------- phase 2: the record, the chapters, the memory ----------

function checkGeneration(project: Project, issues: Issue[], err: Report, warn: Report) {
  const rec = loadRecord(project.root);
  issues.push(...rec.issues);
  // The committed ledger must replay with no error. The staged deltas are for `lb delta`.
  for (const i of fold(project, rec, undefined, { staged: false }).issues) if (i.severity === "error") issues.push({ ...i, code: `ledger.${i.code}` });

  const approved = (book: number, chapter: number) => project.prose.get(book)?.find((c) => c.data.chapter === chapter)?.data.status === "approved";
  for (const k of new Set(rec.ledger.map((l) => chapterKey(l.at.book, l.at.chapter)))) {
    const [b, c] = k.split(".").map(Number);
    if (!approved(b, c)) err("ledger-unapproved", "ledger.jsonl", `the ledger has entries for chapter ${k}, but that chapter is not approved`);
  }
  for (const k of rec.staged.keys()) {
    const [b, c] = k.split(".").map(Number);
    if (approved(b, c)) err("staged-committed", stagedPath(b, c), `chapter ${k} is approved, so its delta must be in the ledger, not staged`);
  }

  for (const [book, files] of project.prose) {
    for (const f of files) {
      if (!project.chapters.get(book)?.some((p) => p.data.chapter === f.data.chapter)) err("no-plan", f.file, `there is no chapter plan for ${chapterKey(book, f.data.chapter)}`);
    }
  }
  for (const [book, files] of project.memory) {
    for (const m of files) {
      if (!approved(book, m.data.chapter)) warn("memory-early", m.file, `chapter ${chapterKey(book, m.data.chapter)} is not approved; memory is written from the approved chapter`);
      const plan = project.chapters.get(book)?.find((p) => p.data.chapter === m.data.chapter);
      if (plan && plan.data.ending.type !== m.data.ending_type) warn("ending-type", m.file, `the chapter ends with '${m.data.ending_type}', but the plan says '${plan.data.ending.type}'`, "ending_type");
    }
  }
}

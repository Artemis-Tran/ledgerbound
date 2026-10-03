/**
 * The plan validator. It checks every file that exists, and the references between files.
 * Missing files are the business of checkpoints.ts, which knows which step is next.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildPlanIndex, climaxSpan, comparePos, type PlanIndex, type Pos } from "./anchors.ts";
import type { Issue } from "./issues.ts";
import { aiNamesIn } from "./lint/patterns.ts";
import { characterEntries, entryNames, loreEntries, type NamedEntry, relationshipsOf } from "./entries.ts";
import { bookDir, type Loaded, pad2, type Project } from "./project.ts";
import { allEntries, chapterKey, chapterPath, fold, isCorrection, loadRecord, quoteLines, stagedPath } from "./record.ts";
import { RULE_IDS } from "./rules.ts";
import { checkValue, fieldDef, type Kind, numericRange } from "./fields.ts";
import { checkPublish } from "./export/epub.ts";
import { APPEARANCE_MIN_PARTS, APPEARANCE_PARTS, BELIEFS, type ChapterPlan, REQUIRED_DECISIONS, VOICE_KINDS, type Target } from "./schemas.ts";

export function validateProject(project: Project): Issue[] {
  const issues: Issue[] = [];
  const err = (code: string, file: string, message: string, path?: string) => issues.push({ code, severity: "error", file, path, message });
  const warn = (code: string, file: string, message: string, path?: string) => issues.push({ code, severity: "warn", file, path, message });

  const index = buildPlanIndex(project, issues);
  const characterIds = checkSchema(project, err);
  // The characters that a chapter brings in with a `create` entry are characters too.
  const types = project.schema?.data.types ?? {};
  for (const { entry } of allEntries(loadRecord(project.root))) if (entry.op === "create" && types[entry.type ?? ""]?.kind === "character") characterIds.add(entry.entity);
  checkBible(project, err, warn);
  checkFacts(project, err);
  const totalBooks = checkLevels(project, err, warn);
  checkDraws(project, totalBooks, err);
  checkCharacters(project, index, characterIds, totalBooks, err, warn);
  checkRelationships(project, index, totalBooks, err, warn);
  checkChapters(project, index, characterIds, err, warn);
  checkTension(project, index, err, warn);
  checkThreads(project, index, err);
  checkTargets(project, index, characterIds, err, warn);
  checkVoiceSamples(project, characterIds, err);
  checkLore(project, index, err, warn);
  checkCast(project, index, characterIds, err, warn);
  checkEntryNames(project, err);
  checkNames(project, err);
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
  // Only when every book plan exists: before that, a later book can still deliver the draw. An imported book delivers
  // nothing, so a project with only imported books waits for its first planned book.
  for (let b = 1; b <= totalBooks; b++) if (!project.books.has(b)) return;
  const planned = [...project.books.keys()].filter((b) => !project.books.get(b)!.data.imported);
  if (planned.length === 0) return;
  const first = project.books.get(Math.min(...planned))!;
  for (const d of draws) {
    if (d.kind === "gives" && !delivered.has(d.id)) err("draw-undelivered", first.file, `no book plan delivers the draw '${d.id}' (${d.text})`, "draws");
  }
}

/** Returns the IDs of all entities in schema.yaml whose type has kind `character`. */
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
    if (!plan.data.imported) continue;
    if (project.chapters.has(b)) err("imported-planned", plan.file, `book ${b} is imported, so it has no chapter plans: remove ${bookDir(b)}/plan/`, "imported");
    const before = [...project.books].filter(([k, p]) => k < b && !p.data.imported).map(([k]) => k);
    if (before.length) err("imported-order", plan.file, `book ${b} is imported, but book ${before[0]} before it is planned: only the books before the first planned book can be imported`, "imported");
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
    if (project.schema && !characterIds.has(c.data.id)) warn("not-in-schema", c.file, `'${c.data.id}' is not a character entity in schema.yaml or the ledger`, "id");
    for (const d of duplicates(c.data.arc_beats, (b) => b.id)) err("duplicate-id", c.file, `arc beat '${d}' is defined twice`, "arc_beats");
    c.data.arc_beats.forEach((beat, i) => {
      if (totalBooks > 0 && beat.book > totalBooks) err("unknown-book", c.file, `book ${beat.book} is not in the plan`, `arc_beats.${i}.book`);
      const plan = project.books.get(beat.book);
      if (plan && !plan.data.imported && !plan.data.acts.some((a) => a.id === beat.act)) err("unknown-act", c.file, `book ${beat.book} has no act '${beat.act}'`, `arc_beats.${i}.act`);
    });
    if (c.data.role !== "supporting") {
      for (const b of project.books.keys()) {
        if (index.imported.has(b)) continue;
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

// ---------- relationships ----------

function checkRelationships(project: Project, index: PlanIndex, totalBooks: number, err: Report, warn: Report) {
  const role = (id: string) => project.characters.find((c) => c.data.id === id)?.data.role;
  const main = (id: string) => role(id) === "protagonist" || role(id) === "main";
  const pairKey = (a: string, b: string) => [a, b].sort().join(" and ");
  const pairs = new Map<string, string>();

  for (const [id, r] of project.relationships) {
    const d = r.data;
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) err("file-name", r.file, `the file name '${id}' is the relationship ID: use lower-case letters, digits and '-'`);
    d.between.forEach((c, i) => {
      if (!role(c)) err("relationship-unknown", r.file, `'${c}' has no characters/${c}.md`, `between.${i}`);
    });
    if (d.between.every((c) => role(c)) && !d.between.some(main)) {
      err("relationship-supporting", r.file, "a relationship file needs a protagonist or main character: two supporting characters get none", "between");
    }
    const key = pairKey(...d.between);
    const other = pairs.get(key);
    if (other) err("relationship-duplicate", r.file, `${key} already have a relationship file: relationships/${other}.md`, "between");
    else pairs.set(key, id);
    for (const field of ["wants", "hides"] as const) {
      for (const c of Object.keys(d[field])) {
        if (!d.between.includes(c)) err("relationship-field", r.file, `'${c}' is not one of ${d.between.join(" and ")}`, `${field}.${c}`);
      }
    }
    for (const c of d.between) {
      if (!(c in d.wants)) err("relationship-field", r.file, `say what ${c} wants from the other`, "wants");
    }

    for (const s of duplicates(d.stages, (s) => s.id)) err("duplicate-id", r.file, `stage '${s}' is defined twice`, "stages");
    d.stages.forEach((s, i) => {
      if (totalBooks > 0 && s.book > totalBooks) err("unknown-book", r.file, `book ${s.book} is not in the plan`, `stages.${i}.book`);
      const plan = project.books.get(s.book);
      if (plan && !plan.data.imported && !plan.data.acts.some((a) => a.id === s.act)) err("unknown-act", r.file, `book ${s.book} has no act '${s.act}'`, `stages.${i}.act`);
    });
    if (d.stages.length === 0) warn("relationship-static", r.file, "the relationship has no stages: nothing on the page changes how the two are together", "stages");
    else if (d.stages.length >= 3 && d.stages.every((s) => s.shift === "closer")) {
      warn("relationship-flat", r.file, "every stage brings the two closer: give the relationship at least one stage that pushes them apart", "stages");
    }

    // Every stage of a book with chapter plans is placed in exactly one chapter of its act.
    for (const book of index.planned) {
      const chapters = project.chapters.get(book)!;
      for (const s of d.stages.filter((s) => s.book === book)) {
        const ref = `${id}/${s.id}`;
        const placed = chapters.filter((ch) => ch.data.stages.includes(ref));
        if (placed.length === 0) err("stage-unplaced", `${bookDir(book)}/plan`, `stage ${ref} is not in any chapter plan`);
        if (placed.length > 1) err("stage-twice", `${bookDir(book)}/plan`, `stage ${ref} is in chapters ${placed.map((p) => p.data.chapter).join(", ")}`);
        const range = index.actRanges.get(book)?.get(s.act);
        for (const p of placed) {
          if (range && (p.data.chapter < range[0] || p.data.chapter > range[1])) {
            err("stage-wrong-act", p.file, `stage ${ref} belongs to ${s.act} (chapters ${range[0]}–${range[1]})`, "stages");
          }
        }
      }
    }
  }

  // Two main characters who share the cast of 2 or more chapters need a relationship file.
  const shared = new Map<string, number>();
  for (const plans of project.chapters.values()) {
    for (const p of plans) {
      const cast = [...new Set([p.data.pov, ...p.data.characters])].filter(main).sort();
      for (let i = 0; i < cast.length; i++) for (let j = i + 1; j < cast.length; j++) shared.set(pairKey(cast[i], cast[j]), (shared.get(pairKey(cast[i], cast[j])) ?? 0) + 1);
    }
  }
  for (const [key, n] of shared) {
    if (n >= 2 && !pairs.has(key)) warn("relationship-missing", "relationships/", `${key} are main characters together in ${n} chapters, but have no relationship file: the brief cannot tell the writer how they are together`);
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
      d.stages.forEach((ref, k) => {
        const [rel, id] = ref.split("/");
        const r = project.relationships.get(rel);
        const stage = r?.data.stages.find((s) => s.id === id);
        if (!r || !stage) return err("unknown-stage", c.file, `stage ${ref} is not defined in relationships/`, `stages.${k}`);
        if (stage.book !== book) err("stage-wrong-book", c.file, `stage ${ref} belongs to book ${stage.book}`, `stages.${k}`);
        const cast = [d.pov, ...d.characters];
        const away = r.data.between.filter((x) => !cast.includes(x));
        if (away.length) warn("stage-cast", c.file, `stage ${ref} moves ${r.data.between.join(" and ")}, but ${away.join(" and ")} is not in \`characters\``, `stages.${k}`);
      });
      for (const kind of ["plants", "advances", "pays_off"] as const) {
        d.threads[kind].forEach((t, k) => {
          if (!threads.has(t)) err("unknown-thread", c.file, `thread '${t}' is not in threads.yaml`, `threads.${kind}.${k}`);
        });
      }
    });
  }
}

// ---------- tension, stakes and the climax ----------

function checkTension(project: Project, index: PlanIndex, err: Report, warn: Report) {
  for (const plan of project.books.values()) {
    if (plan.data.imported) continue;
    if (!plan.data.tension) warn("tension-missing", plan.file, "the book plan has no `tension` range, so nothing checks the tension of its chapters", "tension");
    if (!plan.data.climax) warn("climax-missing", plan.file, "the book plan has no `climax`: a book needs one big event in its last act", "climax");
  }

  for (const [book, chapters] of project.chapters) {
    const plan = project.books.get(book);
    const range = plan?.data.tension;
    const levels = chapters.flatMap((c) => c.data.tension ?? []);
    const peak = range?.max ?? Math.max(0, ...levels);
    const waived = (c: (typeof chapters)[number], rule: string) => c.data.exceptions.some((e) => e.rule === rule);
    // The chapters of the climax stay high together: the flat and after-peak rules start after its decisive chapter.
    const span = climaxSpan(index, book);
    const inSpan = (c: (typeof chapters)[number]) => span !== undefined && c.data.chapter >= span[0] && c.data.chapter <= span[1];

    chapters.forEach((c, i) => {
      const d = c.data;
      const missing = [d.tension === undefined && "`tension`", !d.stakes && "`stakes`", d.scenes.some((s) => !s.result) && "a `result` for each scene"].filter(Boolean);
      if (missing.length) warn("tension-missing", c.file, `the chapter plan has no ${missing.join(", ")}: the writer does not know how urgent the chapter is`);
      if (d.tension === undefined) return;
      if (range && (d.tension < range.min || d.tension > range.max)) err("tension-range", c.file, `tension ${d.tension} is outside the book's range ${range.min}–${range.max}`, "tension");
      const run = chapters.slice(Math.max(0, i - 3), i + 1);
      if (run.length === 4 && !inSpan(c) && run.every((r) => r.data.tension === d.tension) && !waived(c, "tension.flat")) {
        warn("tension.flat", c.file, `chapters ${run[0].data.chapter}–${d.chapter} all have tension ${d.tension}`, "tension");
      }
      const prev = chapters[i - 1];
      if (prev?.data.tension === peak && d.tension >= peak && !inSpan(c) && !waived(c, "tension.after-peak")) {
        warn("tension.after-peak", c.file, `chapter ${prev.data.chapter} is at the book's highest tension (${peak}), so this chapter must be lower`, "tension");
      }
    });

    // Each act: its peak does not fall below the peak of the act before, and not every scene is a win.
    const ranges = index.actRanges.get(book);
    let prevPeak: number | undefined;
    for (const act of plan?.data.acts ?? []) {
      const r = ranges?.get(act.id);
      if (!r) continue;
      const inAct = chapters.filter((c) => c.data.chapter >= r[0] && c.data.chapter <= r[1]);
      const last = inAct.at(-1)!;
      const actLevels = inAct.flatMap((c) => c.data.tension ?? []);
      if (actLevels.length) {
        const actPeak = Math.max(...actLevels);
        if (prevPeak !== undefined && actPeak < prevPeak && !waived(last, "tension.act-rise")) {
          warn("tension.act-rise", last.file, `the highest tension of ${act.id} is ${actPeak}, lower than ${prevPeak} in the act before`, "tension");
        }
        prevPeak = actPeak;
      }
      const results = inAct.flatMap((c) => c.data.scenes.flatMap((s) => s.result ?? []));
      if (results.length && results.every((x) => x === "win") && !waived(last, "tension.results")) {
        warn("tension.results", last.file, `every scene of ${act.id} is a win: give at least one scene the result loss or mixed`, "scenes");
      }
    }

    checkBonding(project, chapters, range?.min ?? 1, ranges, span, waived, warn);

    // The climax spans 2 or more chapters, and its decisive chapter has the highest tension of the book.
    if (!span) continue;
    const [first, decisive] = span;
    const cc = chapters.find((c) => c.data.chapter === decisive)!;
    if (first >= decisive) {
      err("climax-span", cc.file, `b${book}/climax-start (chapter ${first}) must come before b${book}/climax (chapter ${decisive}): the climax spans 2 or more chapters`, "anchors");
      continue;
    }
    const level = cc.data.tension;
    if (level !== undefined) {
      const higher = chapters.filter((c) => (c.data.tension ?? 0) > level).map((c) => c.data.chapter);
      if (higher.length) err("climax-peak", cc.file, `the decisive chapter of the climax has tension ${level}, but chapter(s) ${higher.join(", ")} are higher`, "tension");
      else if (range && level < range.max) warn("climax-peak", cc.file, `the decisive chapter of the climax has tension ${level}, below the book's highest level ${range.max}`, "tension");
    }
    const floor = (range?.max ?? peak) - 1;
    for (const c of chapters.filter(inSpan)) {
      if (c.data.tension !== undefined && c.data.tension < floor) warn("climax-tension", c.file, `the chapter is in the climax (chapters ${first}–${decisive}), so its tension is at least ${floor}`, "tension");
    }
  }
}

/** A bonding chapter is a rest after pressure: at the lowest tension, rare, away from the climax, and about a relationship. */
function checkBonding(
  project: Project,
  chapters: Loaded<ChapterPlan>[],
  floor: number,
  acts: Map<string, [number, number]> | undefined,
  span: [number, number] | undefined,
  waived: (c: Loaded<ChapterPlan>, rule: string) => boolean,
  warn: Report,
) {
  const actOf = (n: number) => [...(acts ?? [])].find(([, [a, b]]) => n >= a && n <= b)?.[0];
  chapters.forEach((c, i) => {
    const d = c.data;
    if (!d.bonding) return;
    const flag = (rule: string, message: string, path?: string) => {
      if (!waived(c, rule)) warn(rule, c.file, message, path);
    };
    if (d.tension !== undefined && d.tension > floor) flag("bonding.tension", `a bonding chapter is at the book's lowest tension (${floor}), not ${d.tension}`, "tension");
    const earlier = chapters.slice(0, i).filter((p) => p.data.bonding);
    if (chapters[i - 1]?.data.bonding) flag("bonding.rate", `chapter ${d.chapter - 1} is a bonding chapter too: never two in a row`, "bonding");
    else if (earlier.some((p) => actOf(p.data.chapter) === actOf(d.chapter) && actOf(d.chapter))) flag("bonding.rate", `${actOf(d.chapter)} already has a bonding chapter: at most one in an act`, "bonding");
    if (span && d.chapter >= span[0] - 1 && d.chapter <= span[1]) flag("bonding.climax", `the climax is chapters ${span[0]}–${span[1]}: a bonding chapter there, or just before it, stops the pressure`, "bonding");
    const cast = [d.pov, ...d.characters];
    if (!relationshipsOf(project, cast).length) flag("bonding.cast", "no relationship file is between two characters of the cast: a bonding chapter moves a relationship", "characters");
  });
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
      if (index.imported.has(b)) continue;
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
    if (index.imported.has(r.book)) {
      err("target-imported", file, `${t.anchor} is in imported book ${r.book}, and the record starts after it: put the state at its end in the start values of schema.yaml`, `${i}.anchor`);
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
      if (plan.data.imported) continue;
      for (const id of [...plan.data.acts.map((a) => `b${book}/${a.id}/end`), `b${book}/end`]) {
        if (!targeted.has(id)) warn("target-missing", file, `the ending state at ${id} has no target`);
      }
    }
  }
}

// ---------- names ----------

/** The planning files name the characters, places and things; the writer takes the names from them. */
function checkNames(project: Project, err: Report) {
  const found = (file: string, text: string, path?: string) => {
    for (const name of aiNamesIn(text)) err("name-ai-default", file, `'${name}' is a name that AI fiction overuses: give a name from the setting (guidelines §4, Names)`, path);
  };
  for (const d of project.bible?.data.decisions ?? []) found(project.bible!.file, d.value, `decisions.${d.id}`);
  for (const [id, e] of Object.entries(project.schema?.data.entities ?? {})) found(project.schema!.file, e.name, `entities.${id}.name`);
  for (const c of project.characters) found(c.file, c.data.name, "name");
  for (const e of project.lore.values()) found(e.file, [e.data.title, ...e.data.aliases, e.body].join("\n"));
  if (project.series) found(project.series.file, JSON.stringify(project.series.data));
  for (const b of project.books.values()) found(b.file, JSON.stringify(b.data));
  for (const plans of project.chapters.values()) for (const p of plans) found(p.file, JSON.stringify(p.data));
}

// ---------- lore ----------

const LORE_MAX_WORDS = 250;
const LORE_MAX_ALWAYS = 3;

function checkLore(project: Project, index: PlanIndex, err: Report, warn: Report) {
  const always = [...project.lore.values()].filter((e) => e.data.always);
  if (always.length > LORE_MAX_ALWAYS) {
    for (const e of always) warn("lore-always", e.file, `${always.length} entries have \`always: true\` (more than ${LORE_MAX_ALWAYS}): each one is in every brief`, "always");
  }
  for (const [id, entry] of project.lore) {
    if (!/^[a-z0-9][a-z0-9-]*$/.test(id)) err("file-name", entry.file, `the file name '${id}' is the entry ID: use lower-case letters, digits and '-'`);
    if (!entry.body.trim()) warn("lore-empty", entry.file, "the entry has no body: the brief gives the writer only the body");
    checkChanges(entry.data.changes, entry.file, "lore-change-order", index, err);
    const words = entry.body.split(/\s+/).filter(Boolean).length;
    if (words > LORE_MAX_WORDS) warn("lore-long", entry.file, `the entry has ${words} words (more than ${LORE_MAX_WORDS}): keep the facts a writer needs, or split it into two entries`);
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
      m.data.lore_added.forEach(({ entry, change }, i) => {
        const e = project.lore.get(entry);
        if (!e) return err("lore-unknown", m.file, `there is no lore entry lore/${entry}.md: write the fact into it`, `lore_added.${i}.entry`);
        const point = `${m.data.book}.${pad2(m.data.chapter)}`;
        const here = e.data.changes.some((c) => {
          const r = index.resolve(c.from);
          return !("error" in r) && r.book === m.data.book && r.chapter === m.data.chapter;
        });
        if (change && !here) err("lore-change-missing", m.file, `lore/${entry}.md has no change from ${point}: add it to its \`changes\``, `lore_added.${i}`);
      });
    }
  }
}

/** Each change of a lore entry or a character resolves, and the changes are in story order. */
function checkChanges(changes: NamedEntry["changes"], file: string, orderCode: string, index: PlanIndex, err: Report) {
  let last: Pos | undefined;
  changes.forEach((c, i) => {
    const r = index.resolve(c.from);
    if ("error" in r) return err("bad-position", file, r.error, `changes.${i}.from`);
    if (last && comparePos(r.pos, last) < 0) err(orderCode, file, `the change from ${c.from} comes before the change above it: keep the changes in story order`, `changes.${i}.from`);
    last = r.pos;
  });
}

/** A name finds the entry for a brief, so one name belongs to one lore entry or character. */
function checkEntryNames(project: Project, err: Report) {
  const names = new Map<string, NamedEntry>();
  for (const e of [...loreEntries(project), ...characterEntries(project)]) {
    for (const name of entryNames(e)) {
      const other = names.get(name);
      if (other) err("duplicate-name", e.file, `the name '${name}' is also a name of ${other.file}: give each entry its own names`);
      else names.set(name, e);
    }
  }
}

// ---------- the cast ----------

function checkCast(project: Project, index: PlanIndex, characterIds: Set<string>, err: Report, warn: Report) {
  const known = new Set([...characterIds, ...project.characters.map((c) => c.data.id)]);
  for (const c of project.characters) {
    if (!c.body.trim()) warn("character-empty", c.file, "the file has no body: the brief tells the writer who the character is from the body");
    if (c.data.role !== "supporting") {
      const missing = [
        !c.data.wound && "`wound`",
        !c.data.contradiction && "`contradiction`",
        c.data.voice.states.length < 2 && "2 or more `voice.states`",
      ].filter(Boolean);
      if (missing.length) warn("character-depth", c.file, `a ${c.data.role} character needs ${missing.join(", ")}: without them the character has one note`);
      const a = c.data.appearance;
      const parts = APPEARANCE_PARTS.filter((p) => a?.[p]).length;
      const thin = [
        parts < APPEARANCE_MIN_PARTS && `${APPEARANCE_MIN_PARTS} or more parts of \`appearance\` (it has ${parts})`,
        !a?.signature.length && "1–3 `appearance.signature` details",
      ].filter(Boolean);
      if (thin.length) warn("character-appearance", c.file, `a ${c.data.role} character needs ${thin.join(" and ")}: without them the writer makes up how they look, and the chapters do not agree`, "appearance");
    }
    if ((c.data.appearance?.signature.length ?? 0) > 3) warn("character-appearance", c.file, "give at most 3 signature details: a reader remembers a character by one or two", "appearance.signature");
    checkChanges(c.data.changes, c.file, "character-change-order", index, err);
  }
  for (const plans of project.chapters.values()) {
    for (const plan of plans) {
      plan.data.characters.forEach((id, i) => {
        if (!known.has(id)) err("character-unknown", plan.file, `'${id}' is not a character: write characters/${id}.md for a new one`, `characters.${i}`);
      });
    }
  }
  // A character on the page in two chapters comes back, so it needs a file.
  const seenIn = new Map<string, number>();
  for (const files of project.memory.values()) {
    for (const m of files) {
      m.data.appeared.forEach((id, i) => {
        if (!known.has(id)) return err("character-unknown", m.file, `'${id}' is not a character entity or file`, `appeared.${i}`);
        seenIn.set(id, (seenIn.get(id) ?? 0) + 1);
      });
      m.data.character_added.forEach(({ character, change, part }, i) => {
        const c = project.characters.find((x) => x.data.id === character);
        if (!c) return err("character-added-unknown", m.file, `there is no characters/${character}.md: write the fact into it`, `character_added.${i}.character`);
        const here = c.data.changes.filter((x) => {
          const r = index.resolve(x.from);
          return !("error" in r) && r.book === m.data.book && r.chapter === m.data.chapter;
        });
        const point = `${m.data.book}.${pad2(m.data.chapter)}`;
        if (change && !here.length) err("character-change-missing", m.file, `characters/${character}.md has no change from ${point}: add it to its \`changes\``, `character_added.${i}`);
        if (!part) return;
        if (change && here.length && !here.some((x) => x.appearance?.[part])) {
          err("character-appearance-missing", m.file, `the change from ${point} in characters/${character}.md does not set \`appearance.${part}\`: add it to the change`, `character_added.${i}.part`);
        }
        if (!change && !c.data.appearance?.[part]) {
          err("character-appearance-missing", m.file, `characters/${character}.md has no \`appearance.${part}\`: write the fact into it`, `character_added.${i}.part`);
        }
      });
    }
  }
  for (const [id, n] of seenIn) {
    if (n >= 2 && !project.characters.some((c) => c.data.id === id)) {
      warn("character-no-file", "characters/", `'${id}' is on the page in ${n} chapters but has no characters/${id}.md: the brief cannot tell the writer who it is`);
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

  const imported = (book: number) => project.books.get(book)?.data.imported === true;
  const approved = (book: number, chapter: number) => project.prose.get(book)?.find((c) => c.data.chapter === chapter)?.data.status === "approved";
  for (const k of new Set(rec.ledger.map((l) => chapterKey(l.at.book, l.at.chapter)))) {
    const [b, c] = k.split(".").map(Number);
    if (imported(b)) err("ledger-imported", "ledger.jsonl", `the ledger has entries for chapter ${k}, but book ${b} is imported: the record starts after it`);
    else if (!approved(b, c)) err("ledger-unapproved", "ledger.jsonl", `the ledger has entries for chapter ${k}, but that chapter is not approved`);
  }
  // An approved chapter can be revised, but each committed quote stays in its prose, in order:
  // the claims and the state at a line depend on them.
  const committed = new Map<string, typeof rec.ledger>();
  for (const l of rec.ledger) {
    const k = chapterKey(l.at.book, l.at.chapter);
    committed.set(k, [...(committed.get(k) ?? []), l]);
  }
  for (const [k, entries] of committed) {
    const [b, c] = k.split(".").map(Number);
    const file = chapterPath(b, c);
    const path = join(project.root, file);
    if (imported(b) || !approved(b, c) || !existsSync(path)) continue;
    const quoted = entries.filter((l) => l.entry.quote && !isCorrection(l.entry));
    const lines = quoteLines(readFileSync(path, "utf8"), quoted.map((l) => l.entry));
    let prev = 0;
    quoted.forEach((l, i) => {
      const at = lines[i];
      if (at === undefined) err("ledger-quote-not-found", file, `the ledger entry ${l.entry.entity}.${l.entry.field ?? l.entry.op} of ${k} quotes words that are not in the chapter: "${l.entry.quote}"`);
      else if (at < prev) warn("ledger-quote-order", file, `the ledger entry ${l.entry.entity}.${l.entry.field ?? l.entry.op} of ${k} quotes line ${at}, before the quote of the entry above it (line ${prev})`);
      else prev = at;
    });
  }
  for (const k of rec.staged.keys()) {
    const [b, c] = k.split(".").map(Number);
    if (approved(b, c)) err("staged-committed", stagedPath(b, c), `chapter ${k} is approved, so its delta must be in the ledger, not staged`);
  }

  for (const [book, files] of project.prose) {
    for (const f of files) {
      if (imported(book) !== (f.data.source === "imported")) {
        err("imported-source", f.file, imported(book) ? `book ${book} is imported, so each chapter has source: imported` : `book ${book} is not imported, so the chapter has no source: imported`, "source");
      }
      if (imported(book)) continue;
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

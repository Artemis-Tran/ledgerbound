/**
 * The context brief: the one input of the chapter-writer agent. `lb brief 1.07` builds it from the
 * files, so two runs for the same chapter give the same brief.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { stringify } from "yaml";
import { buildPlanIndex, comparePos, type Pos } from "./anchors.ts";
import { splitFrontmatter } from "./frontmatter.ts";
import { pad2, type Project } from "./project.ts";
import { chapterPath, fold, type RecordFiles, type State } from "./record.ts";

export const briefPath = (book: number, chapter: number) => `runs/briefs/${pad2(book)}-${pad2(chapter)}.md`;

const yaml = (v: unknown) => `\`\`\`yaml\n${stringify(v, { lineWidth: 0 }).trimEnd()}\n\`\`\``;
const rawFrontmatter = (path: string) => /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(path, "utf8"))?.[1] ?? "";
const NAME_STOP = new Set(["The", "Of", "And", "Old", "Young", "Lady", "Lord", "Sir"]);

/** The entities that a chapter plan names: by ID or full name (any case), or by a capitalized part of the name. */
function entitiesIn(state: State, text: string): string[] {
  const hit = (name: string, flags: string) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, flags).test(text);
  return Object.entries(state.entities)
    .filter(([id, e]) => {
      const parts = e.name.split(/\s+/).filter((w) => /^[A-Z][a-z]{2,}/.test(w) && !NAME_STOP.has(w));
      return hit(id.replace(/-/g, " "), "i") || hit(e.name, "i") || parts.some((p) => hit(p, ""));
    })
    .map(([id]) => id);
}

/** The last paragraphs of a chapter body, about `words` words, with no status windows. */
function tail(body: string, words: number): string {
  const paras = body
    .replace(/```[\s\S]*?```/g, "")
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p && !p.startsWith("#"));
  const out: string[] = [];
  let n = 0;
  while (paras.length && n < words) {
    const p = paras.pop()!;
    out.unshift(p);
    n += p.split(/\s+/).length;
  }
  return out.join("\n\n");
}

interface Section {
  title: string;
  text: string;
  /** Sections that can go when the brief is too long, lowest `drop` first. */
  drop?: number;
}

export interface BriefResult {
  file: string;
  chars: number;
  dropped: string[];
  over: boolean;
}

export function buildBrief(project: Project, rec: RecordFiles, book: number, chapter: number): BriefResult {
  const root = project.root;
  const plans = project.chapters.get(book) ?? [];
  const plan = plans.find((p) => p.data.chapter === chapter);
  if (!plan) throw new Error(`book ${book} has no chapter plan ${pad2(chapter)}`);
  const index = buildPlanIndex(project, []);
  const start = fold(project, rec, { book, chapter, index: 0 }).state;
  const sections: Section[] = [];

  // 1. The prose decisions.
  const decisions = (project.bible?.data.decisions ?? []).filter((d) => ["prose-style", "pov-tense", "tone"].includes(d.id));
  sections.push({
    title: "Prose decisions",
    text: `${decisions.map((d) => `- **${d.topic}**: ${d.value}`).join("\n")}\n\nWindow template (use it for every status window; show only the values that changed):\n\n\`\`\`\n${project.bible?.data.window_template?.trimEnd() ?? "(none)"}\n\`\`\``,
  });

  // 2. The chapter plan, and the next 2.
  sections.push({ title: `This chapter: ${book}.${pad2(chapter)}`, text: `\`\`\`yaml\n${rawFrontmatter(join(root, plan.file))}\n\`\`\`` });
  plans
    .filter((p) => p.data.chapter > chapter && p.data.chapter <= chapter + 2)
    .forEach((p, i) => {
      sections.push({ title: `Next plan: ${book}.${pad2(p.data.chapter)} (for direction only; do not write it)`, text: `\`\`\`yaml\n${rawFrontmatter(join(root, p.file))}\n\`\`\``, drop: 100 - i });
    });

  // 3. The schema, the facts and the entity IDs.
  const types = Object.fromEntries(Object.entries(project.schema?.data.types ?? {}).map(([k, t]) => [k, { kind: t.kind, fields: t.fields }]));
  sections.push({
    title: "Record: schema, facts and entities",
    text: `${yaml({ types })}\n\n${yaml({ facts: Object.fromEntries(project.facts.data.map((f) => [f.id, f.truth])) })}\n\n${yaml({ entities: Object.fromEntries(Object.entries(start.entities).map(([id, e]) => [id, `${e.name} (${e.type})`])) })}`,
  });

  // 4 and 5. The targets of this chapter's anchors, and the fold at the chapter start for the entities that the plan or a target names.
  const targets = project.targets.data.filter((t) => {
    const r = index.resolve(t.anchor);
    return !("error" in r) && r.book === book && r.chapter === chapter;
  });
  const targetIds = targets.flatMap((t) => [...Object.keys(t.expect).map((k) => k.split(".")[0]), ...Object.keys(t.knowledge)]);
  const ids = [...new Set([plan.data.pov, ...entitiesIn(start, JSON.stringify(plan.data)), ...targetIds])].filter((id) => start.entities[id]);
  const beliefs = (id: string) => {
    const e = start.entities[id];
    const all = Object.fromEntries(project.facts.data.map((f) => [f.id, e.beliefs[f.id] ?? "unaware"]));
    // The POV character's beliefs in full; for the others, only what they know or believe falsely.
    return id === plan.data.pov ? all : Object.fromEntries(Object.entries(all).filter(([, b]) => b !== "unaware"));
  };
  sections.push({
    title: "The fold at the chapter start (copy numbers from here and from your delta, never from memory)",
    text: yaml({
      day: start.day ?? null,
      time: start.time ?? null,
      entities: Object.fromEntries(
        ids.map((id) => {
          const e = start.entities[id];
          const isCharacter = project.schema?.data.types[e.type]?.kind === "character";
          return [id, { name: e.name, ...e.fields, ...(isCharacter ? { beliefs: beliefs(id) } : {}) }];
        }),
      ),
    }),
  });
  if (targets.length) sections.push({ title: "Targets at the end of this chapter (the delta must meet them)", text: yaml(targets) });

  // 6. Voice cards.
  const cards = project.characters.filter((c) => ids.includes(c.data.id) || c.data.id === plan.data.pov);
  if (cards.length) sections.push({ title: "Voice cards", text: yaml(Object.fromEntries(cards.map((c) => [c.data.id, { name: c.data.name, role: c.data.role, voice: c.data.voice }]))) });

  // 7. The voice samples.
  for (const v of project.voiceSamples) sections.push({ title: `Voice sample: ${v.data.kind}`, text: v.body.trim() });

  // 8. Rolling memory: the last 3 chapters in full, the summary of older ones.
  const earlier = [...project.memory.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([, ms]) => ms)
    .filter((m) => m.data.book < book || (m.data.book === book && m.data.chapter < chapter));
  const full = earlier.slice(-3);
  earlier.slice(0, -3).forEach((m, i) => {
    sections.push({ title: `Memory ${m.data.book}.${pad2(m.data.chapter)} (summary)`, text: m.data.summary, drop: i });
  });
  for (const m of full) {
    const { phrase_log: _, ...rest } = m.data;
    sections.push({ title: `Memory ${m.data.book}.${pad2(m.data.chapter)}`, text: yaml(rest) });
  }

  // 9. The phrase log of the book.
  const log = { similes: new Set<string>(), images: new Set<string>(), gestures: {} as Record<string, Set<string>>, ending_types: [] as string[] };
  for (const m of project.memory.get(book) ?? []) {
    if (m.data.chapter >= chapter) continue;
    m.data.phrase_log.similes.forEach((s) => log.similes.add(s));
    m.data.phrase_log.images.forEach((s) => log.images.add(s));
    for (const [who, gs] of Object.entries(m.data.phrase_log.gestures)) gs.forEach((g) => (log.gestures[who] ??= new Set()).add(g));
    log.ending_types.push(`${pad2(m.data.chapter)}: ${m.data.ending_type}`);
  }
  if (log.similes.size + log.images.size + log.ending_types.length) {
    sections.push({
      title: "Phrase log of this book (already used: use none of these again)",
      text: yaml({ similes: [...log.similes], images: [...log.images], gestures: Object.fromEntries(Object.entries(log.gestures).map(([k, v]) => [k, [...v]])), ending_types: log.ending_types }),
    });
  }

  // 10. Threads that are open here or that this chapter moves.
  const here: Pos = [book, chapter, 0.5];
  const posOf = (ref: string) => {
    const r = index.resolve(ref);
    return "error" in r ? undefined : r.pos;
  };
  const moves = new Map<string, string>();
  for (const k of ["plants", "advances", "pays_off"] as const) for (const t of plan.data.threads[k]) moves.set(t, k.replace("_", " "));
  const threads = project.threads.data.filter((t) => {
    if (moves.has(t.id)) return true;
    const p = posOf(t.plant);
    const q = posOf(t.payoff);
    return p && q && comparePos(p, here) < 0 && comparePos(q, here) > 0;
  });
  if (threads.length) {
    sections.push({
      title: "Threads",
      text: threads.map((t) => `- **${t.id}** (${t.kind}${moves.has(t.id) ? `; this chapter ${moves.get(t.id)} it` : "; open"}): ${t.summary}`).join("\n"),
    });
  }

  // 11. The last words of the previous chapter.
  const prev = chapter > 1 ? { book, chapter: chapter - 1 } : book > 1 ? { book: book - 1, chapter: project.prose.get(book - 1)?.at(-1)?.data.chapter ?? 0 } : undefined;
  if (prev && existsSync(join(root, chapterPath(prev.book, prev.chapter)))) {
    const body = splitFrontmatter(readFileSync(join(root, chapterPath(prev.book, prev.chapter)), "utf8")).body;
    sections.push({ title: `The end of the previous chapter (${prev.book}.${pad2(prev.chapter)}), for continuity of texture only`, text: tail(body, 300) });
  }

  // Keep the brief under the limit: drop the oldest summaries first, then the farthest next plans.
  const render = (ss: Section[]) => `# Context brief: book ${book}, chapter ${chapter}\n\n${ss.map((s) => `## ${s.title}\n\n${s.text}`).join("\n\n")}\n`;
  const limit = project.config.brief_chars;
  const kept = [...sections];
  const dropped: string[] = [];
  const droppable = sections.filter((s) => s.drop !== undefined).sort((a, b) => a.drop! - b.drop!);
  while (render(kept).length > limit && droppable.length) {
    const s = droppable.shift()!;
    kept.splice(kept.indexOf(s), 1);
    dropped.push(s.title);
  }
  const out = render(kept);
  const file = briefPath(book, chapter);
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), out);
  return { file, chars: out.length, dropped, over: out.length > limit };
}

/**
 * The context brief: the one input of the chapter-writer agent. `lb brief 1.07` builds it from the
 * files, so two runs for the same chapter give the same brief.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { stringify } from "yaml";
import { buildPlanIndex, comparePos, type Pos } from "./anchors.ts";
import { splitFrontmatter } from "./frontmatter.ts";
import { changesBefore, characterEntry, charactersNamedIn, characterText, entryText, firstSentence, loreEntry, loreNamedIn, nameParts, lastSeen } from "./entries.ts";
import { pad2, type Project } from "./project.ts";
import { chapterPath, fold, type RecordFiles, type State } from "./record.ts";

export const briefPath = (book: number, chapter: number) => `runs/briefs/${pad2(book)}-${pad2(chapter)}.md`;

const yaml = (v: unknown) => `\`\`\`yaml\n${stringify(v, { lineWidth: 0 }).trimEnd()}\n\`\`\``;
const rawFrontmatter = (path: string) => /^---\r?\n([\s\S]*?)\r?\n---/.exec(readFileSync(path, "utf8"))?.[1] ?? "";
/** The entities that a chapter plan names: by ID or full name (any case), or by a capitalized part of the name. */
function entitiesIn(state: State, text: string): string[] {
  const hit = (name: string, flags: string) => new RegExp(`\\b${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, flags).test(text);
  return Object.entries(state.entities)
    .filter(([id, e]) => {
      return hit(id.replace(/-/g, " "), "i") || hit(e.name, "i") || nameParts(e.name).some((p) => hit(p, ""));
    })
    .map(([id]) => id);
}

/** The lore entries of a chapter: the `always` ones, the ones the plan lists, then the ones the plan names (see entries.ts). */
export function loreFor(project: Project, planText: string, listed: string[]): { id: string; listed: boolean }[] {
  const out = new Map<string, boolean>();
  for (const [id, e] of project.lore) if (e.data.always) out.set(id, true);
  for (const id of listed) if (project.lore.has(id)) out.set(id, true);
  for (const id of loreNamedIn(project, planText)) if (!out.has(id)) out.set(id, false);
  return [...out].map(([id, listed]) => ({ id, listed }));
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
  /** The lore entry of the section, for the warning when it is shortened. */
  lore?: string;
  /** A shorter text that takes the place of `text` at its `drop` turn, instead of the section going. */
  short?: string;
}

export interface BriefResult {
  file: string;
  chars: number;
  dropped: string[];
  /** The lore entries that the plan names and that were shortened to fit brief_chars. */
  warnings: string[];
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
  const windows = project.config.windows
    ? `Window template (use it for every status window; show only the values that changed):\n\n\`\`\`\n${project.bible?.data.window_template?.trimEnd() ?? "(none)"}\n\`\`\``
    : "No status windows (project.yaml: `windows: off`). Show each change of the record through the prose only: what the character does, feels in the body, or can now do.";
  sections.push({ title: "Prose decisions", text: `${decisions.map((d) => `- **${d.topic}**: ${d.value}`).join("\n")}\n\n${windows}` });

  // 1b. The draws: every exclusion, and the draws that this book delivers.
  const draws = project.bible?.data.draws;
  if (draws) {
    const delivers = new Set(project.books.get(book)?.data.draws ?? []);
    const excludes = draws.filter((d) => d.kind === "excludes");
    const gives = draws.filter((d) => d.kind === "gives" && delivers.has(d.id));
    sections.push({
      title: "Draws (what the reader came for)",
      text: [
        "The story never contains these (a break is an error, rule `draws.excluded`):",
        ...excludes.map((d) => `- ${d.text}`),
        ...(gives.length > 0 ? ["", `Book ${book} delivers these; serve them where the plan allows:`, ...gives.map((d) => `- ${d.text}`)] : []),
      ].join("\n"),
    });
  }

  // 2. The chapter plan, and the next 2.
  sections.push({ title: `This chapter: ${book}.${pad2(chapter)} (about ${plan.data.words ?? project.config.chapter_words} words)`, text: `\`\`\`yaml\n${rawFrontmatter(join(root, plan.file))}\n\`\`\`` });
  // 2b. The act of this chapter and the book: where the chapter goes, and how urgent it is.
  const bookPlan = project.books.get(book)?.data;
  if (bookPlan) {
    const range = [...(index.actRanges.get(book) ?? [])].find(([, [a, b]]) => chapter >= a && chapter <= b);
    const act = range && bookPlan.acts.find((a) => a.id === range[0]);
    const t = plan.data.tension;
    const level = t === undefined ? "" : `Tension ${t}${bookPlan.tension ? ` (this book: ${bookPlan.tension.min}–${bookPlan.tension.max})` : ""}: write the pressure, pace and cost of level ${t} in guidelines/writing.md §13.`;
    const stakes = plan.data.stakes ? `Stakes: ${plan.data.stakes} Put them on the page before the turn of the chapter.` : "";
    sections.push({
      title: `This act${act ? ` (${act.id}, chapters ${range![1][0]}–${range![1][1]})` : ""} and the book`,
      text: [
        [level, stakes].filter(Boolean).join("\n\n"),
        yaml({
          book: { promise: bookPlan.promise, ...(bookPlan.climax ? { climax: bookPlan.climax } : {}) },
          ...(act ? { act: { id: act.id, promise: act.promise, question: act.question, ending_state: act.ending_state } } : {}),
        }),
      ]
        .filter(Boolean)
        .join("\n\n"),
    });
  }
  plans
    .filter((p) => p.data.chapter > chapter && p.data.chapter <= chapter + 2)
    .forEach((p, i) => {
      sections.push({ title: `Next plan: ${book}.${pad2(p.data.chapter)} (for direction only; do not write it)`, text: `\`\`\`yaml\n${rawFrontmatter(join(root, p.file))}\n\`\`\``, drop: 100 - i });
    });

  // 3. The schema, the facts and the entity IDs.
  const types = Object.fromEntries(Object.entries(project.schema?.data.types ?? {}).map(([k, t]) => [k, { kind: t.kind, fields: t.fields }]));
  const untracked = project.schema?.data.untracked ?? [];
  sections.push({
    title: "Record: schema, facts and entities",
    text: `${yaml({ types })}\n\n${untracked.length ? `${yaml({ untracked })}\n\n` : ""}${yaml({ facts: Object.fromEntries(project.facts.data.map((f) => [f.id, f.truth])) })}\n\n${yaml({ entities: Object.fromEntries(Object.entries(start.entities).map(([id, e]) => [id, `${e.name} (${e.type})`])) })}`,
  });

  // 4 and 5. The targets of this chapter's anchors, and the fold at the chapter start for the entities that the plan or a target names.
  const targets = project.targets.data.filter((t) => {
    const r = index.resolve(t.anchor);
    return !("error" in r) && r.book === book && r.chapter === chapter;
  });
  const targetIds = targets.flatMap((t) => [...Object.keys(t.expect).map((k) => k.split(".")[0]), ...Object.keys(t.knowledge)]);
  // The cast: the POV character, the characters that the plan lists, and the ones that a target names. Their
  // sections stay in the brief. The characters that the plan only names come after them, and can go.
  const planText = JSON.stringify(plan.data);
  const listedCast = [...new Set([plan.data.pov, ...plan.data.characters, ...targetIds])];
  const namedCast = [...new Set([...entitiesIn(start, planText), ...charactersNamedIn(project, planText)])].filter((id) => !listedCast.includes(id));
  const ids = [...listedCast, ...namedCast].filter((id) => start.entities[id]);
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

  // 5b. Lore: the setting facts this chapter touches. The prose never contradicts them.
  // Entries found only by name are shortened to their first sentence when the brief is too long, after the next plans.
  const lore = loreFor(project, rawFrontmatter(join(root, plan.file)), plan.data.lore);
  lore.forEach(({ id, listed }, i) => {
    const e = project.lore.get(id)!;
    const short = `${firstSentence(e.body)} (shortened: run \`lb lore ${id} --at ${book}.${pad2(chapter)}\` for the whole entry)`;
    sections.push({ title: `Lore: ${e.data.title} (the prose never contradicts it)`, text: entryText(index, loreEntry(id, e), book, chapter), ...(listed ? {} : { drop: 200 - i, short, lore: id }) });
  });
  // The other entries, one line each, so that the writer knows what the world already has. When the brief is
  // too long, the index keeps only the titles and IDs.
  const others = [...project.lore].filter(([id]) => !lore.some((l) => l.id === id));
  if (others.length) {
    const changed = ([id, e]: (typeof others)[number]) => (changesBefore(index, loreEntry(id, e), book, chapter).length ? " (it has changed since)" : "");
    sections.push({
      title: `Lore index: the other entries (run \`lb lore <id> --at ${book}.${pad2(chapter)}\` before the chapter uses one)`,
      text: others
        .map(([id, e]) => `- **${e.data.title}** (\`${id}\`, ${e.data.category}${e.data.aliases.length ? `; also ${e.data.aliases.join(", ")}` : ""}): ${firstSentence(e.body)}${changed([id, e])}`)
        .join("\n"),
      short: others.map(([id, e]) => `${e.data.title} (\`${id}\`)`).join(" · "),
      drop: 150,
    });
  }

  // 6. The cast: who each character is as the writer must know them at this chapter, and how they speak.
  // A character that the plan only names can go when the brief is too long, after the lore it only names.
  const cast = [...listedCast, ...namedCast].flatMap((id) => project.characters.find((c) => c.data.id === id) ?? []);
  cast.forEach((c, i) => {
    const seen = lastSeen(project, c.data.id, book, chapter);
    sections.push({
      title: `Cast: ${c.data.name} (${c.data.role}; the prose never contradicts it)`,
      text: [characterText(project, index, c, book, chapter), seen ? `Last seen: ${seen}.` : ""].filter(Boolean).join("\n\n"),
      ...(namedCast.includes(c.data.id) ? { drop: 300 - i } : {}),
    });
  });
  // The other characters, one line each, so that the writer knows who the story already has. When the brief is
  // too long, the index keeps only the names and IDs.
  const offstage = project.characters.filter((c) => !cast.includes(c));
  if (offstage.length) {
    const line = (c: (typeof offstage)[number]) => {
      const e = characterEntry(c);
      const seen = lastSeen(project, c.data.id, book, chapter);
      const about = [firstSentence(e.body), seen ? `Last seen ${seen}.` : "", changesBefore(index, e, book, chapter).length ? "(changed since)" : ""].filter(Boolean).join(" ");
      return `- **${c.data.name}** (\`${c.data.id}\`, ${c.data.role}${c.data.aliases.length ? `; also ${c.data.aliases.join(", ")}` : ""})${about ? `: ${about}` : ""}`;
    };
    sections.push({
      title: `Cast index: the other characters (run \`lb who <id> --at ${book}.${pad2(chapter)}\` before the chapter uses one)`,
      text: offstage.map(line).join("\n"),
      short: offstage.map((c) => `${c.data.name} (\`${c.data.id}\`)`).join(" · "),
      drop: 160,
    });
  }

  // 7. The voice samples.
  for (const v of project.voiceSamples) sections.push({ title: `Voice sample: ${v.data.kind} (copy its voice; its lines, gestures, objects and events are its own)`, text: v.body.trim() });

  // 8. Rolling memory: the last 3 chapters in full, the summary of older ones.
  const earlier = [...project.memory.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([, ms]) => ms)
    .filter((m) => m.data.book < book || (m.data.book === book && m.data.chapter < chapter));
  const full = earlier.slice(-3);
  earlier.slice(0, -3).forEach((m, i) => {
    sections.push({ title: `Memory ${m.data.book}.${pad2(m.data.chapter)} (summary)`, text: m.data.summary, drop: i });
  });
  // The lore and character details of a memory file are in the lore entries and character files already.
  for (const m of full) {
    const { phrase_log: _, lore_added: _l, character_added: _c, ...rest } = m.data;
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

  // Keep the brief under the limit: drop the oldest summaries first, then the farthest next plans, then shorten
  // the lore index and the cast index, then shorten the lore entries and drop the characters that the plan only names.
  const render = (ss: Section[]) => `# Context brief: book ${book}, chapter ${chapter}\n\n${ss.map((s) => `## ${s.title}\n\n${s.text}`).join("\n\n")}\n`;
  const limit = project.config.brief_chars;
  const kept = [...sections];
  const dropped: string[] = [];
  const warnings: string[] = [];
  const droppable = sections.filter((s) => s.drop !== undefined).sort((a, b) => a.drop! - b.drop!);
  while (render(kept).length > limit && droppable.length) {
    const s = droppable.shift()!;
    if (s.short !== undefined) {
      s.text = s.short;
      dropped.push(`${s.title}: shortened`);
      if (s.lore) warnings.push(`the plan names lore entry \`${s.lore}\`, and the brief has only its first sentence`);
      continue;
    }
    kept.splice(kept.indexOf(s), 1);
    dropped.push(s.title);
  }
  const out = render(kept);
  const file = briefPath(book, chapter);
  mkdirSync(dirname(join(root, file)), { recursive: true });
  writeFileSync(join(root, file), out);
  return { file, chars: out.length, dropped, warnings, over: out.length > limit };
}

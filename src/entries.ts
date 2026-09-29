/**
 * Named entries: the lore entries and the character files. The brief, `lb lore`, `lb who` and the validator find
 * an entry by the same names: its ID (with spaces for '-'), its title or name, its aliases and, for a character,
 * each capitalized part of its name. Each entry has a body and changes, each from a point or plan anchor.
 */
import { stringify } from "yaml";
import { comparePos, type PlanIndex } from "./anchors.ts";
import { type Loaded, pad2, type Project } from "./project.ts";
import type { Character, LoreEntry, Relationship } from "./schemas.ts";

export interface NamedEntry {
  id: string;
  file: string;
  /** The title of a lore entry, or the name of a character. */
  title: string;
  aliases: string[];
  changes: { from: string; text: string }[];
  body: string;
  /** Capitalized parts of a character's name ("Sabine", "Rook"), matched only in that case. A lore entry has none. */
  parts: string[];
}

/** Capitalized words that are part of many names, so they find no one alone. */
const NAME_STOP = new Set(["The", "Of", "And", "Old", "Young", "Lady", "Lord", "Sir"]);

/** The capitalized parts of a name that can name its entity alone: "Sabine Rook" → Sabine, Rook. */
export function nameParts(name: string): string[] {
  return name.split(/\s+/).filter((w) => /^[A-Z][a-z]{2,}/.test(w) && !NAME_STOP.has(w));
}

export const loreEntry = (id: string, e: Loaded<LoreEntry>): NamedEntry => ({
  id,
  file: e.file,
  title: e.data.title,
  aliases: e.data.aliases,
  changes: e.data.changes,
  body: e.body,
  parts: [],
});

export const characterEntry = (c: Loaded<Character>): NamedEntry => ({
  id: c.data.id,
  file: c.file,
  title: c.data.name,
  aliases: c.data.aliases,
  changes: c.data.changes,
  body: c.body,
  parts: nameParts(c.data.name),
});

export const loreEntries = (project: Project): NamedEntry[] => [...project.lore].map(([id, e]) => loreEntry(id, e));
export const characterEntries = (project: Project): NamedEntry[] => project.characters.map(characterEntry);

/** A name without a leading article, in lower case: "The counting house" → "counting house". */
export function normalName(name: string): string {
  return name.trim().toLowerCase().replace(/^(the|a|an)\s+/, "");
}

/** The names of an entry, normalized and without repeats. One name belongs to one entry; the parts are not in it. */
export function entryNames(e: NamedEntry): string[] {
  return [...new Set([e.id.replace(/-/g, " "), e.title, ...e.aliases].map(normalName).filter(Boolean))];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A pattern for one name: whole words, and the singular or plural of the last word; any case, or only this case. */
function namePattern(name: string, anyCase = true): RegExp {
  const stem = name.length > 3 && /[^s]s$/.test(name) ? name.slice(0, -1) : name;
  const words = escape(stem).replace(/\s+/g, "[\\s-]+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${words}(?:s|es)?(?![\\p{L}\\p{N}])`, anyCase ? "iu" : "u");
}

/** The IDs of the entries that the text names, in the order of the entries. */
export function namedIn(entries: NamedEntry[], text: string): string[] {
  return entries
    .filter((e) => entryNames(e).some((n) => namePattern(n).test(text)) || e.parts.some((p) => namePattern(p, false).test(text)))
    .map((e) => e.id);
}

export const loreNamedIn = (project: Project, text: string) => namedIn(loreEntries(project), text);
export const charactersNamedIn = (project: Project, text: string) => namedIn(characterEntries(project), text);

/** The first sentence of an entry's body, for the indexes of the brief. */
export function firstSentence(body: string, max = 160): string {
  const para = body.trim().split(/\n\s*\n/)[0].replace(/\s+/g, " ");
  const s = /^.+?[.!?](?=\s|$)/.exec(para)?.[0] ?? para;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** The changes of an entry that are true at the start of a chapter: each one is in an earlier chapter or book. */
export function changesBefore(index: PlanIndex, entry: NamedEntry, book: number, chapter: number) {
  return entry.changes.flatMap((c) => {
    const r = index.resolve(c.from);
    if ("error" in r || comparePos(r.pos, [book, chapter, 0]) >= 0) return [];
    // The chapter as a point, and an anchor after it: "1.04 (b1/act2/end)".
    const point = r.chapter === undefined ? c.from : `${r.book}.${pad2(r.chapter)}`;
    return [{ ...c, label: point === c.from ? point : `${point} (${c.from})` }];
  });
}

/** An entry as the writer of a chapter must know it: the body, then each change so far. Later changes stay out. */
export function entryText(index: PlanIndex, entry: NamedEntry, book: number, chapter: number): string {
  const changes = changesBefore(index, entry, book, chapter);
  const body = entry.body.trim();
  if (!changes.length) return body;
  return `${body}\n\nChanges in the story so far (each one wins over what it contradicts above):\n${changes.map((c) => `- Since ${c.label}: ${c.text}`).join("\n")}`;
}

/**
 * The arc beats of a character up to this chapter: every beat of an earlier book, and each beat that a chapter plan of
 * this book places at or before this chapter. A later beat stays out, the same as a later change.
 */
export function beatsSoFar(project: Project, c: Loaded<Character>, book: number, chapter: number) {
  const placed = new Map<string, number>();
  for (const p of project.chapters.get(book) ?? []) for (const ref of p.data.arc_beats) placed.set(ref, p.data.chapter);
  return c.data.arc_beats.flatMap((b) => {
    if (b.book < book) return [{ ...b, now: false }];
    const at = placed.get(`${c.data.id}/${b.id}`);
    return b.book === book && at !== undefined && at <= chapter ? [{ ...b, now: at === chapter }] : [];
  });
}

/**
 * A character as the writer of a chapter must know them: who they are, the arc so far, the voice card, then each
 * change so far. A change comes last because it wins over the text above it, the voice card included.
 */
export function characterText(project: Project, index: PlanIndex, c: Loaded<Character>, book: number, chapter: number): string {
  const d = c.data;
  const beats = beatsSoFar(project, c, book, chapter);
  const inner = [
    d.want && `- **Wants** (chases on the page): ${d.want}`,
    d.need && `- **Needs** (what would fix them): ${d.need}`,
    d.lie && `- **Believes** (the lie): ${d.lie}`,
    d.wound && `- **Wound** (the prose never tells it; it shows in what they avoid): ${d.wound}`,
    d.contradiction && `- **Contradiction** (show it when a scene allows): ${d.contradiction}`,
  ].filter(Boolean);
  const changes = changesBefore(index, characterEntry(c), book, chapter);
  return [
    c.body.trim(),
    inner.join("\n"),
    beats.length ? `Arc beats so far:\n${beats.map((b) => `- ${b.now ? "**This chapter**" : `Book ${b.book}, ${b.act}`}: ${b.beat}`).join("\n")}` : "",
    `Voice card:\n\n\`\`\`yaml\n${stringify(d.voice, { lineWidth: 0 }).trimEnd()}\n\`\`\``,
    changes.length
      ? `Changes in the story so far (each one wins over what it contradicts above, the voice card included):\n${changes.map((ch) => `- Since ${ch.label}: ${ch.text}`).join("\n")}`
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The relationships between two characters of a cast, in ID order. */
export function relationshipsOf(project: Project, cast: string[]): [string, Loaded<Relationship>][] {
  return [...project.relationships].filter(([, r]) => r.data.between.every((id) => cast.includes(id)));
}

/**
 * The stages of a relationship up to this chapter, in story order: every stage of an earlier book, and each stage that a
 * chapter plan of this book places at or before this chapter. A later stage stays out, the same as a later arc beat.
 */
export function stagesSoFar(project: Project, id: string, r: Loaded<Relationship>, book: number, chapter: number) {
  const placed = new Map<string, number>();
  for (const p of project.chapters.get(book) ?? []) for (const ref of p.data.stages) placed.set(ref, p.data.chapter);
  return r.data.stages
    .flatMap((s) => {
      if (s.book < book) return [{ ...s, at: 0, now: false }];
      const at = placed.get(`${id}/${s.id}`);
      return s.book === book && at !== undefined && at <= chapter ? [{ ...s, at, now: at === chapter }] : [];
    })
    .sort((a, b) => a.book - b.book || a.at - b.at);
}

/** A relationship as the writer of a chapter must know it: what each wants and hides, how they talk, and where they stand now. */
export function relationshipText(project: Project, id: string, r: Loaded<Relationship>, book: number, chapter: number): string {
  const d = r.data;
  const name = (c: string) => project.characters.find((x) => x.data.id === c)?.data.name ?? c;
  const [a, b] = d.between;
  const other = (c: string) => (c === a ? b : a);
  const stages = stagesSoFar(project, id, r, book, chapter);
  const before = stages.filter((s) => !s.now).at(-1);
  const lines = [
    ...Object.entries(d.wants).map(([c, w]) => `- **${name(c)} wants from ${name(other(c))}**: ${w}`),
    `- **Friction**: ${d.friction}`,
    ...Object.entries(d.hides).map(([c, h]) => `- **${name(c)} hides from ${name(other(c))}** (show it only in what they avoid): ${h}`),
    `- **How they talk together**: ${d.talk}`,
    d.never_says.length ? `- **They never say to each other**: ${d.never_says.join("; ")}` : "",
    d.obstacle ? `- **Obstacle** (why they are not together now): ${d.obstacle}` : "",
    d.on_page ? `- **On the page** (how much the prose shows; never more): ${d.on_page}` : "",
  ].filter(Boolean);
  return [
    `Between ${name(a)} and ${name(b)}${d.romance ? " (a romance)" : ""}. ${r.body.trim()}`.trim(),
    lines.join("\n"),
    stages.length ? `Stages so far:\n${stages.map((s) => `- ${s.now ? "**This chapter**" : `Book ${s.book}, ${s.act}`} (${s.shift}): ${s.beat} After it: ${s.state}`).join("\n")}` : "",
    `Where they stand at the start of this chapter: ${before ? before.state : "as the body above says; no stage has moved them yet."}`,
  ]
    .filter(Boolean)
    .join("\n\n");
}

/** The last chapter before this one whose rolling memory has the character in `appeared`, as a point like 1.04. */
export function lastSeen(project: Project, id: string, book: number, chapter: number): string | undefined {
  const seen = [...project.memory.values()]
    .flat()
    .filter((m) => (m.data.book < book || (m.data.book === book && m.data.chapter < chapter)) && m.data.appeared.includes(id))
    .sort((a, b) => a.data.book - b.data.book || a.data.chapter - b.data.chapter)
    .at(-1);
  return seen && `${seen.data.book}.${pad2(seen.data.chapter)}`;
}

/**
 * Named entries: the lore entries and the character files. The brief, `lb lore`, `lb who` and the validator find
 * an entry by the same names: its ID (with spaces for '-'), its title or name, its aliases and, for a character,
 * each capitalized part of its name. Each entry has a body and changes, each from a point or plan anchor.
 */
import { comparePos, type PlanIndex } from "./anchors.ts";
import { type Loaded, pad2, type Project } from "./project.ts";
import type { Character, LoreEntry } from "./schemas.ts";

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

/** The last chapter before this one whose rolling memory has the character in `appeared`, as a point like 1.04. */
export function lastSeen(project: Project, id: string, book: number, chapter: number): string | undefined {
  const seen = [...project.memory.values()]
    .flat()
    .filter((m) => (m.data.book < book || (m.data.book === book && m.data.chapter < chapter)) && m.data.appeared.includes(id))
    .sort((a, b) => a.data.book - b.data.book || a.data.chapter - b.data.chapter)
    .at(-1);
  return seen && `${seen.data.book}.${pad2(seen.data.chapter)}`;
}

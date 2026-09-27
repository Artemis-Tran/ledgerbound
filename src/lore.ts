/**
 * Lore entries by name. The brief, `lb lore` and the validator find an entry by the same names:
 * its ID (with spaces for '-'), its title and its aliases.
 */
import { comparePos, type PlanIndex } from "./anchors.ts";
import { type Loaded, pad2, type Project } from "./project.ts";
import type { LoreEntry } from "./schemas.ts";

/** A name without a leading article, in lower case: "The counting house" → "counting house". */
export function normalName(name: string): string {
  return name.trim().toLowerCase().replace(/^(the|a|an)\s+/, "");
}

/** The names of an entry, normalized and without repeats. */
export function loreNames(id: string, entry: Loaded<LoreEntry>): string[] {
  return [...new Set([id.replace(/-/g, " "), entry.data.title, ...entry.data.aliases].map(normalName).filter(Boolean))];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** A pattern for one name: any case, whole words, and the singular or plural of the last word. */
function namePattern(name: string): RegExp {
  const stem = name.length > 3 && /[^s]s$/.test(name) ? name.slice(0, -1) : name;
  const words = escape(stem).replace(/\s+/g, "[\\s-]+");
  return new RegExp(`(?<![\\p{L}\\p{N}])${words}(?:s|es)?(?![\\p{L}\\p{N}])`, "iu");
}

/** The IDs of the entries that the text names, in ID order. */
export function loreNamedIn(project: Project, text: string): string[] {
  return [...project.lore].filter(([id, e]) => loreNames(id, e).some((n) => namePattern(n).test(text))).map(([id]) => id);
}

/** The first sentence of an entry's body, for the lore index of the brief. */
export function firstSentence(body: string, max = 160): string {
  const para = body.trim().split(/\n\s*\n/)[0].replace(/\s+/g, " ");
  const s = /^.+?[.!?](?=\s|$)/.exec(para)?.[0] ?? para;
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

/** The changes of an entry that are true at the start of a chapter: each one is in an earlier chapter or book. */
export function changesBefore(index: PlanIndex, entry: Loaded<LoreEntry>, book: number, chapter: number) {
  return entry.data.changes.flatMap((c) => {
    const r = index.resolve(c.from);
    if ("error" in r || comparePos(r.pos, [book, chapter, 0]) >= 0) return [];
    // The chapter as a point, and an anchor after it: "1.04 (b1/act2/end)".
    const point = r.chapter === undefined ? c.from : `${r.book}.${pad2(r.chapter)}`;
    return [{ ...c, label: point === c.from ? point : `${point} (${c.from})` }];
  });
}

/** An entry as the writer of a chapter must know it: the body, then each change so far. Later changes stay out. */
export function loreText(index: PlanIndex, entry: Loaded<LoreEntry>, book: number, chapter: number): string {
  const changes = changesBefore(index, entry, book, chapter);
  const body = entry.body.trim();
  if (!changes.length) return body;
  return `${body}\n\nChanges in the story so far (each one wins over what it contradicts above):\n${changes.map((c) => `- Since ${c.label}: ${c.text}`).join("\n")}`;
}

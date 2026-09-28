/**
 * Claims: what the prose says about the record, compared with the fold at the line of the claim.
 * The continuity-checker agent extracts the claims; this file only compares them.
 */
import { z } from "zod";
import { charactersNamedIn } from "./entries.ts";
import { fieldDef } from "./fields.ts";
import { splitFrontmatter } from "./frontmatter.ts";
import type { Project } from "./project.ts";
import { type DeltaCheck, findQuotes, stateAtLine } from "./record.ts";

export const Claim = z.strictObject({
  line: z.number().int().min(1),
  quote: z.string().min(1),
  /** An entity ID, or `timeline`. */
  entity: z.string().min(1),
  /** A schema field, `location`, `belief.<fact>`, or for the timeline `day` or `time`. */
  field: z.string().min(1),
  /** For a collection: an item ID (the entity has it), or `{has: [...]}` / `{lacks: [...]}`. */
  value: z.unknown(),
});
export const Claims = z.array(Claim);
export type Claim = z.infer<typeof Claim>;

export interface ClaimResult extends Claim {
  /**
   * `ok`; `mismatch` (an error); `compare` (text that differs in words: the agent decides if it is the same);
   * `missing` (an error: the record has no value, so the delta needs a `set` entry); `unknown` (no such entity or field).
   */
  verdict: "ok" | "mismatch" | "compare" | "missing" | "unknown";
  severity?: "error" | "warn";
  /** The value in the fold at that line. */
  record?: unknown;
  /** The claim's line in the claims file, when its quote is now on another line (a revision moved it). */
  moved_from?: number;
  /** False when the quote is not in the chapter: the span changed, so the claim must be taken again from the prose. */
  quote_found: boolean;
}

const norm = (s: string) => s.toLowerCase().replace(/^(the|a|an) /, "").replace(/\s+/g, " ").trim();

/**
 * Compares each claim with the fold at its line. With the chapter text, a claim is first moved to the line
 * where its quote is now, so a claims file stays usable after a revision.
 */
export function compareClaims(project: Project, check: DeltaCheck, claims: Claim[], chapterText?: string): ClaimResult[] {
  const found = chapterText === undefined ? undefined : findQuotes(chapterText, claims.map((c) => ({ quote: c.quote, near: c.line })));
  return claims.map((claim, i): ClaimResult => {
    const at = found?.[i];
    const c = { ...claim, line: at ?? claim.line, ...(at !== undefined && at !== claim.line ? { moved_from: claim.line } : {}), quote_found: !found || at !== undefined };
    const state = stateAtLine(project, check, c.line);
    const text = (record: unknown): ClaimResult =>
      record === null && c.value !== null
        ? { ...c, verdict: "missing", severity: "error", record }
        : typeof c.value === "string" && typeof record === "string" && norm(c.value) === norm(record)
          ? { ...c, verdict: "ok", record }
          : { ...c, verdict: "compare", severity: "warn", record };
    const exact = (record: unknown): ClaimResult =>
      JSON.stringify(c.value) === JSON.stringify(record) ? { ...c, verdict: "ok", record } : { ...c, verdict: "mismatch", severity: "error", record };
    const unknown = (): ClaimResult => ({ ...c, verdict: "unknown", severity: "error" });

    if (c.entity === "timeline") {
      if (c.field === "day") return exact(state.day ?? null);
      if (c.field === "time") return text(state.time ?? null);
      return unknown();
    }
    const e = state.entities[c.entity];
    if (!e) return unknown();
    if (c.field.startsWith("belief.")) return exact(e.beliefs[c.field.slice(7)] ?? "unaware");
    const type = project.schema?.data.types[e.type];
    const def = type && fieldDef(type, c.field);
    if (!def) return unknown();
    const record = e.fields[c.field] ?? null;
    switch (def.kind) {
      case "counter":
      case "ladder":
        return exact(record);
      case "collection": {
        const items = Array.isArray(record) ? (record as string[]) : [];
        const v = c.value as { has?: string[]; lacks?: string[] } | string;
        const has = typeof v === "string" ? [v] : (v?.has ?? []);
        const lacks = typeof v === "string" ? [] : (v?.lacks ?? []);
        const ok = has.every((i) => items.includes(i)) && lacks.every((i) => !items.includes(i));
        return ok ? { ...c, verdict: "ok", record } : { ...c, verdict: "mismatch", severity: "error", record };
      }
      case "text":
      case "location":
        return text(record);
    }
  });
}

/**
 * The characters that the chapter names, that have no location in the record at the chapter end, and that
 * no claim places. Each one who is on the page needs a location claim (and so a delta entry).
 */
export function unplaced(project: Project, check: DeltaCheck, claims: Claim[], chapterText: string): { entity: string; name: string }[] {
  const placed = new Set(claims.filter((c) => c.field === "location").map((c) => c.entity));
  return charactersNamedIn(project, splitFrontmatter(chapterText).body).flatMap((id) => {
    const e = check.after.entities[id];
    if (!e || placed.has(id) || (e.fields.location ?? null) !== null) return [];
    return [{ entity: id, name: e.name }];
  });
}

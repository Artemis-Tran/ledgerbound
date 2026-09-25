/**
 * Claims: what the prose says about the record, compared with the fold at the line of the claim.
 * The continuity-checker agent extracts the claims; this file only compares them.
 */
import { z } from "zod";
import { fieldDef } from "./fields.ts";
import type { Project } from "./project.ts";
import { type DeltaCheck, stateAtLine } from "./record.ts";

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
  /** `ok`; `mismatch` (an error); `compare` (text that differs in words: the agent decides if it is the same); `unknown` (no such entity or field). */
  verdict: "ok" | "mismatch" | "compare" | "unknown";
  severity?: "error" | "warn";
  /** The value in the fold at that line. */
  record?: unknown;
}

const norm = (s: string) => s.toLowerCase().replace(/^(the|a|an) /, "").replace(/\s+/g, " ").trim();

export function compareClaims(project: Project, check: DeltaCheck, claims: Claim[]): ClaimResult[] {
  return claims.map((c): ClaimResult => {
    const state = stateAtLine(project, check, c.line);
    const text = (record: unknown): ClaimResult =>
      typeof c.value === "string" && typeof record === "string" && norm(c.value) === norm(record)
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

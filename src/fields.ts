/**
 * Schema fields: what kind a field is, and whether a value fits it.
 * The validator (targets, start values) and the fold both use these.
 */
import type { FieldDef } from "./schemas.ts";

export type Kind = FieldDef | { kind: "location" };

export function fieldDef(type: { kind: string; fields: Record<string, FieldDef> }, field: string): Kind | undefined {
  if (field === "location" && type.kind === "character") return { kind: "location" };
  return type.fields[field];
}

/** Returns a problem, or undefined when the value fits the field. */
export function checkValue(def: Kind, v: unknown): string | undefined {
  const isRange = (x: unknown): x is { min?: unknown; max?: unknown } =>
    typeof x === "object" && x !== null && !Array.isArray(x) && Object.keys(x).every((k) => k === "min" || k === "max") && Object.keys(x).length > 0;
  switch (def.kind) {
    case "counter": {
      const nums = typeof v === "number" ? [v] : isRange(v) ? [v.min, v.max].filter((x) => x !== undefined) : undefined;
      if (!nums || nums.some((n) => typeof n !== "number")) return "a counter value is a number or {min, max}";
      if (nums.some((n) => (def.min !== undefined && (n as number) < def.min) || (def.max !== undefined && (n as number) > def.max))) {
        return `outside the counter bounds [${def.min ?? "-∞"}, ${def.max ?? "∞"}]`;
      }
      return undefined;
    }
    case "ladder": {
      const steps = typeof v === "string" ? [v] : isRange(v) ? [v.min, v.max].filter((x) => x !== undefined) : undefined;
      if (!steps) return "a ladder value is a step or {min, max}";
      const bad = steps.find((s) => !def.steps.includes(s as string));
      return bad === undefined ? undefined : `'${String(bad)}' is not a step of the ladder (${def.steps.join(", ")})`;
    }
    case "collection": {
      if (Array.isArray(v) && v.every((x) => typeof x === "string")) return undefined;
      if (typeof v === "object" && v !== null && Object.keys(v).every((k) => k === "has" || k === "lacks")) {
        const o = v as { has?: unknown; lacks?: unknown };
        if ([o.has, o.lacks].every((l) => l === undefined || (Array.isArray(l) && l.every((x) => typeof x === "string")))) return undefined;
      }
      return "a collection value is a list, or {has: [...], lacks: [...]}";
    }
    case "text":
    case "location":
      return typeof v === "string" ? undefined : "the value must be text";
  }
}

/** The numeric range that a counter or ladder value allows. */
export function numericRange(def: Kind, v: unknown): [number, number] | undefined {
  const toNum = (x: unknown) => (def.kind === "ladder" ? def.steps.indexOf(x as string) : (x as number));
  if (def.kind !== "counter" && def.kind !== "ladder") return undefined;
  if (typeof v === "number" || typeof v === "string") return [toNum(v), toNum(v)];
  const r = v as { min?: unknown; max?: unknown };
  return [r.min === undefined ? -Infinity : toNum(r.min), r.max === undefined ? Infinity : toNum(r.max)];
}

/**
 * The file formats of a novel repo. These zod schemas are the source of truth;
 * reference/formats.md shows them with examples.
 */
import { z } from "zod";

export const Slug = z.string().regex(/^[a-z0-9][a-z0-9-]*$/, "use lower-case letters, digits and '-'");
const Text = z.string().trim().min(1, "must not be empty");
const TextList = z.array(Text).default([]);

export const Status = z.enum(["draft", "approved"]).default("draft");

export const CHECKPOINTS = [
  "bible",
  "series-plan",
  "book-plan",
  "character-arcs",
  "chapter-plans",
  "voice-sample",
  "chapter-1",
  "replan",
] as const;
export type Checkpoint = (typeof CHECKPOINTS)[number];

export const ENDING_TYPES = ["action", "dialogue", "reveal", "decision", "image", "cliffhanger", "quiet-cut"] as const;

/** A position in the plan: a point (`1.07` = book 1, chapter 7) or a plan anchor (`b1/act1/end`). */
export const PointRe = /^(\d+)\.(\d+)$/;
export const AnchorRe = /^(series\/end|b\d+\/[a-z0-9-]+(\/end)?)$/;
export const PosRef = z
  .union([z.string(), z.number()])
  .transform((v) => (typeof v === "number" ? v.toFixed(2) : v))
  .refine((v) => PointRe.test(v) || AnchorRe.test(v), "must be a point like 1.07 or a plan anchor like b1/act1/end");

// ---------- project.yaml ----------

const OnOff = z.union([z.boolean(), z.enum(["on", "off"])]).transform((v) => v === true || v === "on");

export const ProjectConfig = z.strictObject({
  title: Text,
  format: z.enum(["series", "standalone"]).default("series"),
  chapter_words: z.number().int().positive().default(3000),
  mode: z.enum(["normal", "just-write-it"]).default("normal"),
  checkpoints: z.partialRecord(z.enum(CHECKPOINTS), OnOff).default({}),
  lint: z
    .strictObject({
      banned_add: z.array(Text).default([]),
      banned_remove: z.array(Text).default([]),
      body_tells_add: z.record(Slug, Text).default({}),
      max_em_dash_per_1000: z.number().positive().default(3),
    })
    .prefault({}),
});
export type ProjectConfig = z.infer<typeof ProjectConfig>;

// ---------- bible.md ----------

export const REQUIRED_DECISIONS = [
  "plot",
  "prose-style",
  "pov-tense",
  "characters",
  "setting",
  "stat-system",
  "themes",
  "tone",
] as const;

export const Decision = z.strictObject({
  id: Slug,
  topic: Text,
  value: Text,
  status: z.enum(["locked", "open"]),
  options_considered: TextList,
  reason: z.string().optional(),
});

export const Bible = z.strictObject({
  status: Status,
  title: Text,
  decisions: z.array(Decision).min(1),
  /** Set by the voice-sample skill from the status window of the approved voice samples. */
  window_template: z.string().optional(),
});
export type Bible = z.infer<typeof Bible>;

// ---------- schema.yaml ----------

export const FieldDef = z.discriminatedUnion("kind", [
  z.strictObject({
    kind: z.literal("counter"),
    min: z.number().optional(),
    max: z.number().optional(),
    /** Largest planned change per chapter. The validator uses it to check that targets are reachable. */
    max_step: z.number().positive().optional(),
    direction: z.enum(["up", "down", "any"]).default("any"),
  }),
  z.strictObject({ kind: z.literal("ladder"), steps: z.array(Text).min(2) }),
  z.strictObject({ kind: z.literal("collection") }),
  z.strictObject({ kind: z.literal("text") }),
]);
export type FieldDef = z.infer<typeof FieldDef>;

export const EntityType = z.strictObject({
  /** `character` entities also get the built-in `location` field and have beliefs about facts. */
  kind: z.enum(["character", "other"]).default("other"),
  fields: z.record(Slug.or(z.string().regex(/^[a-z][a-z0-9_]*$/)), FieldDef).default({}),
});

export const Entity = z.strictObject({
  type: Slug,
  name: Text,
  /** Values at the start of book 1. Phase 2 turns them into the first delta entries. */
  start: z.record(z.string(), z.unknown()).default({}),
});

export const Schema = z.strictObject({
  types: z.record(Slug, EntityType),
  entities: z.record(Slug, Entity).default({}),
});
export type Schema = z.infer<typeof Schema>;

// ---------- facts.yaml ----------

export const BELIEFS = ["knows", "believes-false", "unaware"] as const;
export const Fact = z.strictObject({ id: Slug, truth: Text });
export const Facts = z.array(Fact).nullable().transform((v) => v ?? []);

// ---------- targets.yaml ----------

const Range = z.strictObject({ min: z.number().optional(), max: z.number().optional() });

export const Target = z.strictObject({
  anchor: z.string().regex(AnchorRe, "must be a plan anchor like b1/act1/end"),
  note: z.string().optional(),
  /** Allows a ladder or counter to go against its direction here (a reset, a loss, a correction). */
  reset: z.boolean().default(false),
  /** `entity.field` → expected value. Checked against schema.yaml. */
  expect: z.record(z.string().regex(/^[a-z0-9-]+\.[a-z0-9_-]+$/, "use entity.field"), z.unknown()).default({}),
  /** character → fact → belief. */
  knowledge: z.record(Slug, z.record(Slug, z.enum(BELIEFS))).default({}),
  day: z.union([z.number(), Range]).optional(),
});
export const Targets = z.array(Target).nullable().transform((v) => v ?? []);
export type Target = z.infer<typeof Target>;

// ---------- threads.yaml ----------

export const Thread = z.strictObject({
  id: Slug,
  kind: z.enum(["setup", "mystery", "subplot", "promise", "relationship"]),
  summary: Text,
  plant: PosRef,
  beats: z.array(PosRef).default([]),
  payoff: PosRef,
});
export const Threads = z.array(Thread).nullable().transform((v) => v ?? []);
export type Thread = z.infer<typeof Thread>;

// ---------- series.md, books/NN/plan.md ----------

const Question = z.strictObject({ raises: TextList, answers: TextList });

const levelFields = {
  ending_state: Text,
  promise: Text,
  question: Question,
  handoff: TextList,
};

export const SeriesPlan = z.strictObject({
  status: Status,
  title: Text,
  books: z.number().int().min(1),
  ...levelFields,
});
export type SeriesPlan = z.infer<typeof SeriesPlan>;

export const Act = z.strictObject({ id: Slug, ...levelFields });

export const BookPlan = z.strictObject({
  status: Status,
  book: z.number().int().min(1),
  title: Text,
  ...levelFields,
  acts: z.array(Act).min(1),
  /** Custom plan anchors (`b1/<slug>`), each inside one act. */
  anchors: z.array(z.strictObject({ id: z.string().regex(AnchorRe), act: Slug, note: z.string().optional() })).default([]),
});
export type BookPlan = z.infer<typeof BookPlan>;

// ---------- characters/<id>.md ----------

export const ArcBeat = z.strictObject({ id: Slug, book: z.number().int().min(1), act: Slug, beat: Text });

export const Character = z
  .strictObject({
    status: Status,
    id: Slug,
    name: Text,
    role: z.enum(["protagonist", "main", "supporting"]),
    want: z.string().optional(),
    need: z.string().optional(),
    lie: z.string().optional(),
    voice: z.strictObject({
      vocabulary: Text,
      sentence_length: Text,
      verbal_habits: TextList,
      never_says: TextList,
    }),
    arc_beats: z.array(ArcBeat).default([]),
  })
  .superRefine((c, ctx) => {
    if (c.role === "supporting") return;
    for (const k of ["want", "need", "lie"] as const) {
      if (!c[k]?.trim()) ctx.addIssue({ code: "custom", path: [k], message: `a ${c.role} character needs '${k}'` });
    }
    if (c.arc_beats.length === 0) ctx.addIssue({ code: "custom", path: ["arc_beats"], message: `a ${c.role} character needs arc beats` });
  });
export type Character = z.infer<typeof Character>;

// ---------- books/NN/plan/MM.md ----------

export const Scene = z.strictObject({ goal: Text, conflict: Text, outcome: Text });

export const ChapterPlan = z.strictObject({
  status: Status,
  book: z.number().int().min(1),
  chapter: z.number().int().min(1),
  title: z.string().optional(),
  pov: Slug,
  job: z.strictObject({ value: Text, from: Text, to: Text }),
  /** `character-id/beat-id` */
  arc_beats: z.array(z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, "use character-id/beat-id")).default([]),
  threads: z
    .strictObject({ plants: z.array(Slug).default([]), advances: z.array(Slug).default([]), pays_off: z.array(Slug).default([]) })
    .prefault({}),
  ending: z.strictObject({ type: z.enum(ENDING_TYPES), hook: Text }),
  anchors: z.array(z.string().regex(AnchorRe)).default([]),
  exceptions: z.array(z.strictObject({ rule: Text, reason: Text })).default([]),
  day: z.number().optional(),
  scenes: z.array(Scene).min(1),
});
export type ChapterPlan = z.infer<typeof ChapterPlan>;

// ---------- voice/<kind>.md ----------

/** The three voice samples: one scene of each kind. */
export const VOICE_KINDS = ["dialogue", "action", "quiet"] as const;

export const VoiceSample = z
  .strictObject({
    status: Status,
    kind: z.enum(VOICE_KINDS),
    pov: Slug,
    characters: z.array(Slug).min(1),
    /** Where the scene comes from, for example "1.01, scene 2". */
    source: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.kind === "dialogue" && v.characters.length < 2) {
      ctx.addIssue({ code: "custom", path: ["characters"], message: "the dialogue sample needs the protagonist and one other main character" });
    }
  });
export type VoiceSample = z.infer<typeof VoiceSample>;

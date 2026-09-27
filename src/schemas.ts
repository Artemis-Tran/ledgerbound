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
  "world",
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

/**
 * How a lore entry or a character changes in the story, in story order. `from` is a point or a plan anchor: the change
 * is true after the chapter that holds it, so the brief of that chapter still has the old state.
 */
export const Changes = z.array(z.strictObject({ from: PosRef, text: Text })).default([]);

// ---------- project.yaml ----------

const OnOff = z.union([z.boolean(), z.enum(["on", "off"])]).transform((v) => v === true || v === "on");

export const ProjectConfig = z.strictObject({
  title: Text,
  format: z.enum(["series", "standalone"]).default("series"),
  chapter_words: z.number().int().positive().default(3000),
  /** `just-write-it`: every checkpoint off except `replan`. `autopilot`: every checkpoint off; the run does not stop, and logs its decisions in runs/autopilot.md. */
  mode: z.enum(["normal", "just-write-it", "autopilot"]).default("normal"),
  /** The size limit of a context brief, in characters. */
  brief_chars: z.number().int().positive().default(60000),
  /** Status windows in the prose. `off`: the prose shows progression, and the record still tracks it. */
  windows: OnOff.default(true),
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

export const DRAW_KINDS = ["gives", "excludes"] as const;

export const Draw = z.strictObject({
  id: Slug,
  kind: z.enum(DRAW_KINDS),
  text: Text,
  status: z.enum(["locked", "open"]),
});
export type Draw = z.infer<typeof Draw>;

export const Bible = z.strictObject({
  status: Status,
  title: Text,
  decisions: z.array(Decision).min(1),
  /** What a reader chooses the story for, and what it promises not to have. Missing in repos made before 0.5.0. */
  draws: z.array(Draw).min(3, "at least 3 draws").optional(),
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
  /** Values at the start of book 1: the state that the fold starts from. A character can also have `beliefs: {fact: belief}` here. */
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
  /** The IDs of the `gives` draws that this book delivers. */
  draws: z.array(Slug).default([]),
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
    /** Other names for the character (a nickname, a title). A chapter plan that uses one gets the character in its brief. */
    aliases: TextList,
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
    /** How the character changes in the story (a lost eye, a new post). The markdown body is who the character is. */
    changes: Changes,
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
  /** The target length of this chapter, in words. Default: `chapter_words` in project.yaml. */
  words: z.number().int().positive().optional(),
  pov: Slug,
  job: z.strictObject({ value: Text, from: Text, to: Text }),
  /** `character-id/beat-id` */
  arc_beats: z.array(z.string().regex(/^[a-z0-9-]+\/[a-z0-9-]+$/, "use character-id/beat-id")).default([]),
  threads: z
    .strictObject({ plants: z.array(Slug).default([]), advances: z.array(Slug).default([]), pays_off: z.array(Slug).default([]) })
    .prefault({}),
  ending: z.strictObject({ type: z.enum(ENDING_TYPES), hook: Text }),
  anchors: z.array(z.string().regex(AnchorRe)).default([]),
  /** Lore entry IDs (`lore/<id>.md`) that the brief must include, beyond the ones the plan names by title or alias. */
  lore: z.array(Slug).default([]),
  /** The characters with a part in a scene of this chapter. The brief includes each one, beyond the ones the plan names. */
  characters: z.array(Slug).default([]),
  exceptions: z.array(z.strictObject({ rule: Text, reason: Text })).default([]),
  day: z.number().optional(),
  scenes: z.array(Scene).min(1),
});
export type ChapterPlan = z.infer<typeof ChapterPlan>;

// ---------- lore/<id>.md ----------

/** The areas of the world that plan-world covers. `system` is how the System works in the world (who sees it, what people believe about it), not the numbers: those are in schema.yaml. */
export const LORE_CATEGORIES = ["place", "faction", "history", "custom", "law", "creature", "system", "other"] as const;

/** One lore entry: setting knowledge that the chapter writer needs when a chapter touches it. The markdown body is the entry. */
export const LoreEntry = z.strictObject({
  status: Status,
  title: Text,
  category: z.enum(LORE_CATEGORIES),
  /** Other names for the same thing. A chapter plan that uses one of them gets the entry in its brief. */
  aliases: TextList,
  /** In every brief, not only when a chapter plan names it. For short rules that hold everywhere. */
  always: z.boolean().default(false),
  /** How the thing changes in the story (a law ends, a place burns). */
  changes: Changes,
});
export type LoreEntry = z.infer<typeof LoreEntry>;

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

// ---------- ledger.jsonl, books/NN/deltas/MM.jsonl ----------

/** A point with the entry order: `1.07.3` = book 1, chapter 7, entry 3. `1.07.0` is the start of the chapter. */
export const EntryPointRe = /^(\d+)\.(\d+)\.(\d+)$/;

export const DELTA_OPS = ["add", "remove", "set", "create"] as const;

/**
 * One delta entry: one change to one field of one entity. In a staged delta the point is optional
 * (the order of the lines gives it); in the ledger it is required.
 */
export const DeltaEntry = z
  .strictObject({
    point: z.string().regex(EntryPointRe, "must look like 1.07.3").optional(),
    /** An entity ID from schema.yaml, an ID made by an earlier `create`, or `timeline`. */
    entity: Slug,
    /** A schema field, `location`, `belief.<fact>`, or for the timeline `day` or `time`. Absent for `create`. */
    field: z.string().regex(/^[a-z][a-z0-9_]*(\.[a-z0-9-]+)?$/).optional(),
    op: z.enum(DELTA_OPS),
    value: z.unknown(),
    /** For `create`: the entity type and name. `value` holds the start values. */
    type: Slug.optional(),
    name: Text.optional(),
    /** What in the story made the change, in one short sentence. */
    cause: Text,
    /** The exact words of the prose (at most 15) where the change occurs. Added after the prose is written. */
    quote: z.string().trim().min(1).optional(),
  })
  .superRefine((e, ctx) => {
    if (e.op === "create") {
      if (!e.type) ctx.addIssue({ code: "custom", path: ["type"], message: "a create entry needs 'type'" });
      if (!e.name) ctx.addIssue({ code: "custom", path: ["name"], message: "a create entry needs 'name'" });
      if (e.field) ctx.addIssue({ code: "custom", path: ["field"], message: "a create entry has no 'field'" });
    } else if (!e.field) ctx.addIssue({ code: "custom", path: ["field"], message: `an '${e.op}' entry needs 'field'` });
    if (e.quote && e.quote.split(/\s+/).length > 15) ctx.addIssue({ code: "custom", path: ["quote"], message: "a quote has at most 15 words" });
  });
export type DeltaEntry = z.infer<typeof DeltaEntry>;

// ---------- books/NN/chapters/MM.md ----------

export const Chapter = z.strictObject({
  /** `approved` only through `lb commit` or `lb approve chapter-1`, which also commit the delta. */
  status: Status,
  book: z.number().int().min(1),
  chapter: z.number().int().min(1),
  title: z.string().optional(),
});
export type Chapter = z.infer<typeof Chapter>;

// ---------- books/NN/publish.yaml and books/NN/pages/<id>.md ----------

/** Front and back pages that `lb export` makes itself; every other page ID is a file in books/NN/pages/. */
export const BUILT_IN_PAGES = ["title-page", "contents"] as const;

/** The publish file of one book: the metadata of its export, and the order of its front and back pages. */
export const Publish = z.strictObject({
  /** Default: the title of the book plan. */
  title: Text.optional(),
  subtitle: Text.optional(),
  /** The name on the cover: the author or the pen name. */
  author: Text,
  language: z.string().regex(/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/, "use a language tag like en or en-GB").default("en"),
  /** ISBN-10 or ISBN-13, hyphens allowed. Without it, the export gets a stable urn:uuid. */
  isbn: z.string().optional(),
  publisher: Text.optional(),
  /** The publication date, YYYY-MM-DD. Quote it in YAML. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD").optional(),
  /** The blurb: the store description. */
  description: Text.optional(),
  keywords: TextList,
  /** `number` default: the book number. */
  series: z.strictObject({ name: Text, number: z.number().int().min(1).optional() }).optional(),
  /** A JPEG or PNG, relative to the novel repo root. */
  cover: z.string().regex(/\.(jpe?g|png)$/i, "the cover is a .jpg, .jpeg or .png file").optional(),
  /** Page IDs in reading order: `title-page`, `contents`, or a file books/NN/pages/<id>.md. */
  front: z.array(Slug).default(["title-page", "copyright", "contents"]),
  back: z.array(Slug).default([]),
});
export type Publish = z.infer<typeof Publish>;

export const Page = z.strictObject({
  /** The heading of the page, and its line in the contents. A page with no title is not in the contents. */
  title: Text.optional(),
});
export type Page = z.infer<typeof Page>;

// ---------- books/NN/memory/MM.md ----------

export const RollingMemory = z.strictObject({
  book: z.number().int().min(1),
  chapter: z.number().int().min(1),
  /** 3-5 sentences, facts only. */
  summary: Text,
  changed: TextList,
  open_questions: TextList,
  ending_type: z.enum(ENDING_TYPES),
  /**
   * Setting details that this chapter adds and no lore entry had. The memory writer also writes each one into its entry.
   * `change`: the chapter changes the world (a law ends, a place burns), and the fact is a change of the entry from this chapter.
   */
  lore_added: z.array(z.strictObject({ entry: Slug, fact: Text, change: z.boolean().default(false) })).default([]),
  /** The characters on the page in this chapter: for "last seen" in later briefs. */
  appeared: z.array(Slug).default([]),
  /** Details about a character that this chapter adds, the same as `lore_added`. Each one is also in `characters/<character>.md`. */
  character_added: z.array(z.strictObject({ character: Slug, fact: Text, change: z.boolean().default(false) })).default([]),
  phrase_log: z
    .strictObject({
      similes: TextList,
      images: TextList,
      /** character ID → gestures */
      gestures: z.record(Slug, TextList).default({}),
    })
    .prefault({}),
});
export type RollingMemory = z.infer<typeof RollingMemory>;

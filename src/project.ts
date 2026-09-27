import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { parse as parseYaml } from "yaml";
import type { z } from "zod";
import { splitFrontmatter } from "./frontmatter.ts";
import type { Issue } from "./issues.ts";
import {
  Bible,
  BookPlan,
  Chapter,
  ChapterPlan,
  Character,
  Page,
  Publish,
  Facts,
  LoreEntry,
  ProjectConfig,
  RollingMemory,
  Schema,
  SeriesPlan,
  Targets,
  Threads,
  VoiceSample,
} from "./schemas.ts";

export interface Loaded<T> {
  file: string;
  data: T;
  body: string;
}

/** Everything the validator reads from a novel repo. Files that are missing or invalid are absent here. */
export interface Project {
  root: string;
  config: ProjectConfig;
  bible?: Loaded<Bible>;
  schema?: Loaded<Schema>;
  facts: Loaded<z.infer<typeof Facts>>;
  targets: Loaded<z.infer<typeof Targets>>;
  threads: Loaded<z.infer<typeof Threads>>;
  series?: Loaded<SeriesPlan>;
  /** book number → book-level plan */
  books: Map<number, Loaded<BookPlan>>;
  /** book number → chapter plans, sorted by chapter */
  chapters: Map<number, Loaded<ChapterPlan>[]>;
  characters: Loaded<Character>[];
  /** lore/<id>.md: entry ID → entry, sorted by ID. */
  lore: Map<string, Loaded<LoreEntry>>;
  /** voice/*.md, one per kind. */
  voiceSamples: Loaded<VoiceSample>[];
  /** book number → chapter prose files (books/NN/chapters/MM.md), sorted by chapter */
  prose: Map<number, Loaded<Chapter>[]>;
  /** book number → rolling memory files (books/NN/memory/MM.md), sorted by chapter */
  memory: Map<number, Loaded<RollingMemory>[]>;
  /** book number → books/NN/publish.yaml */
  publish: Map<number, Loaded<Publish>>;
  /** book number → page ID → books/NN/pages/<id>.md */
  pages: Map<number, Map<string, Loaded<Page>>>;
}

export const pad2 = (n: number) => String(n).padStart(2, "0");
export const bookDir = (book: number) => `books/${pad2(book)}`;

export function loadProject(root: string): { project?: Project; issues: Issue[] } {
  const issues: Issue[] = [];
  const rel = (p: string) => relative(root, p);

  function parseWith<S extends z.ZodType>(schema: S, file: string, raw: unknown, body = ""): Loaded<z.infer<S>> | undefined {
    const r = schema.safeParse(raw);
    if (r.success) return { file, data: r.data, body };
    for (const e of r.error.issues) {
      issues.push({ code: "format", severity: "error", file, path: e.path.join(".") || undefined, message: e.message });
    }
    return undefined;
  }

  function readYaml<S extends z.ZodType>(schema: S, name: string): Loaded<z.infer<S>> | undefined {
    const p = join(root, name);
    if (!existsSync(p)) return undefined;
    try {
      return parseWith(schema, name, parseYaml(readFileSync(p, "utf8")));
    } catch (e) {
      issues.push({ code: "yaml", severity: "error", file: name, message: (e as Error).message });
      return undefined;
    }
  }

  function readMd<S extends z.ZodType>(schema: S, path: string): Loaded<z.infer<S>> | undefined {
    const name = rel(path);
    try {
      const fm = splitFrontmatter(readFileSync(path, "utf8"));
      if (fm.data === undefined) {
        issues.push({ code: "frontmatter", severity: "error", file: name, message: "the file has no YAML frontmatter" });
        return undefined;
      }
      return parseWith(schema, name, fm.data, fm.body);
    } catch (e) {
      issues.push({ code: "yaml", severity: "error", file: name, message: (e as Error).message });
      return undefined;
    }
  }

  const mdFiles = (dir: string) =>
    existsSync(join(root, dir))
      ? readdirSync(join(root, dir))
          .filter((f) => f.endsWith(".md"))
          .sort()
          .map((f) => join(root, dir, f))
      : [];

  const config = readYaml(ProjectConfig, "project.yaml");
  if (!config) {
    if (!existsSync(join(root, "project.yaml"))) {
      issues.push({ code: "missing", severity: "error", file: "project.yaml", message: "not a novel repo: project.yaml is missing (run `lb init`)" });
    }
    return { issues };
  }

  const opt = <S extends z.ZodType>(schema: S, name: string) =>
    existsSync(join(root, name)) ? readMd(schema, join(root, name)) : undefined;

  const empty = <T>(file: string, data: T): Loaded<T> => ({ file, data, body: "" });

  const project: Project = {
    root,
    config: config.data,
    bible: opt(Bible, "bible.md"),
    schema: readYaml(Schema, "schema.yaml"),
    facts: readYaml(Facts, "facts.yaml") ?? empty("facts.yaml", []),
    targets: readYaml(Targets, "targets.yaml") ?? empty("targets.yaml", []),
    threads: readYaml(Threads, "threads.yaml") ?? empty("threads.yaml", []),
    series: opt(SeriesPlan, "series.md"),
    books: new Map(),
    chapters: new Map(),
    characters: mdFiles("characters").flatMap((p) => readMd(Character, p) ?? []),
    lore: new Map(mdFiles("lore").flatMap((p) => {
      const entry = readMd(LoreEntry, p);
      return entry ? [[/([^/]+)\.md$/.exec(p)![1], entry] as const] : [];
    })),
    voiceSamples: mdFiles("voice").flatMap((p) => readMd(VoiceSample, p) ?? []),
    prose: new Map(),
    memory: new Map(),
    publish: new Map(),
    pages: new Map(),
  };

  /** Files whose name is the chapter number: the frontmatter must agree with the path. */
  function perChapter<T extends { book: number; chapter: number }>(schema: z.ZodType<T>, book: number, dir: string, into: Map<number, Loaded<T>[]>) {
    const files = mdFiles(dir).flatMap((p) => readMd(schema, p) ?? []);
    for (const c of files) {
      const fileNum = Number(/(\d+)\.md$/.exec(c.file)?.[1]);
      if (c.data.chapter !== fileNum || c.data.book !== book) {
        issues.push({ code: "file-name", severity: "error", file: c.file, message: `frontmatter says book ${c.data.book} chapter ${c.data.chapter}, but the file is ${c.file}` });
      }
    }
    if (files.length > 0) into.set(book, files.sort((a, b) => a.data.chapter - b.data.chapter));
    return files;
  }

  const booksRoot = join(root, "books");
  const bookDirs = existsSync(booksRoot) ? readdirSync(booksRoot).filter((d) => /^\d+$/.test(d)).sort() : [];
  for (const d of bookDirs) {
    const n = Number(d);
    const planPath = join(booksRoot, d, "plan.md");
    if (existsSync(planPath)) {
      const plan = readMd(BookPlan, planPath);
      if (plan) {
        if (plan.data.book !== n) {
          issues.push({ code: "file-name", severity: "error", file: plan.file, path: "book", message: `book is ${plan.data.book}, but the folder is books/${d}` });
        }
        project.books.set(n, plan);
      }
    }
    perChapter(ChapterPlan, n, join("books", d, "plan"), project.chapters);
    perChapter(Chapter, n, join("books", d, "chapters"), project.prose);
    perChapter(RollingMemory, n, join("books", d, "memory"), project.memory);
    const publish = readYaml(Publish, join("books", d, "publish.yaml"));
    if (publish) project.publish.set(n, publish);
    // A page can have no frontmatter: a dedication often has no title.
    const pages = mdFiles(join("books", d, "pages")).flatMap((p) => {
      const text = readFileSync(p, "utf8");
      const page = /^---\r?\n/.test(text) ? readMd(Page, p) : parseWith(Page, rel(p), {}, text);
      return page ? [[/([^/]+)\.md$/.exec(p)![1], page] as const] : [];
    });
    if (pages.length > 0) project.pages.set(n, new Map(pages));
  }

  return { project, issues };
}

/**
 * `lb export`: one book as an EPUB 3 file, with an EPUB 2 table of contents (toc.ncx) for older readers.
 * The book's publish file gives the metadata and the order of the front and back pages.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { extname, join } from "node:path";
import type { Issue } from "../issues.ts";
import { parseProse } from "../lint/text.ts";
import { bookDir, pad2, type Project } from "../project.ts";
import { readVerify } from "../run.ts";
import { BUILT_IN_PAGES } from "../schemas.ts";
import { escapeAttr, escapeXml, inline, toXhtml } from "./markdown.ts";
import { writeZip, type ZipEntry } from "./zip.ts";

export const publishPath = (book: number) => `${bookDir(book)}/publish.yaml`;
export const pagePath = (book: number, id: string) => `${bookDir(book)}/pages/${id}.md`;

export interface ExportOptions {
  /** Export the chapters that exist, in any status. */
  draft?: boolean;
  /** For dcterms:modified. Default: SOURCE_DATE_EPOCH, else now. */
  now?: Date;
}

export interface ExportResult {
  ok: boolean;
  /** The default output path, relative to the novel repo root. */
  file: string;
  title: string;
  draft: boolean;
  chapters: { chapter: number; title?: string; words: number }[];
  /** Chapters in the plan that are not in the export (draft only; else they are errors). */
  missing: number[];
  front: string[];
  back: string[];
  words: number;
  issues: Issue[];
  epub?: Buffer;
}

/** The ISBN digits (and X), or undefined when the checksum is wrong. */
export function normalizeIsbn(isbn: string): string | undefined {
  const s = isbn.replace(/[\s-]/g, "").toUpperCase();
  if (/^\d{13}$/.test(s)) {
    const sum = [...s].reduce((a, d, i) => a + Number(d) * (i % 2 ? 3 : 1), 0);
    return sum % 10 === 0 ? s : undefined;
  }
  if (/^\d{9}[\dX]$/.test(s)) {
    const sum = [...s].reduce((a, d, i) => a + (d === "X" ? 10 : Number(d)) * (10 - i), 0);
    return sum % 11 === 0 ? s : undefined;
  }
  return undefined;
}

/** The checks of a publish file and its pages. `lb validate` and `lb export` both use them. */
export function checkPublish(project: Project, book: number): Issue[] {
  const publish = project.publish.get(book)?.data;
  if (!publish) return [];
  const issues: Issue[] = [];
  const file = publishPath(book);
  const pages = project.pages.get(book) ?? new Map();
  const builtIn = new Set<string>(BUILT_IN_PAGES);
  const listed = [...publish.front, ...publish.back];
  for (const id of listed) {
    if (!builtIn.has(id) && !pages.has(id)) issues.push({ code: "missing-page", severity: "error", file, message: `the page '${id}' is listed, but ${pagePath(book, id)} does not exist` });
  }
  for (const id of new Set(listed.filter((id, i) => listed.indexOf(id) !== i))) {
    issues.push({ code: "duplicate-page", severity: "error", file, message: `the page '${id}' is listed more than once` });
  }
  for (const id of pages.keys()) {
    if (!listed.includes(id)) issues.push({ code: "unused-page", severity: "warn", file: pagePath(book, id), message: `the page is not in 'front' or 'back' of ${file}, so the export leaves it out` });
  }
  if (publish.cover && !existsSync(join(project.root, publish.cover))) {
    issues.push({ code: "missing-cover", severity: "error", file, path: "cover", message: `the cover ${publish.cover} does not exist` });
  }
  if (publish.isbn && !normalizeIsbn(publish.isbn)) {
    issues.push({ code: "isbn", severity: "error", file, path: "isbn", message: `the ISBN ${publish.isbn} is not valid: check the digits` });
  }
  return issues;
}

/** A stable UUID from the book's identity, so the same book keeps its ID across exports. */
function stableUuid(seed: string): string {
  const h = createHash("sha1").update(seed).digest("hex");
  const variant = ((parseInt(h[16], 16) & 0x3) | 0x8).toString(16);
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${variant}${h.slice(17, 20)}-${h.slice(20, 32)}`;
}

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-|-$/g, "") || "book";

/** epub:type of the pages with a known role. */
const PAGE_TYPES: Record<string, string> = {
  "title-page": "titlepage",
  contents: "toc",
  copyright: "copyright-page",
  dedication: "dedication",
  epigraph: "epigraph",
  foreword: "foreword",
  preface: "preface",
  acknowledgments: "acknowledgments",
  afterword: "afterword",
};

const CSS = `body { margin: 0; padding: 0; }
p { margin: 0; text-indent: 1.5em; line-height: 1.4; }
h1 + p, h2 + p, h3 + p, .break + p, .window + p, ul + p { text-indent: 0; }
h1 { font-size: 1.5em; text-align: center; margin: 2em 0 1.5em; page-break-before: always; break-before: page; }
h2, h3, h4 { font-size: 1.1em; margin: 1.5em 0 0.5em; }
.chapter-number { display: block; font-size: 0.7em; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.5em; }
.break { text-align: center; text-indent: 0; margin: 1em 0; }
.window { font-family: monospace; font-size: 0.85em; border: 1px solid; padding: 0.5em 0.75em; margin: 1em 0; page-break-inside: avoid; break-inside: avoid; }
.window p { text-indent: 0; white-space: pre-wrap; line-height: 1.3; }
.page p { text-indent: 0; margin-bottom: 0.8em; }
.page-copyright p, .page-copyright li { font-size: 0.85em; }
.page-dedication, .page-epigraph { text-align: center; margin-top: 30%; }
.title-page { text-align: center; margin-top: 25%; }
.title-page .title { font-size: 2em; margin: 0 0 0.5em; page-break-before: auto; }
.title-page p { text-indent: 0; margin: 0.5em 0; }
.title-page .author { margin-top: 2em; font-size: 1.2em; }
.contents ol { list-style: none; padding: 0; }
.contents li { margin: 0.3em 0; }
.cover { text-align: center; margin: 0; padding: 0; }
.cover img { max-width: 100%; max-height: 100%; }
`;

function xhtml(title: string, lang: string, bodyType: string, body: string, css = "../css/book.css"): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="${lang}" lang="${lang}">
<head>
<meta charset="UTF-8"/>
<title>${escapeXml(title)}</title>
<link rel="stylesheet" type="text/css" href="${css}"/>
</head>
<body${bodyType ? ` epub:type="${bodyType}"` : ""}>
${body}
</body>
</html>
`;
}

interface Doc {
  id: string;
  href: string;
  /** The line in the contents; none: not in the contents. */
  label?: string;
  content: string;
  role: "cover" | "front" | "chapter" | "back";
}

export function buildEpub(project: Project, book: number, opts: ExportOptions = {}): ExportResult {
  const draft = opts.draft ?? false;
  const issues: Issue[] = [];
  const err = (code: string, file: string, message: string) => issues.push({ code, severity: "error", file, message });
  const warn = (code: string, file: string, message: string) => issues.push({ code, severity: "warn", file, message });

  const publish = project.publish.get(book)?.data;
  const plan = project.books.get(book)?.data;
  const baseTitle = publish?.title ?? plan?.title ?? project.config.title;
  const title = draft ? `${baseTitle} (draft)` : baseTitle;
  const result: ExportResult = {
    ok: false,
    file: `exports/${pad2(book)}-${slugify(baseTitle)}${draft ? "-draft" : ""}.epub`,
    title,
    draft,
    chapters: [],
    missing: [],
    front: [],
    back: [],
    words: 0,
    issues,
  };
  if (!publish) {
    err("no-publish-file", publishPath(book), "there is no publish file for this book: run the publish-book skill");
    return result;
  }
  const lang = publish.language;

  // Chapters: every planned chapter, approved; with --draft, the prose that exists.
  const prose = new Map((project.prose.get(book) ?? []).map((c) => [c.data.chapter, c]));
  const numbers = [...new Set([...(project.chapters.get(book) ?? []).map((p) => p.data.chapter), ...prose.keys()])].sort((a, b) => a - b);
  const included = numbers.flatMap((n) => {
    const c = prose.get(n);
    if (c && (draft || c.data.status === "approved")) return [c];
    if (draft) result.missing.push(n);
    else if (c) err("chapter-not-approved", c.file, "the chapter is not approved (use --draft to export it anyway)");
    else err("chapter-missing", `${bookDir(book)}/chapters/${pad2(n)}.md`, "the chapter has no prose (use --draft to export without it)");
    return [];
  });
  if (included.length === 0) err("no-chapters", `${bookDir(book)}/chapters/`, "the book has no chapters to export");
  for (const c of included) {
    const v = readVerify(project.root, book, c.data.chapter);
    if (v?.accepted) warn("accepted-errors", c.file, `the chapter was committed with ${v.open.filter((f) => f.severity === "error").length} open error(s) (runs/verify)`);
  }

  // Pages, cover and ISBN.
  issues.push(...checkPublish(project, book).filter((i) => i.code !== "unused-page"));
  const pages = project.pages.get(book) ?? new Map();
  const coverPath = publish.cover ? join(project.root, publish.cover) : undefined;
  const coverData = coverPath && existsSync(coverPath) ? readFileSync(coverPath) : undefined;
  if (!publish.cover) warn("no-cover", publishPath(book), "the book has no cover: the stores need one");
  if (!publish.description) warn("no-description", publishPath(book), "the book has no description (the blurb for the stores)");
  const isbn = publish.isbn ? normalizeIsbn(publish.isbn) : undefined;
  const identifier = isbn ? `urn:isbn:${isbn}` : `urn:uuid:${stableUuid(`${publish.author}\n${baseTitle}\n${book}`)}`;

  if (issues.some((i) => i.severity === "error")) return result;

  // The documents, in reading order.
  const series = publish.series ? { name: publish.series.name, number: publish.series.number ?? book } : undefined;
  const docs: Doc[] = [];
  const chapterHref = (n: number) => `text/chapter-${pad2(n)}.xhtml`;

  if (coverData) {
    docs.push({
      id: "cover",
      href: "text/cover.xhtml",
      role: "cover",
      content: xhtml(title, lang, "cover", `<section epub:type="cover" class="cover"><img src="../images/cover${extname(publish.cover!).toLowerCase()}" alt="${escapeAttr(`Cover of ${baseTitle}`)}"/></section>`),
    });
  }

  const contentsIndex: { href: string; label: string }[] = [];
  const pageDoc = (id: string, role: "front" | "back"): Doc => {
    const href = `text/page-${id}.xhtml`;
    const type = PAGE_TYPES[id];
    const bodyType = role === "front" ? "frontmatter" : "backmatter";
    if (id === "title-page") {
      const lines = [
        `<h1 class="title">${inline(baseTitle)}</h1>`,
        publish.subtitle && `<p class="subtitle">${inline(publish.subtitle)}</p>`,
        series && `<p class="series">${escapeXml(series.name)}, Book ${series.number}</p>`,
        `<p class="author">${escapeXml(publish.author)}</p>`,
        publish.publisher && `<p class="publisher">${escapeXml(publish.publisher)}</p>`,
      ].filter(Boolean);
      return { id: `page-${id}`, href, role, content: xhtml(baseTitle, lang, bodyType, `<section epub:type="titlepage" class="title-page">\n${lines.join("\n")}\n</section>`) };
    }
    if (id === "contents") {
      // Filled in after every document is known.
      return { id: `page-${id}`, href, role, label: "Contents", content: "" };
    }
    const page = pages.get(id)!;
    const heading = page.data.title ? `<h1>${inline(page.data.title)}</h1>\n` : "";
    const body = `<section${type ? ` epub:type="${type}"` : ""} class="page page-${id}">\n${heading}${toXhtml(page.body)}\n</section>`;
    return { id: `page-${id}`, href, role, label: page.data.title, content: xhtml(page.data.title ?? baseTitle, lang, bodyType, body) };
  };

  for (const id of publish.front) docs.push(pageDoc(id, "front"));
  for (const c of included) {
    const n = c.data.chapter;
    const words = parseProse(c.body).wordCount;
    result.chapters.push({ chapter: n, title: c.data.title, words });
    result.words += words;
    const label = c.data.title ? `Chapter ${n}: ${c.data.title}` : `Chapter ${n}`;
    const heading = `<h1><span class="chapter-number">Chapter ${n}</span>${c.data.title ? ` ${inline(c.data.title)}` : ""}</h1>`;
    docs.push({
      id: `chapter-${pad2(n)}`,
      href: chapterHref(n),
      role: "chapter",
      label,
      content: xhtml(label, lang, "bodymatter", `<section epub:type="chapter" class="chapter">\n${heading}\n${toXhtml(c.body)}\n</section>`),
    });
  }
  for (const id of publish.back) docs.push(pageDoc(id, "back"));
  result.front = publish.front;
  result.back = publish.back;

  for (const d of docs) if (d.label) contentsIndex.push({ href: d.href, label: d.label });
  const contents = docs.find((d) => d.id === "page-contents");
  if (contents) {
    const items = contentsIndex.filter((e) => e.href !== contents.href).map((e) => `<li><a href="${e.href.replace(/^text\//, "")}">${escapeXml(e.label)}</a></li>`);
    contents.content = xhtml("Contents", lang, "frontmatter", `<section epub:type="toc" class="contents">\n<h1>Contents</h1>\n<ol>\n${items.join("\n")}\n</ol>\n</section>`);
  }

  // Navigation: nav.xhtml (EPUB 3) and toc.ncx (EPUB 2).
  const firstChapter = docs.find((d) => d.role === "chapter")!;
  const navItems = contentsIndex.map((e) => `<li><a href="${e.href}">${escapeXml(e.label)}</a></li>`);
  const landmarks = [
    coverData && `<li><a epub:type="cover" href="text/cover.xhtml">Cover</a></li>`,
    `<li><a epub:type="toc" href="${contents ? contents.href : "nav.xhtml#toc"}">Contents</a></li>`,
    `<li><a epub:type="bodymatter" href="${firstChapter.href}">Start</a></li>`,
  ].filter(Boolean);
  const nav = xhtml(
    "Contents",
    lang,
    "",
    `<nav epub:type="toc" id="toc">\n<h1>Contents</h1>\n<ol>\n${navItems.join("\n")}\n</ol>\n</nav>\n<nav epub:type="landmarks" id="landmarks" hidden="">\n<ol>\n${landmarks.join("\n")}\n</ol>\n</nav>`,
    "css/book.css",
  );
  const ncx = `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1" xml:lang="${lang}">
<head>
<meta name="dtb:uid" content="${escapeAttr(identifier)}"/>
<meta name="dtb:depth" content="1"/>
<meta name="dtb:totalPageCount" content="0"/>
<meta name="dtb:maxPageNumber" content="0"/>
</head>
<docTitle><text>${escapeXml(title)}</text></docTitle>
<navMap>
${contentsIndex.map((e, i) => `<navPoint id="nav-${i + 1}" playOrder="${i + 1}"><navLabel><text>${escapeXml(e.label)}</text></navLabel><content src="${e.href}"/></navPoint>`).join("\n")}
</navMap>
</ncx>
`;

  // The package document.
  const now = opts.now ?? (process.env.SOURCE_DATE_EPOCH ? new Date(Number(process.env.SOURCE_DATE_EPOCH) * 1000) : new Date());
  const modified = now.toISOString().replace(/\.\d{3}Z$/, "Z");
  const coverExt = publish.cover ? extname(publish.cover).toLowerCase() : "";
  const coverType = coverExt === ".png" ? "image/png" : "image/jpeg";
  const meta = [
    `<dc:identifier id="book-id">${escapeXml(identifier)}</dc:identifier>`,
    `<dc:title id="title">${escapeXml(title)}</dc:title>`,
    `<meta refines="#title" property="title-type">main</meta>`,
    publish.subtitle && `<dc:title id="subtitle">${escapeXml(publish.subtitle)}</dc:title>\n<meta refines="#subtitle" property="title-type">subtitle</meta>`,
    `<dc:creator id="author">${escapeXml(publish.author)}</dc:creator>`,
    `<meta refines="#author" property="role" scheme="marc:relators">aut</meta>`,
    `<dc:language>${lang}</dc:language>`,
    publish.date && `<dc:date>${publish.date}</dc:date>`,
    publish.publisher && `<dc:publisher>${escapeXml(publish.publisher)}</dc:publisher>`,
    publish.description && `<dc:description>${escapeXml(publish.description)}</dc:description>`,
    ...publish.keywords.map((k) => `<dc:subject>${escapeXml(k)}</dc:subject>`),
    `<meta property="dcterms:modified">${modified}</meta>`,
    series &&
      `<meta property="belongs-to-collection" id="series">${escapeXml(series.name)}</meta>\n<meta refines="#series" property="collection-type">series</meta>\n<meta refines="#series" property="group-position">${series.number}</meta>\n<meta name="calibre:series" content="${escapeAttr(series.name)}"/>\n<meta name="calibre:series_index" content="${series.number}"/>`,
    coverData && `<meta name="cover" content="cover-image"/>`,
  ].filter(Boolean);
  const manifest = [
    `<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>`,
    `<item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>`,
    `<item id="css" href="css/book.css" media-type="text/css"/>`,
    coverData && `<item id="cover-image" href="images/cover${coverExt}" media-type="${coverType}" properties="cover-image"/>`,
    ...docs.map((d) => `<item id="${d.id}" href="${d.href}" media-type="application/xhtml+xml"/>`),
  ].filter(Boolean);
  const spine = docs.map((d) => `<itemref idref="${d.id}"/>`);
  const opf = `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id" xml:lang="${lang}">
<metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
${meta.join("\n")}
</metadata>
<manifest>
${manifest.join("\n")}
</manifest>
<spine toc="ncx">
${spine.join("\n")}
</spine>
</package>
`;
  const container = `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
<rootfiles>
<rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/>
</rootfiles>
</container>
`;

  const text = (name: string, s: string): ZipEntry => ({ name, data: Buffer.from(s, "utf8") });
  const entries: ZipEntry[] = [
    { name: "mimetype", data: Buffer.from("application/epub+zip"), store: true },
    text("META-INF/container.xml", container),
    text("OEBPS/content.opf", opf),
    text("OEBPS/nav.xhtml", nav),
    text("OEBPS/toc.ncx", ncx),
    text("OEBPS/css/book.css", CSS),
    ...(coverData ? [{ name: `OEBPS/images/cover${coverExt}`, data: coverData, store: true }] : []),
    ...docs.map((d) => text(`OEBPS/${d.href}`, d.content)),
  ];
  result.epub = writeZip(entries);
  result.ok = true;
  return result;
}

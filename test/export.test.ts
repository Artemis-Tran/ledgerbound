import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { crc32, deflateSync, inflateRawSync } from "node:zlib";
import { describe, expect, test } from "vitest";
import { buildEpub, normalizeIsbn } from "../src/export/epub.ts";
import { inline, smartQuotes, toXhtml } from "../src/export/markdown.ts";
import { loadProject } from "../src/project.ts";
import { check, edit, fixtureCopy } from "./helpers.ts";

/** Reads a zip from its central directory: name → { method, data }. */
function unzip(buf: Buffer): Map<string, { method: number; data: Buffer }> {
  const end = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(end + 10);
  let p = buf.readUInt32LE(end + 16);
  const out = new Map<string, { method: number; data: Buffer }>();
  for (let i = 0; i < count; i++) {
    const method = buf.readUInt16LE(p + 10);
    const size = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extra = buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32);
    const name = buf.toString("utf8", p + 46, p + 46 + nameLen);
    const local = buf.readUInt32LE(p + 42);
    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
    const raw = buf.subarray(start, start + size);
    out.set(name, { method, data: method === 8 ? inflateRawSync(raw) : raw });
    p += 46 + nameLen + extra;
  }
  return out;
}

/** A valid 1×1 PNG. */
const PNG = (() => {
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(4);
    head.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])));
    return Buffer.concat([head, Buffer.from(type), data, crc]);
  };
  const ihdr = Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
  return Buffer.concat([Buffer.from("89504e470d0a1a0a", "hex"), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(Buffer.from([0, 40, 60, 90]))), chunk("IEND", Buffer.alloc(0))]);
})();

const exportOf = (dir: string, draft = true) => buildEpub(loadProject(dir).project!, 1, { draft, now: new Date("2026-01-01T00:00:00Z") });
const text = (files: ReturnType<typeof unzip>, name: string) => files.get(name)!.data.toString("utf8");

describe("markdown to XHTML", () => {
  test("curly quotes, apostrophes and em dashes", () => {
    expect(smartQuotes(`"It's a third," she said. 'No--never.'`)).toBe("“It’s a third,” she said. ‘No—never.’");
  });

  test("emphasis, links and escaping", () => {
    expect(inline("*The Tithe Well* & **Rook** [news](https://a.example/?x=1&y=2)")).toBe(
      '<em>The Tithe Well</em> &amp; <strong>Rook</strong> <a href="https://a.example/?x=1&amp;y=2">news</a>',
    );
  });

  test("a status window keeps its lines, a scene break is a break, a list is a list", () => {
    const x = toXhtml("One.\n\n```\nLevel .. 2 → 3\n<HP>\n```\n\n* * *\n\n- a\n- b");
    expect(x).toContain('<div class="window">\n<p>Level .. 2 → 3</p>\n<p>&lt;HP&gt;</p>\n</div>');
    expect(x).toContain('<p class="break">* * *</p>');
    expect(x).toContain("<ul>\n<li>a</li>\n<li>b</li>\n</ul>");
  });
});

describe("ISBN", () => {
  test("a valid ISBN-13 and ISBN-10, with hyphens", () => {
    expect(normalizeIsbn("978-0-306-40615-7")).toBe("9780306406157");
    expect(normalizeIsbn("0-306-40615-2")).toBe("0306406152");
  });
  test("a wrong check digit", () => {
    expect(normalizeIsbn("978-0-306-40615-8")).toBeUndefined();
  });
});

describe("lb export", () => {
  test("without --draft, every planned chapter must be approved", () => {
    const r = exportOf(fixtureCopy(), false);
    expect(r.ok).toBe(false);
    expect(r.issues.map((i) => i.code)).toContain("chapter-missing");
  });

  test("a draft export is a valid EPUB container with the pages in order", () => {
    const r = exportOf(fixtureCopy());
    expect(r.ok).toBe(true);
    expect(r.missing).toEqual([2, 3, 4, 5, 6]);
    const files = unzip(r.epub!);
    expect([...files.keys()][0]).toBe("mimetype");
    expect(files.get("mimetype")!.method).toBe(0);
    expect(text(files, "mimetype")).toBe("application/epub+zip");
    const opf = text(files, "OEBPS/content.opf");
    expect(opf).toContain("<dc:title id=\"title\">The Tithe Well (draft)</dc:title>");
    expect(opf).toContain("<meta property=\"dcterms:modified\">2026-01-01T00:00:00Z</meta>");
    const spine = [...opf.matchAll(/<itemref idref="([^"]+)"/g)].map((m) => m[1]);
    expect(spine).toEqual(["page-title-page", "page-copyright", "page-dedication", "page-contents", "chapter-01", "page-about-author"]);
    expect(text(files, "OEBPS/text/chapter-01.xhtml")).toContain("“Level three,” he said.");
  });

  test("the identifier is the same in each export, and an ISBN replaces it", () => {
    const dir = fixtureCopy();
    const id = (r: ReturnType<typeof exportOf>) => /<dc:identifier id="book-id">([^<]+)</.exec(text(unzip(r.epub!), "OEBPS/content.opf"))![1];
    expect(id(exportOf(dir))).toBe(id(exportOf(dir)));
    edit(dir, "books/01/publish.yaml", "language: en", "language: en\nisbn: 978-0-306-40615-7");
    expect(id(exportOf(dir))).toBe("urn:isbn:9780306406157");
  });

  test("a series and a cover go into the metadata", () => {
    const dir = fixtureCopy();
    mkdirSync(join(dir, "art"));
    writeFileSync(join(dir, "art", "cover.png"), PNG);
    edit(dir, "books/01/publish.yaml", "language: en", "language: en\ncover: art/cover.png\nseries: { name: The Well Cycle }");
    const files = unzip(exportOf(dir).epub!);
    const opf = text(files, "OEBPS/content.opf");
    expect(opf).toContain('properties="cover-image"');
    expect(opf).toContain('<meta refines="#series" property="group-position">1</meta>');
    expect(files.has("OEBPS/images/cover.png")).toBe(true);
  });

  test("lb validate finds a missing page, a missing cover and a wrong ISBN", () => {
    const dir = fixtureCopy();
    edit(dir, "books/01/publish.yaml", "back: [about-author]", "back: [about-author, also-by]\ncover: art/none.jpg\nisbn: 978-0-306-40615-8");
    const codes = check(dir).filter((i) => i.severity === "error").map((i) => i.code);
    expect(codes).toEqual(expect.arrayContaining(["missing-page", "missing-cover", "isbn"]));
  });

  const hasEpubcheck = spawnSync("epubcheck", ["--version"]).error === undefined;
  test.skipIf(!hasEpubcheck)("epubcheck finds no error in an export with every kind of metadata", () => {
    const dir = fixtureCopy();
    mkdirSync(join(dir, "art"));
    writeFileSync(join(dir, "art", "cover.png"), PNG);
    edit(dir, "books/01/publish.yaml", "language: en", "language: en\nisbn: 978-0-306-40615-7\ncover: art/cover.png\nsubtitle: An Example\npublisher: Rudd Press\nseries: { name: The Well Cycle }");
    const file = join(dir, "check.epub");
    writeFileSync(file, exportOf(dir).epub!);
    const r = spawnSync("epubcheck", [file], { encoding: "utf8" });
    expect(`${r.stdout}${r.stderr}`).toContain("0 fatals / 0 errors / 0 warnings");
  }, 60_000);

  test("the CLI writes the file and exits 0", () => {
    const dir = fixtureCopy();
    const r = spawnSync("node", [join(import.meta.dirname, "..", "src", "cli.ts"), "export", "--draft", "--json", "--dir", dir], { encoding: "utf8" });
    expect(r.status).toBe(0);
    expect(JSON.parse(r.stdout).file).toBe("exports/01-the-tithe-well-draft.epub");
  });
});

/**
 * The Markdown of chapters and pages, as XHTML for an EPUB. It knows the subset that the
 * prose uses: paragraphs, *italic*, **bold**, [links](url), `- ` lists, `## ` headings,
 * scene breaks (`***`, `* * *`, `---`, a bare `#`) and fenced status windows.
 * Other Markdown stays as text.
 */

export const escapeXml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
export const escapeAttr = (s: string) => escapeXml(s).replace(/"/g, "&quot;");

const OPENS_BEFORE = /[\s([{—–-]/;
const LETTER = /[\p{L}\p{N}]/u;

/** Straight quotes to curly quotes, and `--` to an em dash. */
export function smartQuotes(s: string): string {
  let out = "";
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    const prev = i > 0 ? s[i - 1] : "";
    const next = s[i + 1] ?? "";
    if (ch === '"') out += prev === "" || OPENS_BEFORE.test(prev) ? "“" : "”";
    else if (ch === "'") {
      // An apostrophe or a closing quote after a letter or punctuation; an opening quote at a word start,
      // except an elision before a digit ('90s).
      const opening = (prev === "" || OPENS_BEFORE.test(prev) || prev === "“") && LETTER.test(next) && !/\d/.test(next);
      out += opening ? "‘" : "’";
    } else if (ch === "-" && next === "-") {
      out += "—";
      i++;
    } else out += ch;
  }
  return out;
}

function emphasis(s: string): string {
  return s
    .replace(/\*\*(?=\S)(.+?)(?<=\S)\*\*/g, "<strong>$1</strong>")
    .replace(/(?<![\p{L}\p{N}*])\*(?=\S)(.+?)(?<=\S)\*(?![\p{L}\p{N}*])/gu, "<em>$1</em>")
    .replace(/(?<![\p{L}\p{N}_])_(?=\S)(.+?)(?<=\S)_(?![\p{L}\p{N}_])/gu, "<em>$1</em>");
}

const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

/** One line or paragraph of text as inline XHTML. */
export function inline(text: string): string {
  let out = "";
  let last = 0;
  for (const m of text.matchAll(LINK)) {
    out += emphasis(escapeXml(smartQuotes(text.slice(last, m.index))));
    out += `<a href="${escapeAttr(m[2])}">${emphasis(escapeXml(smartQuotes(m[1])))}</a>`;
    last = m.index + m[0].length;
  }
  return out + emphasis(escapeXml(smartQuotes(text.slice(last))));
}

const BREAK = /^(\*\s*){3,}$|^(-\s*){3,}$|^#$/;
const HEADING = /^(#{1,6})\s+(.+)$/;
const ITEM = /^[-*]\s+(.+)$/;

/** Markdown body → XHTML block elements. */
export function toXhtml(body: string): string {
  const out: string[] = [];
  let para: string[] = [];
  let list: string[] = [];
  let fence: string[] | undefined;

  const flushPara = () => {
    if (para.length) out.push(`<p>${inline(para.join(" "))}</p>`);
    para = [];
  };
  const flushList = () => {
    if (list.length) out.push(`<ul>\n${list.map((i) => `<li>${inline(i)}</li>`).join("\n")}\n</ul>`);
    list = [];
  };

  for (const raw of body.split(/\r?\n/)) {
    const t = raw.trim();
    if (t.startsWith("```") || t.startsWith("~~~")) {
      if (fence) {
        // A status window: one line per <p>, kept as written.
        out.push(`<div class="window">\n${fence.map((l) => `<p>${l.trim() === "" ? "&#160;" : escapeXml(l)}</p>`).join("\n")}\n</div>`);
        fence = undefined;
      } else {
        flushPara();
        flushList();
        fence = [];
      }
      continue;
    }
    if (fence) {
      fence.push(raw.replace(/\s+$/, ""));
      continue;
    }
    if (t === "") {
      flushPara();
      flushList();
      continue;
    }
    if (BREAK.test(t)) {
      flushPara();
      flushList();
      out.push('<p class="break">* * *</p>');
      continue;
    }
    const h = HEADING.exec(t);
    if (h) {
      flushPara();
      flushList();
      const level = Math.min(Math.max(h[1].length, 2), 4);
      out.push(`<h${level}>${inline(h[2])}</h${level}>`);
      continue;
    }
    const item = ITEM.exec(t);
    if (item && para.length === 0) {
      list.push(item[1]);
      continue;
    }
    flushList();
    para.push(t);
  }
  if (fence) out.push(`<div class="window">\n${fence.map((l) => `<p>${escapeXml(l) || "&#160;"}</p>`).join("\n")}\n</div>`);
  flushPara();
  flushList();
  return out.join("\n");
}

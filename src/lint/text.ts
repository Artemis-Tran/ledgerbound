/**
 * Splits markdown prose into paragraphs and sentences, with line numbers.
 * Fenced code blocks (status windows) and headings are not prose. A scene break
 * (`***`, `* * *`, `#`) starts a new scene.
 */
export interface Sentence {
  text: string;
  line: number;
  words: string[];
  /** The sentence starts inside quotation marks. */
  dialogue: boolean;
  paragraph: number;
  scene: number;
}

export interface Paragraph {
  index: number;
  text: string;
  line: number;
  scene: number;
  sentences: Sentence[];
  /** Line number for each character offset in `text`. */
  lineAt: (offset: number) => number;
}

export interface Prose {
  paragraphs: Paragraph[];
  sentences: Sentence[];
  wordCount: number;
}

const ABBREV = /\b(Mr|Mrs|Ms|Dr|St|Mt|Lt|Sgt|Capt|vs|etc|e\.g|i\.e)\.$/i;
const OPEN_QUOTES = new Set(["“", '"']);
const CLOSE_QUOTES = new Set(["”", '"']);

export const wordsOf = (s: string) => s.toLowerCase().match(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu) ?? [];

export function parseProse(body: string, firstLine = 1): Prose {
  const lines = body.split(/\r?\n/);
  const paragraphs: Paragraph[] = [];
  let scene = 0;
  let inFence = false;
  let buf: { text: string; line: number }[] = [];

  const flush = () => {
    if (buf.length === 0) return;
    const starts: number[] = [];
    let text = "";
    for (const b of buf) {
      starts.push(text.length);
      text += (text ? " " : "") + b.text.trim();
      if (starts.length > 1) starts[starts.length - 1] += 1;
    }
    const lineNums = buf.map((b) => b.line);
    const lineAt = (offset: number) => {
      let k = 0;
      while (k + 1 < starts.length && starts[k + 1] <= offset) k++;
      return lineNums[k];
    };
    paragraphs.push({ index: paragraphs.length, text, line: buf[0].line, scene, sentences: [], lineAt });
    buf = [];
  };

  lines.forEach((raw, i) => {
    const line = i + firstLine;
    const t = raw.trim();
    if (t.startsWith("```") || t.startsWith("~~~")) {
      flush();
      inFence = !inFence;
      return;
    }
    if (inFence) return;
    if (t === "") return flush();
    if (/^(\*\s*){3,}$|^(-\s*){3,}$|^#{1,6}(\s|$)/.test(t)) {
      flush();
      scene++;
      return;
    }
    buf.push({ text: raw, line });
  });
  flush();

  const sentences: Sentence[] = [];
  for (const p of paragraphs) {
    const text = p.text;
    // Quote state after each character: true = inside quotation marks.
    const quoted: boolean[] = [];
    let q = false;
    for (const ch of text) {
      if (ch === '"') q = !q;
      else if (ch === "“") q = true;
      else if (ch === "”") q = false;
      quoted.push(q);
    }
    const quotedBefore = (k: number) => (k > 0 ? quoted[k - 1] : false);

    let start = 0;
    const push = (end: number) => {
      const lead = Math.max(0, text.slice(start, end).search(/\S/));
      const s = text.slice(start, end).trim();
      if (s) {
        const sentence: Sentence = {
          text: s,
          line: p.lineAt(start + lead),
          words: wordsOf(s),
          dialogue: quotedBefore(start + lead) || OPEN_QUOTES.has(s[0]),
          paragraph: p.index,
          scene: p.scene,
        };
        if (sentence.words.length > 0) p.sentences.push(sentence);
      }
      start = end;
    };
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (ch !== "." && ch !== "!" && ch !== "?" && ch !== "…") continue;
      let j = i + 1;
      while (j < text.length && ".!?…".includes(text[j])) j++;
      while (j < text.length && (CLOSE_QUOTES.has(text[j]) || ")’'".includes(text[j]))) j++;
      if (j < text.length && !/\s/.test(text[j])) continue;
      if (ch === "." && ABBREV.test(text.slice(Math.max(0, i - 5), i + 1))) continue;
      // `"Go," she said.` / `"Go!" she said.`: a lower-case word after a closing quote continues the sentence.
      if (CLOSE_QUOTES.has(text[j - 1]) && /^[a-z]/.test(text.slice(j).trimStart())) {
        i = j - 1;
        continue;
      }
      push(j);
      i = j - 1;
    }
    push(text.length);
    sentences.push(...p.sentences);
  }

  const wordCount = paragraphs.reduce((n, p) => n + wordsOf(p.text).length, 0);
  return { paragraphs, sentences, wordCount };
}

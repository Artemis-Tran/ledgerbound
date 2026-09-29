/**
 * The deterministic prose checks of guidelines/writing.md. Every finding has a rule ID from
 * src/rules.ts, a severity and a line number in the file.
 */
import type { ProjectConfig } from "../schemas.ts";
import {
  BANNED,
  BANNED_ENDINGS,
  BANNED_OPENINGS,
  BODY_TELLS,
  CONTRAST,
  escapeRe,
  HEDGES,
  NAMES,
  type Pattern,
  STOPWORDS,
  TAGS,
  THERAPY,
} from "./patterns.ts";
import { parseProse, type Paragraph, type Prose, wordsOf } from "./text.ts";

export interface Finding {
  rule: string;
  severity: "error" | "warn";
  line: number;
  text: string;
  message: string;
  /** The chapter plan lists this rule in `exceptions`. */
  waived?: boolean;
  /** Other places involved, for repeats. */
  seeAlso?: { file: string; line: number }[];
}

export interface CorpusFile {
  file: string;
  body: string;
  firstLine: number;
}

export interface LintOptions {
  config?: ProjectConfig["lint"];
  /** Other chapters of the same book, for the repetition checks. */
  corpus?: CorpusFile[];
  /** Rule IDs that the chapter plan waives. */
  waive?: string[];
  /** Keep only findings on these lines (inclusive), for a re-check after a fix. */
  lines?: [number, number];
}

export interface LintResult {
  words: number;
  findings: Finding[];
}

/** `, and he…`: a comma and a conjunction that join two full clauses, not the items of a list. */
const CLAUSE_JOIN = /,\s+(?:and|but|so|or|yet)\s+(?:then\s+|now\s+)?(?:the|a|an|he|she|they|it|we|i|you|his|her|their|its|this|that|there|no|nothing|nobody|[A-Z][\p{L}'’-]*)\b/gu;

const snippet = (s: string, max = 100) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

function quotedAt(text: string, offset: number): boolean {
  let q = false;
  for (let i = 0; i < offset; i++) {
    const ch = text[i];
    if (ch === '"') q = !q;
    else if (ch === "“") q = true;
    else if (ch === "”") q = false;
  }
  return q;
}

function matches(p: Paragraph, pattern: Pattern) {
  const out: { line: number; text: string; index: number }[] = [];
  pattern.re.lastIndex = 0;
  for (const m of p.text.matchAll(pattern.re)) {
    if (pattern.dialogueOnly && !quotedAt(p.text, m.index)) continue;
    out.push({ line: p.lineAt(m.index), text: m[0], index: m.index });
  }
  return out;
}

function bannedList(config?: LintOptions["config"]): Pattern[] {
  const removed = new Set((config?.banned_remove ?? []).map((s) => s.toLowerCase()));
  const base = BANNED.filter((p) => !removed.has(p.id) && !removed.has(p.id.replace(/-/g, " ")));
  const added = (config?.banned_add ?? []).map((phrase) => ({
    id: phrase.toLowerCase(),
    re: new RegExp(`\\b${escapeRe(phrase)}\\b`, "giu"),
    severity: "error" as const,
  }));
  return [...base, ...added];
}

function bodyTells(config?: LintOptions["config"]): Pattern[] {
  const added = Object.entries(config?.body_tells_add ?? {}).map(([id, re]) => ({ id, re: new RegExp(re, "giu"), severity: "error" as const }));
  return [...BODY_TELLS, ...added];
}

// ---------- repetition across chapters ----------

interface Occurrence {
  file: string;
  line: number;
  key: string;
  /** Position of the n-gram in its paragraph, to merge overlaps. */
  at: number;
  paragraph: number;
}

const SIMILE = /\blike an? ([\p{L}'’-]+(?: [\p{L}'’-]+){0,3})|\bas (\p{L}+) as an? ([\p{L}'’-]+)/giu;

function similes(prose: Prose, file: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const p of prose.paragraphs) {
    for (const m of p.text.matchAll(SIMILE)) {
      let key: string;
      if (m[1]) {
        const words = m[1].toLowerCase().split(" ");
        const kept = [words[0], ...words.slice(1).filter((_, i, arr) => !arr.slice(0, i + 1).some((w) => STOPWORDS.has(w)))].slice(0, 3);
        key = `like a ${kept.join(" ")}`;
      } else key = `as ${m[2].toLowerCase()} as a ${m[3].toLowerCase()}`;
      out.push({ file, line: p.lineAt(m.index), key, at: m.index, paragraph: p.index });
    }
  }
  return out;
}

const NGRAM = 5;

function ngrams(prose: Prose, file: string): Occurrence[] {
  const out: Occurrence[] = [];
  for (const p of prose.paragraphs) {
    const tokens = [...p.text.matchAll(/[\p{L}\p{N}]+(?:['’][\p{L}]+)*/gu)];
    for (let i = 0; i + NGRAM <= tokens.length; i++) {
      const words = tokens.slice(i, i + NGRAM).map((t) => t[0].toLowerCase());
      if (words.filter((w) => w.length >= 3 && !STOPWORDS.has(w)).length < 3) continue;
      out.push({ file, line: p.lineAt(tokens[i].index), key: words.join(" "), at: i, paragraph: p.index });
    }
  }
  return out;
}

function repeats(own: Occurrence[], others: Occurrence[], rule: string, severity: "error" | "warn", label: string): Finding[] {
  const index = new Map<string, Occurrence[]>();
  for (const o of [...own, ...others]) index.set(o.key, [...(index.get(o.key) ?? []), o]);
  const findings: Finding[] = [];
  let last: Occurrence | undefined;
  for (const o of own) {
    const others = index.get(o.key)!.filter((x) => x !== o);
    if (others.length === 0) continue;
    const earlierHere = others.some((x) => x.file === o.file && (x.paragraph < o.paragraph || (x.paragraph === o.paragraph && x.at < o.at)));
    const elsewhere = others.some((x) => x.file !== o.file);
    // A repeat inside this file is reported at its second use.
    if (!earlierHere && !elsewhere) continue;
    // An overlapping run of repeated n-grams is one finding.
    if (last && last.paragraph === o.paragraph && o.at - last.at < NGRAM) {
      last = o;
      continue;
    }
    last = o;
    findings.push({
      rule,
      severity,
      line: o.line,
      text: o.key,
      message: others.some((x) => x.file.startsWith("voice/")) && !o.file.startsWith("voice/")
        ? `${label} "${o.key}" is copied from a voice sample: copy the voice, not the words`
        : `${label} "${o.key}" is used more than once in the book`,
      seeAlso: others.map((x) => ({ file: x.file, line: x.line })),
    });
  }
  return findings;
}

// ---------- the lint ----------

export function lintProse(body: string, firstLine: number, file: string, opts: LintOptions = {}): LintResult {
  const prose = parseProse(body, firstLine);
  const findings: Finding[] = [];
  const add = (f: Finding) => findings.push({ ...f, text: snippet(f.text) });
  const { paragraphs, sentences } = prose;

  // §4 banned words and phrases, §6 hedges, §5 therapy language and tags.
  const phraseChecks: [string, Pattern[], string][] = [
    ["words.banned", bannedList(opts.config), "banned phrase"],
    ["names.ai-default", NAMES, "a name that AI fiction overuses; give the character a name from the setting"],
    ["emotion.hedges", HEDGES, "hedge"],
    ["dialogue.therapy", THERAPY, "therapy language in dialogue; correct only when the speaker's voice card uses it"],
    ["dialogue.tags", TAGS, "dialogue tag"],
  ];
  for (const [rule, patterns, label] of phraseChecks) {
    for (const p of paragraphs) {
      for (const pattern of patterns) {
        for (const m of matches(p, pattern)) add({ rule, severity: pattern.severity, line: m.line, text: m.text, message: `${label} (${pattern.id})` });
      }
    }
  }

  // §4 body tells: at most twice per chapter.
  for (const pattern of bodyTells(opts.config)) {
    const all = paragraphs.flatMap((p) => matches(p, pattern));
    all.slice(2).forEach((m) =>
      add({ rule: "words.body-tells", severity: "error", line: m.line, text: m.text, message: `body tell '${pattern.id}' used ${all.length} times (max 2): lines ${all.map((x) => x.line).join(", ")}` }),
    );
  }

  // §3 staccato runs and repeated openings, over narration sentences in one scene.
  const narration: (typeof sentences)[] = [];
  let run: typeof sentences = [];
  for (const s of sentences) {
    if (s.dialogue || (run.length > 0 && run.at(-1)!.scene !== s.scene)) {
      if (run.length) narration.push(run);
      run = s.dialogue ? [] : [s];
    } else run.push(s);
  }
  if (run.length) narration.push(run);

  const firstWord = (s: (typeof sentences)[number]) => s.words[0] ?? "";
  // A short run with one structure is reported once, as rhythm.staccato, not again as rhythm.openings.
  const reported = new Set<(typeof sentences)[number]>();
  for (const seq of narration) {
    let i = 0;
    while (i < seq.length) {
      let j = i;
      while (j < seq.length && seq[j].words.length < 6) j++;
      if (j - i >= 3) {
        const group = seq.slice(i, j);
        const sameStart = group.some((_, k) => k + 2 < group.length && firstWord(group[k]) === firstWord(group[k + 1]) && firstWord(group[k]) === firstWord(group[k + 2]));
        if (sameStart) group.forEach((s) => reported.add(s));
        add({
          rule: "rhythm.staccato",
          severity: sameStart ? "error" : "warn",
          line: group[0].line,
          text: group.map((s) => s.text).join(" "),
          message: sameStart
            ? `${group.length} short sentences in a row with the same structure`
            : `${group.length} consecutive sentences under 6 words (allowed only in a fast action beat)`,
        });
      }
      i = Math.max(j, i + 1);
    }
    for (let k = 0; k + 2 < seq.length; k++) {
      const w = firstWord(seq[k]);
      if (w && w === firstWord(seq[k + 1]) && w === firstWord(seq[k + 2]) && ![seq[k], seq[k + 1], seq[k + 2]].every((s) => reported.has(s))) {
        let end = k + 2;
        while (end + 1 < seq.length && firstWord(seq[end + 1]) === w) end++;
        add({ rule: "rhythm.openings", severity: "error", line: seq[k].line, text: seq.slice(k, end + 1).map((s) => s.text).join(" "), message: `${end - k + 1} consecutive sentences start with "${w}"` });
        k = end;
      }
    }
  }

  // §3 anadiplosis.
  for (let k = 1; k < sentences.length; k++) {
    const a = sentences[k - 1];
    const b = sentences[k];
    const last = a.words.at(-1);
    if (a.paragraph === b.paragraph && last && last === b.words[0] && last.length > 2 && !STOPWORDS.has(last)) {
      add({ rule: "rhythm.anadiplosis", severity: "warn", line: b.line, text: `${a.text} ${b.text}`, message: `the sentence starts with "${last}", the last word of the one before` });
    }
  }

  // §3 clause chains and comma-heavy sentences, in narration only.
  for (const s of sentences) {
    if (s.dialogue) continue;
    const joins = [...s.text.matchAll(CLAUSE_JOIN)].length;
    if (joins >= 2) add({ rule: "rhythm.clause-chains", severity: "warn", line: s.line, text: s.text, message: `${joins + 1} clauses chained with a conjunction: subordinate one, or split the sentence` });
    const commas = (s.text.match(/,/g) ?? []).length;
    if (commas >= 5) add({ rule: "rhythm.commas", severity: "warn", line: s.line, text: s.text, message: `${commas} commas in one sentence (max 4): split it` });
  }

  // §3 contrast framing: at most once.
  const contrasts = paragraphs.flatMap((p) => CONTRAST.flatMap((pattern) => matches(p, pattern)));
  contrasts.slice(1).forEach((m) => add({ rule: "rhythm.contrast", severity: "warn", line: m.line, text: m.text, message: `contrast frame number ${contrasts.indexOf(m) + 1} (max 1 per chapter)` }));

  // §3 one-line paragraphs for drama: at most 2 (a warning), and never 3 in a row (an error).
  const oneLiners = paragraphs.filter((p) => p.sentences.length === 1 && !p.sentences[0].dialogue && p.sentences[0].words.length <= 10);
  const inRun = new Set(oneLiners.filter((p, i) => i >= 2 && oneLiners[i - 2].index === p.index - 2 && oneLiners[i - 1].index === p.index - 1));
  oneLiners.slice(2).forEach((p) =>
    add({
      rule: "rhythm.one-line-paragraphs",
      severity: inRun.has(p) ? "error" : "warn",
      line: p.line,
      text: p.text,
      message: inRun.has(p)
        ? `the third one-line paragraph in a row: join it to the paragraph before or after (lines ${oneLiners.map((x) => x.line).join(", ")})`
        : `${oneLiners.length} one-line paragraphs (max 2 for drama): lines ${oneLiners.map((x) => x.line).join(", ")}`,
    }),
  );

  // §3 em dashes.
  const dashes = paragraphs.flatMap((p) => [...p.text.matchAll(/—|(?<=\S) ?-- ?(?=\S)/g)].map((m) => p.lineAt(m.index)));
  const perThousand = opts.config?.max_em_dash_per_1000 ?? 3;
  const allowed = Math.ceil((perThousand * prose.wordCount) / 1000);
  if (dashes.length > allowed) {
    add({ rule: "rhythm.em-dash", severity: "error", line: dashes[allowed], text: `${dashes.length} em dashes`, message: `${dashes.length} em dashes in ${prose.wordCount} words; max ${allowed}. Lines: ${dashes.join(", ")}` });
  }

  // §1 endings and §2 openings.
  const lastP = paragraphs.at(-1);
  if (lastP) {
    for (const pattern of BANNED_ENDINGS) {
      for (const m of matches(lastP, pattern)) add({ rule: "endings.banned", severity: "error", line: m.line, text: m.text, message: `banned ending (${pattern.id})` });
    }
    const lastS = lastP.sentences.at(-1);
    if (lastS && !lastS.dialogue && /\?["”’)]*$/.test(lastS.text)) {
      add({ rule: "endings.question", severity: "error", line: lastS.line, text: lastS.text, message: "the last line is a question" });
    }
  }
  for (const s of sentences.slice(0, 2)) {
    for (const pattern of BANNED_OPENINGS) {
      pattern.re.lastIndex = 0;
      const m = pattern.re.exec(s.text);
      if (m) add({ rule: "openings.banned", severity: pattern.severity, line: s.line, text: s.text, message: `opening (${pattern.id})` });
    }
  }

  // §4 and §8 repetition inside this file and across the book.
  const corpus = (opts.corpus ?? []).map((c) => ({ file: c.file, prose: parseProse(c.body, c.firstLine) }));
  findings.push(
    ...repeats(similes(prose, file), corpus.flatMap((c) => similes(c.prose, c.file)), "repetition.simile", "error", "simile"),
    ...repeats(ngrams(prose, file), corpus.flatMap((c) => ngrams(c.prose, c.file)), "repetition.phrase", "warn", "phrase"),
  );

  const waive = new Set(opts.waive ?? []);
  const kept = findings
    .filter((f) => !opts.lines || (f.line >= opts.lines[0] && f.line <= opts.lines[1]))
    .map((f) => (waive.has(f.rule) ? { ...f, waived: true } : f))
    .sort((a, b) => a.line - b.line || a.rule.localeCompare(b.rule));
  return { words: prose.wordCount, findings: kept };
}

export { wordsOf };

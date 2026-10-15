/**
 * The shape of the dialogue in a prose file: its turns, how long they are, runs of short turns and echo
 * toppers (guidelines §5, ADR 0008). `lb lint` reports the shapes that break a rule; `lb dialogue` prints
 * the measures, so that a project can compare its chapters with prose that a person wrote.
 *
 * The limits come from 13 chapters of a human-written progression fantasy (Pale Lights) against 40 generated
 * chapters. They suit progression fantasy, the genre of this tool. A terse genre (noir, hard-boiled) has
 * shorter turns: before the tool supports one, measure books of it with `lb dialogue <file>...` and let the
 * project change the limits.
 */
import { STOPWORDS } from "./patterns.ts";
import { type Prose, wordsOf } from "./text.ts";

/** A turn with this many spoken words or fewer is short. */
export const SHORT_TURN = 8;
/** This many short turns in a row is a quip chain (an error). Human prose stays at 4 or fewer. */
export const QUIP_CHAIN = 5;
/** A turn whose paragraph has this many words of narration (a reaction, a thought) ends a run of short turns. */
export const PAUSE_WORDS = 15;
/** This many echo toppers in a chapter is a warning. Human prose has 2 at most; a quote back is not always a quip. */
export const TOPPERS = 3;
/** The turn-length warning needs this many turns in the file. */
export const TURN_LENGTH_MIN_TURNS = 20;
/** The turn-length warning: the median turn is shorter than this, in words. */
export const TURN_LENGTH_MEDIAN = 8;
/** The turn-length warning: more than this share of the turns have 6 words or fewer. */
export const TURN_LENGTH_SHORT_SHARE = 0.45;

export interface Turn {
  /** The paragraph of the turn. */
  paragraph: number;
  line: number;
  scene: number;
  /** The words inside quotation marks. */
  spoken: string;
  words: number;
  /** The words of the paragraph outside the quotation marks: the tag, the beat and the reaction. */
  narration: number;
}

export interface DialogueShape {
  turns: Turn[];
  /** The median of the spoken words in a turn. */
  median: number;
  /** The share of turns with 6 words or fewer. */
  shortShare: number;
  /** The share of turns with 25 words or more. */
  longShare: number;
  /** Each run of consecutive short turns in one scene, with no narration paragraph between them; a turn with a pause ends its run. */
  runs: Turn[][];
  /** Each short turn that takes a word from the short turn just before it ("Brave." / "Stupid-brave."). */
  toppers: { turn: Turn; before: Turn; word: string }[];
}

/** The quoted words of a paragraph, from the quote state at each character, as in parseProse. */
function spokenIn(text: string): string {
  const out: string[] = [];
  let q = false;
  let buf = "";
  for (const ch of text) {
    if (ch === '"' || ch === "“" || ch === "”") {
      const opens: boolean = ch === "“" || (ch === '"' && !q);
      if (!opens && buf) out.push(buf);
      buf = "";
      q = opens;
      continue;
    }
    if (q) buf += ch;
  }
  if (q && buf) out.push(buf);
  return out.join(" ").trim();
}

const median = (xs: number[]) => {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

const contentWords = (s: string) => new Set(wordsOf(s).filter((w) => w.length >= 3 && !STOPWORDS.has(w)));

export function dialogueShape(prose: Prose): DialogueShape {
  const turns: Turn[] = [];
  for (const p of prose.paragraphs) {
    const spoken = spokenIn(p.text);
    const words = wordsOf(spoken).length;
    if (words > 0) turns.push({ paragraph: p.index, line: p.line, scene: p.scene, spoken, words, narration: wordsOf(p.text).length - words });
  }
  const short = (t: Turn) => t.words <= SHORT_TURN;
  // A short beat does not slow the scene; a reaction or a thought of PAUSE_WORDS or more does, as a narration paragraph does.
  const pause = (t: Turn) => t.narration >= PAUSE_WORDS;
  // Two turns are next to each other when no narration paragraph and no scene break is between them.
  const adjacent = (a: Turn, b: Turn) => b.paragraph === a.paragraph + 1 && b.scene === a.scene;

  const runs: Turn[][] = [];
  let run: Turn[] = [];
  for (const t of turns) {
    const last = run.at(-1);
    if (short(t) && last && !pause(last) && adjacent(last, t)) run.push(t);
    else {
      if (run.length) runs.push(run);
      run = short(t) ? [t] : [];
    }
  }
  if (run.length) runs.push(run);

  const toppers: DialogueShape["toppers"] = [];
  for (let i = 1; i < turns.length; i++) {
    const [before, turn] = [turns[i - 1], turns[i]];
    if (!short(before) || !short(turn) || !adjacent(before, turn)) continue;
    const was = contentWords(before.spoken);
    const word = [...contentWords(turn.spoken)].find((w) => was.has(w));
    if (word) toppers.push({ turn, before, word });
  }

  const lengths = turns.map((t) => t.words);
  const share = (f: (n: number) => boolean) => (lengths.length ? lengths.filter(f).length / lengths.length : 0);
  return { turns, median: median(lengths), shortShare: share((n) => n <= 6), longShare: share((n) => n >= 25), runs, toppers };
}

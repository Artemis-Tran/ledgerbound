/** Phrase lists for the lint. The project can add or remove banned phrases and body tells in project.yaml. */

export interface Pattern {
  id: string;
  re: RegExp;
  severity: "error" | "warn";
  /** Only match inside dialogue. */
  dialogueOnly?: boolean;
}

const P = (id: string, re: string, severity: "error" | "warn" = "error"): Pattern => ({ id, re: new RegExp(re, "giu"), severity });

const PRON = "(?:his|her|their|my|your|its|\\w+['’]s)";
const SUBJ = "(?:he|she|they|i|you|we)";

/** guidelines §4. `warn` where a literal use is common (the judge decides). */
export const BANNED: Pattern[] = [
  P("testament-to", "\\btestaments? to\\b"),
  P("tapestry", "\\btapestr(?:y|ies)\\b"),
  P("symphony", "\\bsymphon(?:y|ies)\\b"),
  P("dance-metaphor", "\\bdanc(?:e|ed|es|ing)\\b", "warn"),
  P("palpable", "\\bpalpabl[ey]\\b"),
  P("visceral", "\\bvisceral(?:ly)?\\b"),
  P("electric-air", "\\b(?:air|tension|atmosphere)\\s+(?:was\\s+|grew\\s+|felt\\s+)?electric\\b|\\belectric(?:al)?\\s+(?:air|tension)\\b"),
  P("unspoken", "\\bunspoken\\b"),
  P("delve", "\\bdelv(?:e|ed|es|ing)\\b"),
  P("intricate", "\\bintricate(?:ly)?\\b"),
  P("a-flicker-of", "\\ba flicker of\\b"),
  P("something-akin-to", "\\bsomething akin to\\b"),
  P("in-that-moment", "\\bin that moment\\b"),
  P("the-weight-of", `\\bthe weight of (?:the|${PRON}) (?:words?|world)\\b`),
  P("breath-didnt-know", "\\bbreath (?:he|she|they|i|you|we) (?:didn['’]t|did not|hadn['’]t) (?:know|realiz)"),
  P("let-out-a-breath", "\\blet(?:s|ting)? out a (?:long |slow |shaky |shuddering )?breath\\b"),
  P("jaw-tightened", "\\bjaws? (?:tighten|clench)(?:ed|ing|s)?\\b|\\b(?:tighten|clench)(?:ed|ing|s)? " + PRON + " jaw\\b"),
  P("eyes-widened", "\\beyes (?:widen(?:ed|ing|s)?|went wide)\\b"),
  P("voice-barely-whisper", "\\bbarely above a whisper\\b"),
  P("silence-stretched", "\\b(?:the )?silence stretch(?:ed|es|ing)\\b"),
  P("a-beat-passed", "\\ba beat pass(?:ed|es)\\b"),
  P("time-seemed-to-slow", "\\btime (?:seemed to )?slow(?:ed)?(?: down)?\\b"),
  P("air-grew-thick", "\\bthe air (?:grew|was|went|turned) thick\\b"),
  P("shivers-down-spine", `\\b(?:shivers?|chills?) (?:ran |went |raced |crawled )?(?:up|down) ${PRON} spine\\b`),
  P("ozone", "\\bozone\\b"),
  P("copper-tang", "\\bcopper(?:y)? (?:tang|taste)\\b"),
  P("dog-barked", "\\bsomewhere,? a dog bark(?:ed|s)\\b"),
  P("first-time-in-a-long-time", "\\bfor the first time in (?:a long time|years|ages)\\b"),
  P("impossibly", "\\bimpossibly \\w+"),
  P("couldnt-help-but", "\\b(?:couldn['’]t|could not|can['’]t|cannot) help but\\b"),
  P("a-mix-of", "\\ba (?:mix|mixture|blend) of \\w+ and \\w+"),
  P("it-was-as-if", "\\bit was as if\\b"),
  P("sent-a-jolt", "\\bsen(?:t|ds|ding) a jolt\\b"),
  P("world-narrowed", "\\b(?:the )?world narrow(?:ed|s|ing)\\b"),
  P("every-fiber", "\\bevery fib(?:er|re) of\\b"),
  P("smirk", "\\bsmirk(?:s|ed|ing)?\\b"),
  P("padded", "\\bpadd(?:ed|ing) (?:across|down|through|over|into|out|to|along|up|back|barefoot)\\b"),
  P("orbs", "\\borbs\\b"),
  P("steeled", "\\bsteel(?:ed|ing|s) (?:himself|herself|themselves|myself|yourself|ourselves)\\b"),
];

/** guidelines §4, body tells. At most twice per chapter each. */
export const BODY_TELLS: Pattern[] = [
  P("nod", "\\bnod(?:s|ded|ding)?\\b"),
  P("sigh", "\\bsigh(?:s|ed|ing)?\\b"),
  P("clenched-fist", `\\b(?:clench|ball)(?:ed|es|s|ing)? ${PRON} (?:fists?|hands?)\\b|\\bfists? clench(?:ed)?\\b`),
  P("raised-eyebrow", `\\b(?:rais|arch|lift|quirk)(?:ed|es|s|ing)? (?:an|a|one|${PRON}) (?:eye)?brows?\\b|\\b(?:eye)?brows? (?:rose|lifted|shot up|went up)\\b`),
  P("shrug", "\\bshrug(?:s|ged|ging)?\\b"),
  P("swallowed-hard", "\\bswallow(?:ed|s)? hard\\b"),
  P("hand-through-hair", `\\bran (?:a|${PRON}) hands? through ${PRON} hair\\b`),
  P("bit-lip", `\\bb(?:it|ites|iting) ${PRON} lip\\b`),
  P("grin", "\\bgrin(?:s|ned|ning)?\\b"),
  P("rubbed-temples", `\\brub(?:bed|s|bing)? ${PRON} (?:temples?|eyes|face)\\b`),
];

/** guidelines §1: banned ending lines. Checked in the last paragraph. */
export const BANNED_ENDINGS: Pattern[] = [
  P("never-the-same", "\\bnothing would (?:ever )?be the same\\b|\\bnever be the same\\b"),
  P("everything-changed", "\\beverything (?:had )?changed\\b"),
  P("little-did", `\\blittle did ${SUBJ} know\\b`),
  P("another-day", "\\ba problem for another day\\b|\\bfor another day\\b"),
  P("it-was-enough", "\\bfor now,? (?:it|that) was enough\\b|\\bit would have to be enough\\b"),
  P("tomorrow-bring", "\\bwhat (?:would|will) tomorrow bring\\b"),
  P("wondered-consequences", `\\b${SUBJ} wondered (?:how|what|whether|if)\\b`),
  P("sleep", "\\b(?:fell|drifted (?:off )?(?:in)?to|slipped into) (?:a )?(?:\\w+ )?sleep\\b|\\bsleep took\\b"),
  P("sunset", "\\bsunset\\b|\\bthe sun (?:set|sank|dipped|slipped)\\b"),
  P("lesson", "\\bafter all\\.?$|\\bmaybe (?:strength|power|courage) (?:wasn['’]t|was never|isn['’]t)\\b"),
];

/** guidelines §2. Checked in the first two sentences. */
export const BANNED_OPENINGS: Pattern[] = [
  P("waking", "\\b(?:woke|awoke|wakes|waking|awakened)\\b", "warn"),
  P("weather", "^(?:the )?(?:sun|dawn|morning light|rain|snow|wind|fog|mist|clouds?)\\b", "warn"),
  P("sun-rose", "\\bthe sun (?:rose|was rising|crept|climbed)\\b", "warn"),
];

export const HEDGES: Pattern[] = [
  P("somehow", "\\bsomehow\\b", "warn"),
  P("seemed-to", "\\bseem(?:ed|s|ing) to\\b", "warn"),
  P("almost-as-if", "\\balmost as (?:if|though)\\b", "warn"),
  P("a-sort-of", "\\ba (?:sort|kind) of\\b", "warn"),
];

export const THERAPY: Pattern[] = [
  P("i-hear-you", "\\bi hear you\\b", "warn"),
  P("thats-valid", "\\b(?:that['’]s|that is|it['’]s|feelings are) valid\\b", "warn"),
  P("boundaries", "\\bboundar(?:y|ies)\\b", "warn"),
  P("process-this", "\\bprocess (?:this|that|it|what)\\b", "warn"),
  P("need-you-to-understand", "\\bi need you to understand\\b", "warn"),
  P("space", "\\b(?:need|give|want) (?:me |you |us |them |him |her )?(?:some )?space\\b", "warn"),
  P("trauma", "\\btrauma(?:tic|tized|tised)?\\b", "warn"),
].map((p) => ({ ...p, dialogueOnly: true }));

export const TAGS: Pattern[] = [
  P("tag-adverb", "\\b(?:said|asked|replied|answered|whispered|muttered)\\s+\\w+ly\\b", "warn"),
  P("fancy-tag", `["”],?\\s+(?:${SUBJ}|\\p{Lu}\\p{Ll}+)\\s+(?:hissed|growled|breathed|snarled|purred|barked|spat|chuckled|laughed|sighed|snapped|drawled|intoned)\\b|\\b(?:hissed|growled|breathed|snarled|purred|barked|spat|drawled|intoned)\\s+(?:${SUBJ}|\\p{Lu}\\p{Ll}+)\\b`, "warn"),
];

export const CONTRAST: Pattern[] = [
  P("wasnt-x-was-y", "\\b(?:it|this|that|he|she|they)\\s+(?:wasn['’]t|was not|isn['’]t|is not)\\s+[^.!?]{1,60}[.;]\\s+(?:it|this|that|he|she|they)\\s+(?:was|is)\\b", "warn"),
  P("not-because-but-because", "\\bnot because\\b[^.!?]{1,100},?\\s+but because\\b", "warn"),
  P("not-x-but-y", "\\bnot (?:just |only |merely |a |an |the )?\\w+(?: \\w+){0,3},\\s+but\\b", "warn"),
];

export const STOPWORDS = new Set(
  "a an the and or but if of to in on at by for with from as is was were be been are am it its it's this that these those he she they i you we him her them his hers their my your our me us not no so then than there here what which who whom when where why how all any some into out up down over under again just only very too can could would should will shall do did does had has have".split(
    " ",
  ),
);

/**
 * guidelines §4 Names: the 20 names that language models give characters most often, from published
 * counts of AI-generated stories. A name matches only with its capital letter, so the verb "vex" is no name.
 * The project cannot remove them: a reader who knows AI fiction knows these names.
 */
export const AI_NAMES: { name: string; re: string }[] = [
  { name: "Elara", re: "Elara" },
  { name: "Kael", re: "Kael(?:en|in|yn|a)?" },
  { name: "Lyra", re: "Lyra" },
  { name: "Thorne", re: "Thorne" },
  { name: "Voss", re: "Voss" },
  { name: "Kira", re: "Kira" },
  { name: "Vance", re: "Vance" },
  { name: "Vex", re: "Vex" },
  { name: "Eleanor", re: "Eleanor" },
  { name: "Elena", re: "Elena" },
  { name: "Marcus", re: "Marcus" },
  { name: "Mara", re: "Mara" },
  { name: "Anya", re: "Anya" },
  { name: "Eira", re: "Eira" },
  { name: "Aldric", re: "Aldric" },
  { name: "Zara", re: "Zara" },
  { name: "Althea", re: "Althea" },
  { name: "Elias", re: "Elias" },
  { name: "Arin", re: "Arin" },
  { name: "Hartley", re: "Hartley" },
];

export const NAMES: Pattern[] = AI_NAMES.map((n) => ({
  id: n.name.toLowerCase(),
  re: new RegExp(`(?<![\\p{L}\\p{N}])${n.re}(?![\\p{L}\\p{N}])`, "gu"),
  severity: "error" as const,
}));

/** The AI default names in a text, each once. */
export const aiNamesIn = (text: string): string[] => AI_NAMES.filter((_, i) => new RegExp(NAMES[i].re.source, "u").test(text)).map((n) => n.name);

export const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

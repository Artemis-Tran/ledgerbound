/**
 * The rule IDs of guidelines/writing.md. Lint findings, check-prose findings and
 * chapter-plan `exceptions` all use these IDs. `lb rules` prints this list.
 *
 * check: `lint` = lb lint checks it; `judge` = check-prose judges it; `plan` = lb validate checks it.
 */
export interface Rule {
  id: string;
  section: string;
  check: ("lint" | "judge" | "plan")[];
  summary: string;
}

export const RULES: Rule[] = [
  { id: "endings.banned", section: "1", check: ["lint", "judge"], summary: "No reflection, wondering, empty foreshadowing, moral, sleep/sunset or 'it was enough' ending." },
  { id: "endings.question", section: "1", check: ["lint"], summary: "The last line is not a rhetorical question." },
  { id: "endings.new", section: "1", check: ["judge"], summary: "The last paragraph gives something new and stops in motion." },
  { id: "endings.type-repeat", section: "1", check: ["plan", "judge"], summary: "Two consecutive chapters do not use the same ending type." },
  { id: "endings.cliffhanger-rate", section: "1", check: ["plan"], summary: "At most one cliffhanger in any three consecutive chapters." },
  { id: "openings.banned", section: "2", check: ["lint", "judge"], summary: "No waking up, weather or sunrise opening." },
  { id: "openings.recap", section: "2", check: ["judge"], summary: "No recap of the previous chapter." },
  { id: "openings.in-scene", section: "2", check: ["judge"], summary: "Start inside a scene with a character who does or wants something." },
  { id: "rhythm.staccato", section: "3", check: ["lint", "judge"], summary: "At most 2 consecutive sentences under 6 words (action beats: never 3 of one structure)." },
  { id: "rhythm.openings", section: "3", check: ["lint"], summary: "No 3 consecutive sentences that start with the same word." },
  { id: "rhythm.anadiplosis", section: "3", check: ["lint", "judge"], summary: "A sentence does not start with the last word of the one before." },
  { id: "rhythm.triplets", section: "3", check: ["judge"], summary: "No automatic lists of three." },
  { id: "rhythm.contrast", section: "3", check: ["lint", "judge"], summary: "At most one 'not X, but Y' contrast frame per chapter." },
  { id: "rhythm.one-line-paragraphs", section: "3", check: ["lint", "judge"], summary: "At most 2 one-line dramatic paragraphs per chapter." },
  { id: "rhythm.em-dash", section: "3", check: ["lint"], summary: "At most 3 em dashes per 1,000 words." },
  { id: "rhythm.variety", section: "3", check: ["judge"], summary: "Sentence length varies with the content, not with a pattern." },
  { id: "words.banned", section: "4", check: ["lint"], summary: "No banned word or phrase." },
  { id: "words.body-tells", section: "4", check: ["lint"], summary: "The same body tell at most twice per chapter." },
  { id: "dialogue.stated-feelings", section: "5", check: ["judge"], summary: "Characters do not explain their emotions." },
  { id: "dialogue.therapy", section: "5", check: ["lint", "judge"], summary: "No therapy language in casual speech." },
  { id: "dialogue.subtext", section: "5", check: ["judge"], summary: "The important thing is often not said." },
  { id: "dialogue.direct-answers", section: "5", check: ["judge"], summary: "Not every question gets a direct answer." },
  { id: "dialogue.voices", section: "5", check: ["judge"], summary: "Each line sounds like its speaker's voice card." },
  { id: "dialogue.as-you-know", section: "5", check: ["judge"], summary: "Characters do not tell each other what they both know." },
  { id: "dialogue.speeches", section: "5", check: ["judge"], summary: "A turn is 1-3 sentences unless the plan gives a reason." },
  { id: "dialogue.banter", section: "5", check: ["judge"], summary: "Jokes come from character; no one-register banter." },
  { id: "dialogue.aphorisms", section: "5", check: ["judge"], summary: "No wise aphorisms." },
  { id: "dialogue.tags", section: "5", check: ["lint", "judge"], summary: "Mostly 'said'/'asked' or no tag; no tag adverbs; no fancy tag verbs." },
  { id: "dialogue.action-beats", section: "5", check: ["judge"], summary: "Action beats are not on every line." },
  { id: "dialogue.names", section: "5", check: ["judge"], summary: "Characters rarely say each other's names." },
  { id: "dialogue.honest-talk", section: "5", check: ["judge"], summary: "Conflict is not resolved by one honest talk." },
  { id: "emotion.named", section: "6", check: ["judge"], summary: "Do not name an emotion that was already shown." },
  { id: "emotion.explained", section: "6", check: ["judge"], summary: "Do not explain the meaning of a scene." },
  { id: "emotion.hedges", section: "6", check: ["lint"], summary: "No hedges (somehow, seemed to, almost as if, a sort of)." },
  { id: "emotion.generic", section: "6", check: ["judge"], summary: "Specific, setting-owned nouns, not generic ones." },
  { id: "emotion.tidy", section: "6", check: ["judge"], summary: "No tidy resolution." },
  { id: "litrpg.status-windows", section: "7", check: ["judge"], summary: "Status windows only where a change matters; show the delta; use the window template." },
  { id: "litrpg.fold-match", section: "7", check: ["judge"], summary: "Stats match the fold." },
  { id: "litrpg.notifications", section: "7", check: ["judge"], summary: "Vary reactions to notifications; no notification streams." },
  { id: "litrpg.cost", section: "7", check: ["judge"], summary: "Gains come from effort, risk or sacrifice shown on the page." },
  { id: "litrpg.system-musing", section: "7", check: ["judge"], summary: "No meta-musing about the System as filler." },
  { id: "litrpg.fights", section: "7", check: ["judge"], summary: "Fights have clear geography, a changing situation and a cost." },
  { id: "repetition.simile", section: "4, 8", check: ["lint"], summary: "The same simile never twice in a book." },
  { id: "repetition.phrase", section: "8", check: ["lint", "judge"], summary: "The same distinctive phrase never twice in a book." },
  { id: "repetition.verbal-habit", section: "8", check: ["judge"], summary: "A character's verbal habit at most once every few chapters." },
];

export const RULE_IDS = new Set(RULES.map((r) => r.id));

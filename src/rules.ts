/**
 * The rule IDs of guidelines/writing.md. Lint findings, check-prose findings and
 * chapter-plan `exceptions` all use these IDs. `lb rules` prints this list.
 *
 * check: `lint` = lb lint checks it; `judge` = check-prose judges it; `plan` = lb validate checks it;
 * `record` = lb delta checks it (not in guidelines/writing.md: the record's own limits).
 * Section `bible`: the rule comes from the story bible, not from guidelines/writing.md.
 * Section `plan`: the rule comes from the chapter plan and project.yaml.
 *
 * A rule that only `lint` checks is a count or a pattern: lb lint gives its severity, and nobody judges it again.
 * `max: "warn"`: a finding of this rule is always a warning. Such a rule is a matter of taste or frequency,
 * so one finding never blocks a chapter.
 */
export interface Rule {
  id: string;
  section: string;
  check: ("lint" | "judge" | "plan" | "record")[];
  summary: string;
  max?: "warn";
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
  { id: "rhythm.staccato", section: "3", check: ["lint"], summary: "At most 2 consecutive sentences under 6 words (action beats: never 3 of one structure)." },
  { id: "rhythm.openings", section: "3", check: ["lint"], summary: "No 3 consecutive sentences that start with the same word." },
  { id: "rhythm.anadiplosis", section: "3", check: ["lint", "judge"], summary: "A sentence does not start with the last word of the one before for effect; a chain of reasoning is permitted.", max: "warn" },
  { id: "rhythm.triplets", section: "3", check: ["judge"], summary: "No automatic lists of three.", max: "warn" },
  { id: "rhythm.contrast", section: "3", check: ["lint", "judge"], summary: "At most one 'not X, but Y' contrast frame per chapter.", max: "warn" },
  { id: "rhythm.clause-chains", section: "3", check: ["lint"], summary: "No sentence with 2 or more clauses joined by ', and' / ', but' / ', so'.", max: "warn" },
  { id: "rhythm.commas", section: "3", check: ["lint"], summary: "At most 4 commas in one sentence.", max: "warn" },
  { id: "rhythm.one-line-paragraphs", section: "3", check: ["lint"], summary: "At most 2 one-line dramatic paragraphs per chapter; never 3 in a row." },
  { id: "rhythm.em-dash", section: "3", check: ["lint"], summary: "At most 3 em dashes per 1,000 words." },
  { id: "rhythm.variety", section: "3", check: ["judge"], summary: "Sentence length varies with the content, not with a pattern.", max: "warn" },
  { id: "words.banned", section: "4", check: ["lint"], summary: "No banned word or phrase." },
  { id: "names.ai-default", section: "4", check: ["lint"], summary: "No character, place or thing has one of the 20 names that AI fiction overuses (Elara, Kael, Lyra, Thorne, Voss...)." },
  { id: "words.body-tells", section: "4", check: ["lint"], summary: "The same body tell at most twice per chapter." },
  { id: "dialogue.tone-clear", section: "5", check: ["judge"], summary: "By the third exchange a reader can name the tone (joke, sarcasm, argument, threat); subtext hides the reason, not the tone." },
  { id: "dialogue.stated-feelings", section: "5", check: ["judge"], summary: "A feeling is said only when the character would say it, in their own voice; no explained feelings." },
  { id: "dialogue.therapy", section: "5", check: ["lint", "judge"], summary: "Therapy language only from a character whose voice card uses it." },
  { id: "dialogue.subtext", section: "5", check: ["judge"], summary: "The important thing is often said at an angle, but not every line: the turn of a scene can be said plainly." },
  { id: "dialogue.direct-answers", section: "5", check: ["judge"], summary: "Not every question gets a direct answer.", max: "warn" },
  { id: "dialogue.voices", section: "5", check: ["judge"], summary: "Each line sounds like its speaker's voice card." },
  { id: "dialogue.states", section: "5", check: ["judge"], summary: "A character in a state of their voice card (angry, afraid, lying, close) speaks as the state says, and still in their own voice." },
  { id: "dialogue.as-you-know", section: "5", check: ["judge"], summary: "Characters do not tell each other what they both know." },
  { id: "dialogue.speeches", section: "5", check: ["judge"], summary: "Turn length follows the moment: 1-3 sentences in a quick exchange, longer and less tidy under strong feeling; a lecture or info-dump needs a reason in the plan." },
  { id: "dialogue.plain-talk", section: "5", check: ["judge"], summary: "Banter only between characters whose voice card or relationship `talk` asks for it; the dialogue sample's speech pattern belongs to its pair, not to the book." },
  { id: "dialogue.quip-chain", section: "5", check: ["judge"], summary: "After about four quick one-line exchanges, something slows the scene: a longer turn, a reaction, a silence the POV character feels." },
  { id: "dialogue.natural", section: "5", check: ["judge"], summary: "Speech is less tidy than narration: restarts, half answers, trailing off; not every line is clever.", max: "warn" },
  { id: "dialogue.delivery", section: "5", check: ["judge"], summary: "At the lines that matter, the reader hears how the line is said and sees each speaker's feeling on the outside." },
  { id: "dialogue.banter", section: "5", check: ["judge"], summary: "Jokes come from each speaker's voice card; quips answer, raise the stakes and have a winner; a funny scene has jokes that land." },
  { id: "dialogue.aphorisms", section: "5", check: ["judge"], summary: "No wise aphorisms." },
  { id: "dialogue.tags", section: "5", check: ["lint", "judge"], summary: "Mostly 'said'/'asked' or no tag; no tag adverbs; no fancy tag verbs." },
  { id: "dialogue.action-beats", section: "5", check: ["judge"], summary: "Action beats are not on every line.", max: "warn" },
  { id: "dialogue.names", section: "5", check: ["judge"], summary: "Characters rarely say each other's names.", max: "warn" },
  { id: "dialogue.honest-talk", section: "5", check: ["judge"], summary: "Conflict is not resolved by one honest talk." },
  { id: "emotion.wound-told", section: "6", check: ["judge"], summary: "A character's wound shows only in what they avoid: no flashback, full memory or explanation of it." },
  { id: "emotion.felt", section: "6", check: ["judge"], summary: "At each turn that matters, the reader knows how it lands in the POV character: body, thought, what they hold back." },
  { id: "emotion.named", section: "6", check: ["judge"], summary: "Do not name an emotion that only repeats what was shown, or a label with no body in it; the POV character can name a feeling in their own words when it adds something." },
  { id: "emotion.explained", section: "6", check: ["judge"], summary: "Do not explain the meaning of a scene." },
  { id: "emotion.hedges", section: "6", check: ["lint"], summary: "No hedges (somehow, seemed to, almost as if, a sort of)." },
  { id: "emotion.generic", section: "6", check: ["judge"], summary: "Specific, setting-owned nouns, not generic ones.", max: "warn" },
  { id: "looks.shown", section: "6", check: ["judge"], summary: "A character new to the book, back after a long gap, or with a changed appearance gets 1–2 details of how they look; never a list of looks or a mirror.", max: "warn" },
  { id: "emotion.tidy", section: "6", check: ["judge"], summary: "No tidy resolution." },
  { id: "litrpg.status-windows", section: "7", check: ["judge"], summary: "Status windows only where a change matters; show the delta; use the window template." },
  { id: "windows.off", section: "7", check: ["lint"], summary: "With `windows: off` in project.yaml, no status window: the prose shows progression." },
  { id: "length.target", section: "plan", check: ["lint"], summary: "The chapter is within 25% of its target length: the plan's `words`, else `chapter_words` in project.yaml." },
  { id: "draws.excluded", section: "bible", check: ["judge"], summary: "Nothing that an `excludes` draw in bible.md rules out. No chapter-plan exception waives it." },
  { id: "litrpg.fold-match", section: "7", check: ["judge"], summary: "Stats match the fold." },
  { id: "litrpg.notifications", section: "7", check: ["judge"], summary: "Vary reactions to notifications; no notification streams.", max: "warn" },
  { id: "litrpg.cost", section: "7", check: ["judge"], summary: "Gains come from effort, risk or sacrifice shown on the page." },
  { id: "litrpg.system-musing", section: "7", check: ["judge"], summary: "No meta-musing about the System as filler." },
  { id: "litrpg.fights", section: "7", check: ["judge"], summary: "Fights have clear geography, a changing situation and a cost." },
  { id: "voice.match", section: "9", check: ["judge"], summary: "The narration sounds like the voice samples: vocabulary, sentence rhythm, POV distance (at least as close), how much it explains of the world and plot." },
  { id: "plain.words", section: "11", check: ["judge"], summary: "By default (unless the bible's prose-style or the scene asks for richer prose): common words before rare ones; one main idea per sentence; at most one image or metaphor per paragraph.", max: "warn" },
  { id: "plain.terms", section: "11", check: ["judge"], summary: "By default: at most one new term (name, title, place, creature, custom, System term) per sentence, and two per paragraph." },
  { id: "grammar.splice", section: "12", check: ["judge"], summary: "No comma splice and no run-on sentence: two full clauses are joined by a conjunction, a semicolon or a full stop." },
  { id: "grammar.fragment", section: "12", check: ["judge"], summary: "A fragment has a clear reason (voice, speech, one hard beat), and never stands where the sense needs a verb." },
  { id: "grammar.conjunction", section: "12", check: ["judge"], summary: "A conjunction shows the real relation (because, but, then, while); no 'and' that only means 'next', and no bare sentences where one is needed." },
  { id: "grammar.commas", section: "12", check: ["judge"], summary: "Commas are where the grammar needs them: after an opening clause, round an aside, before a conjunction between full clauses; none between subject and verb." },
  { id: "tension.stakes", section: "13", check: ["judge"], summary: "The chapter's stakes are on the page before its turn: the reader knows what the POV character can lose, and why it matters to them." },
  { id: "tension.match", section: "13", check: ["judge"], summary: "The chapter reads at its planned tension level: the pressure, pace and cost that §13 gives for the level." },
  { id: "tension.inflated", section: "13", check: ["judge"], summary: "High tension comes from events, time and cost, not from inflated emotion or a narrator who says that it is tense." },
  { id: "tension.flat", section: "13", check: ["plan"], summary: "No 4 or more consecutive chapters at the same tension level.", max: "warn" },
  { id: "tension.after-peak", section: "13", check: ["plan"], summary: "The chapter after one at the book's highest tension is lower.", max: "warn" },
  { id: "tension.act-rise", section: "13", check: ["plan"], summary: "The highest tension of an act is not lower than the highest tension of the act before it.", max: "warn" },
  { id: "tension.results", section: "13", check: ["plan"], summary: "Each act has at least one scene with the result `loss` or `mixed`.", max: "warn" },
  { id: "bonding.tension", section: "13", check: ["plan"], summary: "A bonding chapter is at the lowest tension of the book's range.", max: "warn" },
  { id: "bonding.rate", section: "13", check: ["plan"], summary: "At most one bonding chapter in an act, and never two in a row.", max: "warn" },
  { id: "bonding.climax", section: "13", check: ["plan"], summary: "No bonding chapter in the climax or in the chapter just before it.", max: "warn" },
  { id: "bonding.cast", section: "13", check: ["plan"], summary: "A bonding chapter has two characters of a relationship file in its cast.", max: "warn" },
  { id: "bonding.shift", section: "13", check: ["judge"], summary: "A bonding chapter is relaxed, with no clock and no enemy that acts; its value shift is in a relationship, and its small conflict is inside it.", max: "warn" },
  { id: "repetition.simile", section: "4, 8", check: ["lint"], summary: "The same simile never twice in a book." },
  { id: "repetition.phrase", section: "8", check: ["lint", "judge"], summary: "The same distinctive phrase never twice in a book, and never a phrase from a voice sample.", max: "warn" },
  { id: "repetition.image", section: "8", check: ["judge"], summary: "No simile, image or gesture of the book's phrase log (`lb phrases`) again in the book, in the same words or in other words." },
  { id: "record.max-step", section: "rec", check: ["record"], summary: "A counter changes by at most its max_step in one chapter." },
  { id: "record.direction", section: "rec", check: ["record"], summary: "A counter or ladder changes only in its direction (a ladder only goes up)." },
  { id: "repetition.verbal-habit", section: "8", check: ["judge"], summary: "A character's verbal habit at most once every few chapters.", max: "warn" },
];

export const RULE_IDS = new Set(RULES.map((r) => r.id));

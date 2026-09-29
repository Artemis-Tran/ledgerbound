# Writing guidelines

These rules apply to all prose. `lint-prose` checks the rules marked **[lint]**. `check-prose`
judges the rest. A rule can be broken on purpose, but only once, for a clear effect, and the
chapter plan must say why.

## 1. Chapter endings

AI chapters end the same way. That is the most visible tic.

**Banned endings:**
- Reflection on change: "She knew nothing would ever be the same." / "Everything had changed."
- Wondering about consequences: "He wondered how this would affect the System." / "What would
  tomorrow bring?"
- Ominous foreshadowing with no content: "Little did he know…" / "But that was a problem for another day."
- A moral or lesson summary: "Maybe strength wasn't about levels after all."
- Going to sleep, watching the sunset, or "for now, it was enough."
- A rhetorical question as the last line.

**Instead**, the last paragraph must give the reader something **new**: a fact, a decision, an
action, a line of dialogue, an arrival, a number that changed, a concrete image. Stop in motion,
not in reflection. Cut the last paragraph and check: if the chapter is better without it, keep it cut.

**Ending types.** Record one in memory for each chapter: `action`, `dialogue`, `reveal`,
`decision`, `image`, `cliffhanger`, `quiet-cut`. The type is the kind of the last new thing (the
hook). One short beat after it that only reacts to it (a look, a pause) keeps its type: a last line
of dialogue with a look after it is `dialogue`. Two consecutive chapters must not use the same
type. A book uses `cliffhanger` for no more than one chapter in three.

## 2. Chapter openings
- No recap of the previous chapter.
- No waking up, no weather, no "The sun rose over…".
- Start inside a scene, with a character who does something or wants something.

## 3. Sentence rhythm
- **[lint] Staccato runs**: no more than 2 consecutive sentences under 6 words. The exception is a
  fast action beat, and even then, never 3 with the same subject or structure.
  Bad: "It was cold. It was dark. Dark was good."
- **[lint] Repeated openings**: no 3 consecutive sentences that start with the same word or
  structure ("It was…", "He…", "The…").
- **Anadiplosis**: do not start a sentence with the last word of the one before for effect
  ("…dark. Dark was good."): the echo that makes a beat sound deep. A chain of reasoning, where
  each step takes up the last term of the step before because the character thinks in links
  ("…from Body Writs. Body Writs were signed by working people, so…"), is permitted.
- **Triplets**: no automatic lists of three ("cold, dark, and silent"). Use one precise item, two,
  or four. If you use three, the third must add something.
- **[lint] Clause chains**: no sentence with 2 or more clauses joined by ", and" / ", but" / ", so"
  (a triplet of clauses). Each "and" then only means "next". Subordinate one clause, or split.
  Bad: "Then they were gone, and the sand was grey and pocked, and the sea came in over it."
  Better: "Then they were gone. The sand lay grey and pocked, and the sea came in over it."
- **[lint] Commas**: at most 4 commas in one sentence. Split it.
- **Contrast framing**: no "It wasn't X. It was Y." / "not X, but Y" / "Not because X, but because
  Y". At most once per chapter.
- **[lint] One-line paragraphs for drama**: at most 2 per chapter, and never 3 in a row.
- **[lint] Em dashes**: at most 3 per 1,000 words.
- Vary sentence length because the content needs it, not because of a pattern.

## 4. Banned words and phrases [lint]
testament to, tapestry, symphony (of), dance (as a metaphor), palpable, visceral, electric (air or
tension), unspoken, delve, intricate, a flicker of, something akin to, in that moment, the weight
of (the words, the world), a breath he didn't know he was holding, let out a breath, jaw
tightened/clenched, eyes widened, voice barely above a whisper, the silence stretched, a beat
passed, time seemed to slow, the air grew thick, shivers down (her) spine, ozone, the copper tang
of blood, somewhere a dog barked, for the first time in a long time, impossibly (+adjective),
couldn't help but, a mix of X and Y, it was as if, sent a jolt, the world narrowed, every fiber of
his being, smirk, padded (walking), orbs (eyes), steeled himself.

The project can add or remove words in `project.yaml`.

**[lint] Names**: every character, place and thing gets a name from the setting's own language,
class and history: a digger's son in a slate town is Ivo or Pell. These 20 names are the ones that
AI fiction overuses, and a reader who knows AI fiction knows them; they are never used, and the
project cannot remove them: Elara, Kael (Kaelen, Kaelin, Kaelyn, Kaela), Lyra, Thorne, Voss, Kira,
Vance, Vex, Eleanor, Elena, Marcus, Mara, Anya, Eira, Aldric, Zara, Althea, Elias, Arin, Hartley.
`lb lint` checks the prose, and `lb validate` checks the planning files.

**[lint] Gestures that repeat**: the same body tell (a nod, a sigh, a clenched fist, a raised
eyebrow) at most twice per chapter. The same simile never twice in a book.

## 5. Dialogue

AI dialogue fails in two directions. It is too complete, too articulate and too self-aware, and
everyone sounds the same. Or it is so quiet and indirect that the reader cannot see who the
characters are, or if the scene is a joke, a fight or a threat. Good dialogue has subtext **and**
text: some things are said at an angle, and some are said plainly.

- **The tone is clear; the reason can stay hidden.** Subtext hides *why* a character says a line.
  It does not hide *how* they say it. By the third exchange, a reader can name the tone of the
  scene: a joke, sarcasm, an argument, a threat, tenderness. When the scene has a `tone` in the
  chapter plan, that is the target.
- **Subtext and text.** In most exchanges, the important thing is said at an angle: a character
  answers a different question, gives a non-answer, interrupts or lies. But the turn of a scene
  (a confession, a threat, a refusal, a decision) is often said plainly, and it hits harder after
  the indirect lines. A scene where every line is indirect is flat.
- **Not every question gets a direct answer**, and not every question avoids one.
- **Feelings are said when the character would say them.** A blunt character, a breaking point
  or a confession can put a feeling in words: short, in the speaker's own voice, and it costs them
  something or changes the scene. The fault is the explained feeling that no person says ("I'm
  angry because you lied to me"), and a feeling that the scene already showed.
- **Therapy language belongs to the characters who would use it**: a healer, a counselor, a
  character from our world. Put those words in their voice card's `vocabulary`. From anyone else,
  in casual speech, it is out of place: "I hear you", "that's valid", "boundaries", "process
  this", "I need you to understand", "space", "trauma".
- **Distinct voices**: each line sounds like its speaker's voice card. Test: remove the tags.
  If you cannot tell who speaks, rewrite it.
- **Voices under pressure**: when a scene puts a character in one of the `states` of their voice
  card (angry, afraid, lying, close), their speech changes as the state says, and it is still
  their voice. A character who talks the same when calm and when afraid is one note. Use the
  state's `tell` at most once in a scene.
- **Personality is on the page.** Each speaker wants something in the scene and goes after it in
  their own way. The card's `humour` shows when the scene allows it: a dry character is dry on the
  page, and the reader sees it.
- **Sarcasm needs a truth that the reader knows** and that the line contradicts. Give the reader
  that truth before the line, or in the answer to it.
- **Banter comes from character.** Each speaker jokes in their own way, from their voice card, not
  in one shared register. In a back-and-forth, each quip answers the previous line and raises the
  stakes, and the exchange ends when one character wins, loses or leaves. A scene that the plan
  marks as funny has jokes that land. A scene with no reason for a joke has none.
- **No "As you know"**: characters do not tell each other things they both know.
- **No speeches**: in normal conversation, a turn is 1–3 sentences. Monologues need a reason in the
  plan (a villain monologue needs a very good reason).
- **No wise aphorisms** from mentors ("Strength isn't in the blade, it's in the heart").
- **Tags**: mostly "said" and "asked", or no tag. No adverbs on tags ("she said softly"). No fancy
  verbs (hissed, growled, breathed) unless the sound is literal.
- **Action beats**: not on every line. Do not follow each line with a gesture.
- **Names**: characters rarely say each other's names in conversation.
- **Conflict is not resolved by one honest talk.** Agreement costs something or comes slowly.

## 6. Emotion and narration
- **The wound stays under the page.** A character's `wound` is for the writer. The prose shows it
  only in what the character avoids, refuses or cannot say: no flashback, no memory told in full,
  and no line that explains it. A plan that reveals the wound names it in an `exceptions` entry.
- **The contradiction shows without comment.** When a scene allows, the character does the thing
  that goes against their type, and the narration does not explain it.
- **Do not explain the meaning of a scene** after it happens. Trust the reader.
- **No hedges**: somehow, seemed to, almost as if, a sort of.
- **Specific, not generic**: "a chipped enamel mug", not "a cup". Use the setting's own words and objects.
- **No tidy resolution**: characters make wrong choices, and some scenes end worse than they started.

## 7. LitRPG specifics
- **Status windows** only where a change matters to the scene. Do not show the full sheet each
  chapter. Show the delta, and use the project's window template in the same format each time.
  When `project.yaml` has `windows: off`, there are no status windows: show each gain through
  what the character can now do, and what it cost.
- **Stats must match the fold.** Never write a number from memory.
- **Notifications**: vary how the hero reacts to them. No "Ding!" spam, and no stream of 10
  notifications in a row unless it is a planned moment.
- **Power has a cost**: gains come from effort, risk or sacrifice that the reader saw on the page.
- **No meta-musing about the System** as filler ("He wondered what the System had planned.").
  System questions must lead to action or a plot thread.
- **Fights**: clear geography, a changing situation, and a cost. Not a list of moves.

## 8. Repetition across the book [lint + review]
- Keep a phrase log in memory: similes, notable images, character gestures, ending types.
- The same distinctive phrase must not occur twice in a book. A phrase or simile from a voice
  sample counts too: copy the voice of the samples, not their words.
- A character's verbal habit is shown, but at most once every few chapters. It is a spice, not the meal.

## 9. Voice [review]
The three voice samples are the reference for the narration. Each chapter sounds like the same
writer wrote it. Compare each scene with the sample of its kind (dialogue, action or quiet) on:
- **Vocabulary and register**: the same kind of words, from the same world. No sudden literary,
  modern or formal words that the samples never use.
- **Sentence rhythm**: sentence length and variety like the sample of that kind of scene.
- **POV distance**: as close to the POV character's thoughts as the samples, and never closer
  or further (no slip into another head, no narrator who knows more than the samples allow).
- **How much the narration explains**: as much interior thought and explanation as the samples,
  and no more.

## 10. Revision rules
- Fix only the flagged spans. A full rewrite brings in new tics.
- After a fix, run the lint again on the changed paragraph.
- When two rules conflict, the story bible and the voice samples win over these guidelines.

## 11. Clear by default [review]

This section is a default, not a style. Use it when nothing asks for more. Richer prose is
correct when one of these asks for it:
- the `prose-style` decision in `bible.md` (the user asked for dense, lyrical or ornate prose)
- a scene that needs it (a dream, a vision, an old text, a character who speaks that way)
- the chapter plan, which lists `plain.words` or `plain.terms` in `exceptions`

Even then, a reader must be able to follow the sentence.

- **Plain words and sentences.** Use the common word before the rare one. Give a sentence one
  main idea, and join two only when the content links them. One image or metaphor in a paragraph
  is enough; do not put one in every sentence.
- **New terms, few at a time.** A new term is a name, title, place, creature, custom or System
  term that the reader meets for the first time in the book. At most one new term in a sentence,
  and at most two in a paragraph. Until a name matters to the scene, use a common word ("the
  guard", not "the Tithe-warden of the Low Gate"), and bring the name in later.
  Bad: "Hale showed his Body Writ to the Low Gate reeve and paid the tithe-copper."
  Better: "Hale showed the guard his Body Writ and paid."
- **Pronouns and subtext stay.** This section changes words and density only. Keep a pronoun when
  the reader can tell who it means, and leave implied meaning implied.

## 12. Grammar [review]

Standard grammar is the default. Voice can break it: a character's speech, a clipped action beat or
one hard fragment. The writer does it on purpose and for a reason a reader can see.
`check-prose` reports a break as a `warn`, and as an `error` only when the sense is unclear.

- **Comma splices and run-ons.** Join two full clauses with a conjunction, a semicolon or a full stop,
  never with a comma alone. Do not run three or more clauses together without a stop.
- **Fragments.** A fragment stands for a reason: voice, speech, or one hard beat. It never stands where
  the sense needs a subject or a verb, and never twice in a row for effect.
- **Conjunctions show the relation.** Use the word that says how two clauses relate: "because",
  "but", "so", "while", "until". "And" is for things that go together, not for "next". Sentences
  with no conjunction at all, where the relation matters, read as a list of events.
- **Commas.** Put a comma after an opening clause or phrase, round an aside, and before a conjunction
  that joins two full clauses. Put none between a subject and its verb, and none before a conjunction
  that joins two verbs with one subject.

## 13. Tension and stakes [review]

Each chapter plan has `stakes`: what the POV character can lose in the chapter, and why it matters
to them. Each chapter plan also has a `tension` level from 1 to 5, inside the book plan's range. The
level sets the urgency of the chapter. It does not set its tone: a funny scene can be at level 4,
because a joke under pressure is still a joke. A cozy book keeps a low range, and each of its
chapters still has a conflict.

- **The stakes are on the page.** Before the turn of the chapter, the reader knows what the POV
  character can lose. Show it through a thought, a line of dialogue, a price, a deadline or an object
  (the letter, the empty cell, the ranking on the door). Show it once, clearly, and do not repeat it
  in every scene. A scene with its own `stakes` shows those too.
- **Each level reads differently:**
  - **1, quiet**: room for small talk, the workshop, the setting and jokes. There is still a
    conflict, and a small loss is possible.
  - **2, low**: something is at risk, but not yet close. A question or a rival keeps the pages moving.
  - **3, rising**: the cost is named, and a scene can go wrong. Fewer digressions, and each scene
    moves the stakes.
  - **4, high**: a clock (a tide, a deadline, air that runs out) or an enemy that acts. The scenes
    are shorter, the choices are harder, and at least one thing is lost or damaged on the page.
  - **5, climax**: all of the stakes of the book at once. The climax spans 2 or more chapters:
    the first ones raise the stakes and take away the protagonist's options, and the last one is
    where the protagonist decides it by their own choice or act. Nobody rescues them. The cost is
    paid on the page.
- **The events make the tension, not the words.** A high level comes from time, danger and cost.
  It does not come from inflated emotion, from a narrator who says that the moment is tense, or
  from a character who shouts what they feel. Sections 4, 5 and 6 still apply at level 5.
- **A bonding chapter rests the reader, and still moves.** A chapter plan with `bonding: true` puts
  characters together with no clock and no enemy that acts: a meal, a repair, a walk, a game, a
  night on watch. Its value shift is in a relationship: at the end, the two stand in a different
  place (a first trust, a joke that is now theirs, a door that stays closed). Its conflict is small
  and inside the relationship: a secret almost said, a joke that touches a wound, an offer that is
  refused. The outside plot stays in the background, and nobody explains the relationship aloud.
- **Some scenes are lost.** The `result` of a scene in the plan (`win`, `loss` or `mixed`) is the
  target. A `loss` stays a loss on the page: the character does not get the goal back in the next
  paragraph.

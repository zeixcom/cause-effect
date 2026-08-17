# Simplified Technical English (ASD-STE100)

Sentence-level writing rules adapted from ASD-STE100, applied to every document this skill
maintains.

STE100 controls grammar and vocabulary so a technical sentence has exactly one reading. It
does not conflict with a document's register (instructional, comparative, technical, terse) —
apply it within whatever register `references/tone-guide.md` sets for the target document.

**Documents in scope:** `README.md`, `GUIDE.md`, `ARCHITECTURE.md`, `REQUIREMENTS.md`,
`RECIPES.md`, `REACT_INTEGRATION.md`, `AGENTS.md`, `.github/copilot-instructions.md`, and
JSDoc in `src/`.

## Sentence construction

- **One idea per sentence.** Do not join two claims with "and", "which", or a comma splice.
  Split them.
- **Maximum one subordinate clause.** If a sentence needs two conditions or two consequences,
  use a list instead.
- **20 words per sentence, as a ceiling, not a target.** Shorter is fine. A sentence that
  needs 30 words has more than one idea in it.
- **Five sentences per paragraph, as a ceiling.** If a paragraph runs longer, split it or
  convert it to a list.
- **Lists over compound sentences.** When a sentence would enumerate three or more items,
  conditions, or steps, use a bulleted or numbered list.

## Grammar

- **Active voice.** "The effect reads the signal" not "The signal is read by the effect."
  Passive voice is acceptable only when the actor is unknown or irrelevant.
- **Present tense for facts and behavior.** "`deriveComputed()` recomputes when a dependency
  changes," not "will recompute" or "would recompute."
- **Imperative mood for instructions.** "Read the source before writing" not "You should read
  the source before writing."
- **No gerund nouns.** Write "to track dependencies" not "for tracking dependencies". Write
  "when the value changes" not "on value change" or "value changing".
- **Keep articles in `README.md`, `GUIDE.md`, `ARCHITECTURE.md`, `REQUIREMENTS.md`,
  `RECIPES.md`, `REACT_INTEGRATION.md`, and code comments.** Do not drop "a", "an", "the" for
  a telegraphic style in these documents. STE100 requires complete grammar; density comes from
  cutting words, not from cutting grammar.
- **`AGENTS.md`, `.github/copilot-instructions.md`, and skill files may drop articles.** These
  are AI-inference-time documents where token cost outweighs strict grammar. The rest of
  STE100 still applies: one idea per sentence, active voice, one word per concept.
- **No stacked nouns.** Rewrite "signal graph node field mixin composition" as "the
  composition of field mixins in a graph node". Use prepositions to show the relationship
  instead of piling nouns together.

## Vocabulary

- **One word, one meaning.** Use the same word for the same concept everywhere. Do not vary
  vocabulary for style — "sink" one place, "subscriber" another, "observer" a third. Pick the
  approved term and reuse it.
- **Domain terms are defined in `CONTEXT.md`.** Before writing about a concept — Signal,
  State, Sensor, Memo, Task, Store, List, Collection, Slot, Effect, Source, Sink, Node, Edge,
  Dependency, Scope, Owner, Cleanup, Watched, Batch, Flush, Pass, Computed, Mutable Signal,
  Guard, Equality Strategy — read the entry in `CONTEXT.md` and use exactly that term.
  `CONTEXT.md` also lists the words to avoid for each concept; treat those as disallowed
  synonyms.
- **No idioms or figurative language.** "Runs once" not "fires off". "Stops propagation" not
  "short-circuits the chain". Say the literal thing.
- **Approved technical names pass through unchanged.** Standard web-platform and TypeScript
  terms — DOM, `AbortSignal`, `AbortController`, Promise, microtask, ESM, TypeScript,
  `WeakSet` — are technical names, not prose vocabulary. Use them as-is. Do not paraphrase
  them into simpler words and do not invent alternate spellings.
- **Spell out on first use per document; abbreviate after.** If a document uses an
  abbreviation the reader may not know, expand it once, then use the short form consistently.

## What this changes in practice

- Long sentences with two or three subordinate clauses get split, or converted to a list.
- Passive constructions ("is tracked by", "can be disposed by") become active ("tracks",
  "disposes").
- Gerund-form headings ("Choosing the Right Signal", "Handling Errors") stay as headings —
  titles are exempt. Body prose uses the infinitive or present tense form.
- Inconsistent synonyms for the same domain concept get normalized to the `CONTEXT.md` term.

## Scope: current shape only

Describe the API as it is now. Do not describe what it was, why it changed, or what it may
become — no "previously", "as of version X", "we changed this because", "will eventually".
`CHANGELOG.md` (`changelog-keeper` skill) and the ADRs in `adr/` (`adr-keeper` skill) are the
only documents that record history and rationale. Every other document this skill maintains
states current truth only.

This restates the "no changelog language" rule in `references/tone-guide.md`
`<shared_rules>`. Both are binding.

## What this does not change

- Document register (instructional `README.md`, comparative `GUIDE.md`, technical
  `ARCHITECTURE.md`, terse `AGENTS.md`) is set by `references/tone-guide.md`, not by this
  file. STE100 is a grammar and vocabulary layer on top of that register.
- Code, code examples, and identifier names. STE100 governs prose. An identifier keeps its
  source spelling even when that spelling is a disallowed prose synonym — write "the
  `activeSink` pointer", not "the activeSink pointer" rewritten to avoid the word.

<overview>
Writing tone, register, and conciseness rules for each document maintained by the tech-writer
skill. Violating the tone is as wrong as a factual error — each document has a distinct
primary reader and serves a distinct purpose.
</overview>

<shared_rules>
These rules apply to every document without exception:

- **Concise over comprehensive.** Every sentence must add information the reader needs.
  Cut throat-clearing, transitional padding, and restatements of what the code already
  shows.
- **Technically accurate over reassuring.** Do not soften edge cases, paper over
  constraints, or omit behavior that is surprising but correct.
- **No changelog language in documentation.** Documents state current truth. Never write
  "previously", "as of version X", "we changed", or "now supports". Those belong in
  CHANGELOG.md.
- **No meta-commentary.** Do not write "This section explains…" or "See below for…".
  Say the thing directly.
- **Backtick all code.** Every API name, flag, file name, type name, option key, and
  shell command is wrapped in backticks, even mid-sentence.
</shared_rules>

<README>
**Primary audience:** Developers integrating `@zeix/cause-effect` into a project.
They know TypeScript and have used reactive libraries before.

**Register:** Instructional. Direct address ("use `createTask` when…"). Present tense.
Active voice. Short sentences in prose; examples do the heavy lifting.

**Structure rules:**
- Each `### SignalType` section: one short paragraph describing what the signal is for,
  then the signature, then options, then example(s). Description first — don't open with
  the signature.
- Options tables: one row per option. "Description" column is one line; if it needs more,
  the option is complex enough to warrant a prose sentence below the table instead.
- Examples: realistic, not trivial. Show actual usage patterns, not `const x = createState(0)`.
  Prefer examples that demonstrate the signal's distinctive behavior.

**What to cut:**
- Explanations of TypeScript concepts the reader already knows
- Warnings about things the type system already prevents
- Motivational framing ("This is useful when you need to…")
</README>

<GUIDE>
**Primary audience:** Developers migrating from React, Vue, or Angular who want to
understand where this library's concepts map to — and diverge from — what they already know.

**Register:** Comparative and educational. Assumes framework fluency; never assumes
knowledge of this library. Uses "if you've used X, this is like Y, except…" framing.
Approachable but never condescending.

**Structure rules:**
- Comparisons must be specific. Name the exact React hook, Vue function, or Angular
  decorator being compared. Vague comparisons ("like in other frameworks") add no value.
- Divergences get more space than similarities. The reader can infer the familiar parts;
  the non-obvious differences are why this section exists.
- Code examples: show both the framework equivalent and the cause-effect version side by
  side when it aids comparison. Otherwise, cause-effect only.

**What to cut:**
- Explanations of how React/Vue/Angular work internally — assume the reader knows
- Repetition of content already in README.md — GUIDE.md is conceptual, not a reference
- Sections that say "this is the same as in other frameworks" without adding nuance
</GUIDE>

<ARCHITECTURE>
**Primary audience:** Contributors to the library and AI agents that need to understand
internals to implement or review changes correctly.

**Register:** Technical and precise. Third person, present tense. Implementation details
are expected and welcome. Internal function names, type names, flag names, and field names
are used freely without definition — this document assumes the reader has the source open.

**Structure rules:**
- Describe mechanisms, not intentions. Not "this enables efficient updates" but "when
  `propagate()` marks a node `FLAG_CHECK`, downstream nodes call `refresh()` before
  deciding whether to recompute".
- Pseudocode and inline type definitions are appropriate when they make a structure clearer
  than prose would. Match the actual source types exactly — do not simplify.
- Subsection depth: use the existing pattern (##, ###). Do not add new heading levels.

**What to cut:**
- Motivational framing ("The design optimizes for…") — state the mechanism, not the goal
- Public API description — that belongs in README.md
- Any sentence that could be replaced by reading the source directly
</ARCHITECTURE>

<CLAUDE_MD>
**Primary audience:** Claude (this model) at inference time. Every token has a cost.

**Register:** Terse, declarative, maximally dense. No hand-holding. No transitions.
Bold key terms. Bullet lists over prose. Code examples only when the correct pattern is
non-obvious from the statement.

**Structure rules:**
- Non-obvious behavior entries follow a strict three-part structure:
  1. **Bold statement** of the behavior — one sentence, declarative, specific.
  2. Implication or consequence — one or two sentences maximum.
  3. Code example — only if the correct pattern cannot be inferred from the statement.
     Use before/after style (bad comment + good comment) only when the contrast is the point.
- The bar for "non-obvious": an experienced reactive developer would not predict this
  behavior from the public API alone. If they would, it does not belong here.
- Internal names (`FLAG_CHECK`, `activeSink`, `trimSources`) are appropriate — Claude
  can cross-reference ARCHITECTURE.md.

**What to cut:**
- Any sentence that restates what the bold statement already said
- Explanations of standard reactive concepts (memoization, lazy evaluation, dependency tracking)
- "Note that…", "Keep in mind…", "Be aware that…" — state it directly
- Examples that illustrate obvious correct usage; examples only for non-obvious patterns
</CLAUDE_MD>

<copilot_instructions>
**Primary audience:** GitHub Copilot during code generation. The document drives what
Copilot suggests as it completes function calls, option objects, and type annotations.

**Register:** Structured and pattern-oriented. Headers create anchors Copilot uses to
locate relevant context. Code blocks are generation templates — they must be complete,
compilable, and idiomatic.

**Structure rules:**
- Code patterns must compile against the current `index.ts`. Copilot generates from these
  literally — a wrong parameter name or stale option key will be reproduced in generated code.
- Signal type descriptions: one line each in the format
  `**Name** (\`createName\`): what it is and its key behavioral trait.`
- Do not use narrative prose in list items — use fragments that complete a pattern, not
  sentences that explain one.

**What to cut:**
- Explanatory prose around code patterns — the pattern is self-documenting
- Options or parameters that are rarely used and not needed for the common case
- Duplication between sections (e.g. do not describe `createTask` in both "Signal Types"
  and again identically in "Common Code Patterns")
</copilot_instructions>

<REQUIREMENTS>
**Primary audience:** Stakeholders, contributors, and future maintainers who need to
understand the library's purpose and boundaries. This document is read infrequently and
must remain accurate over many versions.

**Register:** Formal, strategic, timeless. Third person. Noun phrases over verb phrases
where possible ("The library is deliberately not a framework" rather than "We decided not
to make this a framework"). No version-specific language except in "Stability".

**Structure rules:**
- Tables state facts as rows — they do not tell a story. Each row is self-contained.
- "Non-Goals" entries are one bold heading + one sentence. The heading names the thing
  that is out of scope; the sentence says why or what to do instead. No more.
- "Stability" is the only section that may reference specific version numbers. All other
  sections describe the library as it is, not how it got there.

**What to cut:**
- Rationale for decisions that were obvious or uncontroversial — if it needs defending,
  add one sentence; otherwise state the fact
- Historical context ("this was added because…")
- Implementation detail — REQUIREMENTS.md describes goals, not mechanisms
</REQUIREMENTS>

<jsdoc>
**Primary audience:** Developers reading function signatures in an IDE or in generated
API documentation. They see the JSDoc in a tooltip or a docs page alongside the TypeScript
signature.

**Register:** Brief, typed, precise. One-line summaries. No narrative. Fragments are
acceptable if they read naturally as a tooltip.

**Structure rules:**
- Summary line: one line. Describes what the function does, not what it is.
  "Creates a mutable reactive signal." not "A factory function for State signals."
- `@param` tags: one line each. Describe semantics and constraints, not the TypeScript
  type (the type is already visible in the signature). For options objects, document only
  options whose behavior is non-obvious.
- `@returns`: one line. What is returned and any non-obvious guarantee
  (e.g. "Always non-nullish per `T extends {}`").
- `@throws`: only for errors that can occur in correct, non-erroneous usage. Do not
  document programmer-error throws (`RequiredOwnerError`, `InvalidCallbackError`,
  `CircularDependencyError`) — they indicate a coding mistake, not a handled condition.
- `@example`: only if the usage pattern is so non-obvious that a developer would misuse
  the function without it. Examples live primarily in README.md.

**What to cut:**
- `@param type` annotations — TypeScript already shows the type
- JSDoc that restates the TypeScript signature in prose
- Generic descriptions that would apply to any function ("Creates and returns a…")
- Multi-paragraph descriptions — if it needs that much explanation, the API design may
  need review
</jsdoc>
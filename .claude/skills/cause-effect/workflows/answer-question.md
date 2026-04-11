<required_reading>
Load references based on question type — only what is needed:

- Which signal to use → references/signal-types.md
- API usage, call signatures, options → references/api-facts.md
- Unexpected or counterintuitive behavior → references/non-obvious-behaviors.md
- A thrown error → references/error-classes.md
- Design rationale or constraints → references/signal-types.md + references/api-facts.md
</required_reading>

<process>
## Step 1: Categorise the question

| Category | Signal words | Load |
|---|---|---|
| Which signal to use | "should I use", "difference between", "when to use", "State vs", "Memo vs" | signal-types.md |
| API usage / call signature | "how do I", "what does X return", "what are the options for", "how to create" | api-facts.md |
| Unexpected behavior | "why does this not work", "is this a bug", "why is watched not firing", "not re-running" | non-obvious-behaviors.md |
| Error meaning | "what does X error mean", "when is Y thrown", "getting RequiredOwnerError" | error-classes.md |
| Design rationale | "why was X designed this way", "why no null", "why is T extends {}" | signal-types.md + api-facts.md |

## Step 2: Load only the relevant references

Do not load all references speculatively. Load only the file(s) listed for the identified category.

## Step 3: Answer from embedded knowledge

All knowledge needed to answer public-API questions is in `references/`. Ground every claim in a reference. Cite the section when the answer is non-obvious (e.g. "per `non-obvious-behaviors.md`…").

For counterintuitive behaviors, always show a correct vs incorrect code example alongside the explanation.

## Step 4: When embedded knowledge is insufficient

If the question requires detail beyond what the references cover (e.g. exact internal flag values, propagation algorithm specifics, architecture decisions), do not guess. Instead:
- Point to the library's README and GUIDE in the npm package or GitHub repository for public API depth
- Note that library internals are available in `node_modules/@zeix/cause-effect/src/` if truly needed, but internal details are not part of the public API contract and may change

## Step 5: Design rationale questions

When asked why the library was designed a certain way, distinguish between:
- **Hard constraints** (e.g. `T extends {}` excludes null/undefined by design to guarantee signals always have a value; the signal type set is intentionally minimal and closed to new types)
- **Soft conventions** (naming patterns, file organisation, option defaults)

If the distinction is unclear from the embedded references, say so rather than speculating.
</process>

<success_criteria>
- Answer is grounded in embedded reference knowledge
- No references to external files that may not exist in the consumer project (REQUIREMENTS.md, ARCHITECTURE.md, src/, etc.)
- Source cited when the answer is non-obvious
- Counterintuitive behaviors include correct vs incorrect code examples
- When knowledge is insufficient, points to upstream documentation rather than guessing
- No reference files loaded beyond what the question required
</success_criteria>
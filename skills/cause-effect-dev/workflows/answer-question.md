<required_reading>
Load references based on the question type — only what is needed:

- API usage or call signatures → references/api-facts.md + references/source-map.md
- Internal architecture, node shapes, ownership → references/internal-types.md
- Graph propagation, flags, flush order → references/internal-types.md (then read `ARCHITECTURE.md` if still unclear)
- Unexpected or counterintuitive behavior → references/non-obvious-behaviors.md
- A thrown error → references/error-classes.md
- Design rationale or constraints → `REQUIREMENTS.md` + `CLAUDE.md`
- Comparing signal types or migration from React/Vue/Angular → references/source-map.md (then read `GUIDE.md`)
</required_reading>

<process>
## Step 1: Categorise the question

Identify which category applies:

| Category | Signal words |
|---|---|
| API / call signature | "how do I use", "what does X return", "what are the options for" |
| Internal architecture | "how does it work internally", "what is a node", "how is ownership tracked" |
| Graph / propagation | "when does it re-run", "why did X not update", "what is FLAG_CHECK" |
| Non-obvious behavior | "why does this not work", "is this a bug", "why is `watched` not firing" |
| Error meaning | "what does X error mean", "when is Y thrown" |
| Design rationale | "why was X designed this way", "why is null excluded", "why no X signal type" |
| Signal type comparison | "when should I use Memo vs Task", "what is a Slot", "Sensor vs State" |

## Step 2: Load the relevant references

Read only the reference files listed for that category above. Do not load references speculatively.

If a reference points to an authoritative document (`ARCHITECTURE.md`, `GUIDE.md`, `REQUIREMENTS.md`, `CLAUDE.md`), read that document only if the reference files do not fully resolve the question.

## Step 3: Read source if needed

If the question requires knowing exact implementation details (option defaults, internal flag values, exact type signatures), use references/source-map.md to locate and read the relevant source file.

Never guess at implementation details. If uncertain, read the source.

## Step 4: Answer

Ground every claim in a source. Cite the file when the answer is non-obvious (e.g. "per `ARCHITECTURE.md`…" or "in `src/nodes/memo.ts`…").

For counterintuitive behaviors, include a minimal code example showing the correct pattern alongside the incorrect one. Use the examples in references/non-obvious-behaviors.md as a model.

For design rationale questions, distinguish between hard constraints (stated in `REQUIREMENTS.md`) and soft conventions (described in `CLAUDE.md`).
</process>

<success_criteria>
- Answer is grounded in authoritative sources, not inference
- Source cited when the answer is non-obvious
- Counterintuitive behaviors include a correct vs incorrect code example
- Design answers distinguish constraints from conventions
- No reference files loaded beyond what the question required
</success_criteria>
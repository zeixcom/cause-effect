<required_reading>
1. references/source-map.md — locate the relevant source file(s)
2. references/api-facts.md — API constraints and callback patterns
3. references/non-obvious-behaviors.md — if the change touches graph edges, ownership, or reactive tracking
</required_reading>

<process>
## Step 1: Confirm scope

Read `REQUIREMENTS.md`. Verify the feature is in scope — the signal type set is complete and new types are explicitly out of scope. If the request would add a new signal type, stop and explain this constraint.

## Step 2: Locate relevant source

Use references/source-map.md to identify:
- Which signal file(s) in `src/nodes/` are involved
- Which authoritative documents to read (README.md for API shape, ARCHITECTURE.md for graph-level changes)

## Step 3: Read before writing

Read the identified source file(s) in full. Do not propose or write any code before doing this.

If the change touches graph propagation, flag semantics, or ownership: read `ARCHITECTURE.md` in full.

If the change affects the public API surface: read the relevant section of `README.md` and `index.ts`.

## Step 4: Implement

Make the change. Follow existing conventions in the file:
- Naming patterns (`createX`, `isX`, node shape fields)
- Internal flag usage (defined in `src/graph.ts`)
- Error types from `src/errors.ts`
- Utility functions from `src/util.ts` before writing new ones

## Step 5: Verify

Run `bun test`. Fix any failures before considering the task done.

If the public API changed, check that `README.md` and `index.ts` are consistent with the new behavior.
</process>

<success_criteria>
- Feature works as specified
- Follows existing naming and structural conventions
- `bun test` passes with no regressions
- Public API surface in `index.ts` and `README.md` is consistent with the change
</success_criteria>
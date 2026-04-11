<required_reading>
1. references/source-map.md — locate the relevant source file(s)
2. references/non-obvious-behaviors.md — the bug may be a known gotcha
3. references/internal-types.md — if the bug involves graph propagation, ownership, or node state
4. references/error-classes.md — if the bug manifests as an unexpected thrown error
</required_reading>

<process>
## Step 1: Reproduce

Identify the smallest possible reproduction. If a failing test exists, run it:

```bash
bun test --test-name-pattern "name of failing test"
```

If no test exists, write one that demonstrates the incorrect behavior before touching any source.

## Step 2: Read the relevant source

Use references/source-map.md to locate the source file(s) involved. Read them in full. Do not guess at the cause before reading.

## Step 3: Check known gotchas

Read references/non-obvious-behaviors.md. Many apparent bugs are actually expected behaviors:
- Lookup methods (`byKey`, `at`, `keyAt`, `indexOfKey`) do not create graph edges
- Conditional signal reads can delay `watched` activation
- A custom `equals` on an intermediate Memo suppresses entire downstream subgraphs

If the reported behavior matches a known non-obvious behavior, explain it rather than patching it.

## Step 4: Check graph-level issues

If the bug involves unexpected re-runs, missing updates, or ownership/cleanup problems, read `ARCHITECTURE.md` for flag semantics and propagation rules.

## Step 5: Identify the root cause

Trace the failure to its origin — do not fix the symptom. Confirm the root cause by reasoning through the propagation path or ownership chain before writing any fix.

## Step 6: Fix

Apply the minimal change that addresses the root cause. Follow existing conventions:
- Flag names and bitmask operations from `src/graph.ts`
- Error types from `src/errors.ts`
- Do not introduce new utilities if `src/util.ts` already covers the need

## Step 7: Verify

Run the full test suite:

```bash
bun test
```

All tests must pass. If the reproduction test did not exist before Step 1, confirm it now passes too.
</process>

<success_criteria>
- Root cause identified (not just symptom suppressed)
- Minimal fix applied
- Reproduction test passes
- `bun test` passes with no regressions
</success_criteria>
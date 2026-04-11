<required_reading>
1. references/non-obvious-behaviors.md — most reactive bugs are documented here
2. references/error-classes.md — if a specific error is thrown
3. references/api-facts.md — to verify the signal is being used correctly
</required_reading>

<process>
## Step 1: Categorise the symptom

Match the symptom to the most likely cause before reading any code:

| Symptom | Most likely cause | Where to look |
|---|---|---|
| Effect doesn't re-run when a signal changes | No graph edge established (conditional read or direct lookup) | non-obvious-behaviors: `conditional-reads-delay-watched`, `direct-lookups-do-not-track` |
| Effect re-runs too often | Missing `equals` option, or mutable reference without `SKIP_EQUALITY` | api-facts: `options.equals`, `SKIP_EQUALITY` |
| `watched` never fires | Signal only read inside a conditional branch | non-obvious-behaviors: `conditional-reads-delay-watched` |
| Collection/List update not reflected in effect | Using `byKey()`, `at()`, `keyAt()`, or `indexOfKey()` | non-obvious-behaviors: `direct-lookups-do-not-track` |
| Stale async result overwrites fresh one | `AbortSignal` not forwarded to `fetch` or async operation | non-obvious-behaviors: `task-abort-on-dependency-change` |
| `UnsetSignalValueError` thrown | Reading Sensor or Task before first value | non-obvious-behaviors: `sensor-unset-before-first-value` |
| `RequiredOwnerError` thrown | `createEffect` called outside a `createScope` or parent effect | api-facts: `createEffect`, `createScope` |
| `CircularDependencyError` thrown | A signal depends on itself, directly or transitively | error-classes: `CircularDependencyError` |
| Downstream Memo or Effect never updates despite source changing | Custom `equals` on an intermediate Memo is suppressing the subgraph | non-obvious-behaviors: `equals-suppresses-subtrees` |
| Cleanup not running / memory leak suspected | Effect created without an active owner, or `unown` used incorrectly | api-facts: `unown`, `createScope` |

## Step 2: Read the relevant section

Read the specific section in references/non-obvious-behaviors.md or references/error-classes.md that matches the symptom. Compare the pattern shown there to the code in question.

## Step 3: Verify API usage

If the symptom does not match a known gotcha, read references/api-facts.md to confirm:
- Signal generics use `T extends {}` (no `null` or `undefined`)
- `createEffect` is inside an owner (`createScope` or another effect)
- `unown` is used only for DOM-owned lifecycles, not to bypass ownership generally
- `batch` is used if multiple state writes should coalesce

## Step 4: Inspect library source (last resort)

If the embedded references do not explain the behavior, the library source is available at:

```
node_modules/@zeix/cause-effect/src/
```

Read the relevant file there — do **not** assume library source files exist at the project root.

## Step 5: Fix

Apply the minimal change that addresses the root cause. Do not suppress the symptom (e.g. wrapping a read in `untrack`) without first confirming that is the intended behavior.

## Step 6: Verify

Run the project's own test suite:

```bash
# use whichever applies to this project
npm test
pnpm test
yarn test
npx vitest
npx jest
```

Do not assume `bun` or any specific test runner is available.
</process>

<success_criteria>
- Root cause identified, not symptom suppressed
- Fix matches the correct pattern from references/non-obvious-behaviors.md where applicable
- Project test suite passes after the fix
</success_criteria>
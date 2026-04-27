<required_reading>
1. references/signal-types.md — choose the right signal type(s) for the task
2. references/api-facts.md — correct API usage, constraints, and callback patterns
3. references/non-obvious-behaviors.md — avoid common pitfalls before writing any code
</required_reading>

<process>
## Step 1: Choose the right signal type

Read references/signal-types.md. Match the task to the appropriate signal(s) using the decision guide. If multiple signal types seem applicable, the guide has explicit comparisons.

## Step 2: Check ownership requirements

Before writing any `createEffect` call, confirm there is an active owner in scope:
- Top-level effects must be wrapped in `createScope`
- Effects in Web Component lifecycle methods that use DOM-managed lifetime: use `createScope(fn, { root: true })` — the returned `dispose` goes in `disconnectedCallback`. This suppresses parent-owner registration so the scope is never disposed by a re-running outer effect

See references/api-facts.md → `<core_functions>` for the rules.

## Step 3: Check for known pitfalls

Skim references/non-obvious-behaviors.md for anything that applies to the task:

| If the task involves… | Check… |
|---|---|
| List or Collection | direct-lookups-do-not-track |
| Conditional rendering or `match` | conditional-reads-delay-watched |
| Async data fetching | task-abort-on-dependency-change |
| Sensor or Task before first value | sensor-unset-before-first-value |
| Multiple state updates at once | references/api-facts.md → `batch` |

## Step 4: Import what you need

All public API is imported from the package root:

```typescript
import {
  createState, createSensor, createMemo, createTask,
  createEffect, createScope, createSlot, createStore,
  createList, createCollection, deriveCollection,
  batch, untrack, unown, match,
  SKIP_EQUALITY,
} from '@zeix/cause-effect'
```

Only import what the task requires.

## Step 5: Implement

Write the code following the patterns in references/. Prefer the examples shown there over inventing new patterns — the non-obvious behaviors exist precisely because intuitive patterns are often wrong.

## Step 6: Verify

Run the project's own test suite using whatever command applies to this project (e.g. `npm test`, `pnpm test`, `npx vitest`, `deno test`). Do not assume a specific test runner or package manager.
</process>

<success_criteria>
- Correct signal type(s) chosen for the task
- No `null` or `undefined` in signal generics (`T extends {}`)
- Every `createEffect` is inside a `createScope` or another effect
- Code follows the patterns from references/ rather than inventing new ones
- Project's own test suite passes (if applicable)
</success_criteria>
# TODO

- [x] CE-001: Move `isEqual` from `list.ts` to `util.ts` — done ✓
  **Skill:** cause-effect-dev
  **Note:** Placed in `graph.ts` instead — circular import blocked `util.ts`. See ARCHITECTURE.md Key Decisions.

- [x] CE-002: Define `DEEP_EQUALITY` in `graph.ts`; update node defaults in `list.ts` and `store.ts` — done ✓
  **Skill:** cause-effect-dev

- [x] CE-003: Update `index.ts` public exports — done ✓
  **Skill:** cause-effect-dev

- [x] CE-006: Drop cycle detection from `isEqual` / `DEEP_EQUALITY` — done ✓
  **Skill:** cause-effect-dev
  **Context:** Remove the `WeakSet`-based cycle detection from `isEqual` in `src/graph.ts`. The `visited?: WeakSet<object>` parameter, the `if (!visited) visited = new WeakSet()` allocation, the `visited.has()` throw, and the `try/finally` cleanup all go. The `CircularDependencyError` import in `graph.ts` stays (used elsewhere in the graph engine). In `src/nodes/list.ts` (`diffArrays`): remove `const visited = new WeakSet()` and the `visited` argument from the `isEqual(...)` call. Same in `src/nodes/store.ts` (`diffRecords`). Update `test/equality.test.ts` to remove the two circular-reference tests — they now produce a stack overflow, not a throw. See ARCHITECTURE.md Key Decisions for rationale.

- [x] CE-004: Update JSDoc, README, and GUIDE for the new equality constants — done ✓
  **Skill:** tech-writer
  **Context:** Depends on CE-006. (1) Add JSDoc to `DEFAULT_EQUALITY` in `graph.ts` (analogous to `SKIP_EQUALITY` — explain it makes the default explicit, useful when composing or overriding). (2) Update `DEEP_EQUALITY` JSDoc to remove any mention of cycle detection. (3) Update any README/GUIDE mentions of `isEqual` to `DEEP_EQUALITY`; note the deprecation. Also correct the ARCHITECTURE.md `isEqual` placement row — it says `util.ts` in one place; update to `graph.ts`.

<overview>
Where to find things in the @zeix/cause-effect codebase. Read this before locating any source file.
</overview>

<authoritative_documents>
| What you need | Where to look |
|---|---|
| Vision, audience, constraints, non-goals | `REQUIREMENTS.md` |
| Mental model, non-obvious behaviors, TS constraints | `CLAUDE.md` |
| Full API reference with examples | `README.md` |
| Mapping from React/Vue/Angular patterns; when to use each signal type | `GUIDE.md` |
| Graph engine architecture, node shapes, propagation | `ARCHITECTURE.md` |
| Public API surface (all exports, types) | `index.ts` |
| Core graph engine (flags, propagation, flush, ownership) | `src/graph.ts` |
| Error classes | `src/errors.ts` |
| Signal base types and type guards | `src/signal.ts` |
| Shared utilities | `src/util.ts` |
</authoritative_documents>

<signal_source_files>
Each signal type lives in its own file under `src/nodes/`:

| Signal | File | Factory | Type guard |
|---|---|---|---|
| State | `src/nodes/state.ts` | `createState()` | `isState()` |
| Sensor | `src/nodes/sensor.ts` | `createSensor()` | `isSensor()` |
| Memo | `src/nodes/memo.ts` | `createMemo()` | `isMemo()` |
| Task | `src/nodes/task.ts` | `createTask()` | `isTask()` |
| Effect | `src/nodes/effect.ts` | `createEffect()` | — |
| Slot | `src/nodes/slot.ts` | `createSlot()` | `isSlot()` |
| Store | `src/nodes/store.ts` | `createStore()` | `isStore()` |
| List | `src/nodes/list.ts` | `createList()` | `isList()` |
| Collection | `src/nodes/collection.ts` | `createCollection()` / `deriveCollection()` | `isCollection()` |

`match()` and `MatchHandlers` live in `src/nodes/effect.ts` alongside `createEffect`.
</signal_source_files>

<quick_lookup>
- Changing a signal's public API → read the signal's source file + `index.ts` + the relevant section of `README.md`
- Changing graph traversal, flags, or flush order → read `src/graph.ts` + `ARCHITECTURE.md`
- Adding or changing error conditions → read `src/errors.ts`
- Adding a shared utility → check `src/util.ts` first; add there if it belongs to multiple nodes
- Checking type constraints or TS-specific decisions → read `CLAUDE.md`
- Verifying a feature is in scope → read `REQUIREMENTS.md`
</quick_lookup>
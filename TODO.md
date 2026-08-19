# TODO

- [x] CE-001: Identity-tracked keys (`keyConfig` given) silently swap content under `.set()`/`deriveList` rebuilds — done ✓
  **Skill:** cause-effect-dev
  **Changed:** `src/nodes/list.ts` (`getKeyGenerator()`, `diffPositional()`, `diffArrays()`, `createList`'s `set()`), `src/nodes/collection.ts` (`keyedAdapter`'s `ensureKeys()`). Tests: `test/list.test.ts` (2 new cases in `describe('set')`), `test/derive-list.test.ts` (1 new case).
  **How:** `getKeyGenerator()` now also returns `positional: boolean` (`keyConfig === undefined`). `diffPositional()` takes that flag: at a shared index where `itemEquals` fails, `positional` lists keep the old behavior (reuse key, emit `change`); `keyConfig`-having lists (string or function) now retire the old key (`remove`) and mint a fresh one via `generateKey()` (`add`) — matching `splice()`'s existing semantics. No change to the no-`keyConfig` path or to `createCollection` (doesn't call `diffArrays`).
  **Check:** confirmed no existing test locked in string-`keyConfig` diffing behavior (only key-format tests existed) — full suite (709 tests) plus `bun run check` (typecheck/lint/tests/bundle) passes clean.

- [x] CE-001-followup: `.set()` behavior change for string `keyConfig` needs a docs pass — done ✓
  **Skill:** tech-writer
  **Changed:** `src/nodes/list.ts` (new JSDoc on `MutableList.set()`), `README.md` (List section, after the `keyConfig` examples), `RECIPES.md` (#3, after the `.set()` example). Checked `GUIDE.md` — it delegates to README's List/Collection sections, no separate edit needed.
  **How:** stated the identity contract directly: with a `keyConfig`, an item keeps its key only while its content stays equal at that position, and changed content gets a new key; without one, array position is the identity and the key at each index stays the same regardless of content. RECIPES.md #3 ties this to the `forecast.set([data])` pattern and the DOM-node/cache-keying consumer case.
  **Check:** `bunx tsc --noEmit` and `bunx biome check` clean.

- [x] CE-002-followup: document that `createCollection`/external-push `deriveList` needs a content-based `keyConfig` — done ✓
  **Skill:** tech-writer
  **Changed:** `src/nodes/collection.ts` (JSDoc on `DeriveListOptions.keyConfig`, `CollectionOptions.keyConfig`, `ListChanges.change`/`.remove`), `README.md` (Collection section, after the `createCollection` example).
  **How:** explained that a function `keyConfig` is required for `change`/`remove` to match an item that isn't the exact tracked object reference — the normal case for parsed JSON — and named `UnresolvableKeyError` as the failure mode otherwise. `GUIDE.md` delegates to README's Collection section for both forms (`createCollection` and `deriveList(seed, { watched })`), so one shared explanation covers both; no separate `deriveList(seed, { watched })` example exists yet to duplicate it into.
  **Check:** `bunx tsc --noEmit` and `bunx biome check` clean.

- [x] CE-002: `createCollection` silently drops `change`/`remove` payloads it can't resolve to a key — done, pending review ⏳
  **Skill:** cause-effect-dev
  **Changed:** `src/errors.ts` (new `UnresolvableKeyError` class, exported), `index.ts` (export), `src/nodes/collection.ts` (`resolveKey()` docstring, `onChanges()`'s `change`/`remove` loops). Tests: `test/collection.test.ts` (+4 cases: throws for non-content-based unresolvable change/remove, still resolves via exact reference reuse, and the two pre-existing content-based "genuinely missing key" tests kept passing unmodified).
  **How:** `resolveKey()`'s two failure modes were already structurally distinguishable — content-based `keyConfig` always produces a real string via `generateKey()` even for a missing key (existing graceful no-op, untouched); only the non-content-based "can't resolve at all" case returns `undefined`. `onChanges()`'s `change`/`remove` loops now stage `[key, item]` pairs for the whole batch first (mirroring the existing `add`-loop staging) and throw `UnresolvableKeyError` if any entry can't resolve — before any mutation commits, so a partial batch never silently applies.
  **Check:** full suite (700 tests) plus `bun run check` (typecheck/lint/tests/bundle) passes clean. Bundle: 25122B minified (ceiling 32768B), core path unaffected (this is on the `createCollection`/`deriveList` path, not the 4kB core promise).
  **Review flag:** new public export `UnresolvableKeyError` — please confirm the name/message read well against the other error classes (`DuplicateKeyError` is the closest sibling).

- [ ] CE-002-followup: document that `createCollection`/external-push `deriveList` needs a content-based `keyConfig`
  **Skill:** tech-writer
  **Context:** CE-002's fix means `applyChanges({ change, remove })` now throws `UnresolvableKeyError` instead of silently no-oping when the collection has no content-based `keyConfig` and the payload items aren't the exact tracked references. README's `createCollection` example already uses `keyConfig: item => item.id`, but doesn't say why it's effectively required — add a note there (and check `deriveList(seed, { watched })`'s docs, since it's the 2.0 replacement per `createCollection`'s `@deprecated` tag) that a content-based `keyConfig` is required for `change`/`remove` with externally-sourced data, since such data is essentially never reference-equal across messages.

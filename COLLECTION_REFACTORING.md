# Collection Refactoring Plan

## Goal

Unify `createCollection()` and `createSourceCollection()` into a single `createCollection()` primitive whose primary form mirrors `createSensor()`: an externally-driven signal with a watched lifecycle. The derived-from-List/Collection form becomes an internal helper used by `.deriveCollection()`.

## Motivation

- **Sensor ↔ Collection parallel**: Both are externally-driven, lazily activated, and auto-cleaned. Making their signatures parallel sharpens this mental model.
- **One primitive, one name**: Users learn `createCollection(start, options)` the same way they learn `createSensor(start, options)`.
- **Derived collections are a method, not a standalone call**: `list.deriveCollection(fn)` and `collection.deriveCollection(fn)` already exist and are the natural way to create derived collections.

## New API Surface

```typescript
// Primary form — externally driven (replaces createSourceCollection)
function createCollection<T extends {}>(
  start: CollectionCallback<T>,
  options?: CollectionOptions<T>,
): Collection<T>

// CollectionCallback mirrors SensorCallback but receives applyChanges
type CollectionCallback<T extends {}> = (
  applyChanges: (changes: DiffResult) => void,
) => Cleanup

// CollectionOptions — initial value hidden in options (like Memo, Task, Sensor)
type CollectionOptions<T extends {}> = {
  value?: T[]                                      // initial items (default: [])
  keyConfig?: KeyConfig<T>                         // key generation strategy
  createItem?: (key: string, value: T) => Signal<T> // custom item factory
}

// Derive method — unchanged on List and Collection
collection.deriveCollection(callback)
list.deriveCollection(callback)
```

## Refactoring Steps

Order matters: the existing `createCollection` and `CollectionCallback` names must be freed up before they can be reused for the new concept. The refactoring proceeds in two phases.

### Phase 1 — Rename existing symbols (free the names)

#### 1.1. Rename `createCollection` → `deriveCollection`

In `src/nodes/collection.ts`:

- Rename the function `createCollection(source, callback)` → `deriveCollection(source, callback)`.
- Update both overload signatures and the implementation signature.
- Update the internal `deriveCollection()` call inside the `Collection.deriveCollection` method body (both in the derived-collection object and the source-collection object).

#### 1.2. Rename `CollectionCallback<T, U>` → `DeriveCollectionCallback<T, U>`

- Rename the type alias in `src/nodes/collection.ts`.
- Update all references: the `deriveCollection` parameter types, and the `Collection.deriveCollection` method parameter type annotations.

#### 1.3. Update `list.ts`

- Change the import from `createCollection` to `deriveCollection`.
- Update `List.deriveCollection()` body to call `deriveCollection(list, cb)`.

#### 1.4. Update exports in `index.ts`

- Replace `createCollection` → `deriveCollection` in the export list.
- Replace `CollectionCallback` → `DeriveCollectionCallback`.
- Keep or drop `CollectionSource` from public exports (internal detail of `deriveCollection`).

#### 1.5. Update tests

- In `test/collection.test.ts` (or `test/collection.next.test.ts`): replace all direct `createCollection(source, cb)` calls with either `deriveCollection(source, cb)` or the equivalent `.deriveCollection(cb)` method.
- Update imports accordingly.

#### 1.6. Verify

- `bun run check` and `bun test` pass.
- Commit: "Rename createCollection → deriveCollection, CollectionCallback → DeriveCollectionCallback"

### Phase 2 — Reshape `createSourceCollection` → `createCollection`

#### 2.1. Rename and reshape function

In `src/nodes/collection.ts`:

- Rename `createSourceCollection` → `createCollection`.
- Move `initialValue` from first positional arg into `options.value` (default `[]`).
- New signature: `createCollection<T>(start: CollectionCallback<T>, options?: CollectionOptions<T>)`.

#### 2.2. Rename types

- `SourceCollectionCallback` → `CollectionCallback<T>` (generic over `T` for type coherence with `CollectionOptions<T>`, even though the callback itself doesn't use `T` directly).
- `SourceCollectionOptions<T>` → `CollectionOptions<T>`, adding the `value?: T[]` field.

#### 2.3. Update exports in `index.ts`

```typescript
// Remove
export { createSourceCollection, SourceCollectionCallback, SourceCollectionOptions, CollectionSource }

// Add / rename
export { createCollection, CollectionCallback, CollectionOptions }

// Keep
export { Collection, DiffResult, isCollection }

// Optional (if deriveCollection is exported)
export { deriveCollection, DeriveCollectionCallback }
```

#### 2.4. Update tests

- `test/source-collection.test.ts` → rename to `test/collection.next.test.ts` (or merge into existing collection test file).
- Update all `createSourceCollection(initialValue, start, options)` calls to `createCollection(start, { value: initialValue, ...options })`.
- Update type imports: `CollectionCallback` instead of `SourceCollectionCallback`, etc.

#### 2.5. Update CLAUDE.md and docs

- Update the Collection section to present `createCollection(start, options)` as the primary form.
- Show `.deriveCollection()` as the way to transform Lists/Collections.
- Emphasize Sensor ↔ Collection parallel in the mental model section.

#### 2.6. Verify

- `bun run check` and `bun test` pass.
- Commit: "Reshape createSourceCollection → createCollection(start, options)"

## Type Summary

```
Before                              After
─────────────────────────────────   ─────────────────────────────────
createSourceCollection(init, start, opts)  →  createCollection(start, opts)
  SourceCollectionCallback          →  CollectionCallback<T>
  SourceCollectionOptions<T>        →  CollectionOptions<T>

createCollection(source, callback)  →  deriveCollection(source, callback)  [internal]
  CollectionCallback<T, U>          →  DeriveCollectionCallback<T, U>      [internal or optional export]
  CollectionSource<T>               →  CollectionSource<T>                 [internal]
```

## Migration Checklist

### Phase 1 — Free the names
- [ ] Rename `createCollection(source, cb)` → `deriveCollection(source, cb)`
- [ ] Rename type `CollectionCallback<T, U>` → `DeriveCollectionCallback<T, U>`
- [ ] Update `List.deriveCollection()` and `Collection.deriveCollection()` to call `deriveCollection()`
- [ ] Update `index.ts` exports (phase 1)
- [ ] Update tests (phase 1)
- [ ] Verify: `bun run check` and `bun test` pass
- [ ] Commit phase 1

### Phase 2 — Reclaim the names
- [ ] Rename `createSourceCollection` → `createCollection(start, options)` with `options.value`
- [ ] Rename type `SourceCollectionCallback` → `CollectionCallback<T>`
- [ ] Rename type `SourceCollectionOptions` → `CollectionOptions` (add `value?: T[]`)
- [ ] Drop `CollectionSource` from public exports
- [ ] Update `index.ts` exports (phase 2)
- [ ] Update tests (phase 2)
- [ ] Update CLAUDE.md Collection sections
- [ ] Verify: `bun run check` and `bun test` pass
- [ ] Commit phase 2

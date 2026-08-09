# Advanced Patterns & Recipes

This guide covers architectural guidance, best practices, and code examples for solving complex real-world state management challenges using the Cause & Effect signal graph.

For more foundational concepts, check out the [Guide](GUIDE.md), learn about the inner workings in the [Architecture](ARCHITECTURE.md) document, or see our notes on [React Integration](REACT_INTEGRATION.md).

---

## 1. Multi-Step Wizard Pattern

A common challenge in UI development is orchestrating a multi-step form or wizard. The recommended approach is to keep each step's data encapsulated in its own reactive primitive and use a `Memo` to declaratively compute the overall state of the wizard.

### Architecture

- **Step Data:** Use independent `Store` or `State` signals for each step. This ensures that typing in Step 1 doesn't trigger unrelated re-evaluations for Step 2.
- **Validation:** Use `Memo` signals to derive the validity of each step. Memos automatically re-evaluate only when their specific dependencies change.
- **Wizard State Machine:** Compute the overall wizard progression (e.g., current step index, `canProceed` boolean, percentage complete) via a central `Memo`.

### Example

```typescript
import { createState, createMemo, createStore } from '@zeix/cause-effect';

// 1. Individual step states encapsulated in Stores
const step1Data = createStore({ name: '', email: '' });
const step2Data = createStore({ plan: 'basic', billing: 'monthly' });

// 2. Navigation state
const currentStep = createState(1);
const totalSteps = 2;

// 3. Step validation using derived Memos
const isStep1Valid = createMemo(() => {
  const data = step1Data.get();
  return data.name.length > 0 && data.email.includes('@');
});

const isStep2Valid = createMemo(() => {
  const data = step2Data.get();
  return ['basic', 'pro'].includes(data.plan);
});

// 4. Overall Wizard State Machine computed declaratively
const wizardState = createMemo(() => {
  const step = currentStep.get();
  
  // Conditionally track only the current step's validity
  const canProceed = step === 1 ? isStep1Valid.get() : isStep2Valid.get();
  const isComplete = step === totalSteps && canProceed;
  
  return {
    step,
    canProceed,
    isComplete,
    progress: (step / totalSteps) * 100
  };
});

// 5. Navigation Controllers
function nextStep() {
  if (wizardState.get().canProceed && currentStep.get() < totalSteps) {
    currentStep.update(s => s + 1);
  }
}

function prevStep() {
  if (currentStep.get() > 1) {
    currentStep.update(s => s - 1);
  }
}

// Usage
step1Data.set({ name: 'Alice', email: 'alice@example.com' });
console.log(wizardState.get().canProceed); // true
nextStep();
console.log(currentStep.get()); // 2
```

---

## 2. Nested Reactive Structures and Batching

Handling deeply nested reactive data inside large collections often involves two risks: poor performance and cascading updates causing inconsistent reads during intermediate states.

### The Problem

When several signals that depend on each other are updated in sequence without batching, the graph propagates each change immediately. This can cause unnecessary intermediate effect executions ("glitches") and layout thrashing as each update triggers a separate evaluation.

### The Solution: `batch()` and Granular Lists

Use a `List` to manage structural integrity (adding or removing items). `List` provides each item with its own stable `State` signal. When applying massive incoming modifications (e.g., from a server sync), wrap all mutations in a single `batch()` block. This prevents cascading effect re-runs and guarantees that the graph settles precisely *once*.

### Example

```typescript
import { createList, createMemo, createEffect, batch } from '@zeix/cause-effect';

// 1. Define a complex nested list structure using a stable key
const workspaces = createList([
  { id: 'w1', name: 'Engineering', members: ['Alice', 'Bob'], active: true },
  { id: 'w2', name: 'Design', members: ['Charlie'], active: false }
], { keyConfig: w => w.id });

// 2. Item-level memoization via deriveCollection
// This function only re-evaluates for the specific workspace that has been updated
const activeMemberCount = workspaces.deriveCollection(workspace => {
  return workspace.active ? workspace.members.length : 0;
});

const totalCount = createMemo(() => 
  activeMemberCount.get().reduce((sum, count) => sum + count, 0)
);

// 3. A robust, heavily batched transaction
function applyComplexServerSync(serverUpdates: any) {
  // batch() prevents cascading updates. Effects subscribed to the 
  // nested data will fire only ONCE after the entire batch completes.
  batch(() => {
    // A. Process structural changes (removals)
    if (serverUpdates.removed) {
      serverUpdates.removed.forEach((id: string) => {
        workspaces.remove(id);
      });
    }
    
    // B. Process granular mutations on nested item signals consistently
    if (serverUpdates.modified) {
      serverUpdates.modified.forEach((update: any) => {
        const workspaceSig = workspaces.byKey(update.id);
        if (workspaceSig) {
          // Deep update using the granular per-item State signal
          workspaceSig.update(ws => ({
            ...ws,
            members: update.newMembers
          }));
        }
      });
    }
    
    // C. Process structural changes (additions)
    if (serverUpdates.added) {
      serverUpdates.added.forEach((item: any) => {
        workspaces.add(item);
      });
    }
  });
}

// 4. Observe the result
createEffect(() => {
  console.log("Total active members:", totalCount.get());
});

// Using the batched transaction guarantees that the 
// `createEffect` above only runs one single time.
applyComplexServerSync({
  removed: ['w2'],
  modified: [
    { id: 'w1', newMembers: ['Alice', 'Bob', 'Dave'] } // +1 member
  ],
  added: [
    { id: 'w3', name: 'Marketing', members: ['Eve'], active: true } // +1 member
  ]
});
// The output jumps straight to: "Total active members: 4" without intermediate logs
```

---

## 3. Rebuilding a List from a Reactive Handler

### The Problem

An effect reads a `List` structurally — through `.keys()`, `.length`, or the iterator — and then rebuilds that same list inside its own body, typically after a `Task` resolves. The structural read links the list into the effect's dependencies. A `remove()` + `add()` loop then writes to that dependency and reverts it within the same run, which throws `EffectConvergenceError` even when the net content is unchanged.

### The Solution

Replace the content in one atomic step. `.set()` diffs the desired content against the previous value and emits a single structural change, so the effect's dependency settles once. Use `.update()` when the next content derives from the current content.

### Example

```js
// ✗ Don't: remove+add inside an effect that already depends on the list
createEffect(() => match(task, {
  ok: data => {
    for (const k of Array.from(forecast.keys())) forecast.remove(k)
    forecast.add(data)
  }
}))

// ✓ Do: .set() replaces the content in one atomic step
createEffect(() => match(task, {
  ok: data => forecast.set([data])
}))
```

The same rule applies to `Store`: prefer `.set()` over an `.remove()` + `.add()` sequence when a reactive handler owns the rebuild.

---

## 4. Async Side Effects in `match()`

### The Problem

An `ok` or `err` handler needs to do asynchronous work. Handlers may return a `Promise`, but an async handler that writes signal state creates a side-channel write: it is untracked, uncancellable, and races against newer runs of the same effect.

### The Solution

Split the two cases:

- **Fire-and-forget external work** — analytics, an IndexedDB write, a toast notification — belongs in an async handler. A cleanup function returned by the resolved `Promise` is registered and runs synchronously before the next re-run.
- **Async work that drives reactive state** belongs in a `Task`. A `Task` receives an `AbortSignal`, cancels automatically when its dependencies change, and exposes pending, resolved, and error states that compose with `nil` and `err`.

### Example

```js
// ✗ Don't: async handler that writes back into the graph
createEffect(() => match(trigger, {
  ok: async () => {
    const data = await fetch('/api/data').then(r => r.json())
    result.set(data) // ← side-channel write, not tracked, no cancellation
  }
}))

// ✓ Do: derive the async value as a Task, read it in match()
const result = createTask(async (_, signal) =>
  fetch('/api/data', { signal }).then(r => r.json()))

createEffect(() => match(result, {
  ok: data => render(data),
  nil: () => showSpinner(),
  err: e => showError(e)
}))
```

### Stale-run rejections still reach `err`

When a signal changes and the effect re-runs, the in-flight async handler from the previous run cannot be cancelled — the library did not initiate the underlying operation. If that stale operation later rejects, `err` runs even though a newer run is already active.

This is a second reason to keep async handlers free of state writes. Routing errors to `err` is safe while `err` is a pure side effect such as logging or showing a notification. It becomes incorrect once `err` calls `.set()` on a signal that the newer run has already updated.

---

## 5. Lazy Resources with Watched Callbacks

### The Problem

An event listener, a WebSocket, or a `MutationObserver` should exist only while something actually reads the data it produces. Creating it eagerly wastes a connection; tearing it down at the wrong moment drops updates.

### The Architecture

`Sensor` and `Collection` take a watched callback as their first argument. `Store` and `List` accept one as the `watched` option. In every case the callback runs when an effect first reads the signal, and its returned cleanup runs when no effect watches it any more.

`Memo` and `Task` also accept `watched`, but their callback receives an `invalidate` function instead. This activates a computed signal that must react to an external event as well as to its tracked dependencies.

### Example

```js
import { createSensor, createCollection, createEffect } from '@zeix/cause-effect'

// Sensor: track external input
const windowSize = createSensor((set) => {
  const update = () => set({ w: innerWidth, h: innerHeight })
  update()
  window.addEventListener('resize', update)
  return () => window.removeEventListener('resize', update)
})

// Collection: receive external data
const feed = createCollection((applyChanges) => {
  const es = new EventSource('/feed')
  es.onmessage = (e) => applyChanges(JSON.parse(e.data))
  return () => es.close()
}, { keyConfig: item => item.id })

// Resources are created only when the effect runs
const cleanup = createEffect(() => {
  console.log('Window size:', windowSize.get())
  console.log('Feed items:', feed.get())
})

// Resources are cleaned up when the effect stops
cleanup()
```

### Propagation through `deriveCollection()`

When an effect reads a derived collection, the `watched` callback on the source List, Store, or Collection activates automatically, through any number of chained levels. Mutating the source does not tear the resource down. When the last effect disposes, cleanup cascades upstream through every intermediate node.

### Activation timing: conditional reads delay it

Dependencies are tracked from the `.get()` calls that actually execute. A read inside a branch that has not run yet — for example inside `match()`'s `ok` branch while a Task is still pending — does not activate `watched` until that branch runs. Read signals eagerly, before the conditional logic, when you need immediate activation:

```js
createEffect(() => {
  match([task, derived], { // derived is always tracked
    ok: ([result, values]) => renderList(values, result),
    nil: () => showLoading(),
  })
})
```

### The `invalidate` pattern

```js
const changes = createMemo((prev) => {
  const next = new Set(parent.querySelectorAll(selector))
  // ... diff prev vs next ...
  return { current: next, added, removed }
}, {
  value: { current: new Set(), added: [], removed: [] },
  watched: (invalidate) => {
    const observer = new MutationObserver(() => invalidate())
    observer.observe(parent, { childList: true, subtree: true })
    return () => observer.disconnect()
  }
})
```

This pattern suits:

- Event listeners that should be active only while data is watched
- Network connections that can be established lazily
- Expensive computations that should pause when nothing needs them
- External subscriptions such as WebSocket or Server-Sent Events
- Computed signals that must react to external events like DOM mutations or timers

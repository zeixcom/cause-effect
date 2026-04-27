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

When multiple dependent signals are updated sequentially without batching, the graph propagates changes immediately. This can cause unnecessary intermediate effect executions ("glitches") and layout thrashing as each update triggers a separate evaluation.

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

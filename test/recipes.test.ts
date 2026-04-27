import { describe, test, expect } from "bun:test";
import { createState, createMemo, createStore, createList, batch, createEffect } from "../index";

describe("Recipes", () => {
  test("Multi-Step Wizard Pattern", () => {
    const step1Data = createStore({ name: '', email: '' });
    const step2Data = createStore({ plan: 'basic', billing: 'monthly' });

    const currentStep = createState(1);
    const totalSteps = 2;

    const isStep1Valid = createMemo(() => {
      const data = step1Data.get();
      return data.name.length > 0 && data.email.includes('@');
    });

    const isStep2Valid = createMemo(() => {
      const data = step2Data.get();
      return ['basic', 'pro'].includes(data.plan);
    });

    const wizardState = createMemo(() => {
      const step = currentStep.get();
      const canProceed = step === 1 ? isStep1Valid.get() : isStep2Valid.get();
      const isComplete = step === totalSteps && canProceed;
      
      return {
        step,
        canProceed,
        isComplete,
        progress: (step / totalSteps) * 100
      };
    });

    function nextStep() {
      if (wizardState.get().canProceed && currentStep.get() < totalSteps) {
        currentStep.update(s => s + 1);
      }
    }

    expect(wizardState.get()).toEqual({ step: 1, canProceed: false, isComplete: false, progress: 50 });
    
    nextStep();
    expect(currentStep.get()).toBe(1);

    step1Data.set({ name: 'Alice', email: 'alice@example.com' });
    expect(wizardState.get()).toEqual({ step: 1, canProceed: true, isComplete: false, progress: 50 });

    nextStep();
    expect(currentStep.get()).toBe(2);
    expect(wizardState.get()).toEqual({ step: 2, canProceed: true, isComplete: true, progress: 100 });
  });

  test("Nested Reactive Structures and Batching", () => {
    let effectCount = 0;
    
    const workspaces = createList([
      { id: 'w1', name: 'Engineering', members: ['Alice', 'Bob'], active: true },
      { id: 'w2', name: 'Design', members: ['Charlie'], active: false }
    ], { keyConfig: w => w.id });

    const activeMemberCount = workspaces.deriveCollection(workspace => {
      return workspace.active ? workspace.members.length : 0;
    });
    
    function applyComplexServerSync(serverUpdates: any) {
      batch(() => {
        if (serverUpdates.removed) {
          serverUpdates.removed.forEach((id: string) => {
            workspaces.remove(id);
          });
        }
        
        if (serverUpdates.modified) {
          serverUpdates.modified.forEach((update: any) => {
            const workspaceSig = workspaces.byKey(update.id);
            if (workspaceSig) {
              workspaceSig.update(ws => ({
                ...ws,
                members: update.newMembers
              }));
            }
          });
        }
        
        if (serverUpdates.added) {
          serverUpdates.added.forEach((item: any) => {
            workspaces.add(item);
          });
        }
      });
    }

    const totalCount = createMemo(() => 
      activeMemberCount.get().reduce((sum, count) => sum + count, 0)
    );

    const cleanup = createEffect(() => {
      totalCount.get();
      effectCount++;
    });

    expect(totalCount.get()).toBe(2);
    expect(effectCount).toBe(1);

    applyComplexServerSync({
      removed: ['w2'],
      modified: [
        { id: 'w1', newMembers: ['Alice', 'Bob', 'Dave'] }
      ],
      added: [
        { id: 'w3', name: 'Marketing', members: ['Eve'], active: true }
      ]
    });

    expect(totalCount.get()).toBe(4);
    expect(effectCount).toBe(2);
    
    cleanup();
  });
});

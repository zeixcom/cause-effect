import type { DiffResult, UnknownRecord } from '../diff';
import type { Signal } from '../signal';
import { type Cleanup, type HookCallback } from '../system';
type CompositeHook = 'add' | 'change' | 'remove';
declare class Composite<T extends UnknownRecord, S extends Signal<T[keyof T] & {}>> {
    #private;
    signals: Map<string, S>;
    constructor(values: T, validate: <K extends keyof T & string>(key: K, value: unknown) => value is T[K] & {}, create: <V extends T[keyof T] & {}>(value: V) => S);
    add<K extends keyof T & string>(key: K, value: T[K]): boolean;
    remove<K extends keyof T & string>(key: K): boolean;
    change(changes: DiffResult, initialRun?: boolean): boolean;
    clear(): boolean;
    on(type: CompositeHook, callback: HookCallback): Cleanup;
}
export { Composite, type CompositeHook as CompositeListeners };

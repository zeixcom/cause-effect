import type { DiffResult, UnknownRecord } from '../diff';
import type { Signal } from '../signal';
import { type Cleanup, type Listener, type Listeners } from '../system';
type CompositeListeners = Pick<Listeners, 'add' | 'change' | 'remove'>;
declare class Composite<T extends UnknownRecord, S extends Signal<T[keyof T] & {}>> {
    #private;
    signals: Map<string, S>;
    constructor(values: T, validate: <K extends keyof T & string>(key: K, value: unknown) => value is T[K] & {}, create: <V extends T[keyof T] & {}>(value: V) => S);
    add<K extends keyof T & string>(key: K, value: T[K]): boolean;
    remove<K extends keyof T & string>(key: K): boolean;
    change(changes: DiffResult, initialRun?: boolean): boolean;
    clear(): boolean;
    on<K extends keyof CompositeListeners>(type: K, listener: Listener<K>): Cleanup;
}
export { Composite, type CompositeListeners };

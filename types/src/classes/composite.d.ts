import type { DiffResult, UnknownRecord } from '../diff';
import { type MutableSignal } from '../signal';
import { type Cleanup, type Listener, type Listeners } from '../system';
type CompositeListeners = Pick<Listeners, 'add' | 'change' | 'remove'>;
declare class MutableComposite<T extends UnknownRecord> {
    #private;
    constructor(values: T, validate: <K extends keyof T & string>(key: K, value: unknown) => value is T[K] & {});
    keys(): IterableIterator<string>;
    values(): IterableIterator<MutableSignal<T[keyof T] & {}>>;
    entries(): IterableIterator<[string, MutableSignal<T[keyof T] & {}>]>;
    has(key: string): boolean;
    get<K extends keyof T & string>(key: K): MutableSignal<T[K] & {}> | undefined;
    add<K extends keyof T & string>(key: K, value: T[K]): boolean;
    remove<K extends keyof T & string>(key: K): boolean;
    change(changes: DiffResult, initialRun?: boolean): boolean;
    clear(): boolean;
    on<K extends keyof CompositeListeners>(type: K, listener: Listener<K>): Cleanup;
}
export { MutableComposite };

import { type Computed } from './classes/computed';
import { type List } from './classes/list';
import { State } from './classes/state';
import { type Store } from './classes/store';
import type { UnknownRecord } from './diff';
type Signal<T extends {}> = {
    get(): T;
};
type MutableSignal<T extends {}> = T extends readonly (infer U extends {})[] ? List<U> : T extends Record<string, unknown> ? Store<T & Record<string, unknown & {}>> : State<T>;
type ReadonlySignal<T extends {}> = Computed<T>;
type UnknownSignalRecord = Record<string, Signal<unknown & {}>>;
type SignalValues<S extends UnknownSignalRecord> = {
    [K in keyof S]: S[K] extends Signal<infer T> ? T : never;
};
/**
 * Check whether a value is a Signal
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a Signal, false otherwise
 */
declare const isSignal: <T extends {}>(value: unknown) => value is Signal<T>;
/**
 * Check whether a value is a State, Store, or List
 *
 * @since 0.15.2
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if value is a State, Store, or List, false otherwise
 */
declare const isMutableSignal: (value: unknown) => value is MutableSignal<unknown & {}>;
/**
 * Convert a value to a Signal.
 *
 * @since 0.9.6
 */
declare function createSignal<T extends {}>(value: readonly T[]): List<T>;
declare function createSignal<T extends {}>(value: T[]): List<T>;
declare function createSignal<T extends UnknownRecord>(value: T): Store<T>;
declare function createSignal<T extends {}>(value: () => T): Computed<T>;
declare function createSignal<T extends {}>(value: T): State<T>;
/**
 * Convert a value to a MutableSignal.
 *
 * @since 0.17.0
 */
declare function createMutableSignal<T extends {}>(value: readonly T[]): List<T>;
declare function createMutableSignal<T extends {}>(value: T[]): List<T>;
declare function createMutableSignal<T extends UnknownRecord>(value: T): Store<T>;
declare function createMutableSignal<T extends {}>(value: T): State<T>;
export { createMutableSignal, createSignal, isMutableSignal, isSignal, type MutableSignal, type ReadonlySignal, type Signal, type SignalValues, type UnknownSignalRecord, };

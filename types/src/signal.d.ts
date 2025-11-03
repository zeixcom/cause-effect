import { type Computed, type ComputedCallback } from './computed';
import { type State } from './state';
import { type Store } from './store';
type Signal<T extends {}> = {
    get(): T;
};
type MaybeSignal<T extends {}> = T | Signal<T> | ComputedCallback<T>;
type SignalValues<S extends Record<string, Signal<unknown & {}>>> = {
    [K in keyof S]: S[K] extends Signal<infer T> ? T : never;
};
declare const UNSET: any;
/**
 * Check whether a value is a Signal or not
 *
 * @since 0.9.0
 * @param {unknown} value - value to check
 * @returns {boolean} - true if value is a Signal, false otherwise
 */
declare const isSignal: <T extends {}>(value: unknown) => value is Signal<T>;
/**
 * Convert a value to a Signal if it's not already a Signal
 *
 * @since 0.9.6
 */
declare function toSignal<T extends Array<unknown & {}>>(value: T[]): Store<Record<string, T>>;
declare function toSignal<T extends Record<keyof T, T[keyof T]>>(value: T): Store<T>;
declare function toSignal<T extends {}>(value: ComputedCallback<T>): Computed<T>;
declare function toSignal<T extends {}>(value: Signal<T>): Signal<T>;
declare function toSignal<T extends {}>(value: T): State<T>;
/**
 * Convert a value to a mutable Signal if it's not already a Signal
 *
 * @since 0.9.6
 */
declare function toMutableSignal<T extends Array<unknown & {}>>(value: T[]): Store<Record<string, T>>;
declare function toMutableSignal<T extends Record<keyof T, T[keyof T]>>(value: T): Store<T>;
declare function toMutableSignal<T extends State<T>>(value: State<T>): State<T>;
declare function toMutableSignal<T extends Store<T>>(value: Store<T>): Store<T>;
declare function toMutableSignal<T extends {}>(value: T): State<T>;
export { type Signal, type MaybeSignal, type SignalValues, UNSET, isSignal, toSignal, toMutableSignal, };

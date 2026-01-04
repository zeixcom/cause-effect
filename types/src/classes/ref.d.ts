import { type Guard } from '../errors';
import { type Cleanup, type HookCallback, type WatchHook } from '../system';
declare const TYPE_REF = "Ref";
/**
 * Create a new ref signal.
 *
 * @since 0.17.1
 */
declare class Ref<T extends {}> {
    #private;
    /**
     * Create a new ref signal.
     *
     * @param {T} value - Reference to external object
     * @param {Guard<T>} guard - Optional guard function to validate the value
     * @throws {NullishSignalValueError} - If the value is null or undefined
     * @throws {InvalidSignalValueError} - If the value is invalid
     */
    constructor(value: T, guard?: Guard<T>);
    get [Symbol.toStringTag](): string;
    /**
     * Get the value of the ref signal.
     *
     * @returns {T} - Object reference
     */
    get(): T;
    /**
     * Notify watchers of relevant changes in the external reference.
     */
    notify(): void;
    /**
     * Register a callback to be called when HOOK_WATCH is triggered.
     *
     * @param {WatchHook} type - The type of hook to register the callback for; only HOOK_WATCH is supported
     * @param {HookCallback} callback - The callback to register
     * @returns {Cleanup} - A function to unregister the callback
     */
    on(type: WatchHook, callback: HookCallback): Cleanup;
}
/**
 * Check if the provided value is a Ref instance
 *
 * @since 0.17.1
 * @param {unknown} value - Value to check
 * @returns {boolean} - True if the value is a Ref instance, false otherwise
 */
declare const isRef: <T extends {}>(value: unknown) => value is Ref<T>;
export { TYPE_REF, Ref, isRef };

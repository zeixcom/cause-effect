import { type Guard } from '../errors';
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
     * Notify watchers of relevant changes in the external reference
     */
    notify(): void;
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
